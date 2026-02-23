import { z } from "zod";
import { prisma } from "../db/client";
import { embed } from "../services/modelGateway";
import type { Citation } from "@janna/shared";
import { RAG_TOP_K } from "@janna/shared";

export const retrieveDocsSchema = z.object({
  query: z.string().max(1000).describe("The search query to retrieve relevant documents"),
  topK: z.number().int().min(1).max(20).default(RAG_TOP_K),
});

export type RetrieveDocsInput = z.infer<typeof retrieveDocsSchema>;

export async function runRetrieveDocs(
  input: RetrieveDocsInput,
  userId: string
): Promise<{ citations: Citation[] }> {
  const [queryEmbedding] = await embed({ texts: [input.query] });

  // pgvector cosine similarity search
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
    ORDER BY dc.embedding <=> ${queryEmbedding}::vector
    LIMIT ${input.topK}
  `;

  const citations: Citation[] = results.map((r) => ({
    attachmentId: r.attachment_id,
    filename: r.filename,
    chunkIndex: r.chunk_index,
    excerpt: r.content.slice(0, 300),
    score: r.score,
  }));

  return { citations };
}

export const retrieveDocsDefinition = {
  name: "retrieve_docs",
  description:
    "Retrieves relevant passages from the user's uploaded documents using semantic search. Returns excerpts with citations.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
      topK: {
        type: "number",
        description: "Number of results to return (default 5)",
      },
    },
    required: ["query"],
  },
};
