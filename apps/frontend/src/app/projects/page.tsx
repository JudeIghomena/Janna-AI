'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProjects, useCreateProject, usePatchProject, useDeleteProject } from '@/hooks/useProjects';
import {
  FolderOpen,
  Plus,
  MoreHorizontal,
  Star,
  Archive,
  Trash2,
  Pencil,
  X,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PROJECT_COLORS = [
  '#d97757', '#3b82f6', '#8b5cf6', '#10b981',
  '#f59e0b', '#ef4444', '#06b6d4', '#ec4899',
];

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const { mutate: create, isPending } = useCreateProject();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create({ name, description, systemPrompt, color }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background-pure shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">New Project</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-raised rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Project name *
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Custom instructions
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Give Janna AI specific instructions for all conversations in this project…"
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform',
                    color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isPending}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
            >
              {isPending ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: any }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { mutate: patch } = usePatchProject();
  const { mutate: del } = useDeleteProject();

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 hover:border-[var(--accent)] hover:shadow-sm transition-all duration-200"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: project.color + '20' }}
        >
          <FolderOpen className="h-5 w-5" style={{ color: project.color }} />
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            setMenuOpen((o) => !o);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground hover:bg-surface-raised rounded-lg transition-all"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => { e.preventDefault(); setMenuOpen(false); }}
            />
            <div className="absolute right-4 top-12 z-50 min-w-[150px] rounded-xl border border-border bg-background-pure py-1 shadow-xl animate-scale-in">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  patch({ id: project.id, starred: !project.starred });
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-surface-raised"
              >
                <Star className={cn('h-3.5 w-3.5', project.starred && 'fill-yellow-400 text-yellow-400')} />
                {project.starred ? 'Unstar' : 'Star'}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  patch({ id: project.id, archived: !project.archived });
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-surface-raised"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (confirm(`Delete "${project.name}"?`)) del(project.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-surface-raised"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div>
        <div className="flex items-center gap-1.5">
          {project.starred && (
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />
          )}
          <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
        </div>
        {project.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        {project.conversationCount} conversation
        {project.conversationCount !== 1 ? 's' : ''}
      </div>
    </Link>
  );
}

export default function ProjectsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: projects = [], isLoading } = useProjects();

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-4xl px-6 py-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Projects</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Organize conversations with shared context and custom instructions
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New project
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
              <div className="mb-4 h-16 w-16 rounded-2xl bg-surface-raised flex items-center justify-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No projects yet</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Projects help you organize conversations with shared context and custom
                instructions for the AI.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-6 flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create your first project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              <button
                onClick={() => setShowCreate(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-5 text-muted-foreground hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all duration-200 min-h-[160px]"
              >
                <Plus className="h-6 w-6" />
                <span className="text-sm font-medium">New project</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </AppLayout>
  );
}
