"use client";
import { Sun, Moon, Monitor } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { Button } from "./Button";
import type { Theme } from "@/types";

export function ThemeToggle() {
  const { theme, setTheme } = useUIStore();

  const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun size={14} />, label: "Light" },
    { value: "dark", icon: <Moon size={14} />, label: "Dark" },
    { value: "system", icon: <Monitor size={14} />, label: "System" },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-overlay p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          aria-label={`${opt.label} theme`}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
            theme === opt.value
              ? "bg-accent-600 text-white"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
