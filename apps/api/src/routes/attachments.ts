import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client";
import { requireAuth } from "../middleware/auth";
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  buildS3Key,
} from "../lib/s3";
import { enqueueIngestionJob } from "../lib/sqs";
import { processJob } from "../workers/ingestionWorker";
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from "@janna/shared";
import { config } from "../config";

const presignSchema = z.object({
  filename: z.string().max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES as [string, ...string[]]),
  size: z.number().int().min(1).max(MAX_ATTACHMENT_SIZE_BYTES),
  conversationId: z.string().optional(),
});

const completeSchema = z.object({
  attachmentId: z.string(),
});

export async function attachmentRoutes(app: FastifyInstance) {
  // POST /api/attachments/presign
  app.post(
    "/api/attachments/presign",
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = presignSchema.parse(request.body);
      const s3Key = buildS3Key(request.user.id, body.filename);

      // Create attachment record
      const attachment = await prisma.attachment.create({
        data: {
          userId: request.user.id,
          conversationId: body.conversationId ?? null,
          filename: body.filename,
          mimeType: body.mimeType,
          size: body.size,
          s3Key,
          status: "UPLOADING",
        },
      });

      const uploadUrl = await generatePresignedUploadUrl(
        s3Key,
        body.mimeType,
        body.size
      );

      return reply.status(201).send({
        attachmentId: attachment.id,
        uploadUrl,
        s3Key,
        expiresIn: config.S3_PRESIGN_EXPIRY_SECONDS,
      });
    }
  );

  // POST /api/attachments/complete
  app.post(
    "/api/attachments/complete",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { attachmentId } = completeSchema.parse(request.body);

      const attachment = await prisma.attachment.findFirst({
        where: { id: attachmentId, userId: request.user.id },
      });
      if (!attachment) return reply.status(404).send({ error: "Not found" });

      // Enqueue processing
      if (config.SQS_INGESTION_QUEUE_URL) {
        await enqueueIngestionJob({
          attachmentId: attachment.id,
          s3Key: attachment.s3Key,
          mimeType: attachment.mimeType,
          userId: attachment.userId,
        });
        await prisma.attachment.update({
          where: { id: attachmentId },
          data: { status: "PROCESSING" },
        });
      } else {
        // Dev mode: process inline (async, don't await)
        processJob({
          attachmentId: attachment.id,
          s3Key: attachment.s3Key,
          mimeType: attachment.mimeType,
          userId: attachment.userId,
        }).catch((err) =>
          console.error("[Dev] Inline processing failed:", err)
        );
        await prisma.attachment.update({
          where: { id: attachmentId },
          data: { status: "PROCESSING" },
        });
      }

      return reply.send({ attachmentId, status: "PROCESSING" });
    }
  );

  // GET /api/attachments/:id
  app.get(
    "/api/attachments/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const attachment = await prisma.attachment.findFirst({
        where: { id, userId: request.user.id },
      });
      if (!attachment) return reply.status(404).send({ error: "Not found" });

      const downloadUrl = await generatePresignedDownloadUrl(attachment.s3Key);
      return reply.send({ ...attachment, downloadUrl });
    }
  );

  // GET /api/attachments - List user's attachments
  app.get(
    "/api/attachments",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { conversationId } = request.query as { conversationId?: string };
      const attachments = await prisma.attachment.findMany({
        where: {
          userId: request.user.id,
          ...(conversationId ? { conversationId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return reply.send({ data: attachments });
    }
  );
}
