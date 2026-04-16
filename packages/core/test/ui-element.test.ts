import { describe, it, expect } from 'vitest';
import { UIElement, setDefaultQueryEngine } from '../src/ui-element.js';
import { SelectorEngine } from '../src/selector-engine.js';

setDefaultQueryEngine(new SelectorEngine());

function el(
  tag: string,
  attrs: Record<string, string> = {},
  children: UIElement[] = [],
): UIElement {
  const node = new UIElement(tag, attrs, [], null);
  for (const child of children) {
    (child as { parent: UIElement | null }).parent = node;
    node.children.push(child);
  }
  return node;
}

describe('UIElement', () => {
  it('exposes id from name attribute', () => {
    const node = new UIElement('Button', { name: 'myBtn' });
    expect(node.id).toBe('myBtn');
  });

  it('exposes text', () => {
    const node = new UIElement('Label', { text: 'Hello' });
    expect(node.text).toBe('Hello');
  });

  it('exposes focused', () => {
    expect(new UIElement('X', { focused: 'true' }).focused).toBe(true);
    expect(new UIElement('X', { focused: 'false' }).focused).toBe(false);
    expect(new UIElement('X', {}).focused).toBe(false);
  });

  it('exposes visible (defaults true)', () => {
    expect(new UIElement('X', {}).visible).toBe(true);
    expect(new UIElement('X', { visible: 'false' }).visible).toBe(false);
  });

  it('parses bounds', () => {
    const node = new UIElement('X', { bounds: '{10, 20, 100, 50}' });
    expect(node.bounds).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('returns undefined bounds for missing attribute', () => {
    expect(new UIElement('X', {}).bounds).toBeUndefined();
  });

  it('findFirst walks depth-first', () => {
    const tree = el('Root', {}, [
      el('A', { name: 'first' }),
      el('B', {}, [el('C', { name: 'deep' })]),
    ]);
    const found = tree.findFirst((n) => n.id === 'deep');
    expect(found).not.toBeNull();
    expect(found!.tag).toBe('C');
  });

  it('findAll collects all matches', () => {
    const tree = el('Root', {}, [
      el('Button', { name: 'a' }),
      el('Group', {}, [el('Button', { name: 'b' })]),
    ]);
    const results = tree.findAll((n) => n.tag === 'Button');
    expect(results).toHaveLength(2);
  });

  it('$ and $$ delegate to SelectorEngine', () => {
    const tree = el('Root', {}, [
      el('Button', { name: 'btn1' }),
      el('Button', { name: 'btn2' }),
    ]);
    expect(tree.$('Button')?.id).toBe('btn1');
    expect(tree.$$('Button')).toHaveLength(2);
  });

  it('toString produces readable output', () => {
    const tree = el('Scene', {}, [
      el('Label', { text: 'Hi' }),
    ]);
    const str = tree.toString();
    expect(str).toContain('<Scene>');
    expect(str).toContain('text="Hi"');
  });
});
