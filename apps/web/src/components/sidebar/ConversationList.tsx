"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ConversationItem } from "./ConversationItem";
import {
  useConversations,
  useUpdateConversation,
  useDeleteConversation,
} from "@/hooks/useConversations";
import { groupConversationsByDate } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Older"];

interface ConversationListProps {
  search: string;
}

export function ConversationList({ search }: ConversationListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, isLoading } = useConversations(search);
  const updateMutation = useUpdateConversation();
  const deleteMutation = useDeleteConversation();

  const conversations = data?.data ?? [];
  const groups = groupConversationsByDate(conversations);

  const activeId = pathname.match(/\/c\/([^/]+)/)?.[1] ?? null;

  const handleRename = async (id: string, currentTitle: string) => {
    const newTitle = window.prompt("Rename conversation:", currentTitle);
    if (newTitle && newTitle.trim()) {
      await updateMutation.mutateAsync({ id, data: { title: newTitle.trim() } });
    }
  };

  const handleArchive = async (id: string) => {
    await updateMutation.mutateAsync({ id, data: { archived: true } });
    if (activeId === id) router.push("/");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this conversation?")) return;
    await deleteMutation.mutateAsync(id);
    if (activeId === id) router.push("/");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-5 w-5 text-text-muted" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="text-xs text-text-muted text-center py-6">
        {search ? "No results" : "No conversations yet"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {GROUP_ORDER.filter((g) => groups[g]?.length > 0).map((group) => (
        <div key={group}>
          <div className="px-2 py-1 text-xs font-medium text-text-muted uppercase tracking-wide">
            {group}
          </div>
          <div className="space-y-0.5">
            {groups[group].map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv as any}
                isActive={activeId === conv.id}
                onRename={() => handleRename(conv.id, conv.title)}
                onArchive={() => handleArchive(conv.id)}
                onDelete={() => handleDelete(conv.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
