'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { useConversations } from '@/hooks/useConversations';

interface Props {
  conversationId: string;
}

export function ChatPageClient({ conversationId }: Props) {
  const router = useRouter();
  const { data: convData } = useConversations();

  const conversation = convData?.data.find((c) => c.id === conversationId);

  useEffect(() => {
    // If conversation not found after data loads, redirect home
    if (convData && !conversation) {
      router.replace('/');
    }
  }, [convData, conversation, router]);

  return (
    <AppLayout>
      <ChatInterface
        conversationId={conversationId}
        title={conversation?.title ?? 'Conversation'}
      />
    </AppLayout>
  );
}
