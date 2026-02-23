// ============================================================
// Janna AI - Shared Types
// Used by both frontend and backend
// ============================================================

export type Role = "system" | "developer" | "user" | "assistant" | "tool";

export type MessageStatus = "pending" | "streaming" | "complete" | "error";

export type AttachmentStatus = "uploading" | "processing" | "ready" | "failed";

export type UserRole = "user" | "admin";

export interface UserProfile {
  id: string; // Cognito sub
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  parentConversationId?: string | null;
  messageCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: string;
  metadata?: MessageMetadata;
  parentMessageId?: string | null;
  status?: MessageStatus;
}

export interface MessageMetadata {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  toolCalls?: ToolCall[];
  citations?: Citation[];
  finishReason?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "running" | "done" | "error";
  latencyMs?: number;
}

export interface Citation {
  attachmentId: string;
  filename: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
}

export interface Attachment {
  id: string;
  userId: string;
  conversationId?: string | null;
  filename: string;
  mimeType: string;
  size: number;
  s3Key: string;
  createdAt: string;
  status: AttachmentStatus;
}

export interface DocumentChunk {
  id: string;
  attachmentId: string;
  chunkIndex: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface UsageEvent {
  id: string;
  userId: string;
  conversationId?: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  costEstimate: number;
  createdAt: string;
}

// API Request / Response types

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  attachmentIds?: string[];
  modelId?: string;
  ragEnabled?: boolean;
  parentMessageId?: string;
}

export interface StreamChunk {
  type: "token" | "tool_call" | "tool_result" | "citation" | "done" | "error";
  data: unknown;
}

export interface TokenChunk {
  type: "token";
  data: { token: string; messageId: string };
}

export interface ToolCallChunk {
  type: "tool_call";
  data: ToolCall;
}

export interface ToolResultChunk {
  type: "tool_result";
  data: { toolCallId: string; result: unknown; status: "done" | "error" };
}

export interface CitationChunk {
  type: "citation";
  data: Citation[];
}

export interface DoneChunk {
  type: "done";
  data: {
    messageId: string;
    promptTokens: number;
    completionTokens: number;
    model: string;
    finishReason: string;
  };
}

export interface ErrorChunk {
  type: "error";
  data: { message: string; code?: string };
}

// Model Registry
export interface ModelConfig {
  id: string;
  name: string;
  provider: "openai" | "local";
  maxTokens: number;
  contextWindow: number;
  costWeight: number;
  latencyWeight: number;
  endpoint?: string;
}

export interface AdminMetrics {
  totalUsers: number;
  activeUsersToday: number;
  totalConversations: number;
  totalMessages: number;
  totalTokensUsed: number;
  estimatedCostUsd: number;
  averageLatencyMs: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
