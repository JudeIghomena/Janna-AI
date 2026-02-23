"use client";
import { useState } from "react";
import { MoreHorizontal, Edit3, Archive, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";
import type { Conversation } from "@/types";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onRename,
  onArchive,
  onDelete,
}: ConversationItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-lg px-2 py-2 cursor-pointer transition-colors",
        isActive
          ? "bg-accent-100 dark:bg-accent-700/20"
          : "hover:bg-surface-overlay"
      )}
    >
      <Link
        href={`/c/${conversation.id}`}
        className="flex-1 min-w-0"
        onClick={() => setMenuOpen(false)}
      >
        <div className="text-sm font-medium text-text-primary truncate">
          {truncate(conversation.title, 40)}
        </div>
        <div className="text-xs text-text-muted mt-0.5">
          {formatRelativeTime(conversation.updatedAt)}
          {conversation.messageCount
            ? ` · ${conversation.messageCount} msgs`
            : ""}
        </div>
      </Link>

      {/* Menu button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          setMenuOpen((o) => !o);
        }}
        className={cn(
          "p-1 rounded text-text-muted hover:text-text-primary transition-colors",
          "opacity-0 group-hover:opacity-100",
          menuOpen && "opacity-100"
        )}
      >
        <MoreHorizontal size={14} />
      </button>

      {/* Context menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-8 z-20 bg-surface-raised border border-border rounded-lg shadow-lg py-1 min-w-[140px] animate-fade-in">
            <button
              onClick={() => { onRename(); setMenuOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
            >
              <Edit3 size={12} /> Rename
            </button>
            <button
              onClick={() => { onArchive(); setMenuOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
            >
              <Archive size={12} /> Archive
            </button>
            <hr className="border-border my-1" />
            <button
              onClick={() => { onDelete(); setMenuOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-500 hover:bg-surface-overlay"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
