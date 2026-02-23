import { create } from "zustand";
import type { Message, ToolCall, Citation } from "@/types";
import { generateId } from "@/lib/utils";

interface StreamingState {
  messageId: string;
  content: string;
  toolCalls: ToolCall[];
  citations: Citation[];
}

interface ChatState {
  messages: Record<string, Message[]>; // conversationId -> messages
  streaming: Record<string, StreamingState | null>; // conversationId -> streaming state
  isStreaming: Record<string, boolean>;

  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  startStreaming: (conversationId: string) => string; // returns temp messageId
  appendToken: (conversationId: string, token: string) => void;
  addToolCall: (conversationId: string, toolCall: ToolCall) => void;
  updateToolCall: (conversationId: string, toolCallId: string, update: Partial<ToolCall>) => void;
  addCitations: (conversationId: string, citations: Citation[]) => void;
  finalizeStream: (
    conversationId: string,
    finalMessage: Message
  ) => void;
  cancelStream: (conversationId: string) => void;
  clearMessages: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  streaming: {},
  isStreaming: {},

  setMessages: (conversationId, messages) =>
    set((s) => ({ messages: { ...s.messages, [conversationId]: messages } })),

  addMessage: (conversationId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] ?? []), message],
      },
    })),

  startStreaming: (conversationId) => {
    const messageId = `stream_${generateId()}`;
    set((s) => ({
      streaming: {
        ...s.streaming,
        [conversationId]: { messageId, content: "", toolCalls: [], citations: [] },
      },
      isStreaming: { ...s.isStreaming, [conversationId]: true },
    }));
    return messageId;
  },

  appendToken: (conversationId, token) =>
    set((s) => {
      const current = s.streaming[conversationId];
      if (!current) return s;
      return {
        streaming: {
          ...s.streaming,
          [conversationId]: { ...current, content: current.content + token },
        },
      };
    }),

  addToolCall: (conversationId, toolCall) =>
    set((s) => {
      const current = s.streaming[conversationId];
      if (!current) return s;
      return {
        streaming: {
          ...s.streaming,
          [conversationId]: {
            ...current,
            toolCalls: [...current.toolCalls, toolCall],
          },
        },
      };
    }),

  updateToolCall: (conversationId, toolCallId, update) =>
    set((s) => {
      const current = s.streaming[conversationId];
      if (!current) return s;
      return {
        streaming: {
          ...s.streaming,
          [conversationId]: {
            ...current,
            toolCalls: current.toolCalls.map((tc) =>
              tc.id === toolCallId ? { ...tc, ...update } : tc
            ),
          },
        },
      };
    }),

  addCitations: (conversationId, citations) =>
    set((s) => {
      const current = s.streaming[conversationId];
      if (!current) return s;
      return {
        streaming: {
          ...s.streaming,
          [conversationId]: { ...current, citations },
        },
      };
    }),

  finalizeStream: (conversationId, finalMessage) =>
    set((s) => ({
      streaming: { ...s.streaming, [conversationId]: null },
      isStreaming: { ...s.isStreaming, [conversationId]: false },
      messages: {
        ...s.messages,
        [conversationId]: [
          ...(s.messages[conversationId] ?? []),
          finalMessage,
        ],
      },
    })),

  cancelStream: (conversationId) =>
    set((s) => ({
      streaming: { ...s.streaming, [conversationId]: null },
      isStreaming: { ...s.isStreaming, [conversationId]: false },
    })),

  clearMessages: (conversationId) =>
    set((s) => ({
      messages: { ...s.messages, [conversationId]: [] },
    })),
}));
