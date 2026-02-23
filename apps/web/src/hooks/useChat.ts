"use client";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "@/store/chatStore";
import { useUIStore } from "@/store/uiStore";
import { useSSE } from "./useSSE";
import type { Message, ToolCall, Citation } from "@/types";

export function useChat(conversationId: string) {
  const qc = useQueryClient();
  const { stream, cancel } = useSSE();
  const {
    messages,
    streaming,
    isStreaming,
    addMessage,
    startStreaming,
    appendToken,
    addToolCall,
    updateToolCall,
    addCitations,
    finalizeStream,
    cancelStream,
  } = useChatStore();

  const { selectedModelId, ragEnabled } = useUIStore();

  const sendMessage = useCallback(
    async (content: string, attachmentIds?: string[], parentMessageId?: string) => {
      if (!content.trim() || isStreaming[conversationId]) return;

      // Optimistically add user message
      const userMsg: Message = {
        id: `temp_user_${Date.now()}`,
        conversationId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
        metadata: {},
      };
      addMessage(conversationId, userMsg);

      // Start streaming state
      startStreaming(conversationId);

      await stream(
        {
          conversationId,
          content,
          modelId: selectedModelId,
          ragEnabled,
          parentMessageId,
        },
        {
          onToken: (token) => appendToken(conversationId, token),
          onToolCall: (tc) => addToolCall(conversationId, tc as ToolCall),
          onToolResult: (res: unknown) => {
            const r = res as { toolCallId: string; result: unknown; status: "done" | "error" };
            updateToolCall(conversationId, r.toolCallId, {
              result: r.result,
              status: r.status,
            });
          },
          onCitation: (citations) =>
            addCitations(conversationId, citations as Citation[]),
          onDone: (data: unknown) => {
            const d = data as { messageId: string; promptTokens: number; completionTokens: number; model: string; finishReason: string };
            const currentStreaming = useChatStore.getState().streaming[conversationId];
            const finalMessage: Message = {
              id: d.messageId,
              conversationId,
              role: "assistant",
              content: currentStreaming?.content ?? "",
              createdAt: new Date().toISOString(),
              metadata: {
                model: d.model,
                promptTokens: d.promptTokens,
                completionTokens: d.completionTokens,
                finishReason: d.finishReason,
                toolCalls: currentStreaming?.toolCalls ?? [],
                citations: currentStreaming?.citations ?? [],
              },
            };
            finalizeStream(conversationId, finalMessage);
            // Invalidate messages query to sync with server
            qc.invalidateQueries({ queryKey: ["messages", conversationId] });
            // Invalidate conversations to update title/time
            qc.invalidateQueries({ queryKey: ["conversations"] });
          },
          onError: (err) => {
            console.error("[Chat] Stream error:", err);
            cancelStream(conversationId);
          },
        }
      );
    },
    [
      conversationId,
      selectedModelId,
      ragEnabled,
      isStreaming,
      stream,
      addMessage,
      startStreaming,
      appendToken,
      addToolCall,
      updateToolCall,
      addCitations,
      finalizeStream,
      cancelStream,
      qc,
    ]
  );

  const stopStreaming = useCallback(() => {
    cancel();
    cancelStream(conversationId);
  }, [cancel, cancelStream, conversationId]);

  return {
    messages: messages[conversationId] ?? [],
    streaming: streaming[conversationId] ?? null,
    isStreaming: isStreaming[conversationId] ?? false,
    sendMessage,
    stopStreaming,
  };
}
