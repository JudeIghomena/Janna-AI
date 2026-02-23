// ============================================================
// Model Gateway - Public API
// ============================================================
import { streamOpenAI, embedOpenAI } from "./openaiProvider";
import { streamLocal, embedLocal } from "./localProvider";
import { resolveProvider } from "./router";
import type { StreamChatOptions, GatewayStreamEvent, EmbedOptions, EmbedResult } from "./types";
import { getAvailableModels } from "./registry";

export * from "./types";
export * from "./registry";

/**
 * Main entry point: stream a chat completion.
 * Handles routing, failover, and unified event format.
 */
export async function* streamChat(
  options: StreamChatOptions
): AsyncGenerator<GatewayStreamEvent> {
  const { provider, effectiveModelId } = await resolveProvider(options.modelId);
  const resolved = { ...options, modelId: effectiveModelId };

  if (provider === "local") {
    yield* streamLocal(resolved);
  } else {
    yield* streamOpenAI(resolved);
  }
}

/**
 * Compute embeddings using the configured provider.
 */
export async function embed(opts: EmbedOptions): Promise<EmbedResult> {
  const provider = opts.provider ?? "openai";
  if (provider === "local") {
    return embedLocal(opts);
  }
  return embedOpenAI(opts);
}

/**
 * Get the list of available models (filtered by configuration).
 */
export { getAvailableModels };
