// ============================================================
// Janna AI - Fastify Server
// ============================================================
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { config } from "./config";
import { healthRoutes } from "./routes/health";
import { conversationRoutes } from "./routes/conversations";
import { chatRoutes } from "./routes/chat";
import { attachmentRoutes } from "./routes/attachments";
import { adminRoutes } from "./routes/admin";

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === "development"
        ? {
            transport: {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "HH:MM:ss" },
            },
          }
        : {}),
    },
    trustProxy: true,
  });

  // Plugins
  await app.register(helmet, {
    contentSecurityPolicy: false, // Handled by CloudFront WAF
  });

  await app.register(cors, {
    origin: config.NODE_ENV === "production" ? /\.jannaai\.com$/ : true,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(sensible);

  // Error handler
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: statusCode === 500 ? "Internal Server Error" : error.message,
      ...(config.NODE_ENV === "development" ? { stack: error.stack } : {}),
    });
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(conversationRoutes);
  await app.register(chatRoutes);
  await app.register(attachmentRoutes);
  await app.register(adminRoutes);

  return app;
}
