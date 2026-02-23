"use client";
import { use, useEffect } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useChat } from "@/hooks/useChat";
import { useConversationMessages, useUpdateConversation } from "@/hooks/useConversations";
import { useChatStore } from "@/store/chatStore";
import { useUIStore } from "@/store/uiStore";
import { useQueryClient } from "@tanstack/react-query";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ConversationPage({ params }: PageProps) {
  const { id: conversationId } = use(params);
  const { data, isLoading } = useConversationMessages(conversationId);
  const { setMessages } = useChatStore();
  const { toggleSidebar } = useUIStore();
  const updateConv = useUpdateConversation();
  const qc = useQueryClient();

  const { messages, streaming, isStreaming, sendMessage, stopStreaming } =
    useChat(conversationId);

  // Load server messages into store
  useEffect(() => {
    if (data?.data) {
      setMessages(conversationId, data.data);
    }
  }, [data, conversationId, setMessages]);

  // Get conversation title from cache
  const conversations = qc
    .getQueryData<{ data: { id: string; title: string }[] }>(["conversations"])
    ?.data;
  const title = conversations?.find((c) => c.id === conversationId)?.title;

  const handleRename = async () => {
    const newTitle = window.prompt("Rename:", title ?? "");
    if (newTitle?.trim()) {
      await updateConv.mutateAsync({
        id: conversationId,
        data: { title: newTitle.trim() },
      });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ChatHeader
        conversationId={conversationId}
        title={title}
        onToggleSidebar={toggleSidebar}
        onRename={handleRename}
      />

      <ChatThread
        conversationId={conversationId}
        initialMessages={data?.data ?? []}
      />

      <ChatComposer
        conversationId={conversationId}
        isStreaming={isStreaming}
        onSend={(content, attachmentIds) =>
          sendMessage(content, attachmentIds)
        }
        onStop={stopStreaming}
      />
    </div>
  );
}
