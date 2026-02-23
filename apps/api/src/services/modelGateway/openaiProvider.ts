// ============================================================
// OpenAI Provider
// ============================================================
import OpenAI from "openai";
import { config } from "../../config";
import type { GatewayStreamEvent, StreamChatOptions, EmbedOptions, EmbedResult } from "./types";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }
  return _client;
}

export async function* streamOpenAI(
  options: StreamChatOptions
): AsyncGenerator<GatewayStreamEvent> {
  const client = getClient();
  const modelName = options.modelId.replace("openai:", "");

  const openaiMessages = options.messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    ...(m.name ? { name: m.name } : {}),
  })) as OpenAI.ChatCompletionMessageParam[];

  const openaiTools = options.tools?.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const stream = await client.chat.completions.create({
    model: modelName,
    messages: openaiMessages,
    stream: true,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    ...(openaiTools && openaiTools.length > 0 ? { tools: openaiTools, tool_choice: "auto" } : {}),
  });

  // Track tool call accumulation
  const toolCallAccum: Record<
    number,
    { id: string; name: string; args: string }
  > = {};
  let promptTokens = 0;
  let completionTokens = 0;
  let finishReason = "stop";

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (!choice) continue;

    const delta = choice.delta;

    // Token content
    if (delta.content) {
      yield { type: "token", token: delta.content };
    }

    // Tool calls
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!toolCallAccum[idx]) {
          toolCallAccum[idx] = {
            id: tc.id ?? `tc_${idx}`,
            name: tc.function?.name ?? "",
            args: "",
          };
        }
        if (tc.function?.name) toolCallAccum[idx].name = tc.function.name;
        if (tc.function?.arguments) toolCallAccum[idx].args += tc.function.arguments;
      }
    }

    if (choice.finish_reason) {
      finishReason = choice.finish_reason;
    }

    // Usage (may come on last chunk with stream_options)
    if (chunk.usage) {
      promptTokens = chunk.usage.prompt_tokens ?? 0;
      completionTokens = chunk.usage.completion_tokens ?? 0;
    }
  }

  // Emit accumulated tool calls
  for (const tc of Object.values(toolCallAccum)) {
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(tc.args);
    } catch {
      parsedArgs = { raw: tc.args };
    }
    yield {
      type: "tool_call",
      toolCall: {
        id: tc.id,
        name: tc.name,
        arguments: tc.args,
        finished: true,
        parsedArgs,
      },
    };
  }

  yield {
    type: "done",
    done: {
      promptTokens,
      completionTokens,
      model: options.modelId,
      finishReason,
    },
  };
}

export async function embedOpenAI(opts: EmbedOptions): Promise<EmbedResult> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: config.OPENAI_EMBEDDING_MODEL,
    input: opts.texts,
  });
  return response.data.map((d) => d.embedding);
}

export async function checkOpenAIHealth(): Promise<boolean> {
  try {
    const client = getClient();
    await client.models.list();
    return true;
  } catch {
    return false;
  }
}
