// ─── Roles ────────────────────────────────────────────────────────────────────
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'developer';
export type UserRole = 'user' | 'admin';

// ─── Model & Provider ─────────────────────────────────────────────────────────
export type ModelProvider = 'openai' | 'anthropic' | 'local';

export interface ModelConfig {
  id: string;             // e.g. "openai:gpt-4o-mini"
  provider: ModelProvider;
  name: string;           // e.g. "gpt-4o-mini"
  displayName: string;
  maxOutputTokens: number;
  contextWindow: number;
  costWeight: number;     // relative cost score 0-10
  latencyWeight: number;  // relative speed score 0-10 (10 = fastest)
  endpoint?: string;      // only for local models
  supportsVision?: boolean;
  supportsTools?: boolean;
}

export const MODEL_REGISTRY: ModelConfig[] = [
  {
    id: 'openai:gpt-4o-mini',
    provider: 'openai',
    name: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    maxOutputTokens: 16384,
    contextWindow: 128000,
    costWeight: 1,
    latencyWeight: 9,
    supportsVision: true,
    supportsTools: true,
  },
  {
    id: 'openai:gpt-4.1',
    provider: 'openai',
    name: 'gpt-4.1',
    displayName: 'GPT-4.1',
    maxOutputTokens: 32768,
    contextWindow: 1047576,
    costWeight: 5,
    latencyWeight: 6,
    supportsVision: true,
    supportsTools: true,
  },
  {
    id: 'anthropic:claude-sonnet-4-6',
    provider: 'anthropic',
    name: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    maxOutputTokens: 16000,
    contextWindow: 200000,
    costWeight: 4,
    latencyWeight: 7,
    supportsVision: true,
    supportsTools: true,
  },
  {
    id: 'anthropic:claude-haiku-4-5',
    provider: 'anthropic',
    name: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    maxOutputTokens: 16000,
    contextWindow: 200000,
    costWeight: 1,
    latencyWeight: 10,
    supportsVision: true,
    supportsTools: true,
  },
  {
    id: 'local:llama-3.1-70b',
    provider: 'local',
    name: 'llama-3.1-70b',
    displayName: 'Llama 3.1 70B (Local)',
    maxOutputTokens: 8192,
    contextWindow: 131072,
    costWeight: 0,
    latencyWeight: 5,
    supportsVision: false,
    supportsTools: true,
  },
];

// ─── SSE Event types (shared between backend emitter and frontend consumer) ──
export type SSEEventType =
  | 'token'
  | 'tool_call_start'
  | 'tool_call_result'
  | 'citation'
  | 'usage'
  | 'error'
  | 'done';

export interface SSEToken {
  type: 'token';
  content: string;
}

export interface SSEToolCallStart {
  type: 'tool_call_start';
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
}

export interface SSEToolCallResult {
  type: 'tool_call_result';
  toolCallId: string;
  name: string;
  output: unknown;
  error?: string;
}

export interface SSECitation {
  type: 'citation';
  attachmentId: string;
  filename: string;
  chunkIndex: number;
  excerpt: string;
  similarity: number;
}

export interface SSEUsage {
  type: 'usage';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: number;
  latencyMs: number;
}

export interface SSEError {
  type: 'error';
  message: string;
  code: string;
}

export interface SSEDone {
  type: 'done';
  messageId: string;
  conversationId: string;
}

export type SSEEvent =
  | SSEToken
  | SSEToolCallStart
  | SSEToolCallResult
  | SSECitation
  | SSEUsage
  | SSEError
  | SSEDone;

// ─── API Request / Response types ─────────────────────────────────────────────
export interface ChatStreamRequest {
  conversationId: string;
  message: string;
  modelId?: string;
  ragEnabled?: boolean;
  temperature?: number;
  maxTokens?: number;
  attachmentIds?: string[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  messageCount: number;
  lastMessage?: string;
  parentConversationId?: string | null;
}

export interface ConversationDetail extends ConversationSummary {
  messages: MessageDetail[];
}

export interface MessageDetail {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  metadata: MessageMetadata;
  parentMessageId?: string | null;
  attachments?: AttachmentSummary[];
}

export interface MessageMetadata {
  modelId?: string;
  promptTokens?: number;
  completionTokens?: number;
  costEstimate?: number;
  latencyMs?: number;
  toolCalls?: ToolCallRecord[];
  citations?: CitationRecord[];
  thumbsUp?: boolean | null;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  latencyMs?: number;
}

export interface CitationRecord {
  attachmentId: string;
  filename: string;
  chunkIndex: number;
  excerpt: string;
  similarity: number;
}

export interface AttachmentSummary {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: AttachmentStatus;
  createdAt: string;
}

export type AttachmentStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'error';

export interface PresignResponse {
  uploadUrl: string;
  s3Key: string;
  attachmentId: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Error shape ──────────────────────────────────────────────────────────────
export interface ApiError {
  error: string;
  code: string;
  statusCode?: number;
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export interface AdminMetrics {
  totalUsers: number;
  activeUsers24h: number;
  totalConversations: number;
  totalMessages: number;
  totalTokensUsed: number;
  estimatedCostUsd: number;
  topModels: Array<{ modelId: string; count: number }>;
  dailyUsage: Array<{ date: string; messages: number; tokens: number }>;
}

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  disabled: boolean;
  messageCount: number;
  tokenCount: number;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}
