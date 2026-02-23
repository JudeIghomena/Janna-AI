import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import { redis } from "../cache/redis";
import { getHealthStatuses } from "../services/modelGateway/router";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_req, reply) => {
    return reply.send({ status: "ok", service: "janna-api" });
  });

  app.get("/health/detailed", async (_req, reply) => {
    const checks = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
      getHealthStatuses(),
    ]);

    const [db, redisCheck, models] = checks;

    return reply.send({
      status: checks.every((c) => c.status === "fulfilled") ? "ok" : "degraded",
      checks: {
        database: db.status === "fulfilled" ? "ok" : "error",
        redis: redisCheck.status === "fulfilled" ? "ok" : "error",
        models: models.status === "fulfilled" ? models.value : { error: "check failed" },
      },
      timestamp: new Date().toISOString(),
    });
  });
}
