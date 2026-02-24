'use client';

import { useState } from 'react';
import {
  Calculator,
  FileSearch,
  Globe,
  Terminal,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StreamingToolCall } from '@/types';

const TOOL_ICONS: Record<string, React.ElementType> = {
  calculator: Calculator,
  retrieve_docs: FileSearch,
  web_search: Globe,
};

interface ToolCallCardProps {
  toolCall: StreamingToolCall;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[toolCall.name] ?? Terminal;

  const statusIcon = {
    running: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />,
    done: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
    error: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  }[toolCall.status];

  const displayName = toolCall.name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        toolCall.status === 'error'
          ? 'border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/20'
          : 'border-border bg-surface'
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={expanded}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
          <Icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-foreground">
            {displayName}
          </span>
          {toolCall.status === 'running' && (
            <span className="ml-2 text-xs text-muted-foreground">
              Running...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {statusIcon}
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 pb-3">
          {/* Input */}
          <div className="mt-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Input
            </p>
            <pre className="overflow-auto rounded-md bg-background p-2 text-xs text-foreground font-mono max-h-32">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {(toolCall.output !== undefined || toolCall.error) && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {toolCall.error ? 'Error' : 'Output'}
              </p>
              <pre
                className={cn(
                  'overflow-auto rounded-md p-2 text-xs font-mono max-h-48',
                  toolCall.error
                    ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                    : 'bg-background text-foreground'
                )}
              >
                {toolCall.error
                  ? toolCall.error
                  : JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
