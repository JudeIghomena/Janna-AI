import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import OpenAI from 'openai';
import pino from 'pino';
import { extractTextFromPDF } from './extractors/pdf';
import { extractTextFromDOCX } from './extractors/docx';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
});

const prisma = new PrismaClient();

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
  ...(process.env.AWS_ENDPOINT_URL
    ? { endpoint: process.env.AWS_ENDPOINT_URL, forcePathStyle: true }
    : {}),
});

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// ─── Text chunking ────────────────────────────────────────────────────────────
function chunkText(
  text: string,
  chunkSize = 800,
  overlap = 100
): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }
    start += chunkSize - overlap;
  }
  return chunks;
}

export interface IngestionJob {
  attachmentId: string;
  s3Key: string;
  mimeType: string;
  userId: string;
}

export async function processAttachment(job: IngestionJob): Promise<void> {
  const { attachmentId, s3Key, mimeType, userId } = job;

  logger.info({ attachmentId, mimeType }, 'Processing attachment');

  try {
    // Mark as processing
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { status: 'processing' },
    });

    // Download from S3
    const cmd = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME ?? 'janna-attachments-dev',
      Key: s3Key,
    });
    const response = await s3.send(cmd);

    if (!response.Body) {
      throw new Error('No body in S3 response');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    // @ts-expect-error - AWS SDK stream
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Extract text
    let text = '';
    if (mimeType === 'application/pdf') {
      text = await extractTextFromPDF(buffer);
    } else if (
      mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      text = await extractTextFromDOCX(buffer);
    } else if (mimeType.startsWith('text/')) {
      text = buffer.toString('utf-8');
    } else if (mimeType.startsWith('image/')) {
      // Images: store a placeholder — future: use vision model for description
      text = `[Image file: ${s3Key.split('/').pop()}]`;
    } else {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }

    if (!text.trim()) {
      throw new Error('No text could be extracted from document');
    }

    logger.info(
      { attachmentId, textLength: text.length },
      'Text extracted, chunking'
    );

    // Chunk text
    const textChunks = chunkText(text);
    logger.info(
      { attachmentId, chunkCount: textChunks.length },
      'Chunks created, computing embeddings'
    );

    // Batch embed (OpenAI allows up to 2048 inputs)
    const EMBED_BATCH_SIZE = 100;
    let chunkIndex = 0;

    for (let i = 0; i < textChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = textChunks.slice(i, i + EMBED_BATCH_SIZE);
      const embedResponse = await getOpenAI().embeddings.create({
        model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
        input: batch,
        dimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 1536),
      });

      // Store each chunk with its embedding
      for (let j = 0; j < batch.length; j++) {
        const embedding = embedResponse.data[j].embedding;
        const pgEmbedding = `[${embedding.join(',')}]`;
        const id = `chunk_${attachmentId}_${chunkIndex}`;

        await prisma.$executeRawUnsafe(
          `INSERT INTO document_chunks (id, "attachmentId", "chunkIndex", content, embedding, metadata, "createdAt")
           VALUES ($1, $2, $3, $4, $5::vector, $6, NOW())
           ON CONFLICT (id) DO UPDATE SET content=$4, embedding=$5::vector`,
          id,
          attachmentId,
          chunkIndex,
          batch[j],
          pgEmbedding,
          JSON.stringify({ source: s3Key, chunkStart: i + j })
        );

        chunkIndex++;
      }

      logger.info(
        {
          attachmentId,
          progress: `${Math.min(i + EMBED_BATCH_SIZE, textChunks.length)}/${textChunks.length}`,
        },
        'Embedding batch done'
      );
    }

    // Mark as ready
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { status: 'ready' },
    });

    logger.info(
      { attachmentId, chunkCount: chunkIndex },
      'Attachment processing complete'
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ attachmentId, error: errorMessage }, 'Processing failed');

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        status: 'error',
        errorMessage: errorMessage.slice(0, 500),
      },
    });

    throw err;
  }
}
