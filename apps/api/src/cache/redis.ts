import Redis from "ioredis";
import { config } from "../config";

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableReadyCheck: true,
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.info("[Redis] Connected");
});

// Rate limiting helpers
export async function checkRateLimit(
  key: string,
  limitPerMinute: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowKey = `rl:${key}:${Math.floor(now / 60000)}`;
  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.expire(windowKey, 60);
  }
  const remaining = Math.max(0, limitPerMinute - count);
  const resetAt = (Math.floor(now / 60000) + 1) * 60000;
  return { allowed: count <= limitPerMinute, remaining, resetAt };
}
