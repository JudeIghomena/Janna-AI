import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  preferences: z
    .object({
      theme: z.enum(['light', 'dark', 'system']).optional(),
      sendOnEnter: z.boolean().optional(),
      defaultModel: z.string().optional(),
      accentColor: z.string().optional(),
    })
    .optional(),
});

export async function profileRoutes(fastify: FastifyInstance) {
  // GET /api/profile
  fastify.get('/profile', async (request, reply) => {
    const userId = (request as any).userId as string;
    const email = (request as any).userEmail as string;

    const profile = await prisma.userProfile.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: email ?? `${userId}@janna.dev`,
        role: 'user',
      },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        preferences: true,
        createdAt: true,
        _count: {
          select: {
            conversations: true,
            projects: true,
          },
        },
      },
    });

    // Calculate token usage stats
    const usageStats = await prisma.usageEvent.aggregate({
      where: { userId },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        costEstimate: true,
      },
      _count: true,
    });

    return reply.send({
      ...profile,
      stats: {
        conversations: profile._count.conversations,
        projects: profile._count.projects,
        totalTokens:
          (usageStats._sum.promptTokens ?? 0) +
          (usageStats._sum.completionTokens ?? 0),
        totalCost: usageStats._sum.costEstimate ?? 0,
        totalRequests: usageStats._count,
      },
    });
  });

  // PUT /api/profile
  fastify.put('/profile', async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = UpdateProfileSchema.parse(request.body);

    const profile = await prisma.userProfile.update({
      where: { id: userId },
      data: {
        ...(body.displayName !== undefined && { displayName: body.displayName }),
        ...(body.bio !== undefined && { bio: body.bio }),
        ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl || null }),
        ...(body.preferences !== undefined && {
          preferences: body.preferences as any,
        }),
      },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        preferences: true,
        updatedAt: true,
      },
    });

    return reply.send(profile);
  });
}
