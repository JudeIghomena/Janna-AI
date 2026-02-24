import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

// Built-in extensions that are always available
const BUILTIN_EXTENSIONS = [
  {
    id: 'web-search',
    type: 'web_search' as const,
    name: 'Web Search',
    description: 'Search the web for real-time information and current events',
    iconUrl: null,
    configSchema: {},
  },
  {
    id: 'calculator',
    type: 'calculator' as const,
    name: 'Calculator',
    description: 'Perform complex mathematical calculations with precision',
    iconUrl: null,
    configSchema: {},
  },
  {
    id: 'code-interpreter',
    type: 'code_interpreter' as const,
    name: 'Code Interpreter',
    description: 'Execute code and analyze results in a sandboxed environment',
    iconUrl: null,
    configSchema: {},
  },
];

const ToggleExtensionSchema = z.object({
  enabled: z.boolean(),
  config: z.record(z.unknown()).optional(),
});

export async function extensionsRoutes(fastify: FastifyInstance) {
  // GET /api/extensions — list all extensions with user's enabled state
  fastify.get('/extensions', async (request, reply) => {
    const userId = (request as any).userId as string;

    // Get user's enabled extensions
    const userExtensions = await prisma.userExtension.findMany({
      where: { userId },
      select: { extensionId: true, enabled: true, config: true },
    });

    const userExtMap = new Map(
      userExtensions.map((ue) => [ue.extensionId, ue])
    );

    // Merge builtins with user state
    const extensions = BUILTIN_EXTENSIONS.map((ext) => ({
      ...ext,
      enabled: userExtMap.get(ext.id)?.enabled ?? false,
      config: userExtMap.get(ext.id)?.config ?? {},
    }));

    return reply.send(extensions);
  });

  // PUT /api/extensions/:id — toggle/configure an extension
  fastify.put('/extensions/:id', async (request, reply) => {
    const userId = (request as any).userId as string;
    const { id } = request.params as { id: string };
    const body = ToggleExtensionSchema.parse(request.body);

    // Ensure extension is valid
    const builtin = BUILTIN_EXTENSIONS.find((e) => e.id === id);
    if (!builtin) {
      return reply.code(404).send({ error: 'Extension not found' });
    }

    // Upsert a DB extension record if needed
    let dbExtension = await prisma.extension.findFirst({
      where: { name: builtin.name },
    });

    if (!dbExtension) {
      dbExtension = await prisma.extension.create({
        data: {
          type: builtin.type,
          name: builtin.name,
          description: builtin.description,
          configSchema: builtin.configSchema,
        },
      });
    }

    // Upsert user extension
    const userExt = await prisma.userExtension.upsert({
      where: { userId_extensionId: { userId, extensionId: dbExtension.id } },
      update: { enabled: body.enabled, config: body.config ?? {} },
      create: {
        userId,
        extensionId: dbExtension.id,
        enabled: body.enabled,
        config: body.config ?? {},
      },
    });

    return reply.send({
      ...builtin,
      enabled: userExt.enabled,
      config: userExt.config,
    });
  });
}
