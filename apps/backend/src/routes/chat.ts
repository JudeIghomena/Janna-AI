import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { streamChat, GatewayMessage } from '../services/modelGateway';
import { retrieveRelevantChunks } from '../services/ragService';
import { getToolDefinitions, executeTool } from '../services/toolService';
import { slidingWindowRateLimit } from '../lib/redis';
import { config } from '../config';
import type { SSEEvent, MessageMetadata, ToolCallRecord, CitationRecord } from '@janna/shared';

const chatStreamBody = z.object({
  conversationId: z.string().cuid(),
  message: z.string().min(1).max(100000),
  modelId: z.string().optional().default('openai:gpt-4o-mini'),
  ragEnabled: z.boolean().optional().default(true),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(32768).optional(),
  attachmentIds: z.array(z.string()).optional(),
});

const SYSTEM_PROMPT = `You are Janna, a context-aware AI assistant. You are helpful, accurate, and concise.
When you have access to the user's documents via retrieve_docs, use them to provide grounded, cited answers.
Always be honest about uncertainty. Format your responses using Markdown when it improves readability.
Today's date is ${new Date().toISOString().split('T')[0]}.`;

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/chat/stream',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Rate limiting
      const rateLimitKey = `rl:chat:${request.userId}`;
      const { allowed, remaining } = await slidingWindowRateLimit(
        rateLimitKey,
        config.RATE_LIMIT_WINDOW_MS,
        config.RATE_LIMIT_CHAT_MAX
      );

      if (!allowed) {
        return reply.status(429).send({
          error: 'Chat rate limit exceeded',
          code: 'RATE_LIMITED',
        });
      }

      reply.raw.setHeader('X-RateLimit-Remaining', remaining.toString());

      // Validate body
      const parsed = chatStreamBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      const {
        conversationId,
        message,
        modelId,
        ragEnabled,
        temperature,
        maxTokens,
        attachmentIds,
      } = parsed.data;

      // Verify conversation ownership
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: request.userId },
        select: { id: true, title: true },
      });

      if (!conversation) {
        return reply.status(404).send({
          error: 'Conversation not found',
          code: 'NOT_FOUND',
        });
      }

      // Load conversation history
      const history = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 50, // limit context window usage
        select: { role: true, content: true },
      });

      // Save user message immediately
      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: message,
          metadata: { modelId },
        },
        select: { id: true, createdAt: true },
      });

      // Auto-title conversation on first user message
      if (history.length === 0 && conversation.title === 'New Conversation') {
        const autoTitle =
          message.slice(0, 60) + (message.length > 60 ? '…' : '');
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { title: autoTitle },
        });
      }

      // ─── Setup SSE ───────────────────────────────────────────────────────
      reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders();

      const sendEvent = (event: SSEEvent) => {
        if (reply.raw.writableEnded) return;
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      // Keep-alive ping every 15s
      const keepAlive = setInterval(() => {
        if (!reply.raw.writableEnded) {
          reply.raw.write(': ping\n\n');
        }
      }, 15_000);

      // Abort controller — cancels the AI stream if the client disconnects
      const abortController = new AbortController();

      const cleanup = () => {
        clearInterval(keepAlive);
        abortController.abort();
        if (!reply.raw.writableEnded) reply.raw.end();
      };

      // Handle client disconnect
      request.raw.on('close', cleanup);

      try {
        // ─── RAG retrieval ──────────────────────────────────────────────────
        const citations: CitationRecord[] = [];
        let ragContext = '';

        if (ragEnabled) {
          try {
            const ragResult = await retrieveRelevantChunks(
              message,
              request.userId,
              attachmentIds
            );
            ragContext = ragResult.context;
            for (const c of ragResult.citations) {
              citations.push(c);
              sendEvent({ type: 'citation', ...c });
            }
          } catch (err) {
            fastify.log.warn({ err }, 'RAG retrieval failed, proceeding without context');
          }
        }

        // ─── Build messages ─────────────────────────────────────────────────
        const systemContent = ragContext
          ? `${SYSTEM_PROMPT}\n\n${ragContext}`
          : SYSTEM_PROMPT;

        const gatewayMessages: GatewayMessage[] = [
          { role: 'system', content: systemContent },
          ...history.map((m) => ({
            role: m.role as GatewayMessage['role'],
            content: m.content,
          })),
          { role: 'user', content: message },
        ];

        // ─── Tool handling ──────────────────────────────────────────────────
        const toolCalls: ToolCallRecord[] = [];
        let assistantContent = '';
        let usage = {
          promptTokens: 0,
          completionTokens: 0,
          costEstimate: 0,
          latencyMs: 0,
        };

        // ─── First streaming pass ────────────────────────────────────────────
        let pendingToolCall: {
          id: string;
          name: string;
          input: Record<string, unknown>;
        } | null = null;

        await streamChat({
          messages: gatewayMessages,
          modelId,
          temperature,
          maxTokens,
          tools: getToolDefinitions(),
          signal: abortController.signal,
          onEvent: (event) => {
            sendEvent(event);
            if (event.type === 'token') {
              assistantContent += event.content;
            }
            if (event.type === 'tool_call_start') {
              pendingToolCall = {
                id: event.toolCallId,
                name: event.name,
                input: event.input,
              };
            }
            if (event.type === 'usage') {
              usage = {
                promptTokens: event.promptTokens,
                completionTokens: event.completionTokens,
                costEstimate: event.costEstimate,
                latencyMs: event.latencyMs,
              };
            }
          },
        });

        // ─── Execute tool if requested ────────────────────────────────────────
        if (pendingToolCall) {
          const tc = pendingToolCall;
          const toolCtx = {
            userId: request.userId,
            conversationId,
            attachmentIds,
          };

          const toolResult = await executeTool(tc.name, tc.input, toolCtx);

          sendEvent({
            type: 'tool_call_result',
            toolCallId: tc.id,
            name: tc.name,
            output: toolResult.output,
            error: toolResult.error,
          });

          toolCalls.push({
            id: tc.id,
            name: tc.name,
            input: tc.input,
            output: toolResult.output,
            error: toolResult.error,
            latencyMs: toolResult.latencyMs,
          });

          // Follow-up streaming pass with tool result
          const followUpMessages: GatewayMessage[] = [
            ...gatewayMessages,
            {
              role: 'assistant',
              content: assistantContent || `[called tool: ${tc.name}]`,
            },
            {
              role: 'tool',
              content: JSON.stringify(toolResult.output ?? toolResult.error),
              toolCallId: tc.id,
              name: tc.name,
            },
          ];

          assistantContent = '';
          await streamChat({
            messages: followUpMessages,
            modelId,
            temperature,
            maxTokens,
            signal: abortController.signal,
            onEvent: (event) => {
              sendEvent(event);
              if (event.type === 'token') {
                assistantContent += event.content;
              }
              if (event.type === 'usage') {
                usage.completionTokens += event.completionTokens;
                usage.costEstimate += event.costEstimate;
                usage.latencyMs += event.latencyMs;
              }
            },
          });
        }

        // ─── Persist assistant message ─────────────────────────────────────────
        const metadata: MessageMetadata = {
          modelId,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          costEstimate: usage.costEstimate,
          latencyMs: usage.latencyMs,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          citations: citations.length > 0 ? citations : undefined,
        };

        const assistantMsg = await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: assistantContent,
            metadata: metadata as object,
          },
          select: { id: true },
        });

        // Persist usage event
        await prisma.usageEvent.create({
          data: {
            userId: request.userId,
            conversationId,
            modelId,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            latencyMs: usage.latencyMs,
            costEstimate: usage.costEstimate,
          },
        });

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        sendEvent({
          type: 'done',
          messageId: assistantMsg.id,
          conversationId,
        });
      } catch (err) {
        fastify.log.error({ err }, 'Chat stream error');
        sendEvent({
          type: 'error',
          message: err instanceof Error ? err.message : 'Stream failed',
          code: 'STREAM_ERROR',
        });
      } finally {
        cleanup();
      }
    }
  );

  // POST /api/messages/:id/feedback
  fastify.post(
    '/messages/:id/feedback',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const bodySchema = z.object({
        thumbsUp: z.boolean().nullable(),
      });
      const body = bodySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid body', code: 'VALIDATION_ERROR' });
      }

      const msg = await prisma.message.findFirst({
        where: { id: request.params.id },
        include: { conversation: { select: { userId: true } } },
      });

      if (!msg || msg.conversation.userId !== request.userId) {
        return reply.status(404).send({ error: 'Message not found', code: 'NOT_FOUND' });
      }

      const currentMeta = (msg.metadata as MessageMetadata) ?? {};
      await prisma.message.update({
        where: { id: request.params.id },
        data: { metadata: { ...currentMeta, thumbsUp: body.data.thumbsUp } },
      });

      return reply.send({ ok: true });
    }
  );
}
