"use client";
import { useState } from "react";
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Edit3,
  User,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import { ToolCallBlock } from "./ToolCallBlock";
import { CitationBlock } from "./CitationBlock";
import type { Message, ToolCall, Citation } from "@/types";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  streamContent?: string;
  streamToolCalls?: ToolCall[];
  streamCitations?: Citation[];
  onRegenerate?: () => void;
  onEdit?: () => void;
}

export function ChatMessage({
  message,
  isStreaming,
  streamContent,
  streamToolCalls = [],
  streamCitations = [],
  onRegenerate,
  onEdit,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const content = isStreaming
    ? (streamContent ?? "")
    : message.content;

  const toolCalls = isStreaming
    ? streamToolCalls
    : (message.metadata?.toolCalls ?? []);

  const citations = isStreaming
    ? streamCitations
    : (message.metadata?.citations ?? []);

  const copyContent = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="group flex gap-3 justify-end px-4 py-2">
        <div className="flex flex-col items-end gap-1 max-w-[85%]">
          <div className="bg-accent-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-text-muted hover:text-text-secondary transition-colors"
              title="Edit message"
            >
              <Edit3 size={11} />
            </button>
            <button
              onClick={copyContent}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-text-muted hover:text-text-secondary transition-colors"
              title="Copy message"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          </div>
        </div>
        <div className="w-7 h-7 rounded-full bg-accent-100 dark:bg-accent-700/30 flex items-center justify-center shrink-0 mt-0.5">
          <User size={14} className="text-accent-600 dark:text-accent-400" />
        </div>
      </div>
    );
  }

  if (isAssistant || isStreaming) {
    return (
      <div className="group flex gap-3 px-4 py-2 message-enter">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <Bot size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {/* Tool calls */}
          {toolCalls.length > 0 && (
            <div className="space-y-1.5">
              {toolCalls.map((tc) => (
                <ToolCallBlock key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}

          {/* Content */}
          {content ? (
            <MarkdownRenderer
              content={content}
              isStreaming={isStreaming}
            />
          ) : isStreaming && toolCalls.length === 0 ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500 animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500 animate-bounce [animation-delay:300ms]" />
            </div>
          ) : null}

          {/* Citations */}
          {citations.length > 0 && (
            <CitationBlock citations={citations} />
          )}

          {/* Message metadata + actions */}
          {!isStreaming && (
            <div className="flex items-center gap-1 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={copyContent}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-text-muted hover:text-text-secondary transition-colors"
                title="Copy"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
              <button
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-text-muted hover:text-emerald-500 transition-colors"
                title="Good response"
              >
                <ThumbsUp size={11} />
              </button>
              <button
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-text-muted hover:text-red-500 transition-colors"
                title="Poor response"
              >
                <ThumbsDown size={11} />
              </button>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-text-muted hover:text-text-secondary transition-colors"
                  title="Regenerate"
                >
                  <RotateCcw size={11} />
                </button>
              )}
              {message.metadata?.model && (
                <span className="ml-2 text-xs text-text-muted">
                  {message.metadata.model.replace("openai:", "").replace("local:", "")}
                  {message.metadata.completionTokens
                    ? ` · ${message.metadata.completionTokens} tokens`
                    : ""}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
