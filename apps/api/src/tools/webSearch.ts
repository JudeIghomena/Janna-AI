import { z } from "zod";

export const webSearchSchema = z.object({
  query: z.string().max(500).describe("The web search query"),
});

export type WebSearchInput = z.infer<typeof webSearchSchema>;

// Stub implementation - replace with a real safe provider (e.g., Brave Search, SerpAPI)
export async function runWebSearch(input: WebSearchInput): Promise<unknown> {
  // TODO: Integrate with a safe search API provider
  // Example with Brave Search:
  // const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(input.query)}`, {
  //   headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY }
  // });
  // const data = await res.json();
  // return { results: data.web?.results?.slice(0, 5) ?? [] };

  return {
    stub: true,
    message: "Web search is not yet configured. Provide BRAVE_SEARCH_API_KEY to enable.",
    query: input.query,
    results: [],
  };
}

export const webSearchDefinition = {
  name: "web_search",
  description:
    "Searches the web for current information. Returns a list of relevant results with titles, URLs, and snippets.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
    },
    required: ["query"],
  },
};
