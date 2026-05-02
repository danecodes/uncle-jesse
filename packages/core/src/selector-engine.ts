import { UIElement } from './ui-element.js';

type Combinator = 'descendant' | 'child' | 'adjacent' | 'general-sibling';

interface AttrMatch {
  value: string | null;
  op?: 'exact' | 'contains' | 'starts' | 'ends';
}

interface SelectorPart {
  tag?: string;
  id?: string;
  attrs?: Record<string, AttrMatch>;
  nthChild?: number;
  has?: string;
  not?: string;
  focused?: boolean;
  visible?: boolean;
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
    if (selector.startsWith('//') || selector.startsWith('./')) {
      throw new Error(
        `XPath selectors are not supported: "${selector}". Use CSS (e.g. replace "//Label[@text=\\"X\\"]" with ":has(Label[text=\\"X\\"])")`
      );
    }

    // Comma-separated selector list: union of matches
    if (selector.includes(',')) {
      const groups = this.splitCommaGroups(selector);
      if (groups.length > 1) {
        const seen = new Set<UIElement>();
        const results: UIElement[] = [];
        for (const group of groups) {
          for (const el of this.queryAll(root, group.trim())) {
            if (!seen.has(el)) {
              seen.add(el);
              results.push(el);
            }
          }
        }
        return results;
      }
    }

    const segments = this.parse(selector);
    if (segments.length === 0) return [];

    const all = this.flatten(root);
    return all.filter((el) => this.matchesChain(el, segments));
  }

  private splitCommaGroups(selector: string): string[] {
    const groups: string[] = [];
    let current = '';
    let depth = 0;
    let inBracket = false;
    for (const ch of selector) {
      if (ch === '[') inBracket = true;
      if (ch === ']') inBracket = false;
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0 && !inBracket) {
        groups.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    if (current) groups.push(current);
    return groups;
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
      if (token === '~') {
        combinator = 'general-sibling';
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

      if (parenDepth === 0 && (ch === '>' || ch === '+' || ch === '~')) {
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

    // Extract :has(...) first (balanced parens)
    remaining = this.extractPseudoFunc(remaining, ':has(', (sub) => { part.has = sub; });

    // Extract :not(...)
    remaining = this.extractPseudoFunc(remaining, ':not(', (sub) => { part.not = sub; });

    // :focused pseudo-class
    if (remaining.includes(':focused')) {
      part.focused = true;
      remaining = remaining.replace(':focused', '');
    }

    // :visible pseudo-class
    if (remaining.includes(':visible')) {
      part.visible = true;
      remaining = remaining.replace(':visible', '');
    }

    // Tag#id or #id (supports CSS escapes like #vkey\:submit)
    const idMatch = remaining.match(/^([^#:\[]*)?#((?:\\.|[^\s.:\[])+)/);
    if (idMatch) {
      if (idMatch[1]) part.tag = idMatch[1];
      part.id = idMatch[2].replace(/\\(.)/g, '$1');
      remaining = remaining.slice(idMatch[0].length);
    } else if (remaining.startsWith('*')) {
      // Universal selector
      remaining = remaining.slice(1);
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

    // [attr=value], [attr*=value], [attr^=value], [attr$=value] pairs
    const attrRegex = /\[([^\]=*^$]+)([*^$])?=(?:"([^"]*)"|'([^']*)')?\]|\[([^\]]+)\]/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(remaining)) !== null) {
      if (!part.attrs) part.attrs = {};
      if (attrMatch[5]) {
        part.attrs[attrMatch[5]] = { value: null };
      } else {
        const key = attrMatch[1];
        const opChar = attrMatch[2];
        const value = attrMatch[3] ?? attrMatch[4] ?? null;
        const op = opChar === '*' ? 'contains' as const
          : opChar === '^' ? 'starts' as const
          : opChar === '$' ? 'ends' as const
          : value !== null ? 'exact' as const
          : undefined;
        part.attrs[key] = { value, op };
      }
    }

    return part;
  }

  /** Extract a balanced-paren pseudo-function like :has(...) or :not(...) */
  private extractPseudoFunc(remaining: string, prefix: string, setter: (sub: string) => void): string {
    const match = remaining.match(new RegExp(prefix.replace('(', '\\(')));
    if (!match) return remaining;
    const start = match.index!;
    let depth = 0;
    let end = -1;
    for (let i = start + prefix.length; i < remaining.length; i++) {
      if (remaining[i] === '(') depth++;
      else if (remaining[i] === ')') {
        if (depth === 0) { end = i; break; }
        depth--;
      }
    }
    if (end !== -1) {
      setter(remaining.slice(start + prefix.length, end));
      return remaining.slice(0, start) + remaining.slice(end + 1);
    }
    return remaining;
  }

  private matchesPart(el: UIElement, part: SelectorPart): boolean {
    if (part.tag) {
      const tagLower = part.tag.toLowerCase();
      const elTagLower = el.tag.toLowerCase();
      const extendsAttr = (el.getAttribute('extends') ?? '').toLowerCase();
      if (elTagLower !== tagLower && extendsAttr !== tagLower) return false;
    }
    if (part.id && el.id !== part.id) return false;

    if (part.focused === true && !el.focused) return false;
    if (part.visible === true && el.getAttribute('visible') === 'false') return false;

    if (part.nthChild !== undefined) {
      const parent = el.parent;
      if (!parent) return part.nthChild === 1;
      const siblings = part.tag
        ? parent.children.filter((c) => c.tag === part.tag)
        : parent.children;
      const idx = siblings.indexOf(el);
      if (idx + 1 !== part.nthChild) return false;
    }

    if (part.attrs) {
      for (const [key, match] of Object.entries(part.attrs)) {
        const attrVal = el.getAttribute(key);
        if (match.value === null) {
          if (attrVal === undefined) return false;
        } else if (attrVal === undefined) {
          return false;
        } else if (match.op === 'contains') {
          if (!attrVal.includes(match.value)) return false;
        } else if (match.op === 'starts') {
          if (!attrVal.startsWith(match.value)) return false;
        } else if (match.op === 'ends') {
          if (!attrVal.endsWith(match.value)) return false;
        } else {
          if (attrVal !== match.value) return false;
        }
      }
    }

    if (part.has) {
      const hasSel = part.has.trim();
      // :has(+ B) — check if el has an adjacent next sibling matching B
      if (hasSel.startsWith('+')) {
        const sibSel = hasSel.slice(1).trim();
        const sibPart = this.parsePart(sibSel);
        const parent = el.parent;
        if (!parent) return false;
        const idx = parent.children.indexOf(el);
        if (idx < 0 || idx >= parent.children.length - 1) return false;
        if (!this.matchesPart(parent.children[idx + 1], sibPart)) return false;
      } else if (hasSel.startsWith('~')) {
        // :has(~ B) — check if el has any following sibling matching B
        const sibSel = hasSel.slice(1).trim();
        const sibPart = this.parsePart(sibSel);
        const parent = el.parent;
        if (!parent) return false;
        const idx = parent.children.indexOf(el);
        let found = false;
        for (let s = idx + 1; s < parent.children.length; s++) {
          if (this.matchesPart(parent.children[s], sibPart)) { found = true; break; }
        }
        if (!found) return false;
      } else {
        // Standard :has() — check descendants
        const subSegments = this.parse(hasSel);
        const descendants = this.flatten(el).slice(1);
        const anyMatch = descendants.some((d) => this.matchesChain(d, subSegments));
        if (!anyMatch) return false;
      }
    }

    if (part.not) {
      const subSegments = this.parse(part.not);
      if (this.matchesChain(el, subSegments)) return false;
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
      } else if (rel === 'general-sibling') {
        const p: UIElement | null = current.parent;
        if (!p) return false;
        const sibIdx: number = p.children.indexOf(current);
        let found = false;
        for (let s = sibIdx - 1; s >= 0; s--) {
          if (this.matchesPart(p.children[s], segments[i].part)) {
            current = p.children[s];
            found = true;
            break;
          }
        }
        if (!found) return false;
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
