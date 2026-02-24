'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Plus,
  Search,
  Settings,
  LogOut,
  FolderOpen,
  Star,
  Archive,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Trash2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  User,
  Sparkles,
  FolderPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/uiStore';
import { useAuthContext } from '@/components/providers/AuthProvider';
import {
  useConversations,
  useCreateConversation,
  usePatchConversation,
  useDeleteConversation,
} from '@/hooks/useConversations';
import { useProjects } from '@/hooks/useProjects';

// ─── Temporal grouping ────────────────────────────────────────────────────────
function getGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Last 7 days';
  if (diffDays <= 30) return 'Last 30 days';
  return 'Older';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Older'];

// ─── Conversation context menu ────────────────────────────────────────────────
function ConvoMenu({
  convId,
  title,
  starred,
  archived,
  onClose,
}: {
  convId: string;
  title: string;
  starred: boolean;
  archived: boolean;
  onClose: () => void;
}) {
  const { mutate: patch } = usePatchConversation();
  const { mutate: del } = useDeleteConversation();
  const router = useRouter();

  const action = (fn: () => void) => () => { fn(); onClose(); };

  return (
    <div className="absolute right-0 top-6 z-50 min-w-[160px] rounded-xl border border-sidebar-border bg-[oklch(25%_0.01_250)] py-1 shadow-xl animate-scale-in">
      <button
        onClick={action(() => patch({ id: convId, starred: !starred }))}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-sidebar-fg hover:bg-sidebar-hover transition-colors"
      >
        <Star className={cn('h-3.5 w-3.5', starred && 'fill-yellow-400 text-yellow-400')} />
        {starred ? 'Unstar' : 'Star'}
      </button>
      <button
        onClick={action(() => patch({ id: convId, archived: !archived }))}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-sidebar-fg hover:bg-sidebar-hover transition-colors"
      >
        <Archive className="h-3.5 w-3.5" />
        {archived ? 'Unarchive' : 'Archive'}
      </button>
      <div className="my-1 border-t border-sidebar-border" />
      <button
        onClick={action(() => {
          if (confirm(`Delete "${title}"?`)) {
            del(convId, { onSuccess: () => router.push('/') });
          }
        })}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-sidebar-hover transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
  );
}

// ─── Single conversation row ──────────────────────────────────────────────────
function ConvoItem({
  conv,
  isActive,
}: {
  conv: {
    id: string; title: string; starred: boolean; archived: boolean; updatedAt: string;
  };
  isActive: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={cn('group relative flex items-center rounded-lg', isActive && 'bg-sidebar-active')}>
      <Link
        href={`/chat/${conv.id}`}
        className={cn(
          'flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors min-w-0',
          isActive
            ? 'text-sidebar-fg'
            : 'text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-hover'
        )}
      >
        {conv.starred && <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />}
        <span className="truncate">{conv.title}</span>
      </Link>

      <button
        onClick={(e) => { e.preventDefault(); setMenuOpen((o) => !o); }}
        className={cn(
          'mr-1 shrink-0 rounded p-0.5 text-sidebar-muted transition-opacity',
          'opacity-0 group-hover:opacity-100 hover:text-sidebar-fg hover:bg-sidebar-hover'
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <ConvoMenu
            convId={conv.id}
            title={conv.title}
            starred={conv.starred}
            archived={conv.archived}
            onClose={() => setMenuOpen(false)}
          />
        </>
      )}
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export function Sidebar() {
  const { sidebarOpen, setSidebarOpen, setSettingsOpen } = useUIStore();
  const { user, signOut } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [convosExpanded, setConvosExpanded] = useState(true);

  const { mutate: createConversation, isPending } = useCreateConversation();
  const { data: convoData } = useConversations({ archived: showArchived });
  const { data: projects = [] } = useProjects();

  const conversations = convoData?.data ?? [];

  const handleNewChat = () => {
    createConversation(undefined, {
      onSuccess: (data) => router.push(`/chat/${data.id}`),
    });
  };

  // Filter and group conversations
  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    return conversations.filter((c) =>
      c.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [conversations, search]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    for (const c of filtered) {
      const g = getGroup(c.updatedAt);
      if (!map[g]) map[g] = [];
      map[g].push(c);
    }
    return GROUP_ORDER.filter((g) => map[g]?.length).map((g) => ({ label: g, items: map[g] }));
  }, [filtered]);

  const currentConvId = pathname.startsWith('/chat/')
    ? pathname.split('/')[2]
    : null;

  const displayName = user?.email?.split('@')[0] ?? 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  // Collapsed sidebar
  if (!sidebarOpen) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-r border-sidebar bg-sidebar py-3 gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-hover rounded-lg transition-colors"
          aria-label="Open sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <button
          onClick={handleNewChat}
          disabled={isPending}
          className="p-2 text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-hover rounded-lg transition-colors"
          aria-label="New chat"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-hover rounded-lg transition-colors"
        >
          <Settings className="h-4 w-4" />
        </button>
        <div className="h-7 w-7 rounded-full avatar-gradient flex items-center justify-center text-white text-xs font-semibold">
          {initials}
        </div>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-[260px] flex-col bg-sidebar border-r border-sidebar animate-slide-in-left">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md avatar-gradient flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-sidebar-fg">Janna AI</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-hover rounded-lg transition-colors"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* ── New chat ── */}
      <div className="px-2 pb-2">
        <button
          onClick={handleNewChat}
          disabled={isPending}
          className="flex w-full items-center gap-2 rounded-lg bg-sidebar-hover px-3 py-2 text-xs font-medium text-sidebar-fg hover:bg-sidebar-active transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New conversation
        </button>
      </div>

      {/* ── Search ── */}
      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-sidebar-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-lg bg-sidebar-hover border border-sidebar-border py-1.5 pl-7 pr-3 text-xs text-sidebar-fg placeholder:text-sidebar-muted focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto sidebar-scroll px-2 pb-2 space-y-4">
        {/* Projects section */}
        {projects.length > 0 && (
          <section>
            <button
              onClick={() => setProjectsExpanded((e) => !e)}
              className="flex w-full items-center gap-1 px-1 py-0.5 text-xs font-semibold text-sidebar-muted uppercase tracking-widest hover:text-sidebar-fg transition-colors"
            >
              {projectsExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Projects
            </button>
            {projectsExpanded && (
              <div className="mt-1 space-y-0.5">
                {projects.slice(0, 8).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-hover transition-colors"
                  >
                    <span
                      className="h-4 w-4 rounded shrink-0 flex items-center justify-center text-white"
                      style={{ backgroundColor: project.color }}
                    >
                      <FolderOpen className="h-2.5 w-2.5" />
                    </span>
                    <span className="truncate">{project.name}</span>
                    <span className="ml-auto text-[10px] text-sidebar-muted">
                      {project.conversationCount}
                    </span>
                  </Link>
                ))}
                <Link
                  href="/projects"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-hover transition-colors"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  New project
                </Link>
              </div>
            )}
          </section>
        )}

        {/* ── Conversations ── */}
        <section>
          {/* Archive toggle tabs */}
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => setShowArchived(false)}
              className={cn(
                'flex-1 rounded-md py-1 text-xs font-medium transition-colors',
                !showArchived
                  ? 'bg-sidebar-active text-sidebar-fg'
                  : 'text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-hover'
              )}
            >
              Conversations
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                showArchived
                  ? 'bg-sidebar-active text-sidebar-fg'
                  : 'text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-hover'
              )}
            >
              <Archive className="h-3 w-3" />
              Archived
            </button>
          </div>

          {grouped.length === 0 && (
            <p className="px-2 text-xs text-sidebar-muted py-4 text-center">
              {search ? 'No results' : 'No conversations yet'}
            </p>
          )}

          <div className="space-y-3">
            {grouped.map(({ label, items }) => (
              <div key={label}>
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                  {label}
                </p>
                <div className="space-y-0.5">
                  {items.map((conv) => (
                    <ConvoItem
                      key={conv.id}
                      conv={conv}
                      isActive={conv.id === currentConvId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-sidebar px-2 py-2 space-y-0.5">
        <Link
          href="/profile"
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sidebar-hover transition-colors"
        >
          <div className="h-7 w-7 rounded-full avatar-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-fg">
              {user?.email ?? ''}
            </p>
            <p className="text-[10px] text-sidebar-muted capitalize">{user?.role ?? 'user'}</p>
          </div>
        </Link>

        <Link
          href="/extensions"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-hover transition-colors"
        >
          <Puzzle className="h-3.5 w-3.5" />
          Extensions
        </Link>

        <button
          onClick={() => setSettingsOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-muted hover:text-sidebar-fg hover:bg-sidebar-hover transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>

        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-muted hover:text-red-400 hover:bg-sidebar-hover transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
