"use client";
import { useRef, useCallback } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface SSEHandlers {
  onToken?: (token: string, messageId: string) => void;
  onToolCall?: (toolCall: unknown) => void;
  onToolResult?: (result: unknown) => void;
  onCitation?: (citations: unknown) => void;
  onDone?: (data: unknown) => void;
  onError?: (error: string) => void;
}

export function useSSE() {
  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(
    async (
      payload: {
        conversationId: string;
        content: string;
        modelId?: string;
        ragEnabled?: boolean;
        parentMessageId?: string;
      },
      handlers: SSEHandlers
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString() ?? "";

      const res = await fetch(`${API_URL}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text();
        handlers.onError?.(errText || "Stream failed");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));
              switch (currentEvent) {
                case "token":
                  handlers.onToken?.(data.token, data.messageId);
                  break;
                case "tool_call":
                  handlers.onToolCall?.(data);
                  break;
                case "tool_result":
                  handlers.onToolResult?.(data);
                  break;
                case "citation":
                  handlers.onCitation?.(data);
                  break;
                case "done":
                  handlers.onDone?.(data);
                  break;
                case "error":
                  handlers.onError?.(data.message);
                  break;
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          handlers.onError?.((err as Error).message);
        }
      }
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { stream, cancel };
}
