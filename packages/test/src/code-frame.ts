import { readFileSync } from 'node:fs';

const TEST_FILE_RE = /\s+at\s+.*[/\\](.+\.(?:test|spec)\.(?:ts|tsx|js|mjs)):(\d+):(\d+)/;

/**
 * Rewrite assertion error stacks to include the source line with a caret.
 * Similar to @babel/code-frame but zero dependencies.
 */
export function patchErrorStack(error: Error): void {
  if (!error.stack) return;

  const match = error.stack.match(TEST_FILE_RE);
  if (!match) return;

  const [, file, lineStr, colStr] = match;
  const line = Number(lineStr);
  const col = Number(colStr);

  try {
    // Try to resolve the file path from the stack
    const fullPathMatch = error.stack.match(new RegExp(`(\\S+[/\\\\]${escapeRegExp(file)}):(\\d+):(\\d+)`));
    if (!fullPathMatch) return;

    const fullPath = fullPathMatch[1];
    const source = readFileSync(fullPath, 'utf8');
    const lines = source.split('\n');

    const start = Math.max(0, line - 3);
    const end = Math.min(lines.length, line + 2);
    const frame: string[] = [];
    const gutterWidth = String(end).length;

    for (let i = start; i < end; i++) {
      const lineNum = i + 1;
      const marker = lineNum === line ? '>' : ' ';
      const gutter = String(lineNum).padStart(gutterWidth);
      frame.push(`  ${marker} ${gutter} | ${lines[i]}`);

      if (lineNum === line && col > 0) {
        const padding = ' '.repeat(col - 1);
        frame.push(`    ${' '.repeat(gutterWidth)} | ${padding}^`);
      }
    }

    error.stack = `${error.message}\n\n${frame.join('\n')}\n\n${error.stack}`;
  } catch {
    // File not readable, skip
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
