import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config';
import { prisma } from '../lib/prisma';

// Extend FastifyRequest to include the authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
    userRole: 'user' | 'admin';
  }
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(userPoolId: string, region: string) {
  const key = `${region}:${userPoolId}`;
  if (!jwksCache.has(key)) {
    const jwksUrl = new URL(
      `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
    );
    jwksCache.set(key, createRemoteJWKSet(jwksUrl));
  }
  return jwksCache.get(key)!;
}

async function verifyToken(token: string): Promise<{
  sub: string;
  email: string;
  groups?: string[];
}> {
  // Dev mode: accept static test tokens shaped as `dev:userId:email`
  if (
    config.NODE_ENV === 'development' &&
    token.startsWith('dev:')
  ) {
    const [, sub, email] = token.split(':');
    return { sub, email: email ?? `${sub}@dev.local`, groups: ['admin'] };
  }

  if (!config.COGNITO_USER_POOL_ID) {
    throw new Error('COGNITO_USER_POOL_ID not configured');
  }

  const JWKS = getJWKS(config.COGNITO_USER_POOL_ID, config.COGNITO_REGION);

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://cognito-idp.${config.COGNITO_REGION}.amazonaws.com/${config.COGNITO_USER_POOL_ID}`,
    audience: config.COGNITO_CLIENT_ID,
  });

  return {
    sub: payload.sub as string,
    email: (payload['email'] as string) ?? '',
    groups: (payload['cognito:groups'] as string[]) ?? [],
  };
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('userId', '');
  fastify.decorateRequest('userEmail', '');
  fastify.decorateRequest('userRole', 'user');

  fastify.addHook(
    'preHandler',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip auth for health check and public routes
      if (
        request.url === '/health' ||
        request.url === '/api/health'
      ) {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Missing or invalid Authorization header',
          code: 'UNAUTHORIZED',
        });
      }

      const token = authHeader.slice(7);
      try {
        const claims = await verifyToken(token);

        // Upsert user profile on first access
        const user = await prisma.userProfile.upsert({
          where: { id: claims.sub },
          update: { email: claims.email },
          create: {
            id: claims.sub,
            email: claims.email,
            role: 'user',
          },
          select: { id: true, email: true, role: true, disabled: true },
        });

        if (user.disabled) {
          return reply.status(403).send({
            error: 'Account disabled',
            code: 'ACCOUNT_DISABLED',
          });
        }

        request.userId = user.id;
        request.userEmail = user.email;
        request.userRole = user.role as 'user' | 'admin';
      } catch (err) {
        fastify.log.warn({ err }, 'JWT verification failed');
        return reply.status(401).send({
          error: 'Invalid or expired token',
          code: 'TOKEN_INVALID',
        });
      }
    }
  );
}

export const requireAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  if (request.userRole !== 'admin') {
    return reply.status(403).send({
      error: 'Admin access required',
      code: 'FORBIDDEN',
    });
  }
};

export default fp(authPlugin, { name: 'auth' });
