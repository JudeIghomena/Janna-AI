import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { orchestrateChat } from "../services/chatOrchestrator";
import { checkRateLimit } from "../cache/redis";
import { config } from "../config";
import { getAvailableModels } from "../services/modelGateway";
import { DEFAULT_MODEL_ID } from "@janna/shared";

const streamSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(32000),
  modelId: z.string().optional(),
  ragEnabled: z.boolean().optional().default(false),
  parentMessageId: z.string().optional(),
});

export async function chatRoutes(app: FastifyInstance) {
  // POST /api/chat/stream - SSE streaming endpoint
  app.post(
    "/api/chat/stream",
    { preHandler: requireAuth },
    async (request, reply) => {
      // Rate limiting
      const { allowed, remaining, resetAt } = await checkRateLimit(
        request.user.id,
        config.RATE_LIMIT_REQUESTS_PER_MINUTE
      );

      reply.header("X-RateLimit-Remaining", remaining.toString());
      reply.header("X-RateLimit-Reset", new Date(resetAt).toISOString());

      if (!allowed) {
        return reply.status(429).send({
          error: "Rate limit exceeded",
          resetAt: new Date(resetAt).toISOString(),
        });
      }

      let body: z.infer<typeof streamSchema>;
      try {
        body = streamSchema.parse(request.body);
      } catch (err) {
        return reply.status(400).send({ error: "Invalid request body" });
      }

      await orchestrateChat({
        conversationId: body.conversationId,
        userMessageContent: body.content,
        userId: request.user.id,
        modelId: body.modelId ?? DEFAULT_MODEL_ID,
        ragEnabled: body.ragEnabled,
        parentMessageId: body.parentMessageId,
        reply,
      });
    }
  );

  // GET /api/models - Available models
  app.get("/api/models", { preHandler: requireAuth }, async (_req, reply) => {
    const models = getAvailableModels();
    return reply.send({ data: models });
  });
}
