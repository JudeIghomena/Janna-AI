'use client';

import { useRouter } from 'next/navigation';
import {
  Download,
  Activity,
  Code2,
  MoreHorizontal,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useChatStore } from '@/store/chatStore';
import { useMessages } from '@/hooks/useConversations';
import { useChat } from '@/hooks/useChat';
import { chatApi } from '@/lib/api';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { ActivityPanel } from './ActivityPanel';
import { ArtifactsPanel } from './ArtifactsPanel';
import { MODEL_REGISTRY } from '@janna/shared';
import { conversationToMarkdown, downloadBlob } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  conversationId: string;
  title: string;
}

export function ChatInterface({ conversationId, title }: ChatInterfaceProps) {
  const router = useRouter();
  const {
    activityPanelOpen,
    toggleActivityPanel,
    artifactsPanelOpen,
    artifacts,
    setArtifactsPanelOpen,
  } = useUIStore();
  const { isStreaming, streamingMessage, modelId, ragEnabled } = useChatStore();
  const { data: messages = [], refetch } = useMessages(conversationId);
  const { sendMessage, stopStreaming } = useChat();

  const currentModel = MODEL_REGISTRY.find((m) => m.id === modelId);

  const handleSend = async (content: string) => {
    await sendMessage(conversationId, content);
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      const result = await chatApi.editMessage(messageId, content);
      router.push(`/chat/${result.conversationId}`);
    } catch (err) {
      console.error('Failed to create branch:', err);
    }
  };

  const handleExportMarkdown = () => {
    const md = conversationToMarkdown(
      title,
      messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }))
    );
    downloadBlob(new Blob([md], { type: 'text/markdown' }), `${title}.md`);
  };

  const toolCalls = streamingMessage?.toolCalls ?? [];
  const citations = streamingMessage?.citations ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 border-b border-border bg-background-pure px-4 py-2.5 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-[var(--accent)]" />
            <span>{currentModel?.displayName ?? modelId}</span>
            {ragEnabled && (
              <>
                <span>·</span>
                <span className="text-[var(--accent)]">Docs enabled</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Export */}
          <button
            onClick={handleExportMarkdown}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
            title="Export as markdown"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Artifacts toggle */}
          {artifacts.length > 0 && (
            <button
              onClick={() => setArtifactsPanelOpen(!artifactsPanelOpen)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors',
                artifactsPanelOpen
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
              )}
              title="Toggle artifacts panel"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                Artifacts {artifacts.length > 0 && `(${artifacts.length})`}
              </span>
            </button>
          )}

          {/* Activity toggle */}
          <button
            onClick={toggleActivityPanel}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-colors',
              activityPanelOpen
                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
            )}
            title="Toggle activity panel"
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Activity</span>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {/* Claude-like: constrained width with generous padding */}
            <div className="mx-auto max-w-3xl px-4 py-6">
              <MessageList
                messages={messages}
                onEditMessage={handleEditMessage}
                onRegenerateMessage={(messageId) => {
                  const idx = messages.findIndex((m) => m.id === messageId);
                  if (idx > 0) {
                    const userMsg = messages[idx - 1];
                    if (userMsg?.role === 'user') {
                      handleSend(userMsg.content);
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Composer */}
          <div className="mx-auto w-full max-w-3xl">
            <MessageComposer
              conversationId={conversationId}
              onSend={handleSend}
              disabled={false}
            />
          </div>
        </div>

        {/* Artifacts panel */}
        {artifactsPanelOpen && artifacts.length > 0 && (
          <ArtifactsPanel
            artifacts={artifacts}
            onClose={() => setArtifactsPanelOpen(false)}
          />
        )}

        {/* Activity panel */}
        {activityPanelOpen && (
          <ActivityPanel
            toolCalls={toolCalls}
            citations={citations}
            usage={streamingMessage?.usage}
          />
        )}
      </div>
    </div>
  );
}
