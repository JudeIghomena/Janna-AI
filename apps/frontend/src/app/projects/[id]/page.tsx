'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProject, usePatchProject } from '@/hooks/useProjects';
import { useCreateConversation } from '@/hooks/useConversations';
import {
  FolderOpen,
  Plus,
  MessageSquare,
  ArrowLeft,
  Settings2,
  ChevronRight,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: project, isLoading } = useProject(id);
  const { mutate: createConv, isPending } = useCreateConversation();

  const handleNewChat = () => {
    createConv(undefined, {
      onSuccess: (conv) => {
        // TODO: associate conversation with project
        router.push(`/chat/${conv.id}`);
      },
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Project not found</p>
          <Link href="/projects" className="text-sm text-[var(--accent)] hover:underline">
            Back to projects
          </Link>
        </div>
      </AppLayout>
    );
  }

  const conversations = (project as any).conversations ?? [];

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* Back */}
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All projects
          </Link>

          {/* Project header */}
          <div className="flex items-start gap-5 mb-8">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: (project as any).color + '20' }}
            >
              <FolderOpen className="h-7 w-7" style={{ color: (project as any).color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              {project.description && (
                <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
              )}
            </div>
            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface-raised rounded-xl transition-colors">
              <Settings2 className="h-5 w-5" />
            </button>
          </div>

          {/* Custom instructions preview */}
          {project.systemPrompt && (
            <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Custom instructions
              </p>
              <p className="text-sm text-foreground line-clamp-3">{project.systemPrompt}</p>
            </div>
          )}

          {/* New conversation */}
          <button
            onClick={handleNewChat}
            disabled={isPending}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-muted-foreground hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all mb-6"
          >
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">New conversation in this project</span>
          </button>

          {/* Conversations */}
          {conversations.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Conversations
              </p>
              {conversations.map((conv: any) => (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-[var(--accent)] hover:shadow-sm transition-all group"
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{conv.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(conv.updatedAt)}
                      {conv._count?.messages > 0 &&
                        ` · ${conv._count.messages} messages`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No conversations yet. Start one above!
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
