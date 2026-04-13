import { UIElement } from './ui-element.js';

export class SelectorEngine {
  query(root: UIElement, selector: string): UIElement | null {
    const results = this.queryAll(root, selector);
    return results[0] ?? null;
  }

  queryAll(root: UIElement, selector: string): UIElement[] {
    const parts = this.parse(selector);
    return this.match(root, parts);
  }

  private parse(selector: string): SelectorPart[] {
    const parts: SelectorPart[] = [];
    const tokens = selector.trim().split(/\s+/);

    for (const token of tokens) {
      const part: SelectorPart = {};
      let remaining = token;

      // Tag#id or #id
      const idMatch = remaining.match(/^([^#]*)?#([^\s.[\]]+)/);
      if (idMatch) {
        if (idMatch[1]) part.tag = idMatch[1];
        part.id = idMatch[2];
        remaining = remaining.slice(idMatch[0].length);
      } else if (!remaining.startsWith('[') && !remaining.startsWith('.')) {
        // Plain tag name
        const tagMatch = remaining.match(/^([a-zA-Z][\w]*)/);
        if (tagMatch) {
          part.tag = tagMatch[1];
          remaining = remaining.slice(tagMatch[0].length);
        }
      }

      // [attr=value] pairs
      const attrRegex = /\[([^\]=]+)(?:="([^"]*)")?\]/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(remaining)) !== null) {
        if (!part.attrs) part.attrs = {};
        part.attrs[attrMatch[1]] = attrMatch[2] ?? null;
      }

      parts.push(part);
    }

    return parts;
  }

  private match(root: UIElement, parts: SelectorPart[]): UIElement[] {
    if (parts.length === 0) return [];

    let candidates = this.flatten(root);

    // For descendant combinator, filter progressively
    for (const part of parts) {
      candidates = candidates.filter((el) => this.matchesPart(el, part));
    }

    // If multi-part selector (descendant), verify ancestry chain
    if (parts.length > 1) {
      candidates = candidates.filter((el) =>
        this.matchesDescendant(el, parts),
      );
    }

    return candidates;
  }

  private matchesPart(el: UIElement, part: SelectorPart): boolean {
    if (part.tag && el.tag !== part.tag) return false;
    if (part.id && el.id !== part.id) return false;
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
    return true;
  }

  private matchesDescendant(el: UIElement, parts: SelectorPart[]): boolean {
    const lastPart = parts[parts.length - 1];
    if (!this.matchesPart(el, lastPart)) return false;

    if (parts.length === 1) return true;

    let current: UIElement | null = el.parent;
    let partIdx = parts.length - 2;

    while (current && partIdx >= 0) {
      if (this.matchesPart(current, parts[partIdx])) {
        partIdx--;
      }
      current = current.parent;
    }

    return partIdx < 0;
  }

  private flatten(root: UIElement): UIElement[] {
    const result: UIElement[] = [root];
    for (const child of root.children) {
      result.push(...this.flatten(child));
    }
    return result;
  }
}

interface SelectorPart {
  tag?: string;
  id?: string;
  attrs?: Record<string, string | null>;
}
