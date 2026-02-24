'use client';

import { X, FileText, Link, Activity } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useChatStore } from '@/store/chatStore';
import { ToolCallCard } from './ToolCallCard';
import type { CitationRecord, SSEUsage } from '@janna/shared';

interface ActivityPanelProps {
  toolCalls?: import('@/types').StreamingToolCall[];
  citations?: CitationRecord[];
  usage?: SSEUsage;
}

export function ActivityPanel({
  toolCalls = [],
  citations = [],
  usage,
}: ActivityPanelProps) {
  const { setActivityPanelOpen } = useUIStore();

  const hasContent = toolCalls.length > 0 || citations.length > 0 || usage;

  return (
    <div className="flex h-full w-72 flex-col border-l border-border bg-surface animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-foreground">Activity</span>
        </div>
        <button
          onClick={() => setActivityPanelOpen(false)}
          className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-surface-raised transition-colors"
          aria-label="Close activity panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {!hasContent && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              Tool calls, citations, and usage will appear here during chat.
            </p>
          </div>
        )}

        {/* Tool calls */}
        {toolCalls.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Tool Calls ({toolCalls.length})
            </h3>
            <div className="space-y-2">
              {toolCalls.map((tc) => (
                <ToolCallCard key={tc.id} toolCall={tc} />
              ))}
            </div>
          </section>
        )}

        {/* Citations */}
        {citations.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Sources ({citations.length})
            </h3>
            <div className="space-y-2">
              {citations.map((c, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-background p-2.5"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {c.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Chunk {c.chunkIndex} · {Math.round(c.similarity * 100)}%
                        match
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2 italic">
                        "{c.excerpt}…"
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Token usage */}
        {usage && (
          <section>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Usage
            </h3>
            <div className="rounded-lg border border-border bg-background p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Prompt tokens</span>
                <span className="font-mono text-foreground">
                  {usage.promptTokens.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Output tokens</span>
                <span className="font-mono text-foreground">
                  {usage.completionTokens.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs border-t border-border pt-1.5">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono text-foreground">
                  {usage.totalTokens.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Cost est.</span>
                <span className="font-mono text-foreground">
                  ${usage.costEstimate.toFixed(5)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-mono text-foreground">
                  {(usage.latencyMs / 1000).toFixed(2)}s
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
