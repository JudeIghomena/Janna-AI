'use client';

import { useCallback, useRef } from 'react';
import { chatApi } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { useOptimisticMessage } from './useConversations';
import type { SSEEvent } from '@janna/shared';

export function useChat() {
  const store = useChatStore();
  const { addUserMessage, addAssistantMessage, invalidate } =
    useOptimisticMessage();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (conversationId: string, content: string) => {
      if (store.isStreaming) return;

      const tempUserMsgId = `temp-${Date.now()}`;
      addUserMessage(conversationId, content, tempUserMsgId);
      store.startStreaming(conversationId);

      // Abort previous if any
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await chatApi.stream({
          conversationId,
          message: content,
          modelId: store.modelId,
          ragEnabled: store.ragEnabled,
          attachmentIds:
            store.pendingAttachmentIds.length > 0
              ? store.pendingAttachmentIds
              : undefined,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(
            errorBody.error ?? `HTTP ${response.status}`
          );
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processEvent = (data: string) => {
          if (data === '[DONE]') return;
          try {
            const event = JSON.parse(data) as SSEEvent;
            switch (event.type) {
              case 'token':
                store.appendToken(event.content);
                break;
              case 'tool_call_start':
                store.addToolCall({
                  id: event.toolCallId,
                  name: event.name,
                  input: event.input,
                  status: 'running',
                });
                break;
              case 'tool_call_result':
                store.updateToolCall(event.toolCallId, {
                  output: event.output,
                  error: event.error,
                  status: event.error ? 'error' : 'done',
                });
                break;
              case 'citation':
                store.addCitation({
                  attachmentId: event.attachmentId,
                  filename: event.filename,
                  chunkIndex: event.chunkIndex,
                  excerpt: event.excerpt,
                  similarity: event.similarity,
                });
                break;
              case 'usage':
                // handled at done
                store.finalizeStream('streaming', event);
                break;
              case 'done': {
                const sm = useChatStore.getState().streamingMessage;
                store.finalizeStream(event.messageId);

                // Add final assistant message to cache
                if (sm) {
                  addAssistantMessage(conversationId, {
                    id: event.messageId,
                    conversationId,
                    role: 'assistant',
                    content: sm.content,
                    createdAt: new Date().toISOString(),
                    metadata: {
                      toolCalls: sm.toolCalls,
                      citations: sm.citations,
                      usage: sm.usage,
                    },
                    parentMessageId: null,
                  });
                }

                store.clearPendingAttachments();
                invalidate(conversationId);
                break;
              }
              case 'error':
                console.error('[Chat] Stream error:', event.message);
                store.cancelStream();
                break;
            }
          } catch {
            // ignore malformed SSE events
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done || controller.signal.aborted) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              processEvent(line.slice(6).trim());
            }
          }
        }

        // Process any remaining buffer
        if (buffer.startsWith('data: ')) {
          processEvent(buffer.slice(6).trim());
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('[Chat] Error:', err);
        }
        store.cancelStream();
        invalidate(conversationId);
      }
    },
    [store, addUserMessage, addAssistantMessage, invalidate]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    store.cancelStream();
  }, [store]);

  return {
    sendMessage,
    stopStreaming,
    isStreaming: store.isStreaming,
    streamingMessage: store.streamingMessage,
    modelId: store.modelId,
    ragEnabled: store.ragEnabled,
    setModelId: store.setModelId,
    setRagEnabled: store.setRagEnabled,
    pendingAttachmentIds: store.pendingAttachmentIds,
    addPendingAttachment: store.addPendingAttachment,
    removePendingAttachment: store.removePendingAttachment,
  };
}
