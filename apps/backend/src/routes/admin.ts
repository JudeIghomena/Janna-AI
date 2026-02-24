import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../plugins/auth';

export async function adminRoutes(fastify: FastifyInstance) {
  // All admin routes require admin role
  fastify.addHook('preHandler', requireAdmin);

  // GET /api/admin/metrics
  fastify.get(
    '/admin/metrics',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeUsers24h,
        totalConversations,
        totalMessages,
        usageSummary,
        topModels,
        dailyRaw,
      ] = await Promise.all([
        prisma.userProfile.count(),
        prisma.usageEvent.groupBy({
          by: ['userId'],
          where: { createdAt: { gte: yesterday } },
        }).then((r) => r.length),
        prisma.conversation.count(),
        prisma.message.count(),
        prisma.usageEvent.aggregate({
          _sum: {
            promptTokens: true,
            completionTokens: true,
            costEstimate: true,
          },
        }),
        prisma.usageEvent.groupBy({
          by: ['modelId'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        prisma.$queryRaw<
          Array<{
            date: string;
            messages: bigint;
            tokens: bigint;
          }>
        >`
          SELECT
            DATE_TRUNC('day', "createdAt")::text AS date,
            COUNT(*) AS messages,
            SUM("promptTokens" + "completionTokens") AS tokens
          FROM usage_events
          WHERE "createdAt" >= ${thirtyDaysAgo}
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY DATE_TRUNC('day', "createdAt")
        `,
      ]);

      return reply.send({
        totalUsers,
        activeUsers24h,
        totalConversations,
        totalMessages,
        totalTokensUsed:
          (usageSummary._sum.promptTokens ?? 0) +
          (usageSummary._sum.completionTokens ?? 0),
        estimatedCostUsd: Number(
          (usageSummary._sum.costEstimate ?? 0).toFixed(4)
        ),
        topModels: topModels.map((m) => ({
          modelId: m.modelId,
          count: m._count.id,
        })),
        dailyUsage: dailyRaw.map((d) => ({
          date: d.date.slice(0, 10),
          messages: Number(d.messages),
          tokens: Number(d.tokens),
        })),
      });
    }
  );

  // GET /api/admin/users
  fastify.get(
    '/admin/users',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
      });

      const query = querySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({ error: 'Invalid query', code: 'VALIDATION_ERROR' });
      }

      const { page, pageSize, search } = query.data;
      const skip = (page - 1) * pageSize;

      const where = search
        ? { email: { contains: search, mode: 'insensitive' as const } }
        : {};

      const [users, total] = await Promise.all([
        prisma.userProfile.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            disabled: true,
            _count: { select: { usageEvents: true } },
            usageEvents: {
              select: {
                promptTokens: true,
                completionTokens: true,
              },
            },
          },
        }),
        prisma.userProfile.count({ where }),
      ]);

      return reply.send({
        data: users.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          disabled: u.disabled,
          createdAt: u.createdAt.toISOString(),
          messageCount: u._count.usageEvents,
          tokenCount: u.usageEvents.reduce(
            (sum, e) => sum + e.promptTokens + e.completionTokens,
            0
          ),
        })),
        total,
        page,
        pageSize,
        hasMore: skip + users.length < total,
      });
    }
  );

  // POST /api/admin/users/:id/disable
  fastify.post(
    '/admin/users/:id/disable',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const user = await prisma.userProfile.findUnique({
        where: { id: request.params.id },
        select: { id: true, role: true },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' });
      }

      if (user.role === 'admin') {
        return reply.status(403).send({
          error: 'Cannot disable admin users',
          code: 'FORBIDDEN',
        });
      }

      await prisma.userProfile.update({
        where: { id: request.params.id },
        data: { disabled: true },
      });

      return reply.send({ ok: true });
    }
  );

  // POST /api/admin/users/:id/enable
  fastify.post(
    '/admin/users/:id/enable',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const user = await prisma.userProfile.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' });
      }

      await prisma.userProfile.update({
        where: { id: request.params.id },
        data: { disabled: false },
      });

      return reply.send({ ok: true });
    }
  );

  // POST /api/admin/users/:id/set-role
  fastify.post(
    '/admin/users/:id/set-role',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const bodySchema = z.object({
        role: z.enum(['user', 'admin']),
      });
      const body = bodySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid body', code: 'VALIDATION_ERROR' });
      }

      await prisma.userProfile.update({
        where: { id: request.params.id },
        data: { role: body.data.role },
      });

      return reply.send({ ok: true });
    }
  );
}
