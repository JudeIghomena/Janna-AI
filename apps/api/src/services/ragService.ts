// ============================================================
// RAG Service - Retrieval Augmented Generation
// ============================================================
import { prisma } from "../db/client";
import { embed } from "./modelGateway";
import type { Citation } from "@janna/shared";
import { RAG_TOP_K } from "@janna/shared";
import type { GatewayMessage } from "./modelGateway/types";

export async function retrieveContext(
  query: string,
  userId: string,
  topK: number = RAG_TOP_K
): Promise<{ citations: Citation[]; contextMessages: GatewayMessage[] }> {
  const [queryEmbedding] = await embed({ texts: [query] });

  const results = await prisma.$queryRaw<
    {
      id: string;
      attachment_id: string;
      chunk_index: number;
      content: string;
      filename: string;
      score: number;
    }[]
  >`
    SELECT
      dc.id,
      dc.attachment_id,
      dc.chunk_index,
      dc.content,
      a.filename,
      1 - (dc.embedding <=> ${queryEmbedding}::vector) AS score
    FROM document_chunks dc
    JOIN attachments a ON a.id = dc.attachment_id
    WHERE a.user_id = ${userId}
      AND a.status = 'READY'
      AND dc.embedding IS NOT NULL
      AND (1 - (dc.embedding <=> ${queryEmbedding}::vector)) > 0.5
    ORDER BY dc.embedding <=> ${queryEmbedding}::vector
    LIMIT ${topK}
  `;

  if (results.length === 0) {
    return { citations: [], contextMessages: [] };
  }

  const citations: Citation[] = results.map((r) => ({
    attachmentId: r.attachment_id,
    filename: r.filename,
    chunkIndex: r.chunk_index,
    excerpt: r.content.slice(0, 300),
    score: r.score,
  }));

  // Build a system context message with retrieved content
  // RAG prompt injection defense: wrap in quoted blocks
  const contextText = results
    .map(
      (r, i) =>
        `[Document ${i + 1}: ${r.filename}, chunk ${r.chunk_index}]\n"""\n${r.content}\n"""`
    )
    .join("\n\n");

  const contextMessages: GatewayMessage[] = [
    {
      role: "system",
      content: `The following passages are retrieved from the user's documents. Use them to inform your answer. Do not fabricate information not present in these passages. Always cite the document name when referencing retrieved content.\n\n${contextText}`,
    },
  ];

  return { citations, contextMessages };
}
