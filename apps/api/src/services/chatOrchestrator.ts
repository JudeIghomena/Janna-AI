// ============================================================
// Chat Orchestrator - Main streaming pipeline
// ============================================================
import type { FastifyReply } from "fastify";
import { prisma } from "../db/client";
import { streamChat } from "./modelGateway";
import { retrieveContext } from "./ragService";
import { executeTool, TOOL_DEFINITIONS } from "../tools";
import { estimateCost } from "./modelGateway/registry";
import type { GatewayMessage } from "./modelGateway/types";
import type { ToolCall, Citation } from "@janna/shared";
import { DEFAULT_MODEL_ID } from "@janna/shared";
import { config } from "../config";

interface OrchestratorOptions {
  conversationId: string;
  userMessageContent: string;
  userId: string;
  modelId?: string;
  ragEnabled?: boolean;
  parentMessageId?: string;
  reply: FastifyReply;
}

function sseEvent(reply: FastifyReply, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function orchestrateChat(opts: OrchestratorOptions): Promise<void> {
  const {
    conversationId,
    userMessageContent,
    userId,
    modelId = DEFAULT_MODEL_ID,
    ragEnabled = false,
    reply,
  } = opts;

  // SSE headers
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    // 1) Verify conversation ownership
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) {
      sseEvent(reply, "error", { message: "Conversation not found", code: "NOT_FOUND" });
      reply.raw.end();
      return;
    }

    // 2) Persist user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: "user",
        content: userMessageContent,
        parentMessageId: opts.parentMessageId ?? null,
        metadata: {},
      },
    });

    // 3) Load history (last 50 messages)
    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    // 4) RAG retrieval
    let citations: Citation[] = [];
    let contextMessages: GatewayMessage[] = [];

    if (ragEnabled) {
      const ragResult = await retrieveContext(userMessageContent, userId);
      citations = ragResult.citations;
      contextMessages = ragResult.contextMessages;

      if (citations.length > 0) {
        sseEvent(reply, "citation", citations);
      }
    }

    // 5) Build messages array
    const historyMessages: GatewayMessage[] = history
      .filter((m) => ["system", "user", "assistant", "tool"].includes(m.role))
      .map((m) => ({ role: m.role as GatewayMessage["role"], content: m.content }));

    // System prompt
    const systemMessage: GatewayMessage = {
      role: "system",
      content: `You are Janna AI, a helpful, context-aware AI assistant. Today is ${new Date().toISOString().split("T")[0]}.
When using tools, always explain what you're doing. Present information clearly using markdown.
If you reference retrieved documents, always cite the source filename.`,
    };

    const messages: GatewayMessage[] = [
      systemMessage,
      ...contextMessages,
      ...historyMessages,
    ];

    // 6) Stream from Model Gateway
    let assistantContent = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let finishReason = "stop";
    const toolCalls: ToolCall[] = [];

    const startTime = Date.now();

    for await (const event of streamChat({
      messages,
      modelId,
      userId,
      conversationId,
      tools: TOOL_DEFINITIONS,
    })) {
      if (event.type === "token" && event.token) {
        assistantContent += event.token;
        sseEvent(reply, "token", { token: event.token, messageId: "pending" });
      } else if (event.type === "tool_call" && event.toolCall?.finished) {
        const tc = event.toolCall;
        const toolCall: ToolCall = {
          id: tc.id,
          name: tc.name,
          arguments: tc.parsedArgs ?? {},
          status: "running",
        };
        sseEvent(reply, "tool_call", toolCall);

        // Execute the tool
        let toolResult: unknown;
        let toolStatus: "done" | "error" = "done";
        const toolStart = Date.now();

        try {
          toolResult = await executeTool(tc.name, tc.parsedArgs ?? {}, { userId });
          toolCall.status = "done";
        } catch (err) {
          toolResult = { error: (err as Error).message };
          toolCall.status = "error";
          toolStatus = "error";
        }

        toolCall.result = toolResult;
        toolCall.latencyMs = Date.now() - toolStart;
        toolCalls.push(toolCall);

        sseEvent(reply, "tool_result", {
          toolCallId: tc.id,
          result: toolResult,
          status: toolStatus,
        });

        // Append tool result to messages and continue generation
        messages.push({ role: "assistant", content: assistantContent || "(thinking)" });
        messages.push({
          role: "tool",
          content: JSON.stringify(toolResult),
          toolCallId: tc.id,
          name: tc.name,
        });

        // Continue generation after tool
        assistantContent = "";
        for await (const cont of streamChat({ messages, modelId, userId, conversationId })) {
          if (cont.type === "token" && cont.token) {
            assistantContent += cont.token;
            sseEvent(reply, "token", { token: cont.token, messageId: "pending" });
          } else if (cont.type === "done" && cont.done) {
            promptTokens += cont.done.promptTokens;
            completionTokens += cont.done.completionTokens;
            finishReason = cont.done.finishReason;
          }
        }
      } else if (event.type === "done" && event.done) {
        promptTokens = event.done.promptTokens;
        completionTokens = event.done.completionTokens;
        finishReason = event.done.finishReason;
      }
    }

    const latencyMs = Date.now() - startTime;

    // 7) Persist assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: assistantContent,
        parentMessageId: userMessage.id,
        metadata: {
          model: modelId,
          promptTokens,
          completionTokens,
          latencyMs,
          toolCalls,
          citations,
          finishReason,
        },
      },
    });

    // 8) Record usage
    const costEstimate = estimateCost(modelId, promptTokens, completionTokens);
    await prisma.usageEvent.create({
      data: {
        userId,
        conversationId,
        model: modelId,
        promptTokens,
        completionTokens,
        latencyMs,
        costEstimate,
      },
    });

    // 9) Update conversation title if first message
    if (history.filter((m) => m.role === "user").length === 0) {
      const title = userMessageContent.slice(0, 60).trim() || "New Conversation";
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      });
    }

    // 10) Send done event
    sseEvent(reply, "done", {
      messageId: assistantMessage.id,
      promptTokens,
      completionTokens,
      model: modelId,
      finishReason,
    });
  } catch (err) {
    console.error("[Orchestrator] Error:", err);
    sseEvent(reply, "error", {
      message: (err as Error).message ?? "Internal error",
      code: "INTERNAL_ERROR",
    });
  } finally {
    reply.raw.end();
  }
}
