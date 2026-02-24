import { create } from 'zustand';
import type { StreamingMessage, StreamingToolCall } from '@/types';
import type { CitationRecord, SSEUsage } from '@janna/shared';

interface ChatState {
  // Active streaming message
  streamingMessage: StreamingMessage | null;
  isStreaming: boolean;

  // Selected model
  modelId: string;

  // RAG toggle
  ragEnabled: boolean;

  // Attachment IDs in the current composer
  pendingAttachmentIds: string[];

  // Start a new streaming message
  startStreaming: (conversationId: string) => void;

  // Append a token to the streaming message
  appendToken: (token: string) => void;

  // Add a tool call
  addToolCall: (tc: StreamingToolCall) => void;

  // Update a tool call with result
  updateToolCall: (
    id: string,
    update: Partial<StreamingToolCall>
  ) => void;

  // Add a citation
  addCitation: (citation: CitationRecord) => void;

  // Finalize the streaming message
  finalizeStream: (messageId: string, usage?: SSEUsage) => void;

  // Cancel / error stream
  cancelStream: () => void;

  // Settings
  setModelId: (id: string) => void;
  setRagEnabled: (enabled: boolean) => void;
  addPendingAttachment: (id: string) => void;
  removePendingAttachment: (id: string) => void;
  clearPendingAttachments: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  streamingMessage: null,
  isStreaming: false,
  modelId: 'openai:gpt-4o-mini',
  ragEnabled: true,
  pendingAttachmentIds: [],

  startStreaming: (conversationId) =>
    set({
      isStreaming: true,
      streamingMessage: {
        id: `streaming-${Date.now()}`,
        role: 'assistant',
        content: '',
        isStreaming: true,
        toolCalls: [],
        citations: [],
      },
    }),

  appendToken: (token) =>
    set((state) => ({
      streamingMessage: state.streamingMessage
        ? {
            ...state.streamingMessage,
            content: state.streamingMessage.content + token,
          }
        : null,
    })),

  addToolCall: (tc) =>
    set((state) => ({
      streamingMessage: state.streamingMessage
        ? {
            ...state.streamingMessage,
            toolCalls: [...state.streamingMessage.toolCalls, tc],
          }
        : null,
    })),

  updateToolCall: (id, update) =>
    set((state) => ({
      streamingMessage: state.streamingMessage
        ? {
            ...state.streamingMessage,
            toolCalls: state.streamingMessage.toolCalls.map((tc) =>
              tc.id === id ? { ...tc, ...update } : tc
            ),
          }
        : null,
    })),

  addCitation: (citation) =>
    set((state) => ({
      streamingMessage: state.streamingMessage
        ? {
            ...state.streamingMessage,
            citations: [...state.streamingMessage.citations, citation],
          }
        : null,
    })),

  finalizeStream: (messageId, usage) =>
    set((state) => ({
      isStreaming: false,
      streamingMessage: state.streamingMessage
        ? {
            ...state.streamingMessage,
            id: messageId,
            isStreaming: false,
            usage,
          }
        : null,
    })),

  cancelStream: () =>
    set({
      isStreaming: false,
      streamingMessage: null,
    }),

  setModelId: (modelId) => set({ modelId }),
  setRagEnabled: (ragEnabled) => set({ ragEnabled }),
  addPendingAttachment: (id) =>
    set((s) => ({
      pendingAttachmentIds: [...s.pendingAttachmentIds, id],
    })),
  removePendingAttachment: (id) =>
    set((s) => ({
      pendingAttachmentIds: s.pendingAttachmentIds.filter((a) => a !== id),
    })),
  clearPendingAttachments: () => set({ pendingAttachmentIds: [] }),
}));
