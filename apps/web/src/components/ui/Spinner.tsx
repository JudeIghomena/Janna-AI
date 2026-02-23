import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border-2 border-current border-t-transparent animate-spin",
        className ?? "h-4 w-4"
      )}
      aria-label="Loading"
      role="status"
    />
  );
}
