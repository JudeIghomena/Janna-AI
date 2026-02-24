import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import corsPlugin from '@fastify/cors';
import { config } from '../config';

async function cors(fastify: FastifyInstance) {
  await fastify.register(corsPlugin, {
    origin:
      config.NODE_ENV === 'production'
        ? [/\.janna\.ai$/, /^https:\/\/janna\.ai$/]
        : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'Cache-Control',
    ],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 86400,
  });
}

export default fp(cors, { name: 'cors' });
