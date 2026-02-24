import { z } from 'zod';
import type { ToolExecutionContext } from './index';

export const webSearchSchema = z.object({
  query: z.string().min(1).max(500),
  numResults: z.number().int().min(1).max(10).optional().default(5),
});

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ─── Brave Search provider (swap with Serper or Bing as needed) ───────────────
async function braveSearch(
  query: string,
  count: number
): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    // Return stub results in dev/when key not configured
    return [
      {
        title: '[Web search stub — configure BRAVE_SEARCH_API_KEY]',
        url: 'https://example.com',
        snippet: `Search results for "${query}" would appear here.`,
      },
    ];
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
    query
  )}&count=${count}&text_decorations=false`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    web?: {
      results?: Array<{
        title: string;
        url: string;
        description: string;
      }>;
    };
  };

  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));
}

export async function webSearch(
  input: Record<string, unknown>,
  _ctx: ToolExecutionContext
): Promise<unknown> {
  const { query, numResults } = input as z.infer<typeof webSearchSchema>;
  const results = await braveSearch(query, numResults);
  return {
    query,
    results,
    note: 'Results from web search. Verify important facts independently.',
  };
}
