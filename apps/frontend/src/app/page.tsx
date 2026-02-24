'use client';

import { useRouter } from 'next/navigation';
import {
  Plus,
  Code2,
  FileText,
  Lightbulb,
  Globe,
  Pencil,
  Calculator,
  FolderOpen,
  ArrowRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCreateConversation } from '@/hooks/useConversations';
import { useProjects } from '@/hooks/useProjects';
import { useChatStore } from '@/store/chatStore';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { MODEL_REGISTRY } from '@janna/shared';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const SUGGESTED_PROMPTS = [
  {
    icon: Code2,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    label: 'Write code',
    prompt: 'Help me write a React component that fetches and displays data from an API',
  },
  {
    icon: FileText,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-950/30',
    label: 'Summarize text',
    prompt: 'Summarize the key points from my documents and highlight actionable insights',
  },
  {
    icon: Lightbulb,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    label: 'Brainstorm ideas',
    prompt: 'Help me brainstorm creative ideas for my next project',
  },
  {
    icon: Globe,
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    label: 'Research a topic',
    prompt: 'Research the latest developments in quantum computing and explain them simply',
  },
  {
    icon: Pencil,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    label: 'Draft content',
    prompt: 'Help me write a professional email to a potential client about our services',
  },
  {
    icon: Calculator,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    label: 'Analyze data',
    prompt: 'Analyze this dataset and identify trends, patterns, and anomalies',
  },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const router = useRouter();
  const { mutate: createConv, isPending } = useCreateConversation();
  const { data: projects = [] } = useProjects();
  const { modelId } = useChatStore();
  const { user } = useAuthContext();
  const currentModel = MODEL_REGISTRY.find((m) => m.id === modelId);

  const displayName =
    user?.email?.split('@')[0]
      ? user.email.split('@')[0].charAt(0).toUpperCase() +
        user.email.split('@')[0].slice(1)
      : 'there';

  const startNewChat = (initialPrompt?: string) => {
    createConv(undefined, {
      onSuccess: (conv) => {
        if (initialPrompt) {
          // Store prompt so chat page can auto-send it
          sessionStorage.setItem(`initial_prompt:${conv.id}`, initialPrompt);
        }
        router.push(`/chat/${conv.id}`);
      },
    });
  };

  return (
    <AppLayout>
      <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
        <div className="mx-auto w-full max-w-3xl px-6 py-12 flex flex-col gap-10">

          {/* ── Greeting ── */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              {getGreeting()}, {displayName}
            </h1>
            <p className="mt-2 text-muted-foreground text-base">
              How can I help you today?
            </p>
          </div>

          {/* ── Suggested prompts grid ── */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Suggestions
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => startNewChat(p.prompt)}
                  disabled={isPending}
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-left hover:border-[var(--accent)] hover:shadow-sm transition-all duration-200"
                >
                  <div className={cn('rounded-xl p-2', p.bg)}>
                    <p.icon className={cn('h-5 w-5', p.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {p.prompt}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Projects ── */}
          {projects.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Projects
                </p>
                <Link
                  href="/projects"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {projects.slice(0, 6).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-[var(--accent)] hover:shadow-sm transition-all duration-200"
                  >
                    <div
                      className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: project.color + '20', borderColor: project.color }}
                    >
                      <FolderOpen className="h-4 w-4" style={{ color: project.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {project.conversationCount} conversation
                        {project.conversationCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── New conversation CTA ── */}
          <div className="flex justify-center pb-8">
            <button
              onClick={() => startNewChat()}
              disabled={isPending}
              className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-3 text-sm text-muted-foreground hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              New conversation
              {currentModel && (
                <span className="ml-1 text-xs opacity-60">
                  · {currentModel.displayName}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
