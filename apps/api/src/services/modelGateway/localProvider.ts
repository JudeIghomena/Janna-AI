// ============================================================
// Local vLLM Provider (OpenAI-compatible API)
// ============================================================
import OpenAI from "openai";
import { config } from "../../config";
import type { GatewayStreamEvent, StreamChatOptions, EmbedOptions, EmbedResult } from "./types";

let _client: OpenAI | null = null;

function getLocalClient(): OpenAI {
  if (!_client) {
    if (!config.LOCAL_VLLM_BASE_URL) {
      throw new Error("LOCAL_VLLM_BASE_URL not configured");
    }
    _client = new OpenAI({
      apiKey: config.LOCAL_VLLM_API_KEY ?? "none",
      baseURL: config.LOCAL_VLLM_BASE_URL,
    });
  }
  return _client;
}

export async function* streamLocal(
  options: StreamChatOptions
): AsyncGenerator<GatewayStreamEvent> {
  const client = getLocalClient();
  const modelName = config.LOCAL_VLLM_MODEL ?? options.modelId.replace("local:", "");

  const messages = options.messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  })) as OpenAI.ChatCompletionMessageParam[];

  const stream = await client.chat.completions.create({
    model: modelName,
    messages,
    stream: true,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
  });

  let promptTokens = 0;
  let completionTokens = 0;
  let finishReason = "stop";

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (!choice) continue;

    if (choice.delta.content) {
      yield { type: "token", token: choice.delta.content };
    }

    if (choice.finish_reason) finishReason = choice.finish_reason;

    if (chunk.usage) {
      promptTokens = chunk.usage.prompt_tokens ?? 0;
      completionTokens = chunk.usage.completion_tokens ?? 0;
    }
  }

  yield {
    type: "done",
    done: { promptTokens, completionTokens, model: options.modelId, finishReason },
  };
}

export async function embedLocal(_opts: EmbedOptions): Promise<EmbedResult> {
  // Stub: use OpenAI embeddings as fallback in MVP
  throw new Error("Local embedding not yet implemented; use openai provider");
}

export async function checkLocalHealth(): Promise<boolean> {
  if (!config.LOCAL_VLLM_BASE_URL) return false;
  try {
    const res = await fetch(`${config.LOCAL_VLLM_BASE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
