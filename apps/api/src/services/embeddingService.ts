import { embed } from "./modelGateway";
import { CHUNK_SIZE, CHUNK_OVERLAP } from "@janna/shared";

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE * 4, text.length); // ~4 chars per token
    chunks.push(text.slice(start, end).trim());
    start += (CHUNK_SIZE - CHUNK_OVERLAP) * 4;
  }

  return chunks.filter((c) => c.length > 20); // Drop tiny chunks
}

export async function computeEmbeddings(texts: string[]): Promise<number[][]> {
  // Process in batches of 100
  const BATCH_SIZE = 100;
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embed({ texts: batch, provider: "openai" });
    all.push(...embeddings);
  }
  return all;
}
