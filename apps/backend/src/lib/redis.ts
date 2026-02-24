import Redis from 'ioredis';
import { config } from '../config';

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.info('[Redis] Connected');
    });

    redisClient.on('reconnecting', () => {
      console.warn('[Redis] Reconnecting...');
    });
  }
  return redisClient;
}

// ─── Sliding Window Rate Limiter ──────────────────────────────────────────────
// Returns { allowed: boolean; remaining: number; resetAt: number }
export async function slidingWindowRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedis();
  const now = Date.now();
  const windowStart = now - windowMs;
  const resetAt = now + windowMs;

  // Lua script for atomic sliding window check
  const luaScript = `
    local key = KEYS[1]
    local window_start = tonumber(ARGV[1])
    local now = tonumber(ARGV[2])
    local max_requests = tonumber(ARGV[3])
    local window_ms = tonumber(ARGV[4])

    redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
    local count = redis.call('ZCARD', key)

    if count < max_requests then
      redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
      redis.call('PEXPIRE', key, window_ms)
      return {1, max_requests - count - 1}
    else
      return {0, 0}
    end
  `;

  const result = (await redis.eval(
    luaScript,
    1,
    key,
    windowStart.toString(),
    now.toString(),
    maxRequests.toString(),
    windowMs.toString()
  )) as [number, number];

  return {
    allowed: result[0] === 1,
    remaining: result[1],
    resetAt,
  };
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
