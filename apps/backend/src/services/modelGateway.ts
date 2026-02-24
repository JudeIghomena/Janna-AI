import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL_REGISTRY, ModelConfig, SSEEvent } from '@janna/shared';
import { getSecrets } from '../lib/secrets';
import { config } from '../config';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GatewayMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | GatewayContentBlock[];
  toolCallId?: string;
  name?: string;
}

export interface GatewayContentBlock {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'auto' | 'low' | 'high' };
}

export interface GatewayStreamOptions {
  messages: GatewayMessage[];
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  tools?: GatewayTool[];
  onEvent: (event: SSEEvent) => void;
  signal?: AbortSignal;
}

export interface GatewayTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface EmbedOptions {
  texts: string[];
  modelId?: string; // defaults to config embedding model
}

// ─── Cost estimation (USD per 1M tokens) ─────────────────────────────────────
const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'llama-3.1-70b': { input: 0, output: 0 },
};

function estimateCost(
  modelName: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rates = COST_PER_MILLION[modelName];
  if (!rates) return 0;
  return (
    (promptTokens / 1_000_000) * rates.input +
    (completionTokens / 1_000_000) * rates.output
  );
}

// ─── Provider clients (lazy-initialized) ─────────────────────────────────────
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let localClient: OpenAI | null = null;

async function getOpenAIClient(): Promise<OpenAI> {
  if (!openaiClient) {
    const secrets = await getSecrets();
    openaiClient = new OpenAI({ apiKey: secrets.OPENAI_API_KEY });
  }
  return openaiClient;
}

async function getAnthropicClient(): Promise<Anthropic> {
  if (!anthropicClient) {
    const secrets = await getSecrets();
    anthropicClient = new Anthropic({ apiKey: secrets.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

async function getLocalClient(): Promise<OpenAI> {
  if (!localClient) {
    const secrets = await getSecrets();
    localClient = new OpenAI({
      apiKey: secrets.LOCAL_MODEL_API_KEY || 'local',
      baseURL: config.LOCAL_MODEL_ENDPOINT,
    });
  }
  return localClient;
}

// ─── Health check for local model ─────────────────────────────────────────────
let localHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL_MS = 30_000;

async function checkLocalHealth(): Promise<boolean> {
  if (Date.now() - lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
    return localHealthy;
  }
  try {
    const client = await getLocalClient();
    await client.models.list();
    localHealthy = true;
  } catch {
    localHealthy = false;
  }
  lastHealthCheck = Date.now();
  return localHealthy;
}

// ─── Route model preference to config ─────────────────────────────────────────
function resolveModel(modelId: string): ModelConfig {
  const model = MODEL_REGISTRY.find((m) => m.id === modelId);
  if (!model) {
    // Default to cheapest/fastest
    return MODEL_REGISTRY.find((m) => m.id === 'openai:gpt-4o-mini')!;
  }
  return model;
}

async function shouldFailover(model: ModelConfig): Promise<ModelConfig> {
  if (model.provider !== 'local') return model;
  const healthy = await checkLocalHealth();
  if (!healthy) {
    console.warn('[ModelGateway] Local model unhealthy, failing over to OpenAI');
    return MODEL_REGISTRY.find((m) => m.id === 'openai:gpt-4o-mini')!;
  }
  return model;
}

// ─── OpenAI streaming ─────────────────────────────────────────────────────────
async function streamOpenAI(
  opts: GatewayStreamOptions,
  model: ModelConfig,
  startTime: number
): Promise<void> {
  const client = await getOpenAIClient();

  const openaiMessages = opts.messages.map((m) => ({
    role: m.role as 'system' | 'user' | 'assistant' | 'tool',
    content:
      typeof m.content === 'string'
        ? m.content
        : m.content
            .map((b) =>
              b.type === 'text'
                ? { type: 'text' as const, text: b.text ?? '' }
                : {
                    type: 'image_url' as const,
                    image_url: b.image_url ?? { url: '' },
                  }
            ),
    ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    ...(m.name ? { name: m.name } : {}),
  })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

  const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined =
    opts.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema as Record<string, unknown>,
      },
    }));

  const stream = await client.chat.completions.create({
    model: model.name,
    messages: openaiMessages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? model.maxOutputTokens,
    stream: true,
    ...(openaiTools ? { tools: openaiTools, tool_choice: 'auto' } : {}),
  }, { signal: opts.signal });

  let promptTokens = 0;
  let completionTokens = 0;
  const pendingToolCalls: Map<number, { id: string; name: string; args: string }> = new Map();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    // Text token
    if (delta.content) {
      opts.onEvent({ type: 'token', content: delta.content });
    }

    // Tool call chunks
    if (delta.tool_calls) {
      for (const tcDelta of delta.tool_calls) {
        const idx = tcDelta.index;
        if (!pendingToolCalls.has(idx)) {
          pendingToolCalls.set(idx, {
            id: tcDelta.id ?? '',
            name: tcDelta.function?.name ?? '',
            args: '',
          });
        }
        const tc = pendingToolCalls.get(idx)!;
        if (tcDelta.id) tc.id = tcDelta.id;
        if (tcDelta.function?.name) tc.name += tcDelta.function.name;
        if (tcDelta.function?.arguments) tc.args += tcDelta.function.arguments;
      }
    }

    // Finish
    if (chunk.choices[0]?.finish_reason === 'tool_calls') {
      for (const [, tc] of pendingToolCalls) {
        let input: Record<string, unknown> = {};
        try { input = JSON.parse(tc.args); } catch { /* keep empty */ }
        opts.onEvent({
          type: 'tool_call_start',
          toolCallId: tc.id,
          name: tc.name,
          input,
        });
      }
    }

    // Usage
    if (chunk.usage) {
      promptTokens = chunk.usage.prompt_tokens;
      completionTokens = chunk.usage.completion_tokens;
    }
  }

  const latencyMs = Date.now() - startTime;
  opts.onEvent({
    type: 'usage',
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costEstimate: estimateCost(model.name, promptTokens, completionTokens),
    latencyMs,
  });
}

// ─── Anthropic streaming ──────────────────────────────────────────────────────
async function streamAnthropic(
  opts: GatewayStreamOptions,
  model: ModelConfig,
  startTime: number
): Promise<void> {
  const client = await getAnthropicClient();

  // Separate system messages from conversation
  const systemMessages = opts.messages.filter((m) => m.role === 'system');
  const conversationMessages = opts.messages.filter(
    (m) => m.role !== 'system'
  );

  const systemText = systemMessages
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n\n');

  const anthropicMessages: Anthropic.MessageParam[] = conversationMessages.map(
    (m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content:
        typeof m.content === 'string'
          ? m.content
          : m.content
              .map((b) =>
                b.type === 'text'
                  ? { type: 'text' as const, text: b.text ?? '' }
                  : {
                      type: 'image' as const,
                      source: {
                        type: 'url' as const,
                        url: b.image_url?.url ?? '',
                      },
                    }
              ),
    })
  );

  const anthropicTools: Anthropic.Tool[] | undefined = opts.tools?.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  const stream = await client.messages.stream({
    model: model.name,
    max_tokens: opts.maxTokens ?? model.maxOutputTokens,
    temperature: opts.temperature ?? 0.7,
    system: systemText || undefined,
    messages: anthropicMessages,
    ...(anthropicTools ? { tools: anthropicTools } : {}),
  });

  let inputTokens = 0;
  let outputTokens = 0;

  stream.on('text', (text) => {
    opts.onEvent({ type: 'token', content: text });
  });

  stream.on('message', (msg) => {
    inputTokens = msg.usage.input_tokens;
    outputTokens = msg.usage.output_tokens;

    // Emit tool calls from final message
    for (const block of msg.content) {
      if (block.type === 'tool_use') {
        opts.onEvent({
          type: 'tool_call_start',
          toolCallId: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }
  });

  await stream.finalMessage();

  const latencyMs = Date.now() - startTime;
  opts.onEvent({
    type: 'usage',
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    totalTokens: inputTokens + outputTokens,
    costEstimate: estimateCost(model.name, inputTokens, outputTokens),
    latencyMs,
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function streamChat(opts: GatewayStreamOptions): Promise<void> {
  const rawModel = resolveModel(opts.modelId);
  const model = await shouldFailover(rawModel);
  const startTime = Date.now();

  try {
    switch (model.provider) {
      case 'openai':
        return await streamOpenAI(opts, model, startTime);
      case 'local':
        return await streamOpenAI(
          { ...opts, modelId: model.id },
          model,
          startTime
        );
      case 'anthropic':
        return await streamAnthropic(opts, model, startTime);
      default:
        throw new Error(`Unknown provider: ${(model as ModelConfig).provider}`);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown gateway error';
    opts.onEvent({ type: 'error', message, code: 'GATEWAY_ERROR' });
    throw err;
  }
}

export async function embedTexts(opts: EmbedOptions): Promise<number[][]> {
  const client = await getOpenAIClient();
  const response = await client.embeddings.create({
    model: config.EMBEDDING_MODEL,
    input: opts.texts,
    dimensions: config.EMBEDDING_DIMENSIONS,
  });
  return response.data.map((d) => d.embedding);
}
