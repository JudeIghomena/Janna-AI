import { z } from 'zod';
import { retrieveRelevantChunks } from '../services/ragService';
import type { ToolExecutionContext } from './index';

export const retrieveDocsSchema = z.object({
  query: z.string().min(1).max(1000),
  topK: z.number().int().min(1).max(20).optional().default(5),
});

export async function retrieveDocs(
  input: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<unknown> {
  const { query, topK } = input as z.infer<typeof retrieveDocsSchema>;
  const result = await retrieveRelevantChunks(
    query,
    ctx.userId,
    ctx.attachmentIds,
    topK
  );

  if (result.citations.length === 0) {
    return {
      found: false,
      message: 'No relevant documents found for this query.',
      results: [],
    };
  }

  return {
    found: true,
    results: result.citations.map((c) => ({
      filename: c.filename,
      chunkIndex: c.chunkIndex,
      excerpt: c.excerpt,
      similarity: c.similarity,
    })),
    context: result.context,
  };
}
