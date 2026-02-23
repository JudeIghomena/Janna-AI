"use client";
import { X, Activity, Wrench } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { ToolCallBlock } from "./ToolCallBlock";
import { CitationBlock } from "./CitationBlock";

interface ActivityPanelProps {
  conversationId: string;
  onClose: () => void;
}

export function ActivityPanel({ conversationId, onClose }: ActivityPanelProps) {
  const { messages } = useChatStore();
  const msgs = messages[conversationId] ?? [];

  // Gather all tool calls and citations from assistant messages
  const activities = msgs
    .filter((m) => m.role === "assistant")
    .flatMap((m) => {
      const tcs = m.metadata?.toolCalls ?? [];
      const citations = m.metadata?.citations ?? [];
      return tcs.length > 0 || citations.length > 0
        ? [{ messageId: m.id, toolCalls: tcs, citations, createdAt: m.createdAt }]
        : [];
    })
    .reverse();

  return (
    <div className="w-72 border-l border-border bg-surface-raised flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <Activity size={15} className="text-accent-500" />
          Activity
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Wrench size={20} className="text-text-muted" />
            <p className="text-xs text-text-muted">
              Tool calls and citations will appear here
            </p>
          </div>
        ) : (
          activities.map((a) => (
            <div key={a.messageId} className="space-y-2">
              <div className="text-xs text-text-muted">
                {new Date(a.createdAt).toLocaleTimeString()}
              </div>
              {a.toolCalls.map((tc) => (
                <ToolCallBlock key={tc.id} toolCall={tc} />
              ))}
              {a.citations.length > 0 && (
                <CitationBlock citations={a.citations} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
