import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { retrieveRelevantChunks } from '../services/ragService';
import { prisma } from '../lib/prisma';

export async function ragRoutes(fastify: FastifyInstance) {
  // POST /api/rag/search
  fastify.post(
    '/rag/search',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bodySchema = z.object({
        query: z.string().min(1).max(1000),
        topK: z.number().int().min(1).max(20).optional().default(5),
        attachmentIds: z.array(z.string()).optional(),
        similarityThreshold: z.number().min(0).max(1).optional(),
      });

      const body = bodySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid body', code: 'VALIDATION_ERROR' });
      }

      const result = await retrieveRelevantChunks(
        body.data.query,
        request.userId,
        body.data.attachmentIds,
        body.data.topK,
        body.data.similarityThreshold
      );

      return reply.send(result);
    }
  );

  // GET /api/rag/status  → chunk counts per attachment
  fastify.get(
    '/rag/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rows = await prisma.attachment.findMany({
        where: { userId: request.userId, status: 'ready' },
        select: {
          id: true,
          filename: true,
          _count: { select: { chunks: true } },
        },
      });

      return reply.send(
        rows.map((r) => ({
          attachmentId: r.id,
          filename: r.filename,
          chunkCount: r._count.chunks,
        }))
      );
    }
  );
}
