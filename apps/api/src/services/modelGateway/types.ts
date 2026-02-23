// ============================================================
// Model Gateway - Types
// ============================================================
import type { Message } from "@janna/shared";

export interface GatewayMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  toolCallId?: string;
  name?: string;
}

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface StreamChatOptions {
  messages: GatewayMessage[];
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  userId: string;
  conversationId: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface GatewayStreamEvent {
  type: "token" | "tool_call" | "done" | "error";
  token?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string; // JSON string, accumulating
    finished?: boolean;
    parsedArgs?: Record<string, unknown>;
  };
  done?: {
    promptTokens: number;
    completionTokens: number;
    model: string;
    finishReason: string;
  };
  error?: string;
}

export interface EmbedOptions {
  texts: string[];
  provider?: "openai" | "local";
}

export type EmbedResult = number[][];

export interface HealthStatus {
  provider: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

// Convert DB Messages to Gateway format
export function dbMessagesToGateway(messages: Message[]): GatewayMessage[] {
  return messages
    .filter((m) => ["system", "user", "assistant", "tool"].includes(m.role))
    .map((m) => ({
      role: m.role as GatewayMessage["role"],
      content: m.content,
    }));
}
