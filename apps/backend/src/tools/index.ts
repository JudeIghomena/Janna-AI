import { ToolDefinition } from '@janna/shared';
import { z, ZodSchema } from 'zod';
import { calculator, calculatorSchema } from './calculator';
import { retrieveDocs, retrieveDocsSchema } from './retrieveDocs';
import { webSearch, webSearchSchema } from './webSearch';

export interface ToolExecutionContext {
  userId: string;
  conversationId: string;
  attachmentIds?: string[];
}

export interface ToolExecutor {
  definition: ToolDefinition;
  schema: ZodSchema;
  execute: (
    input: Record<string, unknown>,
    ctx: ToolExecutionContext
  ) => Promise<unknown>;
}

const TOOL_REGISTRY: Map<string, ToolExecutor> = new Map([
  [
    'calculator',
    {
      definition: {
        name: 'calculator',
        description:
          'Evaluates a safe mathematical expression. Supports +, -, *, /, **, %, sqrt, abs, round, floor, ceil, min, max, log, exp, and numeric literals.',
        inputSchema: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Mathematical expression to evaluate, e.g. "2 * (3 + 4)"',
            },
          },
          required: ['expression'],
        },
      },
      schema: calculatorSchema,
      execute: calculator,
    },
  ],
  [
    'retrieve_docs',
    {
      definition: {
        name: 'retrieve_docs',
        description:
          'Searches the user\'s uploaded documents for relevant information. Use this when the user asks about content in their files.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to find relevant document chunks',
            },
            topK: {
              type: 'number',
              description: 'Maximum number of results to return (default: 5)',
            },
          },
          required: ['query'],
        },
      },
      schema: retrieveDocsSchema,
      execute: retrieveDocs,
    },
  ],
  [
    'web_search',
    {
      definition: {
        name: 'web_search',
        description:
          'Searches the web for current information. Use for questions about recent events, facts not in training data, or real-time information.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query',
            },
            numResults: {
              type: 'number',
              description: 'Number of results to return (default: 5, max: 10)',
            },
          },
          required: ['query'],
        },
      },
      schema: webSearchSchema,
      execute: webSearch,
    },
  ],
]);

export function getToolDefinitions(): ToolDefinition[] {
  return Array.from(TOOL_REGISTRY.values()).map((t) => t.definition);
}

export async function executeTool(
  name: string,
  rawInput: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<{ output: unknown; error?: string; latencyMs: number }> {
  const tool = TOOL_REGISTRY.get(name);
  if (!tool) {
    return {
      output: null,
      error: `Unknown tool: ${name}`,
      latencyMs: 0,
    };
  }

  const parsed = tool.schema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      output: null,
      error: `Invalid input: ${parsed.error.message}`,
      latencyMs: 0,
    };
  }

  const start = Date.now();
  try {
    const output = await Promise.race([
      tool.execute(parsed.data as Record<string, unknown>, ctx),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timeout')), 10_000)
      ),
    ]);
    return { output, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      output: null,
      error: err instanceof Error ? err.message : 'Tool execution failed',
      latencyMs: Date.now() - start,
    };
  }
}
