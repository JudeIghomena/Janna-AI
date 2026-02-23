import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyCognitoToken } from "../lib/cognito";
import { prisma } from "../db/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing Authorization header" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyCognitoToken(token);
    const sub = payload.sub;

    // Upsert user profile
    let user = await prisma.userProfile.findUnique({ where: { id: sub } });
    if (!user) {
      user = await prisma.userProfile.create({
        data: {
          id: sub,
          email: payload.email ?? payload.username ?? sub,
          role: "USER",
        },
      });
    }

    if (user.disabled) {
      return reply.status(403).send({ error: "Account disabled" });
    }

    request.user = { id: user.id, email: user.email, role: user.role };
  } catch (err) {
    return reply.status(401).send({ error: "Invalid or expired token" });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);
  if (request.user.role !== "ADMIN") {
    return reply.status(403).send({ error: "Admin access required" });
  }
}
