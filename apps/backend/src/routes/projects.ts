import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().max(10000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().optional(),
});

const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  starred: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export async function projectsRoutes(fastify: FastifyInstance) {
  // GET /api/projects
  fastify.get('/projects', async (request, reply) => {
    const userId = (request as any).userId as string;
    const { archived } = (request.query as any) ?? {};

    const projects = await prisma.project.findMany({
      where: {
        userId,
        archived: archived === 'true' ? true : false,
      },
      orderBy: [{ starred: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        description: true,
        systemPrompt: true,
        color: true,
        icon: true,
        starred: true,
        archived: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { conversations: true } },
      },
    });

    return reply.send(
      projects.map((p) => ({
        ...p,
        conversationCount: p._count.conversations,
      }))
    );
  });

  // POST /api/projects
  fastify.post('/projects', async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = CreateProjectSchema.parse(request.body);

    const project = await prisma.project.create({
      data: {
        userId,
        name: body.name,
        description: body.description,
        systemPrompt: body.systemPrompt,
        color: body.color ?? '#d97757',
        icon: body.icon ?? 'folder',
      },
    });

    return reply.code(201).send(project);
  });

  // GET /api/projects/:id
  fastify.get('/projects/:id', async (request, reply) => {
    const userId = (request as any).userId as string;
    const { id } = request.params as { id: string };

    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        conversations: {
          where: { archived: false },
          orderBy: { updatedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            _count: { select: { messages: true } },
          },
        },
      },
    });

    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return reply.send(project);
  });

  // PATCH /api/projects/:id
  fastify.patch('/projects/:id', async (request, reply) => {
    const userId = (request as any).userId as string;
    const { id } = request.params as { id: string };
    const body = UpdateProjectSchema.parse(request.body);

    const existing = await prisma.project.findFirst({ where: { id, userId } });
    if (!existing) return reply.code(404).send({ error: 'Project not found' });

    const project = await prisma.project.update({
      where: { id },
      data: body,
    });

    return reply.send(project);
  });

  // DELETE /api/projects/:id
  fastify.delete('/projects/:id', async (request, reply) => {
    const userId = (request as any).userId as string;
    const { id } = request.params as { id: string };

    const existing = await prisma.project.findFirst({ where: { id, userId } });
    if (!existing) return reply.code(404).send({ error: 'Project not found' });

    await prisma.project.delete({ where: { id } });
    return reply.code(204).send();
  });

  // GET /api/projects/:id/conversations
  fastify.get('/projects/:id/conversations', async (request, reply) => {
    const userId = (request as any).userId as string;
    const { id } = request.params as { id: string };

    const project = await prisma.project.findFirst({ where: { id, userId } });
    if (!project) return reply.code(404).send({ error: 'Project not found' });

    const conversations = await prisma.conversation.findMany({
      where: { projectId: id, userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        starred: true,
        archived: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    return reply.send(conversations);
  });
}
