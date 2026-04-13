import type { UIElement } from '@uncle-jesse/core';

export interface TVMatchers {
  toBeFocused(): void;
  toBeVisible(): void;
  toHaveText(expected: string): void;
  toExist(): void;
  toHaveAttribute(name: string, value?: string): void;
}

export const tvMatchers = {
  toBeFocused(received: UIElement | null | undefined) {
    const pass = received?.focused === true;
    const id = received?.id ?? received?.tag ?? '<unknown>';
    return {
      pass,
      message: () =>
        pass
          ? `expected ${id} not to be focused`
          : `expected ${id} to be focused, but focused=${received?.getAttribute('focused') ?? 'undefined'}`,
    };
  },

  toBeVisible(received: UIElement | null | undefined) {
    const pass = received != null && received.visible;
    const id = received?.id ?? received?.tag ?? '<unknown>';
    return {
      pass,
      message: () =>
        pass
          ? `expected ${id} not to be visible`
          : `expected ${id} to be visible, but visible=${received?.getAttribute('visible') ?? 'undefined'}`,
    };
  },

  toHaveText(received: UIElement | null | undefined, expected: string) {
    const actual = received?.text;
    const pass = actual === expected;
    const id = received?.id ?? received?.tag ?? '<unknown>';
    return {
      pass,
      message: () =>
        pass
          ? `expected ${id} not to have text "${expected}"`
          : `expected ${id} to have text "${expected}", but got "${actual ?? '<none>'}"`,
    };
  },

  toExist(received: UIElement | null | undefined) {
    const pass = received != null;
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to exist`
          : `expected element to exist, but got ${received === null ? 'null' : 'undefined'}`,
    };
  },

  toHaveAttribute(received: UIElement | null | undefined, name: string, value?: string) {
    if (!received) {
      return {
        pass: false,
        message: () => `expected element to have attribute "${name}", but element is ${received === null ? 'null' : 'undefined'}`,
      };
    }

    const actual = received.getAttribute(name);
    const hasAttr = actual !== undefined;
    const pass = value !== undefined ? actual === value : hasAttr;
    const id = received.id ?? received.tag;

    return {
      pass,
      message: () => {
        if (value !== undefined) {
          return pass
            ? `expected ${id} not to have attribute "${name}"="${value}"`
            : `expected ${id} to have attribute "${name}"="${value}", but got "${actual ?? '<missing>'}"`;
        }
        return pass
          ? `expected ${id} not to have attribute "${name}"`
          : `expected ${id} to have attribute "${name}"`;
      },
    };
  },
};
