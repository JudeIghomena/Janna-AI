'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Send,
  Square,
  Paperclip,
  X,
  ChevronDown,
  Database,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/uiStore';
import { useChatStore } from '@/store/chatStore';
import { attachmentsApi } from '@/lib/api';
import { MODEL_REGISTRY } from '@janna/shared';
import { formatBytes } from '@/lib/utils';

interface PendingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  attachmentId?: string;
}

interface MessageComposerProps {
  conversationId: string;
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function MessageComposer({
  conversationId,
  onSend,
  disabled,
}: MessageComposerProps) {
  const { sendOnEnter } = useUIStore();
  const {
    isStreaming,
    modelId,
    ragEnabled,
    setModelId,
    setRagEnabled,
    addPendingAttachment,
    removePendingAttachment,
  } = useChatStore();

  const [content, setContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = MODEL_REGISTRY.find((m) => m.id === modelId);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [content]);

  // Close model dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setContent('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [content, isStreaming, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sendOnEnter && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPendingFiles((prev) => [
        ...prev,
        { id: fileId, file, progress: 0, status: 'uploading' },
      ]);

      try {
        const presign = await attachmentsApi.presign({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          conversationId,
        });

        await attachmentsApi.uploadToS3(file, presign.uploadUrl, (pct) => {
          setPendingFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, progress: pct } : f))
          );
        });

        await attachmentsApi.complete(presign.attachmentId);
        addPendingAttachment(presign.attachmentId);
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, progress: 100, status: 'done', attachmentId: presign.attachmentId }
              : f
          )
        );
      } catch {
        setPendingFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: 'error' } : f))
        );
      }
    },
    [conversationId, addPendingAttachment]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    onDrop: (files) => files.forEach(uploadFile),
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const removeFile = (fileId: string, attachmentId?: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (attachmentId) removePendingAttachment(attachmentId);
  };

  const canSend = content.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div
      {...getRootProps()}
      className={cn(
        'px-4 pb-5 pt-3',
        isDragActive && 'bg-[var(--accent)]/5'
      )}
    >
      <input {...getInputProps()} aria-hidden="true" />

      {isDragActive && (
        <div className="mb-2 rounded-2xl border-2 border-dashed border-[var(--accent)] py-6 text-center text-sm text-[var(--accent)]">
          Drop files to attach
        </div>
      )}

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingFiles.map((pf) => (
            <div
              key={pf.id}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1.5"
            >
              {pf.status === 'uploading' ? (
                <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" />
              ) : pf.status === 'error' ? (
                <span className="h-3 w-3 text-destructive text-xs">!</span>
              ) : (
                <span className="h-3 w-3 text-green-500 text-xs">✓</span>
              )}
              <span className="text-xs text-foreground truncate max-w-[120px]">
                {pf.file.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatBytes(pf.file.size)}
              </span>
              {pf.status === 'uploading' && (
                <span className="text-[10px] text-[var(--accent)]">{pf.progress}%</span>
              )}
              <button
                onClick={() => removeFile(pf.id, pf.attachmentId)}
                className="p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input container */}
      <div
        className={cn(
          'relative flex flex-col rounded-2xl border bg-background-pure shadow-sm transition-all',
          'border-border focus-within:border-[var(--accent)]/60 focus-within:shadow-md focus-within:ring-2 focus-within:ring-[var(--accent)]/15'
        )}
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Janna AI…"
          className="min-h-[52px] max-h-[240px] w-full resize-none bg-transparent px-4 py-3.5 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
          disabled={disabled}
          rows={1}
          aria-label="Message input"
        />

        {/* Bottom toolbar */}
        <div className="flex items-center gap-1.5 px-3 pb-3">
          <div className="flex items-center gap-1">
            {/* Attach file */}
            <label
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
              <input
                type="file"
                className="sr-only"
                multiple
                accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  Array.from(e.target.files ?? []).forEach(uploadFile);
                  e.target.value = '';
                }}
              />
            </label>

            {/* RAG toggle */}
            <button
              onClick={() => setRagEnabled(!ragEnabled)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition-colors',
                ragEnabled
                  ? 'text-[var(--accent)] bg-[var(--accent)]/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
              )}
              title={`Document search ${ragEnabled ? 'on' : 'off'}`}
            >
              <Database className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Docs</span>
            </button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {/* Model selector */}
            <div ref={modelDropdownRef} className="relative">
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span className="max-w-[100px] truncate font-medium">
                  {currentModel?.displayName ?? modelId}
                </span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {showModelDropdown && (
                <div
                  className="absolute bottom-full right-0 mb-2 min-w-[220px] rounded-2xl border border-border bg-background-pure py-1.5 shadow-2xl animate-scale-in"
                  role="listbox"
                >
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Choose Model
                  </p>
                  {MODEL_REGISTRY.map((model) => (
                    <button
                      key={model.id}
                      role="option"
                      aria-selected={model.id === modelId}
                      onClick={() => {
                        setModelId(model.id);
                        setShowModelDropdown(false);
                      }}
                      className={cn(
                        'flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-raised transition-colors',
                        model.id === modelId && 'bg-surface-raised'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {model.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {model.provider} · {model.contextWindow.toLocaleString()} ctx
                        </p>
                      </div>
                      {model.id === modelId && (
                        <span className="text-[var(--accent)] text-sm">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send / Stop */}
            {isStreaming ? (
              <button
                onClick={() => {}}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background hover:bg-foreground/80 transition-colors"
                title="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200',
                  canSend
                    ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-sm'
                    : 'bg-surface-raised text-muted-foreground cursor-not-allowed'
                )}
                title={sendOnEnter ? 'Send (Enter)' : 'Send (Ctrl+Enter)'}
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Janna AI can make mistakes. Consider verifying important information.
      </p>
    </div>
  );
}
