import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import { requireAdmin } from "../middleware/auth";

export async function adminRoutes(app: FastifyInstance) {
  // GET /api/admin/metrics
  app.get(
    "/api/admin/metrics",
    { preHandler: requireAdmin },
    async (_req, reply) => {
      const [
        totalUsers,
        totalConversations,
        totalMessages,
        usageAggregate,
        activeToday,
      ] = await Promise.all([
        prisma.userProfile.count(),
        prisma.conversation.count(),
        prisma.message.count(),
        prisma.usageEvent.aggregate({
          _sum: { promptTokens: true, completionTokens: true, costEstimate: true },
          _avg: { latencyMs: true },
        }),
        prisma.usageEvent.findMany({
          where: {
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
          distinct: ["userId"],
          select: { userId: true },
        }),
      ]);

      return reply.send({
        totalUsers,
        activeUsersToday: activeToday.length,
        totalConversations,
        totalMessages,
        totalTokensUsed:
          (usageAggregate._sum.promptTokens ?? 0) +
          (usageAggregate._sum.completionTokens ?? 0),
        estimatedCostUsd: usageAggregate._sum.costEstimate ?? 0,
        averageLatencyMs: Math.round(usageAggregate._avg.latencyMs ?? 0),
      });
    }
  );

  // GET /api/admin/users
  app.get(
    "/api/admin/users",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { page = 1, pageSize = 20 } = request.query as {
        page?: number;
        pageSize?: number;
      };
      const skip = (Number(page) - 1) * Number(pageSize);

      const [data, total] = await Promise.all([
        prisma.userProfile.findMany({
          skip,
          take: Number(pageSize),
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: { conversations: true, usageEvents: true },
            },
          },
        }),
        prisma.userProfile.count(),
      ]);

      return reply.send({
        data: data.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          disabled: u.disabled,
          createdAt: u.createdAt,
          conversationCount: u._count.conversations,
          usageEventCount: u._count.usageEvents,
        })),
        total,
        page: Number(page),
        pageSize: Number(pageSize),
      });
    }
  );

  // POST /api/admin/users/:id/disable
  app.post(
    "/api/admin/users/:id/disable",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await prisma.userProfile.update({
        where: { id },
        data: { disabled: true },
      });
      return reply.send({ success: true });
    }
  );

  // POST /api/admin/users/:id/enable
  app.post(
    "/api/admin/users/:id/enable",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await prisma.userProfile.update({
        where: { id },
        data: { disabled: false },
      });
      return reply.send({ success: true });
    }
  );

  // POST /api/admin/users/:id/role
  app.post(
    "/api/admin/users/:id/role",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { role } = request.body as { role: "USER" | "ADMIN" };
      if (!["USER", "ADMIN"].includes(role)) {
        return reply.status(400).send({ error: "Invalid role" });
      }
      await prisma.userProfile.update({ where: { id }, data: { role } });
      return reply.send({ success: true });
    }
  );
}
