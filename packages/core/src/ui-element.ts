export class UIElement {
  readonly tag: string;
  readonly attributes: Record<string, string>;
  readonly children: UIElement[];
  readonly parent: UIElement | null;

  constructor(
    tag: string,
    attributes: Record<string, string> = {},
    children: UIElement[] = [],
    parent: UIElement | null = null,
  ) {
    this.tag = tag;
    this.attributes = attributes;
    this.children = children;
    this.parent = parent;
  }

  get id(): string | undefined {
    return this.attributes['id'] ?? this.attributes['name'];
  }

  get text(): string | undefined {
    return this.attributes['text'];
  }

  get focused(): boolean {
    return this.attributes['focused'] === 'true';
  }

  get visible(): boolean {
    return this.attributes['visible'] !== 'false';
  }

  get bounds(): { x: number; y: number; width: number; height: number } | undefined {
    const b = this.attributes['bounds'];
    if (!b) return undefined;
    const match = b.match(/\{(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\}/);
    if (!match) return undefined;
    return {
      x: Number(match[1]),
      y: Number(match[2]),
      width: Number(match[3]),
      height: Number(match[4]),
    };
  }

  getAttribute(name: string): string | undefined {
    return this.attributes[name];
  }

  findAll(predicate: (el: UIElement) => boolean): UIElement[] {
    const results: UIElement[] = [];
    if (predicate(this)) results.push(this);
    for (const child of this.children) {
      results.push(...child.findAll(predicate));
    }
    return results;
  }

  findFirst(predicate: (el: UIElement) => boolean): UIElement | null {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.findFirst(predicate);
      if (found) return found;
    }
    return null;
  }
}
