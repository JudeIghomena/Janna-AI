import { z } from 'zod';

export const calculatorSchema = z.object({
  expression: z
    .string()
    .max(500)
    .regex(
      /^[\d\s+\-*/().,%^]+$|^(sqrt|abs|round|floor|ceil|min|max|log|exp|Math\.\w+)\(/,
      'Expression contains disallowed characters'
    ),
});

// Safe math evaluator — no eval(), uses a recursive descent parser
function safeMath(expr: string): number {
  const tokens = tokenize(expr.replace(/\s+/g, ''));
  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }

  function consume(): string {
    return tokens[pos++];
  }

  function parseNumber(): number {
    const tok = peek();
    if (tok === undefined) throw new Error('Unexpected end of expression');

    // Parenthesized expression
    if (tok === '(') {
      consume(); // (
      const val = parseExpr();
      if (consume() !== ')') throw new Error('Missing closing parenthesis');
      return val;
    }

    // Functions
    if (/^[a-z]+$/.test(tok)) {
      consume();
      if (consume() !== '(') throw new Error(`Expected ( after ${tok}`);
      const arg1 = parseExpr();
      let result: number;
      if (peek() === ',') {
        consume();
        const arg2 = parseExpr();
        result = applyFunc2(tok, arg1, arg2);
      } else {
        result = applyFunc(tok, arg1);
      }
      if (consume() !== ')') throw new Error('Missing closing parenthesis');
      return result;
    }

    // Unary minus
    if (tok === '-') {
      consume();
      return -parseNumber();
    }

    // Number literal
    const numStr = consume();
    const n = parseFloat(numStr);
    if (isNaN(n)) throw new Error(`Not a number: ${numStr}`);
    return n;
  }

  function parsePow(): number {
    let base = parseNumber();
    while (peek() === '**' || peek() === '^') {
      consume();
      const exp = parseNumber();
      base = Math.pow(base, exp);
    }
    return base;
  }

  function parseMulDiv(): number {
    let result = parsePow();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      const right = parsePow();
      if (op === '*') result *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        result /= right;
      } else {
        result %= right;
      }
    }
    return result;
  }

  function parseExpr(): number {
    let result = parseMulDiv();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseMulDiv();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  const result = parseExpr();
  if (pos !== tokens.length) {
    throw new Error(`Unexpected token at position ${pos}: ${tokens[pos]}`);
  }
  return result;
}

function applyFunc(name: string, x: number): number {
  switch (name) {
    case 'sqrt': return Math.sqrt(x);
    case 'abs':  return Math.abs(x);
    case 'round': return Math.round(x);
    case 'floor': return Math.floor(x);
    case 'ceil':  return Math.ceil(x);
    case 'log':  return Math.log(x);
    case 'exp':  return Math.exp(x);
    default: throw new Error(`Unknown function: ${name}`);
  }
}

function applyFunc2(name: string, a: number, b: number): number {
  switch (name) {
    case 'min': return Math.min(a, b);
    case 'max': return Math.max(a, b);
    default: throw new Error(`Unknown two-arg function: ${name}`);
  }
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    if (/\d|\./.test(expr[i])) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) num += expr[i++];
      tokens.push(num);
    } else if (expr[i] === '*' && expr[i + 1] === '*') {
      tokens.push('**');
      i += 2;
    } else if (/[+\-*/%^(),]/.test(expr[i])) {
      tokens.push(expr[i++]);
    } else if (/[a-z]/.test(expr[i])) {
      let fn = '';
      while (i < expr.length && /[a-z]/.test(expr[i])) fn += expr[i++];
      tokens.push(fn);
    } else {
      throw new Error(`Unexpected character: ${expr[i]}`);
    }
  }
  return tokens;
}

export async function calculator(
  input: Record<string, unknown>
): Promise<{ result: number; expression: string }> {
  const { expression } = input as z.infer<typeof calculatorSchema>;
  const result = safeMath(expression);
  return { result, expression };
}
