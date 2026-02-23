// Re-export shared types and add frontend-only types
export * from "@janna/shared";

export interface StreamingMessage {
  id: string;
  conversationId: string;
  role: "assistant";
  content: string;
  isStreaming: boolean;
  toolCalls: import("@janna/shared").ToolCall[];
  citations: import("@janna/shared").Citation[];
  createdAt: string;
}

export type AccentColor = "violet" | "blue" | "emerald" | "rose";
export type Theme = "light" | "dark" | "system";

export interface UISettings {
  theme: Theme;
  accentColor: AccentColor;
  fontSize: "sm" | "md" | "lg";
  ragEnabled: boolean;
  selectedModelId: string;
}
