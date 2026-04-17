import { UIElement } from './ui-element.js';

type Combinator = 'descendant' | 'child' | 'adjacent';

interface SelectorPart {
  tag?: string;
  id?: string;
  attrs?: Record<string, string | null>;
  nthChild?: number;
  has?: string;
}

interface SelectorSegment {
  combinator: Combinator;
  part: SelectorPart;
}

export class SelectorEngine {
  query(root: UIElement, selector: string): UIElement | null {
    const results = this.queryAll(root, selector);
    return results[0] ?? null;
  }

  queryAll(root: UIElement, selector: string): UIElement[] {
    const segments = this.parse(selector);
    if (segments.length === 0) return [];

    const all = this.flatten(root);
    return all.filter((el) => this.matchesChain(el, segments));
  }

  private parse(selector: string): SelectorSegment[] {
    const segments: SelectorSegment[] = [];
    const tokens = this.tokenize(selector);

    let combinator: Combinator = 'descendant';

    for (const token of tokens) {
      if (token === '>') {
        combinator = 'child';
        continue;
      }
      if (token === '+') {
        combinator = 'adjacent';
        continue;
      }

      segments.push({
        combinator: segments.length === 0 ? 'descendant' : combinator,
        part: this.parsePart(token),
      });
      combinator = 'descendant';
    }

    return segments;
  }

  private tokenize(selector: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let parenDepth = 0;

    for (let i = 0; i < selector.length; i++) {
      const ch = selector[i];

      if (ch === '[') {
        const end = selector.indexOf(']', i);
        if (end === -1) {
          current += selector.slice(i);
          break;
        }
        current += selector.slice(i, end + 1);
        i = end;
        continue;
      }

      if (ch === '(') { parenDepth++; current += ch; continue; }
      if (ch === ')') { parenDepth--; current += ch; continue; }

      if (parenDepth === 0 && (ch === ' ' || ch === '\t')) {
        if (current) { tokens.push(current); current = ''; }
        continue;
      }

      if (parenDepth === 0 && (ch === '>' || ch === '+')) {
        if (current) { tokens.push(current); current = ''; }
        tokens.push(ch);
        continue;
      }

      current += ch;
    }

    if (current) tokens.push(current);
    return tokens;
  }

  private parsePart(token: string): SelectorPart {
    const part: SelectorPart = {};
    let remaining = token;

    // Extract :has(...) first (balanced parens) before attribute regex runs
    const hasMatch = remaining.match(/:has\(/);
    if (hasMatch) {
      const start = hasMatch.index!;
      let depth = 0;
      let end = -1;
      for (let i = start + 5; i < remaining.length; i++) {
        if (remaining[i] === '(') depth++;
        else if (remaining[i] === ')') {
          if (depth === 0) { end = i; break; }
          depth--;
        }
      }
      if (end !== -1) {
        const sub = remaining.slice(start + 5, end);
        part.has = sub;
        remaining = remaining.slice(0, start) + remaining.slice(end + 1);
      }
    }

    // Tag#id or #id (supports CSS escapes like #vkey\:submit)
    const idMatch = remaining.match(/^([^#:\[]*)?#((?:\\.|[^\s.:\[])+)/);
    if (idMatch) {
      if (idMatch[1]) part.tag = idMatch[1];
      part.id = idMatch[2].replace(/\\(.)/g, '$1');
      remaining = remaining.slice(idMatch[0].length);
    } else {
      const tagMatch = remaining.match(/^([a-zA-Z][\w]*)/);
      if (tagMatch) {
        part.tag = tagMatch[1];
        remaining = remaining.slice(tagMatch[0].length);
      }
    }

    // :nth-child(n)
    const nthMatch = remaining.match(/:nth-child\((\d+)\)/);
    if (nthMatch) {
      part.nthChild = Number(nthMatch[1]);
      remaining = remaining.replace(nthMatch[0], '');
    }

    // [attr=value] pairs
    const attrRegex = /\[([^\]=]+)(?:="([^"]*)")?\]/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(remaining)) !== null) {
      if (!part.attrs) part.attrs = {};
      part.attrs[attrMatch[1]] = attrMatch[2] ?? null;
    }

    return part;
  }

  private matchesPart(el: UIElement, part: SelectorPart): boolean {
    if (part.tag && el.tag !== part.tag) return false;
    if (part.id && el.id !== part.id) return false;

    if (part.nthChild !== undefined) {
      const parent = el.parent;
      if (!parent) return part.nthChild === 1;
      // When a tag is specified, count only siblings with the same tag
      // (matches CSS :nth-of-type behavior that test authors expect)
      const siblings = part.tag
        ? parent.children.filter((c) => c.tag === part.tag)
        : parent.children;
      const idx = siblings.indexOf(el);
      if (idx + 1 !== part.nthChild) return false;
    }

    if (part.attrs) {
      for (const [key, value] of Object.entries(part.attrs)) {
        const attrVal = el.getAttribute(key);
        if (value === null) {
          if (attrVal === undefined) return false;
        } else {
          if (attrVal !== value) return false;
        }
      }
    }

    if (part.has) {
      const subSegments = this.parse(part.has);
      const descendants = this.flatten(el).slice(1); // exclude el itself
      const anyMatch = descendants.some((d) => this.matchesChain(d, subSegments));
      if (!anyMatch) return false;
    }

    return true;
  }

  private matchesChain(el: UIElement, segments: SelectorSegment[]): boolean {
    let current: UIElement = el;
    if (!this.matchesPart(current, segments[segments.length - 1].part)) return false;

    for (let i = segments.length - 2; i >= 0; i--) {
      const rel = segments[i + 1].combinator;

      if (rel === 'child') {
        const p = current.parent;
        if (!p || !this.matchesPart(p, segments[i].part)) return false;
        current = p;
      } else if (rel === 'adjacent') {
        const p: UIElement | null = current.parent;
        if (!p) return false;
        const sibIdx: number = p.children.indexOf(current);
        if (sibIdx <= 0) return false;
        const prev: UIElement = p.children[sibIdx - 1];
        if (!this.matchesPart(prev, segments[i].part)) return false;
        current = prev;
      } else {
        let ancestor: UIElement | null = current.parent;
        let found = false;
        while (ancestor) {
          if (this.matchesPart(ancestor, segments[i].part)) {
            found = true;
            current = ancestor;
            break;
          }
          ancestor = ancestor.parent;
        }
        if (!found) return false;
      }
    }

    return true;
  }

  private flatten(root: UIElement): UIElement[] {
    const result: UIElement[] = [root];
    for (const child of root.children) {
      result.push(...this.flatten(child));
    }
    return result;
  }
}
