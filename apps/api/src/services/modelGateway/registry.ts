// ============================================================
// Model Registry - Available models and configs
// ============================================================
import { ModelConfig } from "@janna/shared";
import { config } from "../../config";

export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: "openai:gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    maxTokens: 16384,
    contextWindow: 128000,
    costWeight: 1,
    latencyWeight: 1,
  },
  {
    id: "openai:gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    maxTokens: 32768,
    contextWindow: 1000000,
    costWeight: 10,
    latencyWeight: 3,
  },
  {
    id: "local:llama-3.1-70b",
    name: "Llama 3.1 70B (Local)",
    provider: "local",
    maxTokens: 8192,
    contextWindow: 131072,
    costWeight: 0,
    latencyWeight: 5,
    endpoint: config.LOCAL_VLLM_BASE_URL,
  },
];

export function getModelConfig(modelId: string): ModelConfig {
  const found = MODEL_CONFIGS.find((m) => m.id === modelId);
  if (!found) throw new Error(`Unknown model: ${modelId}`);
  return found;
}

export function getAvailableModels(): ModelConfig[] {
  return MODEL_CONFIGS.filter((m) => {
    if (m.provider === "local" && !config.LOCAL_VLLM_BASE_URL) return false;
    return true;
  });
}

// Cost estimation per 1M tokens (USD)
const COST_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "openai:gpt-4o-mini": { input: 0.15, output: 0.6 },
  "openai:gpt-4.1": { input: 2.0, output: 8.0 },
  "local:llama-3.1-70b": { input: 0, output: 0 },
};

export function estimateCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const cost = COST_PER_MILLION_TOKENS[modelId] ?? { input: 0, output: 0 };
  return (promptTokens * cost.input + completionTokens * cost.output) / 1_000_000;
}
