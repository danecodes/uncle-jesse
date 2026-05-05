/**
 * Minimal tag-expression evaluator for test filtering.
 *
 * Grammar:
 *   expr   = term (('or' | 'OR') term)*
 *   term   = factor (('and' | 'AND') factor)*
 *   factor = 'not' factor | '(' expr ')' | atom
 *   atom   = '@' name ('(' arg ')')?
 *
 * Examples:
 *   "@smoke"
 *   "@smoke and not @bug"
 *   "@login or @signup"
 *   "not @bug(ROKU-5786)"
 */

interface TagAtom {
  type: 'atom';
  name: string;
  arg?: string;
}

interface TagNot {
  type: 'not';
  child: TagExpr;
}

interface TagAnd {
  type: 'and';
  left: TagExpr;
  right: TagExpr;
}

interface TagOr {
  type: 'or';
  left: TagExpr;
  right: TagExpr;
}

type TagExpr = TagAtom | TagNot | TagAnd | TagOr;

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === ' ' || input[i] === '\t') { i++; continue; }
    if (input[i] === '(' || input[i] === ')') { tokens.push(input[i]); i++; continue; }
    if (input[i] === '@') {
      let j = i + 1;
      while (j < input.length && /[\w-]/.test(input[j])) j++;
      let tag = input.slice(i, j);
      if (j < input.length && input[j] === '(') {
        const close = input.indexOf(')', j);
        if (close !== -1) {
          tag += input.slice(j, close + 1);
          j = close + 1;
        }
      }
      tokens.push(tag);
      i = j;
      continue;
    }
    // Word (and/or/not)
    let j = i;
    while (j < input.length && /[a-zA-Z]/.test(input[j])) j++;
    if (j > i) { tokens.push(input.slice(i, j)); i = j; continue; }
    i++;
  }
  return tokens;
}

function parse(tokens: string[]): TagExpr {
  let pos = 0;

  function parseOr(): TagExpr {
    let left = parseAnd();
    while (pos < tokens.length && tokens[pos].toLowerCase() === 'or') {
      pos++;
      left = { type: 'or', left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd(): TagExpr {
    let left = parseFactor();
    while (pos < tokens.length && tokens[pos].toLowerCase() === 'and') {
      pos++;
      left = { type: 'and', left, right: parseFactor() };
    }
    return left;
  }

  function parseFactor(): TagExpr {
    if (tokens[pos]?.toLowerCase() === 'not') {
      pos++;
      return { type: 'not', child: parseFactor() };
    }
    if (tokens[pos] === '(') {
      pos++; // skip (
      const expr = parseOr();
      pos++; // skip )
      return expr;
    }
    return parseAtom();
  }

  function parseAtom(): TagExpr {
    const token = tokens[pos++];
    if (!token || !token.startsWith('@')) {
      throw new Error(`Expected @tag, got "${token}"`);
    }
    const argMatch = token.match(/^@([\w-]+)(?:\(([^)]*)\))?$/);
    if (!argMatch) throw new Error(`Invalid tag: "${token}"`);
    return { type: 'atom', name: argMatch[1], arg: argMatch[2] };
  }

  const result = parseOr();
  return result;
}

function evaluate(expr: TagExpr, tags: Array<{ name: string; arg?: string }>): boolean {
  switch (expr.type) {
    case 'atom':
      return tags.some((t) => {
        if (t.name !== expr.name) return false;
        if (expr.arg !== undefined) return t.arg === expr.arg;
        return true;
      });
    case 'not':
      return !evaluate(expr.child, tags);
    case 'and':
      return evaluate(expr.left, tags) && evaluate(expr.right, tags);
    case 'or':
      return evaluate(expr.left, tags) || evaluate(expr.right, tags);
  }
}

/** Extract @tag and @tag(arg) tokens from a test name. */
export function extractTags(testName: string): Array<{ name: string; arg?: string }> {
  const tags: Array<{ name: string; arg?: string }> = [];
  const re = /@([\w-]+)(?:\(([^)]*)\))?/g;
  let m;
  while ((m = re.exec(testName)) !== null) {
    tags.push({ name: m[1], arg: m[2] });
  }
  return tags;
}

/** Evaluate a tag expression against a test name. Returns true if the test should run. */
export function matchesTagExpression(testName: string, expression: string): boolean {
  if (!expression.trim()) return true;
  const tags = extractTags(testName);
  if (tags.length === 0) return false;
  const expr = parse(tokenize(expression));
  return evaluate(expr, tags);
}

/**
 * Apply tag filtering to a list of Vitest tasks.
 * Sets task.mode = 'skip' on non-matching tasks.
 */
export function applyTagFilter(
  tasks: Array<{ name: string; mode: string }>,
  expression: string,
): void {
  if (!expression.trim()) return;
  for (const task of tasks) {
    if (task.mode === 'skip') continue;
    if (!matchesTagExpression(task.name, expression)) {
      task.mode = 'skip';
    }
  }
}
