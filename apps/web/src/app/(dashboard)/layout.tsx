"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "aws-amplify/auth";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ActivityPanel } from "@/components/chat/ActivityPanel";
import { useUIStore } from "@/store/uiStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { sidebarOpen, activityPanelOpen, setActivityPanelOpen } = useUIStore();

  useEffect(() => {
    getCurrentUser().catch(() => router.push("/login"));
  }, [router]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar */}
      {sidebarOpen && <Sidebar />}

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children}
      </main>

      {/* Activity panel */}
      {activityPanelOpen && (
        <ActivityPanel
          conversationId=""
          onClose={() => setActivityPanelOpen(false)}
        />
      )}
    </div>
  );
}
