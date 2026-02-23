"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      aria-label="Copy code"
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export function MarkdownRenderer({
  content,
  className,
  isStreaming,
}: MarkdownRendererProps) {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none",
        "prose-headings:text-text-primary prose-p:text-text-primary prose-li:text-text-primary",
        "prose-strong:text-text-primary prose-em:text-text-secondary",
        "prose-code:text-accent-600 prose-code:bg-surface-overlay prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono",
        "prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0",
        "prose-table:border prose-table:border-border",
        "prose-th:bg-surface-overlay prose-th:px-3 prose-th:py-1.5",
        "prose-td:px-3 prose-td:py-1.5 prose-td:border prose-td:border-border",
        "prose-blockquote:border-accent-500 prose-blockquote:text-text-secondary",
        "dark:prose-invert",
        isStreaming && "streaming-cursor",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? "");
            const codeString = String(children).replace(/\n$/, "");
            const isInline = !match && !codeString.includes("\n");

            if (isInline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }

            return (
              <div className="relative group rounded-lg overflow-hidden my-3">
                <div className="flex items-center justify-between bg-[#1e1e2e] px-4 py-2">
                  <span className="text-xs text-gray-400 font-mono">
                    {match?.[1] ?? "code"}
                  </span>
                  <CopyButton code={codeString} />
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={match?.[1] ?? "text"}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: "0.8125rem",
                    lineHeight: "1.6",
                  }}
                  showLineNumbers={codeString.split("\n").length > 5}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-600 hover:underline"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
