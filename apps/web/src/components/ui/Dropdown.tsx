"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface DropdownProps<T = string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
}

export function Dropdown<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = "Select...",
  className,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-8 px-3 text-sm rounded-lg border border-border bg-surface-raised hover:bg-surface-overlay text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 w-full"
      >
        {selected?.icon && <span className="text-text-muted">{selected.icon}</span>}
        <span className="flex-1 text-left truncate">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "text-text-muted transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-full w-max max-w-xs bg-surface-raised border border-border rounded-lg shadow-lg overflow-hidden animate-fade-in">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-surface-overlay transition-colors",
                opt.value === value && "bg-accent-50 dark:bg-accent-700/10"
              )}
            >
              {opt.icon && (
                <span className="mt-0.5 text-text-muted">{opt.icon}</span>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-text-primary">
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="text-xs text-text-muted">{opt.description}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
