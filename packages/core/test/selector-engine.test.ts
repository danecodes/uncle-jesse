import { describe, it, expect } from 'vitest';
import { SelectorEngine } from '../src/selector-engine.js';
import { UIElement } from '../src/ui-element.js';
import { setDefaultQueryEngine } from '../src/ui-element.js';

// Initialize engine for $/$$ methods
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

// Build a tree resembling a Roku scene:
// Scene
//   MainScreen (name=homePage)
//     HeroCarousel (name=heroCarousel)
//       Button (name=heroItem0, focused=true)
//       Button (name=heroItem1)
//       Button (name=heroItem2)
//     CategoryRow (name=categoryRow1)
//       Label (name=catLabel, text=Movies)
//       Button (name=catItem0)

function buildTree(): UIElement {
  return el('Scene', {}, [
    el('MainScreen', { name: 'homePage' }, [
      el('HeroCarousel', { name: 'heroCarousel' }, [
        el('Button', { name: 'heroItem0', focused: 'true' }),
        el('Button', { name: 'heroItem1' }),
        el('Button', { name: 'heroItem2' }),
      ]),
      el('CategoryRow', { name: 'categoryRow1' }, [
        el('Label', { name: 'catLabel', text: 'Movies' }),
        el('Button', { name: 'catItem0' }),
      ]),
    ]),
  ]);
}

describe('SelectorEngine', () => {
  const engine = new SelectorEngine();

  describe('tag name', () => {
    it('matches by tag', () => {
      const tree = buildTree();
      const results = engine.queryAll(tree, 'Button');
      expect(results).toHaveLength(4);
    });

    it('returns null for non-existent tag', () => {
      const tree = buildTree();
      expect(engine.query(tree, 'NonExistent')).toBeNull();
    });
  });

  describe('#id', () => {
    it('matches by name attribute', () => {
      const tree = buildTree();
      const result = engine.query(tree, '#heroItem1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('heroItem1');
    });
  });

  describe('Tag#id', () => {
    it('matches tag and id together', () => {
      const tree = buildTree();
      const result = engine.query(tree, 'Button#heroItem0');
      expect(result).not.toBeNull();
      expect(result!.tag).toBe('Button');
      expect(result!.focused).toBe(true);
    });

    it('rejects wrong tag with right id', () => {
      const tree = buildTree();
      expect(engine.query(tree, 'Label#heroItem0')).toBeNull();
    });
  });

  describe('descendant combinator', () => {
    it('matches nested elements', () => {
      const tree = buildTree();
      const results = engine.queryAll(tree, 'MainScreen Button');
      expect(results).toHaveLength(4);
    });

    it('matches deep descendants', () => {
      const tree = buildTree();
      const results = engine.queryAll(tree, 'Scene Button');
      expect(results).toHaveLength(4);
    });
  });

  describe('child combinator >', () => {
    it('matches direct children only', () => {
      const tree = buildTree();
      const results = engine.queryAll(tree, 'HeroCarousel > Button');
      expect(results).toHaveLength(3);
    });

    it('rejects non-direct descendants', () => {
      const tree = buildTree();
      const results = engine.queryAll(tree, 'MainScreen > Button');
      expect(results).toHaveLength(0);
    });
  });

  describe('adjacent sibling +', () => {
    it('matches next sibling', () => {
      const tree = buildTree();
      const result = engine.query(tree, '#heroItem0 + Button');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('heroItem1');
    });
  });

  describe(':nth-child()', () => {
    it('matches by 1-based index', () => {
      const tree = buildTree();
      const result = engine.query(tree, 'Button:nth-child(2)');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('heroItem1');
    });

    it('filters by tag when tag is specified', () => {
      // Parent has: Spacer, ProfileItem, ProfileItem
      // ProfileItem:nth-child(1) should match the first ProfileItem, not fail
      // because the first overall child is a Spacer
      const tree = el('Root', {}, [
        el('Parent', {}, [
          el('Spacer', {}),
          el('ProfileItem', { name: 'p1' }),
          el('ProfileItem', { name: 'p2' }),
        ]),
      ]);
      const result = engine.query(tree, 'ProfileItem:nth-child(1)');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('p1');
      const second = engine.query(tree, 'ProfileItem:nth-child(2)');
      expect(second).not.toBeNull();
      expect(second!.id).toBe('p2');
    });
  });

  describe('[attr] selectors', () => {
    it('matches attribute existence', () => {
      const tree = buildTree();
      const results = engine.queryAll(tree, '[focused]');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('heroItem0');
    });

    it('matches attribute value', () => {
      const tree = buildTree();
      const result = engine.query(tree, '[text="Movies"]');
      expect(result).not.toBeNull();
      expect(result!.tag).toBe('Label');
    });
  });

  describe(':has()', () => {
    it('matches element containing a descendant', () => {
      // Foo:has(Bar) - matches Foo that contains a Bar descendant
      const tree = el('Root', {}, [
        el('Foo', {}, [el('Bar', {})]),
        el('Foo', {}, [el('Baz', {})]),
      ]);
      const results = engine.queryAll(tree, 'Foo:has(Bar)');
      expect(results).toHaveLength(1);
      expect(results[0].children[0].tag).toBe('Bar');
    });

    it('matches with attribute selector inside :has()', () => {
      // Foo:has([attr="x"]) - matches Foo with any descendant having attr="x"
      const tree = el('Root', {}, [
        el('Foo', {}, [el('Child', { attr: 'x' })]),
        el('Foo', {}, [el('Child', { attr: 'y' })]),
      ]);
      const results = engine.queryAll(tree, 'Foo:has([attr="x"])');
      expect(results).toHaveLength(1);
    });

    it('scopes :has to each matched element', () => {
      // A B:has(C) - only B descendants of A that contain C
      const tree = el('Root', {}, [
        el('A', {}, [
          el('B', {}, [el('C', {})]),
          el('B', {}, [el('D', {})]),
        ]),
      ]);
      const results = engine.queryAll(tree, 'A B:has(C)');
      expect(results).toHaveLength(1);
      expect(results[0].children[0].tag).toBe('C');
    });

    it('supports nested :has()', () => {
      // A:has(B:has(C)) - A containing a B that itself contains a C
      const tree = el('Root', {}, [
        el('A', {}, [
          el('B', {}, [el('C', {})]),
        ]),
        el('A', {}, [
          el('B', {}, [el('D', {})]),
        ]),
      ]);
      const results = engine.queryAll(tree, 'A:has(B:has(C))');
      expect(results).toHaveLength(1);
    });
  });
});
