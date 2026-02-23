"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  Settings,
  LogOut,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { SidebarSearch } from "./SidebarSearch";
import { ConversationList } from "./ConversationList";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useCreateConversation } from "@/hooks/useConversations";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [search, setSearch] = useState("");
  const { user, signOut } = useAuth();
  const router = useRouter();
  const createConv = useCreateConversation();
  const { setActivityPanelOpen, activityPanelOpen } = useUIStore();

  const handleNewChat = async () => {
    const conv = await createConv.mutateAsync();
    router.push(`/c/${conv.id}`);
  };

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-surface-raised border-r border-border h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center">
            <span className="text-white text-xs font-bold">J</span>
          </div>
          <span className="text-sm font-semibold text-text-primary">Janna AI</span>
        </div>
        <ThemeToggle />
      </div>

      {/* New chat */}
      <div className="px-3 pt-3">
        <button
          onClick={handleNewChat}
          disabled={createConv.isPending}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-accent-500 hover:bg-accent-50 dark:hover:bg-accent-700/10 text-sm text-text-secondary hover:text-accent-600 transition-colors"
        >
          <PlusCircle size={15} />
          New conversation
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-2">
        <SidebarSearch value={search} onChange={setSearch} />
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <ConversationList search={search} />
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3 py-3 space-y-1">
        {/* Activity toggle */}
        <button
          onClick={() => setActivityPanelOpen(!activityPanelOpen)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-surface-overlay transition-colors",
            activityPanelOpen && "bg-surface-overlay text-text-primary"
          )}
        >
          <Activity size={14} />
          Activity Panel
        </button>

        {/* Admin link */}
        {user && (
          <a
            href="/admin"
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-surface-overlay transition-colors"
          >
            <ShieldCheck size={14} />
            Admin
          </a>
        )}

        {/* User info */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-overlay">
          <div className="w-6 h-6 rounded-full bg-accent-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-semibold">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </span>
          </div>
          <span className="flex-1 text-xs text-text-secondary truncate">
            {user?.email ?? "Loading..."}
          </span>
          <button
            onClick={signOut}
            className="text-text-muted hover:text-red-500 transition-colors"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
