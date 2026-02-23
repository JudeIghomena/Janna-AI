"use client";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Calculator,
  Search,
  Globe,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCall } from "@/types";

const TOOL_ICONS: Record<string, React.ReactNode> = {
  calculator: <Calculator size={14} />,
  retrieve_docs: <Search size={14} />,
  web_search: <Globe size={14} />,
  summarize_attachment: <FileText size={14} />,
};

export function ToolCallBlock({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon =
    toolCall.status === "done" ? (
      <CheckCircle size={14} className="text-emerald-500" />
    ) : toolCall.status === "error" ? (
      <XCircle size={14} className="text-red-500" />
    ) : (
      <Loader2 size={14} className="animate-spin text-accent-500" />
    );

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface-overlay text-sm overflow-hidden",
        toolCall.status === "error" && "border-red-300 dark:border-red-800"
      )}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-raised transition-colors"
      >
        <span className="text-text-muted">
          {TOOL_ICONS[toolCall.name] ?? <Calculator size={14} />}
        </span>
        <span className="flex-1 text-left font-mono text-xs text-text-secondary">
          {toolCall.name}(
          {Object.keys(toolCall.arguments ?? {})
            .slice(0, 2)
            .join(", ")}
          {Object.keys(toolCall.arguments ?? {}).length > 2 ? ", …" : ""})
        </span>
        {statusIcon}
        <span className="text-text-muted">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          <div>
            <div className="text-xs font-medium text-text-muted mb-1">Arguments</div>
            <pre className="text-xs text-text-secondary overflow-auto rounded bg-surface-raised p-2 font-mono">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div>
              <div className="text-xs font-medium text-text-muted mb-1">
                Result {toolCall.latencyMs ? `· ${toolCall.latencyMs}ms` : ""}
              </div>
              <pre className="text-xs text-text-secondary overflow-auto rounded bg-surface-raised p-2 font-mono max-h-40">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
