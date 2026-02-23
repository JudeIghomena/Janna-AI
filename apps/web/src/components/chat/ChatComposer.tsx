"use client";
import { useState, useRef, useCallback } from "react";
import { Send, Square, Paperclip, ChevronDown, ChevronUp, X } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { attachmentsApi } from "@/lib/api";
import { formatBytes, cn } from "@/lib/utils";
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from "@janna/shared";
import { Button } from "@/components/ui/Button";

interface ComposerProps {
  conversationId: string;
  isStreaming: boolean;
  onSend: (content: string, attachmentIds?: string[]) => void;
  onStop: () => void;
}

interface PendingFile {
  file: File;
  id?: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export function ChatComposer({
  conversationId,
  isStreaming,
  onSend,
  onStop,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = value.trim().length > 0 && !isStreaming;

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!canSend) return;

    const attachmentIds = pendingFiles
      .filter((f) => f.status === "done" && f.id)
      .map((f) => f.id!);

    onSend(value.trim(), attachmentIds);
    setValue("");
    setPendingFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        alert(`File type not allowed: ${file.type}`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        alert(`File too large: ${formatBytes(file.size)} (max 50MB)`);
        continue;
      }

      const pendingEntry: PendingFile = { file, status: "uploading" };
      setPendingFiles((prev) => [...prev, pendingEntry]);

      try {
        const { attachmentId } = await attachmentsApi.upload(
          file,
          conversationId
        );
        setPendingFiles((prev) =>
          prev.map((p) =>
            p === pendingEntry
              ? { ...p, status: "done", id: attachmentId }
              : p
          )
        );
      } catch (err) {
        setPendingFiles((prev) =>
          prev.map((p) =>
            p === pendingEntry
              ? { ...p, status: "error", error: (err as Error).message }
              : p
          )
        );
      }
    }
  };

  return (
    <div className="px-4 pb-4 pt-2 border-t border-border bg-surface shrink-0">
      {/* File attachments */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pendingFiles.map((f, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs",
                f.status === "done"
                  ? "border-emerald-400/50 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400"
                  : f.status === "error"
                  ? "border-red-400/50 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400"
                  : "border-border bg-surface-overlay text-text-secondary"
              )}
            >
              <span className="truncate max-w-[120px]">{f.file.name}</span>
              {f.status === "uploading" && (
                <span className="inline-block h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
              )}
              <button
                onClick={() =>
                  setPendingFiles((prev) => prev.filter((_, j) => j !== i))
                }
                className="hover:opacity-70"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer box */}
      <div className="flex flex-col gap-0 rounded-xl border border-border bg-surface-raised focus-within:ring-2 focus-within:ring-accent-500 focus-within:border-transparent overflow-hidden transition-shadow">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask Janna AI anything... (Shift+Enter for new line)"
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none min-h-[44px] max-h-[240px]"
          disabled={isStreaming}
          aria-label="Message input"
        />

        {/* Advanced params */}
        {showAdvanced && (
          <div className="px-4 pb-2 flex items-center gap-4 border-t border-border-subtle">
            <label className="flex items-center gap-2 text-xs text-text-muted">
              Temperature:{" "}
              <span className="text-text-primary font-mono">{temperature}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-24"
              />
            </label>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 pb-2">
          {/* File attach */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_MIME_TYPES.join(",")}
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors disabled:opacity-40"
            title="Attach files"
          >
            <Paperclip size={15} />
          </button>

          {/* Advanced */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
            title="Advanced parameters"
          >
            {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          <div className="flex-1" />

          {/* Send / Stop */}
          {isStreaming ? (
            <Button
              variant="secondary"
              size="icon"
              onClick={onStop}
              className="w-8 h-8 rounded-lg"
              title="Stop generation"
            >
              <Square size={13} className="fill-current" />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className="w-8 h-8 rounded-lg"
              title="Send message"
            >
              <Send size={13} />
            </Button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-text-muted mt-2">
        Janna AI can make mistakes. Verify important information.
      </p>
    </div>
  );
}
