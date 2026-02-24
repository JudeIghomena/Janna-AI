// Re-export everything from shared
export * from '@janna/shared';

// ─── Frontend-only types ──────────────────────────────────────────────────────
export interface StreamingMessage {
  id: string;
  role: 'assistant';
  content: string;
  isStreaming: boolean;
  toolCalls: StreamingToolCall[];
  citations: import('@janna/shared').CitationRecord[];
  usage?: import('@janna/shared').SSEUsage;
}

export interface StreamingToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  status: 'running' | 'done' | 'error';
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  token: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UISettings {
  theme: ThemeMode;
  accentColor: string;
  fontSize: 'sm' | 'md' | 'lg';
  compactMode: boolean;
  sendOnEnter: boolean;
  showLineNumbers: boolean;
}

export const DEFAULT_UI_SETTINGS: UISettings = {
  theme: 'system',
  accentColor: '250 75% 60%', // oklch
  fontSize: 'md',
  compactMode: false,
  sendOnEnter: true,
  showLineNumbers: true,
};
