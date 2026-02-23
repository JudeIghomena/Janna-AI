"use client";
import { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import { useChatStore } from "@/store/chatStore";

interface ChatThreadProps {
  conversationId: string;
  initialMessages?: import("@/types").Message[];
}

export function ChatThread({ conversationId, initialMessages = [] }: ChatThreadProps) {
  const { messages, streaming, isStreaming, setMessages } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sync initial messages from server
  useEffect(() => {
    if (initialMessages.length > 0 && !messages[conversationId]?.length) {
      setMessages(conversationId, initialMessages);
    }
  }, [conversationId, initialMessages, setMessages, messages]);

  const displayMessages = messages[conversationId] ?? initialMessages;
  const streamState = streaming[conversationId];

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, streamState?.content]);

  if (displayMessages.length === 0 && !streamState) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-lg">
          <span className="text-white text-2xl font-bold">J</span>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">
            How can I help you today?
          </h2>
          <p className="text-sm text-text-muted max-w-sm">
            Ask me anything. I can help with analysis, writing, coding,
            and retrieving information from your documents.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 max-w-sm w-full">
          {[
            "Summarize my uploaded documents",
            "Help me write a technical spec",
            "Analyze this data and find trends",
            "Explain a complex concept simply",
          ].map((prompt) => (
            <button
              key={prompt}
              className="text-left text-xs text-text-secondary border border-border rounded-lg p-3 hover:bg-surface-overlay hover:border-accent-500/50 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-4 space-y-1">
      {displayMessages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}

      {/* Streaming message */}
      {streamState && (
        <ChatMessage
          key="streaming"
          message={{
            id: streamState.messageId,
            conversationId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
          }}
          isStreaming
          streamContent={streamState.content}
          streamToolCalls={streamState.toolCalls}
          streamCitations={streamState.citations}
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
