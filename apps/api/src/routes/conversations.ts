import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { exportConversationMarkdown } from "../services/exportService";

const createConvSchema = z.object({
  title: z.string().max(200).optional(),
  parentConversationId: z.string().optional(),
});

const updateConvSchema = z.object({
  title: z.string().max(200).optional(),
  archived: z.boolean().optional(),
});

export async function conversationRoutes(app: FastifyInstance) {
  // GET /api/conversations
  app.get(
    "/api/conversations",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { page = 1, pageSize = 20, search = "" } = request.query as {
        page?: number;
        pageSize?: number;
        search?: string;
      };
      const skip = (Number(page) - 1) * Number(pageSize);

      const where = {
        userId: request.user.id,
        archived: false,
        ...(search
          ? { title: { contains: search, mode: "insensitive" as const } }
          : {}),
      };

      const [data, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip,
          take: Number(pageSize),
          include: { _count: { select: { messages: true } } },
        }),
        prisma.conversation.count({ where }),
      ]);

      return reply.send({
        data: data.map((c) => ({
          id: c.id,
          title: c.title,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          archived: c.archived,
          parentConversationId: c.parentConversationId,
          messageCount: c._count.messages,
        })),
        total,
        page: Number(page),
        pageSize: Number(pageSize),
      });
    }
  );

  // POST /api/conversations
  app.post(
    "/api/conversations",
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = createConvSchema.parse(request.body);
      const conversation = await prisma.conversation.create({
        data: {
          userId: request.user.id,
          title: body.title ?? "New Conversation",
          parentConversationId: body.parentConversationId ?? null,
        },
      });
      return reply.status(201).send(conversation);
    }
  );

  // PATCH /api/conversations/:id
  app.patch(
    "/api/conversations/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateConvSchema.parse(request.body);

      const existing = await prisma.conversation.findFirst({
        where: { id, userId: request.user.id },
      });
      if (!existing) return reply.status(404).send({ error: "Not found" });

      const updated = await prisma.conversation.update({
        where: { id },
        data: body,
      });
      return reply.send(updated);
    }
  );

  // DELETE /api/conversations/:id (soft archive)
  app.delete(
    "/api/conversations/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.conversation.findFirst({
        where: { id, userId: request.user.id },
      });
      if (!existing) return reply.status(404).send({ error: "Not found" });

      await prisma.conversation.update({
        where: { id },
        data: { archived: true },
      });
      return reply.status(204).send();
    }
  );

  // GET /api/conversations/:id/messages
  app.get(
    "/api/conversations/:id/messages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { cursor, limit = 50 } = request.query as {
        cursor?: string;
        limit?: number;
      };

      const conversation = await prisma.conversation.findFirst({
        where: { id, userId: request.user.id },
      });
      if (!conversation) return reply.status(404).send({ error: "Not found" });

      const messages = await prisma.message.findMany({
        where: {
          conversationId: id,
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: Number(limit),
      });

      return reply.send({ data: messages, conversationId: id });
    }
  );

  // POST /api/messages/:id/edit (branch)
  app.post(
    "/api/messages/:id/edit",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { content } = z
        .object({ content: z.string().min(1) })
        .parse(request.body);

      const message = await prisma.message.findUnique({ where: { id } });
      if (!message) return reply.status(404).send({ error: "Not found" });

      // Verify message belongs to user's conversation
      const conversation = await prisma.conversation.findFirst({
        where: { id: message.conversationId, userId: request.user.id },
      });
      if (!conversation) return reply.status(403).send({ error: "Forbidden" });

      // Create a branch conversation
      const branchConv = await prisma.conversation.create({
        data: {
          userId: request.user.id,
          title: `Branch: ${conversation.title}`,
          parentConversationId: conversation.id,
        },
      });

      // Copy messages up to (but not including) the edited one
      const precedingMessages = await prisma.message.findMany({
        where: {
          conversationId: conversation.id,
          createdAt: { lt: message.createdAt },
        },
        orderBy: { createdAt: "asc" },
      });

      for (const m of precedingMessages) {
        await prisma.message.create({
          data: {
            conversationId: branchConv.id,
            role: m.role,
            content: m.content,
            metadata: m.metadata ?? {},
          },
        });
      }

      // Add edited message
      const editedMessage = await prisma.message.create({
        data: {
          conversationId: branchConv.id,
          role: "user",
          content,
          parentMessageId: message.parentMessageId,
          metadata: {},
        },
      });

      return reply.status(201).send({
        branchConversationId: branchConv.id,
        editedMessageId: editedMessage.id,
      });
    }
  );

  // GET /api/conversations/:id/export
  app.get(
    "/api/conversations/:id/export",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { format = "markdown" } = request.query as { format?: string };

      try {
        if (format === "markdown") {
          const md = await exportConversationMarkdown(id, request.user.id);
          reply.header("Content-Type", "text/markdown");
          reply.header("Content-Disposition", `attachment; filename="conversation-${id}.md"`);
          return reply.send(md);
        }
        return reply.status(400).send({ error: "Unsupported format" });
      } catch (err) {
        return reply.status(404).send({ error: (err as Error).message });
      }
    }
  );
}
