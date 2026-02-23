import { buildServer } from "./server";
import { config } from "./config";
import { prisma } from "./db/client";
import { redis } from "./cache/redis";

async function main() {
  // Connect Redis early
  await redis.connect();

  const app = await buildServer();

  try {
    await app.listen({ port: config.API_PORT, host: config.API_HOST });
    app.log.info(`Janna AI API running on ${config.API_HOST}:${config.API_PORT}`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    await redis.disconnect();
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    await app.close();
    await prisma.$disconnect();
    await redis.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
