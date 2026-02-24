'use client';

import { useParams } from 'next/navigation';
import { useConversations } from '@/hooks/useConversations';
import { ConversationItem } from './ConversationItem';
import { groupConversationsByDate } from '@/lib/utils';
import { MessageSquareDashed } from 'lucide-react';

interface ConversationListProps {
  search?: string;
  showArchived?: boolean;
}

export function ConversationList({
  search,
  showArchived = false,
}: ConversationListProps) {
  const params = useParams();
  const activeId = params?.id as string | undefined;

  const { data, isLoading, error } = useConversations({
    archived: showArchived ? true : undefined,
    search: search || undefined,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 px-2" aria-label="Loading conversations">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-lg bg-surface-raised"
            style={{ opacity: 1 - i * 0.15 }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="px-3 py-2 text-xs text-red-500">
        Failed to load conversations
      </p>
    );
  }

  const conversations = data?.data ?? [];

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
        <MessageSquareDashed className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">
          {search
            ? 'No conversations match your search'
            : showArchived
            ? 'No archived conversations'
            : 'No conversations yet. Start a new chat!'}
        </p>
      </div>
    );
  }

  const groups = groupConversationsByDate(conversations);

  return (
    <div className="flex flex-col" role="list" aria-label="Conversations">
      {groups.map((group) => (
        <div key={group.label} className="mb-3">
          <p className="mb-1 px-3 text-xs font-medium text-muted-foreground">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5 px-1">
            {group.items.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
