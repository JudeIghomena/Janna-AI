'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { extensionsApi } from '@/lib/api';
import {
  Globe,
  Code2,
  Calculator,
  Puzzle,
  Check,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Extension {
  id: string;
  type: string;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  web_search: Globe,
  code_interpreter: Code2,
  calculator: Calculator,
};

const TYPE_COLORS: Record<string, string> = {
  web_search: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  code_interpreter: 'bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
  calculator: 'bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400',
};

function ExtensionCard({ ext }: { ext: Extension }) {
  const qc = useQueryClient();
  const Icon = TYPE_ICONS[ext.type] ?? Puzzle;
  const colorClass = TYPE_COLORS[ext.type] ?? 'bg-surface-raised text-muted-foreground';

  const { mutate: toggle, isPending } = useMutation({
    mutationFn: () => extensionsApi.toggle(ext.id, !ext.enabled) as Promise<Extension>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['extensions'] }),
  });

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-2xl border p-5 transition-all duration-200',
        ext.enabled
          ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5'
          : 'border-border bg-surface hover:border-[var(--accent)]/30'
      )}
    >
      <div className={cn('rounded-xl p-2.5 shrink-0', colorClass)}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{ext.name}</h3>
          {ext.enabled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-950/30 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
              <Check className="h-2.5 w-2.5" /> Enabled
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{ext.description}</p>
      </div>

      <button
        onClick={() => toggle()}
        disabled={isPending}
        className={cn(
          'shrink-0 h-6 w-11 rounded-full transition-all duration-200 relative',
          ext.enabled
            ? 'bg-[var(--accent)]'
            : 'bg-surface-raised border border-border',
          isPending && 'opacity-70'
        )}
        role="switch"
        aria-checked={ext.enabled}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200',
            ext.enabled ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </button>
    </div>
  );
}

export default function ExtensionsPage() {
  const { data: extensions = [], isLoading } = useQuery<Extension[]>({
    queryKey: ['extensions'],
    queryFn: () => extensionsApi.list() as Promise<Extension[]>,
  });

  const enabledCount = extensions.filter((e) => e.enabled).length;

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-2xl px-6 py-10">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Extensions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Extend Janna AI with additional capabilities and integrations
            </p>
          </div>

          {/* Stats */}
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
            <Puzzle className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">{enabledCount}</span> of{' '}
              <span className="font-semibold">{extensions.length}</span> extensions enabled
            </p>
          </div>

          {/* Tip */}
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Enabled extensions are available as tools in every conversation.
              The AI will automatically use them when relevant to your requests.
            </p>
          </div>

          {/* Extensions list */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {extensions.map((ext) => (
                <ExtensionCard key={ext.id} ext={ext} />
              ))}
            </div>
          )}

          {/* Coming soon */}
          <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center">
            <Puzzle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">More extensions coming soon</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Custom MCP servers, database connectors, and more
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
