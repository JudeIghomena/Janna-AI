import { Metadata } from 'next';
import { ChatPageClient } from './ChatPageClient';

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Chat',
};

export default async function ChatPage({ params }: Props) {
  const { id } = await params;
  return <ChatPageClient conversationId={id} />;
}
