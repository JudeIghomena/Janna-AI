import { FastifyInstance } from 'fastify';
import { conversationsRoutes } from './conversations';
import { chatRoutes } from './chat';
import { attachmentsRoutes } from './attachments';
import { ragRoutes } from './rag';
import { adminRoutes } from './admin';
import { profileRoutes } from './profile';
import { projectsRoutes } from './projects';
import { extensionsRoutes } from './extensions';

export async function registerRoutes(fastify: FastifyInstance) {
  const apiPrefix = { prefix: '/api' };

  await fastify.register(conversationsRoutes, apiPrefix);
  await fastify.register(chatRoutes, apiPrefix);
  await fastify.register(attachmentsRoutes, apiPrefix);
  await fastify.register(ragRoutes, apiPrefix);
  await fastify.register(adminRoutes, apiPrefix);
  await fastify.register(profileRoutes, apiPrefix);
  await fastify.register(projectsRoutes, apiPrefix);
  await fastify.register(extensionsRoutes, apiPrefix);
}
