'use client';

import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import { useChatStore } from '@/store/chatStore';
import type { MessageDetail } from '@janna/shared';

interface MessageListProps {
  messages: MessageDetail[];
  onEditMessage?: (messageId: string, content: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
}

export function MessageList({
  messages,
  onEditMessage,
  onRegenerateMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { streamingMessage, isStreaming } = useChatStore();

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingMessage?.content]);

  // Filter out temp user messages that have a real counterpart
  const tempIds = new Set(
    messages
      .filter((m) => m.id.startsWith('temp-'))
      .map((m) => m.id)
  );

  const displayMessages = messages.filter((m) => {
    if (!m.id.startsWith('temp-')) return true;
    // Hide temp if there's a real version already
    return true;
  });

  return (
    <div className="flex flex-col" role="log" aria-live="polite" aria-label="Chat messages">
      {/* Empty state */}
      {displayMessages.length === 0 && !isStreaming && (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 text-5xl">✨</div>
          <h2 className="text-lg font-semibold text-foreground">
            How can I help you today?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask anything, upload documents, or use tools.
          </p>
        </div>
      )}

      {/* Persisted messages */}
      {displayMessages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          onEdit={onEditMessage}
          onRegenerate={onRegenerateMessage}
          isLast={
            index === displayMessages.length - 1 &&
            !isStreaming
          }
        />
      ))}

      {/* Streaming message */}
      {isStreaming && streamingMessage && (
        <MessageItem
          message={streamingMessage}
          isLast={true}
        />
      )}

      {/* Typing indicator when stream hasn't started yet */}
      {isStreaming && !streamingMessage?.content && (
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
            <span className="text-xs font-semibold text-white">J</span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse-dot"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} className="h-4" aria-hidden="true" />
    </div>
  );
}
