import { z } from "zod";

export const calculatorSchema = z.object({
  expression: z
    .string()
    .max(256)
    .describe("A mathematical expression to evaluate, e.g. '2 + 2 * 3'"),
});

export type CalculatorInput = z.infer<typeof calculatorSchema>;

const ALLOWED_CHARS = /^[0-9+\-*/().\s%^,]+$/;

export async function runCalculator(input: CalculatorInput): Promise<unknown> {
  const expr = input.expression.trim();
  if (!ALLOWED_CHARS.test(expr)) {
    throw new Error("Expression contains disallowed characters");
  }
  // Safe evaluation using Function constructor with no global access
  try {
    const fn = new Function("'use strict'; return (" + expr + ")");
    const result = fn();
    if (typeof result !== "number" || !isFinite(result)) {
      throw new Error("Result is not a finite number");
    }
    return { result, expression: expr };
  } catch (err) {
    throw new Error(`Cannot evaluate expression: ${(err as Error).message}`);
  }
}

export const calculatorDefinition = {
  name: "calculator",
  description:
    "Evaluates a safe mathematical expression and returns the numeric result. Use for arithmetic, percentages, and basic math.",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "The mathematical expression to evaluate",
      },
    },
    required: ["expression"],
  },
};
