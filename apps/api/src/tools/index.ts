// ============================================================
// Tool Registry - Allowlisted tools with schemas
// ============================================================
import {
  calculatorDefinition,
  calculatorSchema,
  runCalculator,
} from "./calculator";
import {
  retrieveDocsDefinition,
  retrieveDocsSchema,
  runRetrieveDocs,
} from "./retrieveDocs";
import {
  webSearchDefinition,
  webSearchSchema,
  runWebSearch,
} from "./webSearch";
import {
  summarizeAttachmentDefinition,
  summarizeAttachmentSchema,
  runSummarizeAttachment,
} from "./summarizeAttachment";
import type { ToolDefinition } from "../services/modelGateway";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  calculatorDefinition,
  retrieveDocsDefinition,
  webSearchDefinition,
  summarizeAttachmentDefinition,
];

export const TOOL_NAMES = new Set(TOOL_DEFINITIONS.map((t) => t.name));

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: { userId: string }
): Promise<unknown> {
  // Enforce allowlist
  if (!TOOL_NAMES.has(name)) {
    throw new Error(`Tool "${name}" is not in the allowlist`);
  }

  const TIMEOUT_MS = 15000;

  const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Tool execution timed out")), TIMEOUT_MS)
      ),
    ]);

  switch (name) {
    case "calculator": {
      const input = calculatorSchema.parse(args);
      return withTimeout(runCalculator(input));
    }
    case "retrieve_docs": {
      const input = retrieveDocsSchema.parse(args);
      return withTimeout(runRetrieveDocs(input, context.userId));
    }
    case "web_search": {
      const input = webSearchSchema.parse(args);
      return withTimeout(runWebSearch(input));
    }
    case "summarize_attachment": {
      const input = summarizeAttachmentSchema.parse(args);
      return withTimeout(runSummarizeAttachment(input, context.userId));
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
