'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { conversationsApi, chatApi } from '@/lib/api';
import type { ConversationSummary, MessageDetail } from '@janna/shared';

export const CONVERSATIONS_KEY = ['conversations'] as const;
export const MESSAGES_KEY = (id: string) => ['messages', id] as const;

export function useConversations(params?: {
  archived?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: [...CONVERSATIONS_KEY, params],
    queryFn: () =>
      conversationsApi.list({
        pageSize: 100,
        archived: params?.archived,
        search: params?.search,
      }),
    staleTime: 30_000,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: MESSAGES_KEY(conversationId ?? ''),
    queryFn: () => conversationsApi.messages(conversationId!),
    enabled: !!conversationId,
    staleTime: 5_000,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => conversationsApi.create(title),
    onSuccess: (data) => {
      qc.setQueryData<{ data: ConversationSummary[] } | undefined>(
        [...CONVERSATIONS_KEY, undefined],
        (old) =>
          old
            ? { ...old, data: [data, ...old.data] }
            : { data: [data], total: 1, page: 1, pageSize: 100, hasMore: false }
      );
    },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { title?: string; archived?: boolean; starred?: boolean; projectId?: string | null };
    }) => conversationsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

// Alias used by Sidebar
export function usePatchConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      archived?: boolean;
      starred?: boolean;
      projectId?: string | null;
    }) => conversationsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useMessageFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      thumbsUp,
    }: {
      messageId: string;
      thumbsUp: boolean | null;
    }) => chatApi.feedback(messageId, thumbsUp),
  });
}

// Optimistically add a user message and trigger re-fetch on the assistant message
export function useOptimisticMessage() {
  const qc = useQueryClient();

  return {
    addUserMessage: (
      conversationId: string,
      content: string,
      tempId: string
    ) => {
      qc.setQueryData<MessageDetail[]>(
        MESSAGES_KEY(conversationId),
        (old = []) => [
          ...old,
          {
            id: tempId,
            conversationId,
            role: 'user',
            content,
            createdAt: new Date().toISOString(),
            metadata: {},
            parentMessageId: null,
          },
        ]
      );
    },

    addAssistantMessage: (
      conversationId: string,
      message: MessageDetail
    ) => {
      qc.setQueryData<MessageDetail[]>(
        MESSAGES_KEY(conversationId),
        (old = []) => {
          // Replace streaming placeholder if present
          const filtered = old.filter((m) => !m.id.startsWith('streaming-'));
          return [...filtered, message];
        }
      );
    },

    invalidate: (conversationId: string) => {
      qc.invalidateQueries({ queryKey: MESSAGES_KEY(conversationId) });
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  };
}
