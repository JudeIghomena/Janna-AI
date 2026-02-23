// ============================================================
// Ingestion Worker - Processes uploaded files via SQS
// Extracts text, chunks, embeds, and stores in pgvector
// ============================================================
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { prisma } from "../db/client";
import { getS3Object } from "../lib/s3";
import { chunkText, computeEmbeddings } from "../services/embeddingService";
import { config } from "../config";
import type { IngestionJob } from "../lib/sqs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

const sqs = new SQSClient({ region: config.AWS_REGION });

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case "application/pdf": {
      const data = await pdfParse(buffer);
      return data.text;
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "text/plain":
    case "text/markdown":
      return buffer.toString("utf-8");
    case "image/png":
    case "image/jpeg":
    case "image/gif":
    case "image/webp":
      return "[Image file - text extraction not supported]";
    default:
      return buffer.toString("utf-8");
  }
}

async function processJob(job: IngestionJob): Promise<void> {
  console.info(`[Worker] Processing attachment ${job.attachmentId}`);

  // Mark as processing
  await prisma.attachment.update({
    where: { id: job.attachmentId },
    data: { status: "PROCESSING" },
  });

  try {
    // 1) Download from S3
    const buffer = await getS3Object(job.s3Key);

    // 2) Extract text
    const text = await extractText(buffer, job.mimeType);

    // 3) Chunk
    const chunks = chunkText(text);
    console.info(`[Worker] ${job.attachmentId}: ${chunks.length} chunks`);

    // 4) Embed
    const embeddings = await computeEmbeddings(chunks);

    // 5) Store chunks in DB
    await prisma.$transaction(async (tx) => {
      // Delete existing chunks if re-processing
      await tx.documentChunk.deleteMany({
        where: { attachmentId: job.attachmentId },
      });

      for (let i = 0; i < chunks.length; i++) {
        const embeddingArr = embeddings[i];
        const vectorLiteral = `[${embeddingArr.join(",")}]`;

        await tx.$executeRaw`
          INSERT INTO document_chunks (id, attachment_id, chunk_index, content, embedding, metadata, created_at)
          VALUES (
            gen_random_uuid()::text,
            ${job.attachmentId},
            ${i},
            ${chunks[i]},
            ${vectorLiteral}::vector,
            '{}',
            NOW()
          )
        `;
      }
    });

    // 6) Mark ready
    await prisma.attachment.update({
      where: { id: job.attachmentId },
      data: { status: "READY" },
    });

    console.info(`[Worker] Attachment ${job.attachmentId} processed successfully`);
  } catch (err) {
    console.error(`[Worker] Failed to process ${job.attachmentId}:`, err);
    await prisma.attachment.update({
      where: { id: job.attachmentId },
      data: { status: "FAILED" },
    });
    throw err;
  }
}

async function pollQueue(): Promise<void> {
  if (!config.SQS_INGESTION_QUEUE_URL) {
    console.warn("[Worker] No SQS queue URL - running in dev mode (inline processing)");
    return;
  }

  console.info("[Worker] Starting SQS poll loop");

  while (true) {
    try {
      const response = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: config.SQS_INGESTION_QUEUE_URL,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 20,
          VisibilityTimeout: 300,
        })
      );

      if (!response.Messages || response.Messages.length === 0) continue;

      await Promise.allSettled(
        response.Messages.map(async (msg) => {
          try {
            const job = JSON.parse(msg.Body ?? "{}") as IngestionJob;
            await processJob(job);

            await sqs.send(
              new DeleteMessageCommand({
                QueueUrl: config.SQS_INGESTION_QUEUE_URL!,
                ReceiptHandle: msg.ReceiptHandle!,
              })
            );
          } catch (err) {
            console.error("[Worker] Failed message:", err);
            // Message becomes visible again after VisibilityTimeout
          }
        })
      );
    } catch (err) {
      console.error("[Worker] Poll error:", err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Export for inline dev processing
export { processJob };

// Main entry point
if (require.main === module) {
  pollQueue().catch((err) => {
    console.error("[Worker] Fatal:", err);
    process.exit(1);
  });
}
