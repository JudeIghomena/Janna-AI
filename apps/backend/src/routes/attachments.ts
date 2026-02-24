import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  buildS3Key,
} from '../services/s3Service';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { config } from '../config';
import crypto from 'crypto';

const ALLOWED_TYPES = config.ALLOWED_MIME_TYPES.split(',').map((t) => t.trim());
const MAX_BYTES = config.MAX_FILE_SIZE_MB * 1024 * 1024;

let sqsClient: SQSClient | null = null;
function getSQS(): SQSClient {
  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: config.AWS_REGION,
      ...(config.AWS_ENDPOINT_URL ? { endpoint: config.AWS_ENDPOINT_URL } : {}),
    });
  }
  return sqsClient;
}

export async function attachmentsRoutes(fastify: FastifyInstance) {
  // POST /api/attachments/presign  → returns presigned upload URL
  fastify.post(
    '/attachments/presign',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bodySchema = z.object({
        filename: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(100),
        size: z.number().int().positive().max(MAX_BYTES),
        conversationId: z.string().cuid().optional(),
      });

      const body = bodySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid body', code: 'VALIDATION_ERROR' });
      }

      const { filename, mimeType, size, conversationId } = body.data;

      if (!ALLOWED_TYPES.includes(mimeType)) {
        return reply.status(415).send({
          error: `File type not allowed: ${mimeType}`,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          allowedTypes: ALLOWED_TYPES,
        });
      }

      if (conversationId) {
        const conv = await prisma.conversation.findFirst({
          where: { id: conversationId, userId: request.userId },
          select: { id: true },
        });
        if (!conv) {
          return reply.status(404).send({ error: 'Conversation not found', code: 'NOT_FOUND' });
        }
      }

      const attachmentId = crypto.randomUUID();
      const s3Key = buildS3Key(request.userId, attachmentId, filename);

      // Create attachment record
      await prisma.attachment.create({
        data: {
          id: attachmentId,
          userId: request.userId,
          conversationId: conversationId ?? null,
          filename,
          mimeType,
          size,
          s3Key,
          status: 'pending',
        },
      });

      const uploadUrl = await generatePresignedUploadUrl(s3Key, mimeType, size);

      return reply.status(201).send({
        uploadUrl,
        s3Key,
        attachmentId,
      });
    }
  );

  // POST /api/attachments/complete  → mark upload done, enqueue processing
  fastify.post(
    '/attachments/complete',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bodySchema = z.object({
        attachmentId: z.string().uuid(),
      });

      const body = bodySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid body', code: 'VALIDATION_ERROR' });
      }

      const attachment = await prisma.attachment.findFirst({
        where: { id: body.data.attachmentId, userId: request.userId },
        select: { id: true, s3Key: true, mimeType: true, status: true },
      });

      if (!attachment) {
        return reply.status(404).send({ error: 'Attachment not found', code: 'NOT_FOUND' });
      }

      if (attachment.status !== 'pending') {
        return reply.status(409).send({
          error: 'Attachment already processed',
          code: 'CONFLICT',
        });
      }

      // Mark as processing
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: { status: 'processing' },
      });

      // Enqueue ingestion job
      if (config.SQS_INGESTION_QUEUE_URL) {
        try {
          const sqs = getSQS();
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: config.SQS_INGESTION_QUEUE_URL,
              MessageBody: JSON.stringify({
                attachmentId: attachment.id,
                s3Key: attachment.s3Key,
                mimeType: attachment.mimeType,
                userId: request.userId,
              }),
              MessageGroupId: request.userId, // FIFO ordering per user
            })
          );
        } catch (err) {
          fastify.log.error({ err }, 'Failed to enqueue ingestion job');
          // Still return success; worker will retry
        }
      } else {
        // Dev mode: no SQS, mark ready
        await prisma.attachment.update({
          where: { id: attachment.id },
          data: { status: 'ready' },
        });
      }

      return reply.send({ attachmentId: attachment.id, status: 'processing' });
    }
  );

  // GET /api/attachments/:id
  fastify.get(
    '/attachments/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const attachment = await prisma.attachment.findFirst({
        where: { id: request.params.id, userId: request.userId },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
          s3Key: true,
        },
      });

      if (!attachment) {
        return reply.status(404).send({ error: 'Attachment not found', code: 'NOT_FOUND' });
      }

      // Generate download URL for ready attachments
      let downloadUrl: string | undefined;
      if (attachment.status === 'ready') {
        downloadUrl = await generatePresignedDownloadUrl(attachment.s3Key);
      }

      return reply.send({
        id: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        status: attachment.status,
        errorMessage: attachment.errorMessage,
        createdAt: attachment.createdAt.toISOString(),
        updatedAt: attachment.updatedAt.toISOString(),
        downloadUrl,
      });
    }
  );

  // GET /api/attachments  → list user's attachments
  fastify.get(
    '/attachments',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        conversationId: z.string().cuid().optional(),
        status: z.enum(['pending', 'processing', 'ready', 'error']).optional(),
      });

      const query = querySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({ error: 'Invalid query', code: 'VALIDATION_ERROR' });
      }

      const attachments = await prisma.attachment.findMany({
        where: {
          userId: request.userId,
          ...(query.data.conversationId ? { conversationId: query.data.conversationId } : {}),
          ...(query.data.status ? { status: query.data.status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          status: true,
          createdAt: true,
        },
      });

      return reply.send(
        attachments.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))
      );
    }
  );

  // DELETE /api/attachments/:id
  fastify.delete(
    '/attachments/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const attachment = await prisma.attachment.findFirst({
        where: { id: request.params.id, userId: request.userId },
        select: { id: true },
      });

      if (!attachment) {
        return reply.status(404).send({ error: 'Attachment not found', code: 'NOT_FOUND' });
      }

      await prisma.attachment.delete({ where: { id: attachment.id } });
      return reply.status(204).send();
    }
  );
}
