export const MODEL_REGISTRY = [
  {
    id: "openai:gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai" as const,
    maxTokens: 16384,
    contextWindow: 128000,
    costWeight: 1,
    latencyWeight: 1,
  },
  {
    id: "openai:gpt-4.1",
    name: "GPT-4.1",
    provider: "openai" as const,
    maxTokens: 32768,
    contextWindow: 1000000,
    costWeight: 10,
    latencyWeight: 3,
  },
  {
    id: "local:llama-3.1-70b",
    name: "Llama 3.1 70B (Local)",
    provider: "local" as const,
    maxTokens: 8192,
    contextWindow: 131072,
    costWeight: 0,
    latencyWeight: 5,
  },
] as const;

export const DEFAULT_MODEL_ID = "openai:gpt-4o-mini";

export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

export const RAG_TOP_K = 5;
export const CHUNK_SIZE = 512;
export const CHUNK_OVERLAP = 64;

export const TOOL_NAMES = ["calculator", "retrieve_docs", "web_search", "summarize_attachment"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const SSE_EVENTS = {
  TOKEN: "token",
  TOOL_CALL: "tool_call",
  TOOL_RESULT: "tool_result",
  CITATION: "citation",
  DONE: "done",
  ERROR: "error",
} as const;
