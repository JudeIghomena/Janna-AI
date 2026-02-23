"use client";
import { useRouter } from "next/navigation";
import { useCreateConversation } from "@/hooks/useConversations";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { useUIStore } from "@/store/uiStore";

export default function HomePage() {
  const router = useRouter();
  const createConv = useCreateConversation();
  const { toggleSidebar } = useUIStore();

  const handleNewChat = async () => {
    const conv = await createConv.mutateAsync();
    router.push(`/c/${conv.id}`);
  };

  return (
    <div className="flex flex-col h-full">
      <ChatHeader onToggleSidebar={toggleSidebar} />
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-xl">
          <span className="text-white text-3xl font-bold">J</span>
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-text-primary">Janna AI</h1>
          <p className="text-text-muted">Your context-aware AI workspace</p>
        </div>
        <button
          onClick={handleNewChat}
          disabled={createConv.isPending}
          className="px-6 py-3 rounded-xl bg-accent-600 text-white font-medium hover:bg-accent-700 transition-colors shadow-lg"
        >
          Start a conversation
        </button>
      </div>
    </div>
  );
}
