"use client";
import { useState } from "react";
import {
  Menu,
  MoreHorizontal,
  Download,
  Archive,
  Edit3,
  ToggleLeft,
  ToggleRight,
  Cpu,
} from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { MODEL_REGISTRY } from "@janna/shared";
import { conversationsApi } from "@/lib/api";

interface ChatHeaderProps {
  conversationId?: string;
  title?: string;
  onToggleSidebar: () => void;
  onRename?: () => void;
}

export function ChatHeader({
  conversationId,
  title,
  onToggleSidebar,
  onRename,
}: ChatHeaderProps) {
  const { selectedModelId, setSelectedModelId, ragEnabled, setRagEnabled, toggleSidebar } =
    useUIStore();
  const [exporting, setExporting] = useState(false);

  const modelOptions = MODEL_REGISTRY.map((m) => ({
    value: m.id,
    label: m.name,
    description: m.provider === "local" ? "Private · Local GPU" : `Context: ${(m.contextWindow / 1000).toFixed(0)}k`,
    icon: <Cpu size={12} />,
  }));

  const handleExport = async () => {
    if (!conversationId) return;
    setExporting(true);
    try {
      const md = await conversationsApi.export(conversationId, "markdown");
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation-${conversationId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface shrink-0">
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu size={16} />
      </button>

      {/* Conversation title */}
      <div className="flex-1 min-w-0">
        {title ? (
          <h1 className="text-sm font-medium text-text-primary truncate">{title}</h1>
        ) : (
          <span className="text-sm text-text-muted">Janna AI</span>
        )}
      </div>

      {/* RAG toggle */}
      <button
        onClick={() => setRagEnabled(!ragEnabled)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border",
          ragEnabled
            ? "bg-accent-600 text-white border-accent-600"
            : "text-text-secondary border-border hover:bg-surface-overlay"
        )}
        title="Toggle document retrieval (RAG)"
      >
        {ragEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
        <span>Docs</span>
      </button>

      {/* Model selector */}
      <Dropdown
        options={modelOptions}
        value={selectedModelId}
        onChange={setSelectedModelId}
        className="w-44"
      />

      {/* Actions */}
      {conversationId && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExport}
            loading={exporting}
            title="Export conversation"
            className="w-8 h-8"
          >
            <Download size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRename}
            title="Rename"
            className="w-8 h-8"
          >
            <Edit3 size={14} />
          </Button>
        </div>
      )}
    </header>
  );
}
