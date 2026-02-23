import { FileText, ExternalLink } from "lucide-react";
import type { Citation } from "@/types";

export function CitationBlock({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;

  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-xs font-medium text-text-muted uppercase tracking-wide">
        Sources
      </div>
      <div className="flex flex-wrap gap-2">
        {citations.map((c, i) => (
          <div
            key={`${c.attachmentId}-${c.chunkIndex}`}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-overlay px-2 py-1 text-xs text-text-secondary"
            title={c.excerpt}
          >
            <FileText size={11} className="text-text-muted shrink-0" />
            <span className="truncate max-w-[160px]">{c.filename}</span>
            <span className="text-text-muted">§{c.chunkIndex + 1}</span>
            <span className="text-text-muted">
              {(c.score * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
