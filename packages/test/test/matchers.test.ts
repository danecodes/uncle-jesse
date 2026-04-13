import { describe, it, expect } from 'vitest';
import { UIElement, setDefaultQueryEngine, SelectorEngine } from '@danecodes/uncle-jesse-core';
import { tvMatchers } from '../src/matchers.js';

setDefaultQueryEngine(new SelectorEngine());
expect.extend(tvMatchers);

// Augment vitest types for our matchers
declare module 'vitest' {
  interface Assertion {
    toBeFocused(): void;
    toBeVisible(): void;
    toHaveText(expected: string): void;
    toExist(): void;
    toHaveAttribute(name: string, value?: string): void;
  }
}

describe('tvMatchers', () => {
  describe('toBeFocused', () => {
    it('passes for focused element', () => {
      const el = new UIElement('AppButton', { focused: 'true' });
      expect(el).toBeFocused();
    });

    it('fails for unfocused element', () => {
      const el = new UIElement('AppButton', { focused: 'false' });
      expect(el).not.toBeFocused();
    });

    it('fails for null', () => {
      expect(null).not.toBeFocused();
    });
  });

  describe('toBeVisible', () => {
    it('passes for visible element (default)', () => {
      const el = new UIElement('AppButton', {});
      expect(el).toBeVisible();
    });

    it('fails for hidden element', () => {
      const el = new UIElement('AppButton', { visible: 'false' });
      expect(el).not.toBeVisible();
    });
  });

  describe('toHaveText', () => {
    it('passes when text matches', () => {
      const el = new UIElement('AppLabel', { text: 'Movies' });
      expect(el).toHaveText('Movies');
    });

    it('fails when text differs', () => {
      const el = new UIElement('AppLabel', { text: 'Movies' });
      expect(el).not.toHaveText('Shows');
    });
  });

  describe('toExist', () => {
    it('passes for an element', () => {
      const el = new UIElement('AppButton', {});
      expect(el).toExist();
    });

    it('fails for null', () => {
      expect(null).not.toExist();
    });

    it('fails for undefined', () => {
      expect(undefined).not.toExist();
    });
  });

  describe('toHaveAttribute', () => {
    it('passes when attribute exists', () => {
      const el = new UIElement('AppButton', { opacity: '1.0' });
      expect(el).toHaveAttribute('opacity');
    });

    it('passes when attribute matches value', () => {
      const el = new UIElement('AppButton', { opacity: '1.0' });
      expect(el).toHaveAttribute('opacity', '1.0');
    });

    it('fails when attribute value differs', () => {
      const el = new UIElement('AppButton', { opacity: '1.0' });
      expect(el).not.toHaveAttribute('opacity', '0.5');
    });

    it('fails when attribute missing', () => {
      const el = new UIElement('AppButton', {});
      expect(el).not.toHaveAttribute('opacity');
    });
  });
});
