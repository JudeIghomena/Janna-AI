import Fastify, { FastifyError } from 'fastify';
import helmet from '@fastify/helmet';
import { config } from './config';
import corsPlugin from './plugins/cors';
import authPlugin from './plugins/auth';
import { registerRoutes } from './routes';
import { prisma } from './lib/prisma';
import { getRedis, disconnectRedis } from './lib/redis';

const fastify = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          hostname: request.hostname,
          remoteAddress: request.ip,
          userId: (request as { userId?: string }).userId,
        };
      },
    },
  },
  trustProxy: true,
});

// ─── Plugins ───────────────────────────────────────────────────────────────────
async function bootstrap() {
  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // CSP handled by CloudFront/Next.js
    crossOriginEmbedderPolicy: false,
  });

  // CORS
  await fastify.register(corsPlugin);

  // Auth (JWT validation)
  await fastify.register(authPlugin);

  // ─── Health check (no auth) ───────────────────────────────────────────────
  fastify.get('/health', async () => {
    const redis = getRedis();
    let redisOk = false;
    try {
      await redis.ping();
      redisOk = true;
    } catch {}

    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {}

    const healthy = redisOk && dbOk;
    return {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
      checks: { database: dbOk, redis: redisOk },
    };
  });

  fastify.get('/api/health', async (_req, reply) => {
    return reply.redirect('/health');
  });

  // ─── API routes ────────────────────────────────────────────────────────────
  await registerRoutes(fastify);

  // ─── Global error handler ──────────────────────────────────────────────────
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.validation,
      });
    }

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error:
        statusCode < 500
          ? error.message
          : 'Internal server error',
      code: error.code ?? 'INTERNAL_ERROR',
    });
  });

  fastify.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: 'Route not found',
      code: 'NOT_FOUND',
    });
  });
}

// ─── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    await bootstrap();

    // Warm up DB connection
    await prisma.$connect();
    fastify.log.info('Database connected');

    // Warm up Redis (non-fatal — the /health endpoint reports degraded state if Redis
    // is unavailable; the server must start even if Redis has a transient TLS issue)
    try {
      const redis = getRedis();
      await redis.connect();
      fastify.log.info('Redis connected');
    } catch (redisErr) {
      fastify.log.warn(
        { err: redisErr },
        'Redis warm-up failed — server starting in degraded mode'
      );
    }

    await fastify.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });
  } catch (err) {
    fastify.log.fatal(err, 'Failed to start server');
    process.exit(1);
  }
}

// ─── Graceful shutdown ─────────────────────────────────────────────────────────
const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
for (const signal of signals) {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down gracefully`);
    await fastify.close();
    await prisma.$disconnect();
    await disconnectRedis();
    process.exit(0);
  });
}

start();
