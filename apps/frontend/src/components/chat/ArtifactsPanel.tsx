'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Code2,
  Eye,
  Copy,
  Check,
  Download,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/utils';

export interface Artifact {
  id: string;
  type: 'html' | 'svg' | 'code' | 'markdown' | 'mermaid' | 'react';
  title: string;
  content: string;
  language?: string;
}

interface ArtifactsPanelProps {
  artifacts: Artifact[];
  onClose: () => void;
}

function ArtifactViewer({ artifact }: { artifact: Artifact }) {
  const [view, setView] = useState<'preview' | 'source'>('preview');
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleCopy = async () => {
    await copyToClipboard(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext =
      artifact.type === 'html'
        ? 'html'
        : artifact.type === 'svg'
        ? 'svg'
        : artifact.language ?? 'txt';
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build the srcdoc for HTML artifacts
  const buildSrcdoc = (content: string, type: string) => {
    if (type === 'html') return content;
    if (type === 'svg') {
      return `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f9f6f1}</style></head><body>${content}</body></html>`;
    }
    if (type === 'mermaid') {
      return `<!DOCTYPE html><html><head>
        <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"><\/script>
        <style>body{margin:16px;font-family:Inter,sans-serif;}div.mermaid{max-width:100%}</style>
      </head><body>
        <div class="mermaid">${content}</div>
        <script>mermaid.initialize({startOnLoad:true,theme:'default'})<\/script>
      </body></html>`;
    }
    return `<!DOCTYPE html><html><head><style>body{margin:16px;font-family:monospace;white-space:pre-wrap;font-size:13px;line-height:1.5;background:#1e1e2e;color:#cdd6f4}</style></head><body>${content}</body></html>`;
  };

  const showPreview = ['html', 'svg', 'mermaid'].includes(artifact.type);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2 shrink-0">
        {showPreview && (
          <>
            <button
              onClick={() => setView('preview')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                view === 'preview'
                  ? 'bg-surface-raised text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              onClick={() => setView('source')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                view === 'source'
                  ? 'bg-surface-raised text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Code2 className="h-3.5 w-3.5" />
              Source
            </button>
          </>
        )}
        <div className="flex-1" />
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {showPreview && view === 'preview' ? (
          <iframe
            ref={iframeRef}
            className="artifact-frame"
            sandbox="allow-scripts"
            srcDoc={buildSrcdoc(artifact.content, artifact.type)}
            title={artifact.title}
          />
        ) : (
          <div className="h-full overflow-auto bg-[#1e1e2e]">
            <pre className="p-4 text-sm text-[#cdd6f4] font-mono leading-relaxed whitespace-pre-wrap break-words">
              {artifact.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function ArtifactsPanel({ artifacts, onClose }: ArtifactsPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(artifacts.length - 1);

  // Auto-navigate to newest artifact when list changes
  useEffect(() => {
    setCurrentIndex(artifacts.length - 1);
  }, [artifacts.length]);

  if (artifacts.length === 0) return null;

  const current = artifacts[currentIndex];

  return (
    <div className="flex h-full w-[480px] flex-col border-l border-border bg-background animate-slide-in-right shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Code2 className="h-4 w-4 text-[var(--accent)] shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">
            {current?.title ?? 'Artifact'}
          </span>
          {artifacts.length > 1 && (
            <span className="text-xs text-muted-foreground">
              ({currentIndex + 1}/{artifacts.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {artifacts.length > 1 && (
            <>
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() =>
                  setCurrentIndex((i) => Math.min(artifacts.length - 1, i + 1))
                }
                disabled={currentIndex === artifacts.length - 1}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-raised rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Type badge */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <span className="rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {current?.type}
        </span>
        {current?.language && (
          <span className="rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {current.language}
          </span>
        )}
      </div>

      {/* Viewer */}
      <div className="flex-1 overflow-hidden">
        {current && <ArtifactViewer artifact={current} />}
      </div>
    </div>
  );
}
