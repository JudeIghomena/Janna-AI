// ============================================================
// Model Router - Routing policies + failover
// ============================================================
import { getModelConfig } from "./registry";
import { checkLocalHealth } from "./localProvider";
import { checkOpenAIHealth } from "./openaiProvider";
import { redis } from "../../cache/redis";

const LOCAL_HEALTH_CACHE_KEY = "gateway:local:healthy";
const HEALTH_CACHE_TTL = 30; // seconds

export async function resolveProvider(
  modelId: string
): Promise<{ provider: "openai" | "local"; effectiveModelId: string }> {
  const modelConfig = getModelConfig(modelId);

  if (modelConfig.provider === "local") {
    // Check health with caching
    const cached = await redis.get(LOCAL_HEALTH_CACHE_KEY);
    const isHealthy = cached ? cached === "1" : await checkLocalHealth();

    if (!isHealthy) {
      // Cache negative result
      await redis.setex(LOCAL_HEALTH_CACHE_KEY, HEALTH_CACHE_TTL, "0");
      // Failover to OpenAI
      console.warn(`[Router] Local model unhealthy, failing over to OpenAI`);
      return { provider: "openai", effectiveModelId: "openai:gpt-4o-mini" };
    }

    await redis.setex(LOCAL_HEALTH_CACHE_KEY, HEALTH_CACHE_TTL, "1");
    return { provider: "local", effectiveModelId: modelId };
  }

  // OpenAI path
  return { provider: "openai", effectiveModelId: modelId };
}

export async function getHealthStatuses() {
  const [localOk, openAiOk] = await Promise.all([
    checkLocalHealth(),
    checkOpenAIHealth(),
  ]);
  return {
    local: { healthy: localOk },
    openai: { healthy: openAiOk },
  };
}
