export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function groupConversationsByDate(
  conversations: { id: string; updatedAt: string; title: string }[]
): Record<string, typeof conversations> {
  const groups: Record<string, typeof conversations> = {};
  const now = new Date();

  for (const conv of conversations) {
    const d = new Date(conv.updatedAt);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);

    let group: string;
    if (diffDays === 0) group = "Today";
    else if (diffDays === 1) group = "Yesterday";
    else if (diffDays <= 7) group = "This Week";
    else if (diffDays <= 30) group = "This Month";
    else group = "Older";

    if (!groups[group]) groups[group] = [];
    groups[group].push(conv);
  }

  return groups;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}
