'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Archive,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateConversation, useDeleteConversation } from '@/hooks/useConversations';
import type { ConversationSummary } from '@janna/shared';

interface ConversationItemProps {
  conversation: ConversationSummary;
  isActive?: boolean;
}

export function ConversationItem({
  conversation,
  isActive,
}: ConversationItemProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { mutate: updateConv } = useUpdateConversation();
  const { mutate: deleteConv } = useDeleteConversation();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== conversation.title) {
      updateConv({ id: conversation.id, data: { title: trimmed } });
    } else {
      setTitle(conversation.title);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveTitle();
    if (e.key === 'Escape') {
      setTitle(conversation.title);
      setEditing(false);
    }
  };

  return (
    <div
      className={cn(
        'group relative flex items-center rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer',
        isActive
          ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
          : 'text-foreground hover:bg-surface-raised'
      )}
      onClick={() => !editing && router.push(`/chat/${conversation.id}`)}
      role="listitem"
    >
      <MessageSquare
        className={cn(
          'mr-2 h-3.5 w-3.5 shrink-0',
          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
        )}
      />

      {editing ? (
        <div
          className="flex flex-1 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveTitle}
            className="flex-1 truncate bg-transparent text-sm outline-none"
            maxLength={200}
          />
          <button
            onClick={saveTitle}
            className="p-0.5 text-green-600 hover:text-green-700"
            aria-label="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setTitle(conversation.title);
              setEditing(false);
            }}
            className="p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <span className="flex-1 truncate">{conversation.title}</span>
      )}

      {/* Context menu */}
      {!editing && (
        <div
          ref={menuRef}
          className="relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              'p-1 rounded text-muted-foreground hover:text-foreground transition-colors',
              'opacity-0 group-hover:opacity-100 focus:opacity-100',
              menuOpen && 'opacity-100'
            )}
            aria-label="Conversation options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-border bg-background py-1 shadow-lg">
              <button
                onClick={() => {
                  setEditing(true);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-surface-raised"
              >
                <Pencil className="h-3.5 w-3.5" />
                Rename
              </button>
              <button
                onClick={() => {
                  updateConv({
                    id: conversation.id,
                    data: { archived: !conversation.archived },
                  });
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-surface-raised"
              >
                <Archive className="h-3.5 w-3.5" />
                {conversation.archived ? 'Unarchive' : 'Archive'}
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => {
                  if (confirm('Delete this conversation? This cannot be undone.')) {
                    deleteConv(conversation.id);
                    if (isActive) router.push('/');
                  }
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
