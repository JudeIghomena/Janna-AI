import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ─── Request schemas ───────────────────────────────────────────────────────────
const createConversationBody = z.object({
  title: z.string().max(200).optional(),
});

const patchConversationBody = z.object({
  title: z.string().max(200).optional(),
  archived: z.boolean().optional(),
  starred: z.boolean().optional(),
  projectId: z.string().optional().nullable(),
});

const listConversationsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  archived: z.enum(['true', 'false']).optional(),
  search: z.string().max(200).optional(),
});

export async function conversationsRoutes(fastify: FastifyInstance) {
  // GET /api/conversations
  fastify.get(
    '/conversations',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = listConversationsQuery.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({ error: 'Invalid query', code: 'VALIDATION_ERROR' });
      }

      const { page, pageSize, archived, search } = query.data;
      const skip = (page - 1) * pageSize;

      const where = {
        userId: request.userId,
        ...(archived !== undefined ? { archived: archived === 'true' } : {}),
        ...(search
          ? {
              title: {
                contains: search,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      };

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: pageSize,
          select: {
            id: true,
            title: true,
            archived: true,
            starred: true,
            projectId: true,
            createdAt: true,
            updatedAt: true,
            parentConversationId: true,
            _count: { select: { messages: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { content: true, role: true },
            },
          },
        }),
        prisma.conversation.count({ where }),
      ]);

      const data = conversations.map((c) => ({
        id: c.id,
        title: c.title,
        archived: c.archived,
        starred: c.starred,
        projectId: c.projectId,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        parentConversationId: c.parentConversationId,
        messageCount: c._count.messages,
        lastMessage: c.messages[0]?.content?.slice(0, 100),
      }));

      return reply.send({
        data,
        total,
        page,
        pageSize,
        hasMore: skip + conversations.length < total,
      });
    }
  );

  // POST /api/conversations
  fastify.post(
    '/conversations',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createConversationBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid body', code: 'VALIDATION_ERROR' });
      }

      const conversation = await prisma.conversation.create({
        data: {
          userId: request.userId,
          title: body.data.title ?? 'New Conversation',
        },
        select: {
          id: true,
          title: true,
          archived: true,
          createdAt: true,
          updatedAt: true,
          parentConversationId: true,
        },
      });

      return reply.status(201).send({
        ...conversation,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messageCount: 0,
      });
    }
  );

  // PATCH /api/conversations/:id
  fastify.patch(
    '/conversations/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const body = patchConversationBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid body', code: 'VALIDATION_ERROR' });
      }

      const existing = await prisma.conversation.findFirst({
        where: { id: request.params.id, userId: request.userId },
        select: { id: true },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Conversation not found', code: 'NOT_FOUND' });
      }

      const updated = await prisma.conversation.update({
        where: { id: request.params.id },
        data: {
          ...(body.data.title !== undefined ? { title: body.data.title } : {}),
          ...(body.data.archived !== undefined ? { archived: body.data.archived } : {}),
          ...(body.data.starred !== undefined ? { starred: body.data.starred } : {}),
          ...(body.data.projectId !== undefined ? { projectId: body.data.projectId } : {}),
        },
        select: {
          id: true,
          title: true,
          archived: true,
          updatedAt: true,
        },
      });

      return reply.send({
        ...updated,
        updatedAt: updated.updatedAt.toISOString(),
      });
    }
  );

  // DELETE /api/conversations/:id
  fastify.delete(
    '/conversations/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const existing = await prisma.conversation.findFirst({
        where: { id: request.params.id, userId: request.userId },
        select: { id: true },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Conversation not found', code: 'NOT_FOUND' });
      }

      await prisma.conversation.delete({ where: { id: request.params.id } });
      return reply.status(204).send();
    }
  );

  // GET /api/conversations/:id/messages
  fastify.get(
    '/conversations/:id/messages',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const conversation = await prisma.conversation.findFirst({
        where: { id: request.params.id, userId: request.userId },
        select: { id: true },
      });

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found', code: 'NOT_FOUND' });
      }

      const messages = await prisma.message.findMany({
        where: { conversationId: request.params.id },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          conversationId: true,
          role: true,
          content: true,
          metadata: true,
          parentMessageId: true,
          createdAt: true,
        },
      });

      return reply.send(
        messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        }))
      );
    }
  );

  // POST /api/messages/:id/edit  (branch from an earlier message)
  fastify.post(
    '/messages/:id/edit',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const bodySchema = z.object({
        content: z.string().min(1).max(100000),
      });
      const body = bodySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid body', code: 'VALIDATION_ERROR' });
      }

      // Verify the message belongs to this user
      const original = await prisma.message.findFirst({
        where: { id: request.params.id },
        include: { conversation: { select: { userId: true, id: true } } },
      });

      if (!original || original.conversation.userId !== request.userId) {
        return reply.status(404).send({ error: 'Message not found', code: 'NOT_FOUND' });
      }

      // Create a branch conversation
      const branchConversation = await prisma.conversation.create({
        data: {
          userId: request.userId,
          title: `Branch from "${original.conversation.id}"`,
          parentConversationId: original.conversationId,
        },
      });

      // Copy messages up to (but not including) the edited message
      const previousMessages = await prisma.message.findMany({
        where: {
          conversationId: original.conversationId,
          createdAt: { lt: original.createdAt },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Bulk insert previous messages into the new conversation
      if (previousMessages.length > 0) {
        await prisma.message.createMany({
          data: previousMessages.map((m) => ({
            conversationId: branchConversation.id,
            role: m.role,
            content: m.content,
            metadata: m.metadata ?? {},
            createdAt: m.createdAt,
          })),
        });
      }

      // Create the new (edited) message in the branch
      const newMessage = await prisma.message.create({
        data: {
          conversationId: branchConversation.id,
          role: original.role,
          content: body.data.content,
          parentMessageId: original.id,
        },
      });

      return reply.status(201).send({
        conversationId: branchConversation.id,
        messageId: newMessage.id,
        message: 'Branch created. Continue the conversation in the new branch.',
      });
    }
  );
}
