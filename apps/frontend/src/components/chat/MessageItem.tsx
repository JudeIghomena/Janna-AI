'use client';

import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Pencil,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard, formatRelativeTime } from '@/lib/utils';
import { useMessageFeedback } from '@/hooks/useConversations';
import type { MessageDetail } from '@janna/shared';
import type { StreamingMessage } from '@/types';

interface MessageItemProps {
  message: MessageDetail | StreamingMessage;
  onEdit?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  isLast?: boolean;
  userInitials?: string;
}

// ─── Code block with copy button ─────────────────────────────────────────────
function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');
  const language = /language-(\w+)/.exec(className ?? '')?.[1];
  const isInline = !className?.includes('language-');

  const handleCopy = useCallback(async () => {
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  if (isInline) {
    return (
      <code
        className="rounded-md bg-surface-raised px-1.5 py-0.5 text-[13px] font-mono text-foreground border border-border"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-xl border border-white/10 bg-[#1e1e2e]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-[#181825]">
        <span className="text-xs font-medium text-white/40 font-mono">
          {language ?? 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-auto p-4 text-sm leading-relaxed">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

// ─── Thinking block (collapsible) ────────────────────────────────────────────
function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="my-2 rounded-xl border border-border bg-surface-raised overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span className="font-medium">Thinking</span>
        {expanded ? (
          <ChevronUp className="ml-auto h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="ml-auto h-3.5 w-3.5" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main message component ───────────────────────────────────────────────────
export function MessageItem({
  message,
  onEdit,
  onRegenerate,
  isLast,
  userInitials = 'U',
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const { mutate: feedback } = useMessageFeedback();

  const isUser = message.role === 'user';
  const isStreaming = 'isStreaming' in message && message.isStreaming;
  const metadata = 'metadata' in message ? (message.metadata as Record<string, unknown>) : {};
  const thumbsUp = (metadata as { thumbsUp?: boolean | null })?.thumbsUp;

  const handleCopy = useCallback(async () => {
    await copyToClipboard(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  // ── User message layout ──────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div
        className="group flex justify-end px-4 py-2 animate-fade-in"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="flex flex-col items-end gap-1 max-w-[75%]">
          {/* Message bubble */}
          <div className="rounded-2xl rounded-tr-sm bg-[var(--accent)] px-4 py-2.5 text-sm text-white shadow-sm">
            <p className="whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          </div>

          {/* Actions */}
          <div
            className={cn(
              'flex items-center gap-1 transition-opacity',
              showActions ? 'opacity-100' : 'opacity-0'
            )}
          >
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
            {onEdit && 'id' in message && (
              <button
                onClick={() => onEdit(message.id, message.content)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* User avatar */}
        <div className="ml-3 mt-0.5 h-8 w-8 shrink-0 rounded-full avatar-gradient flex items-center justify-center text-white text-xs font-bold">
          {userInitials}
        </div>
      </div>
    );
  }

  // ── Assistant message layout ─────────────────────────────────────────────────
  return (
    <div
      className="group flex gap-4 px-4 py-4 animate-fade-in"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Assistant avatar */}
      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center shadow-sm">
        <Sparkles className="h-4 w-4 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              code: CodeBlock as React.ComponentType<React.HTMLAttributes<HTMLElement>>,
              table: ({ children, ...props }) => (
                <div className="overflow-x-auto my-3">
                  <table
                    className="min-w-full text-sm border-collapse"
                    {...props}
                  >
                    {children}
                  </table>
                </div>
              ),
              th: ({ children, ...props }) => (
                <th
                  className="border border-border bg-surface-raised px-3 py-2 text-left text-xs font-semibold text-foreground"
                  {...props}
                >
                  {children}
                </th>
              ),
              td: ({ children, ...props }) => (
                <td
                  className="border border-border px-3 py-2 text-sm text-foreground"
                  {...props}
                >
                  {children}
                </td>
              ),
              a: ({ children, href, ...props }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                  {...props}
                >
                  {children}
                </a>
              ),
              blockquote: ({ children, ...props }) => (
                <blockquote
                  className="border-l-4 border-[var(--accent)] bg-surface-raised pl-4 py-1 my-3 rounded-r-lg text-muted-foreground"
                  {...props}
                >
                  {children}
                </blockquote>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>

          {/* Streaming cursor */}
          {isStreaming && (
            <span className="inline-block h-4 w-0.5 animate-pulse bg-[var(--accent)] ml-0.5 align-middle rounded-full" />
          )}
        </div>

        {/* Timestamp */}
        {'createdAt' in message && message.createdAt && !isStreaming && (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatRelativeTime(message.createdAt)}
          </p>
        )}

        {/* Action bar */}
        {!isStreaming && (
          <div
            className={cn(
              'mt-2 flex items-center gap-1 transition-opacity',
              showActions || isLast ? 'opacity-100' : 'opacity-0'
            )}
          >
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
              title="Copy response"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>

            {'id' in message && (
              <>
                <button
                  onClick={() =>
                    feedback({
                      messageId: message.id,
                      thumbsUp: thumbsUp === true ? null : true,
                    })
                  }
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors',
                    thumbsUp === true
                      ? 'text-green-600 bg-green-50 dark:bg-green-950/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
                  )}
                  title="Good response"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() =>
                    feedback({
                      messageId: message.id,
                      thumbsUp: thumbsUp === false ? null : false,
                    })
                  }
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors',
                    thumbsUp === false
                      ? 'text-red-500 bg-red-50 dark:bg-red-950/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
                  )}
                  title="Bad response"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>

                {isLast && onRegenerate && (
                  <button
                    onClick={() => onRegenerate(message.id)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
                    title="Regenerate response"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
