import type { TVDevice } from './tv-device.js';
import type { WaitOptions, Direction } from './types.js';
import { TimeoutError } from './errors.js';

// Attributes used to verify element identity across re-queries
const IDENTITY_ATTRS = ['name', 'rcid', 'uiElementId', 'extends'] as const;

export class LiveElement {
  protected device: TVDevice;
  private selector: string;
  private parentSelector: string | null;
  private cachedIdentity: Record<string, string | undefined> | null = null;

  constructor(device: TVDevice, selector: string, parentSelector?: string) {
    this.device = device;
    this.selector = selector;
    this.parentSelector = parentSelector ?? null;
  }

  getDevice(): TVDevice {
    return this.device;
  }

  get fullSelector(): string {
    if (this.parentSelector) {
      return `${this.parentSelector} ${this.selector}`;
    }
    return this.selector;
  }

  $(childSelector: string): LiveElement {
    return new LiveElement(this.device, childSelector, this.fullSelector);
  }

  $$(childSelector: string): ElementCollection;
  $$<T extends BaseComponent>(childSelector: string, ComponentClass: new (el: LiveElement) => T): TypedElementCollection<T>;
  $$(childSelector: string, ComponentClass?: new (el: LiveElement) => any): any {
    if (ComponentClass) {
      return new TypedElementCollection(this.device, childSelector, this.fullSelector, ComponentClass);
    }
    return new ElementCollection(this.device, childSelector, this.fullSelector);
  }

  async resolve() {
    const el = await this.device.$(this.fullSelector);
    if (!el) return null;

    const identity = captureIdentity(el);

    if (this.cachedIdentity) {
      if (!matchesIdentity(this.cachedIdentity, identity)) {
        // Element at this selector changed structurally.
        // Update the cache to the new element.
        this.cachedIdentity = identity;
      }
    } else {
      this.cachedIdentity = identity;
    }

    return el;
  }

  isStale(): Promise<boolean> {
    return this.resolve().then((el) => {
      if (!el) return true;
      if (!this.cachedIdentity) return false;
      return !matchesIdentity(this.cachedIdentity, captureIdentity(el));
    });
  }

  async getAttribute(name: string): Promise<string | undefined> {
    const el = await this.resolve();
    return el?.getAttribute(name);
  }

  async getText(): Promise<string> {
    const el = await this.resolve();
    if (!el) return '';

    // Direct text attribute takes precedence
    const direct = el.getAttribute('text');
    if (direct) return direct;

    // Collect text from Label/Button descendants (matches Appium behavior)
    const chunks: string[] = [];
    const walk = (node: { tag: string; getAttribute(n: string): string | undefined; children: readonly any[] }): void => {
      if (node.getAttribute('visible') === 'false') return;
      if (node.getAttribute('opacity') === '0') return;
      const tag = node.tag.toLowerCase();
      if (tag.endsWith('label') || tag.endsWith('button')) {
        const t = node.getAttribute('text');
        if (t) chunks.push(t);
      }
      for (const c of node.children) walk(c);
    };
    walk(el);
    return chunks.join('\n');
  }

  async getRect(): Promise<Rect | null> {
    const el = await this.resolve();
    if (!el) return null;
    return getBounds(el);
  }

  async isExisting(): Promise<boolean> {
    const el = await this.resolve();
    return el !== null;
  }

  async isDisplayed(): Promise<boolean> {
    const el = await this.resolve();
    if (!el) return false;
    return el.getAttribute('visible') !== 'false';
  }

  async isFocused(): Promise<boolean> {
    const el = await this.resolve();
    return el?.focused ?? false;
  }

  async clear(): Promise<void> {
    const text = await this.getText();
    if (text.length > 0) {
      await this.device.press('backspace', { times: text.length, delay: 100 });
    }
  }

  async select(options?: { ifNotDisplayedNavigate?: Direction }): Promise<void> {
    if (options?.ifNotDisplayedNavigate) {
      await this.scrollUntilDisplayed(options.ifNotDisplayedNavigate);
    }
    await this.focus();
    await this.device.select();
  }

  async focus(options?: {
    maxAttempts?: number;
    timeout?: number;
  }): Promise<void> {
    const timeout = options?.timeout ?? 30000;
    const noProgressLimit = 12;
    const unresolvedPollLimit = options?.maxAttempts ?? 60;
    const start = Date.now();
    const visited = new Map<string, Set<Direction>>();
    const trail: string[] = [];
    let unresolvedPolls = 0;
    let lastDirection: Direction | null = null;
    let lastGap: number | null = null;
    let noProgressCount = 0;

    while (Date.now() - start < timeout) {
      // 1. Resolve the target element from a fresh tree
      const target = await this.resolve();
      if (!target) {
        unresolvedPolls++;
        if (unresolvedPolls > unresolvedPollLimit) {
          throw new Error(
            `Could not focus ${this.fullSelector}: target never resolved after ${unresolvedPolls} attempts. The selector may be incorrect or the page/dialog may not have loaded.`
          );
        }
        // Don't press anything -- blind keypresses can dismiss dialogs
        // or navigate away from pages that are still mounting.
        await sleep(200);
        continue;
      }
      unresolvedPolls = 0;

      // 2. Get the currently focused element
      const active = await this.device.getFocusedElement();
      if (!active) {
        await sleep(200);
        continue;
      }

      // 3. Check if target is focused. Use fingerprint identity when
      //    both elements have a stable ID (name/id/uiElementId). Fall
      //    back to target.focused for elements without IDs.
      const targetFp = elementFingerprint(target);
      const activeFp = elementFingerprint(active);
      const targetHasStableId = target.id !== undefined;
      if (targetHasStableId && activeFp === targetFp) return;
      if (!targetHasStableId && target.focused) return;

      // 4. Cycle detection: track visited positions and which directions
      //    we've already tried from each position. When the greedy best
      //    direction has been tried before from this node, try alternates.
      const fp = elementFingerprint(active);

      // 5. Get absolute rects
      const targetRect = getBounds(target);
      const activeRect = getBounds(active);

      if (!targetRect || !activeRect) {
        await sleep(200);
        continue;
      }

      // 6. Collect directions. Try strict non-overlapping edge gates first.
      const candidates: Array<{ direction: Direction; gap: number }> = [];

      if (targetRect.y + targetRect.height <= activeRect.y) {
        candidates.push({ direction: 'up', gap: activeRect.y - (targetRect.y + targetRect.height) });
      }
      if (targetRect.y >= activeRect.y + activeRect.height) {
        candidates.push({ direction: 'down', gap: targetRect.y - (activeRect.y + activeRect.height) });
      }
      if (targetRect.x + targetRect.width <= activeRect.x) {
        candidates.push({ direction: 'left', gap: activeRect.x - (targetRect.x + targetRect.width) });
      }
      if (targetRect.x >= activeRect.x + activeRect.width) {
        candidates.push({ direction: 'right', gap: targetRect.x - (activeRect.x + activeRect.width) });
      }

      // Fallback: when strict produces zero candidates (overlapping bounds),
      // use center-point comparison on the dominant axis only. Single
      // candidate avoids zig-zag cycling on 1px deltas.
      if (candidates.length === 0) {
        const dx = (targetRect.x + targetRect.width / 2) - (activeRect.x + activeRect.width / 2);
        const dy = (targetRect.y + targetRect.height / 2) - (activeRect.y + activeRect.height / 2);

        if (Math.abs(dx) > Math.abs(dy)) {
          candidates.push({ direction: dx > 0 ? 'right' : 'left', gap: Math.abs(dx) });
        } else if (Math.abs(dy) > 0) {
          candidates.push({ direction: dy > 0 ? 'down' : 'up', gap: Math.abs(dy) });
        }
      }

      if (candidates.length === 0) {
        await sleep(200);
        continue;
      }

      candidates.sort((a, b) => a.gap - b.gap);

      // 7. Pick direction, skipping directions already tried from this node.
      const triedHere = fp ? (visited.get(fp) ?? new Set<Direction>()) : new Set<Direction>();
      let direction: Direction | null = null;
      for (const candidate of candidates) {
        if (!triedHere.has(candidate.direction)) {
          direction = candidate.direction;
          break;
        }
      }

      if (!direction) {
        // All directions from this node have been tried -- we're stuck.
        throw new Error(
          `Could not focus ${this.fullSelector}: navigation cycled at ${fp} after ${trail.length} presses (tried: ${trail.join(',')})`
        );
      }

      // Record that we tried this direction from this position
      if (fp) {
        triedHere.add(direction);
        visited.set(fp, triedHere);
      }

      // 8. No-progress detection: if pressing in this direction isn't
      //    closing the gap to the target, we're stalled.
      const currentGap = candidates[0].gap;
      if (direction === lastDirection && lastGap !== null) {
        if (currentGap >= lastGap) {
          noProgressCount++;
          if (noProgressCount >= noProgressLimit) {
            throw new Error(
              `Could not focus ${this.fullSelector}: stalled — ${noProgressCount} presses of "${direction}" without closing axis gap (current: ${currentGap}, initial: ${lastGap}). Tried: ${trail.join(',')}`
            );
          }
        } else {
          noProgressCount = 0;
        }
      } else {
        noProgressCount = 0;
        lastGap = currentGap;
      }
      lastDirection = direction;

      // 9. Press that key
      await this.device.press(direction);
      trail.push(direction);

      // 8. Poll for focus change. First poll at 150ms (keyboards re-render
      //    focus in 100-150ms), then back off. Cap at 800ms total since
      //    getFocusedElement() itself costs 200-400ms per call.
      const prevId = fp;
      const pollStart = Date.now();
      let moved = false;
      let pollDelay = 150;
      while (Date.now() - pollStart < 800) {
        await sleep(pollDelay);
        pollDelay = Math.min(pollDelay * 2, 400);
        const newActive = await this.device.getFocusedElement();
        const newId = elementFingerprint(newActive);
        if (newId !== prevId) {
          moved = true;
          break;
        }
      }

      // 9. If focus didn't move, re-loop to recompute direction
      //    from the new tree state. Outer timeout handles truly stuck cases.
      if (!moved) {
        continue;
      }
    }

    const final = await this.resolve();
    if (final?.focused) return;

    throw new Error(
      `Could not focus ${this.fullSelector} within ${timeout}ms (tried: ${trail.join(',')})`
    );
  }

  private async scrollUntilDisplayed(
    direction: Direction,
    maxAttempts = 20,
    timeout = 15000,
  ): Promise<void> {
    const start = Date.now();
    for (let i = 0; i < maxAttempts && Date.now() - start < timeout; i++) {
      if (await this.isDisplayed()) return;
      await this.device.press(direction);
      await sleep(300);
    }
  }

  async waitForDisplayed(options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await this.isDisplayed()) return;
      await sleep(interval);
    }

    throw new TimeoutError(this.fullSelector, Date.now() - start);
  }

  async waitForExisting(options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await this.isExisting()) return;
      await sleep(interval);
    }

    throw new TimeoutError(this.fullSelector, Date.now() - start);
  }

  /** Try ODC observation for a field match. Returns true if handled, false to fall back to polling. */
  private async tryObserve(
    field: string,
    match: unknown,
    timeout: number,
  ): Promise<boolean> {
    if (!this.device.observeField) return false;
    const el = await this.resolve();
    const nodeId = el?.id;
    if (!nodeId) return false;
    try {
      const result = await this.device.observeField(nodeId, field, { match, timeout });
      return result.matched;
    } catch {
      // ODC unavailable or node not found -- fall back to polling
      return false;
    }
  }

  // Assertions that poll with timeout.
  // When ODC is available and the element has an ID, assertions use
  // observeField for event-driven waiting instead of polling. Falls
  // back to ECP polling when ODC is not configured.

  // Checks if the element has focused="true" in its attributes,
  // meaning it's anywhere in the Roku focus chain (not just the leaf).
  async toBeFocused(options?: WaitOptions & { inverted?: boolean }): Promise<void> {
    if (options?.inverted) {
      return this.toNotBeFocused(options);
    }
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    // Try ODC observation first
    if (await this.tryObserve('focused', 'true', timeout)) return;

    // Fall back to polling
    while (Date.now() - start < timeout) {
      const el = await this.resolve();
      if (el?.focused) return;
      await sleep(interval);
    }

    const expected = (await this.resolve())?.id ?? this.fullSelector;
    throw new Error(
      `Expected ${expected} to be focused, but it is not in the focus chain`
    );
  }

  async toBeInFocusChain(options?: WaitOptions): Promise<void> {
    // Same check as toBeFocused since Roku sets focused="true" on the
    // entire chain. This method exists for semantic clarity: use
    // toBeFocused when you expect the leaf, toBeInFocusChain when you
    // only care that the element is an ancestor of the focused node.
    return this.toBeFocused(options);
  }

  async toBeDisplayed(options?: WaitOptions): Promise<void> {
    await this.waitForDisplayed(options);
  }

  async toNotBeDisplayed(options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (!(await this.isDisplayed())) return;
      await sleep(interval);
    }

    throw new Error(
      `Expected ${this.fullSelector} to not be displayed, but it is`
    );
  }

  async toHaveText(expected: string | RegExp, options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    // Try ODC observation for exact string matches
    if (typeof expected === 'string') {
      if (await this.tryObserve('text', expected, timeout)) return;
    }

    // Fall back to polling (always used for RegExp)
    while (Date.now() - start < timeout) {
      const text = await this.getText();
      if (typeof expected === 'string' && text === expected) return;
      if (expected instanceof RegExp && expected.test(text)) return;
      await sleep(interval);
    }

    const actual = await this.getText();
    throw new Error(
      `Expected ${this.fullSelector} to have text "${expected}", but got "${actual}"`
    );
  }

  async toExist(options?: WaitOptions): Promise<void> {
    await this.waitForExisting(options);
  }

  async toHaveAttribute(
    name: string,
    expected: string | RegExp,
    options?: WaitOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    // Try ODC observation for exact string matches
    if (typeof expected === 'string') {
      if (await this.tryObserve(name, expected, timeout)) return;
    }

    // Fall back to polling
    while (Date.now() - start < timeout) {
      const value = await this.getAttribute(name);
      if (value !== undefined) {
        if (typeof expected === 'string' && value === expected) return;
        if (expected instanceof RegExp && expected.test(value)) return;
      }
      await sleep(interval);
    }

    const actual = await this.getAttribute(name);
    throw new Error(
      `Expected ${this.fullSelector} to have attribute "${name}" matching "${expected}", but got "${actual ?? '<missing>'}"`
    );
  }

  async toNotHaveAttribute(
    name: string,
    expected: string | RegExp,
    options?: WaitOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const value = await this.getAttribute(name);
      if (value === undefined) return;
      if (typeof expected === 'string' && value !== expected) return;
      if (expected instanceof RegExp && !expected.test(value)) return;
      await sleep(interval);
    }

    const actual = await this.getAttribute(name);
    throw new Error(
      `Expected ${this.fullSelector} to not have attribute "${name}" matching "${expected}", but got "${actual}"`
    );
  }

  async toNotExist(options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (!(await this.isExisting())) return;
      await sleep(interval);
    }

    throw new Error(
      `Expected ${this.fullSelector} to not exist, but it does`
    );
  }

  async toNotBeFocused(options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const el = await this.resolve();
      if (!el?.focused) return;
      await sleep(interval);
    }

    throw new Error(
      `Expected ${this.fullSelector} to not be focused, but it is`
    );
  }

  async toNotHaveText(expected: string | RegExp, options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const text = await this.getText();
      if (typeof expected === 'string' && text !== expected) return;
      if (expected instanceof RegExp && !expected.test(text)) return;
      await sleep(interval);
    }

    const actual = await this.getText();
    throw new Error(
      `Expected ${this.fullSelector} to not have text "${expected}", but got "${actual}"`
    );
  }

  async toHaveTextContaining(text: string, options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const actual = await this.getText();
      if (actual.includes(text)) return;
      await sleep(interval);
    }

    const actual = await this.getText();
    throw new Error(
      `Expected ${this.fullSelector} text to contain "${text}", but got "${actual}"`
    );
  }
}

export class ElementCollection {
  protected device: TVDevice;
  protected selector: string;
  protected parentSelector: string | null;

  constructor(device: TVDevice, selector: string, parentSelector?: string) {
    this.device = device;
    this.selector = selector;
    this.parentSelector = parentSelector ?? null;
  }

  get fullSelector(): string {
    if (this.parentSelector) {
      return `${this.parentSelector} ${this.selector}`;
    }
    return this.selector;
  }

  get(index: number): LiveElement {
    return new IndexedLiveElement(this.device, this.fullSelector, index);
  }

  get length(): Promise<number> {
    return this.device.$$(this.fullSelector).then((els) => els.length);
  }

  async toHaveLength(
    expected: number | { gte?: number; lte?: number; eq?: number },
    options?: WaitOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    const matches = (count: number): boolean => {
      if (typeof expected === 'number') return count === expected;
      if (expected.eq !== undefined && count !== expected.eq) return false;
      if (expected.gte !== undefined && count < expected.gte) return false;
      if (expected.lte !== undefined && count > expected.lte) return false;
      return true;
    };

    while (Date.now() - start < timeout) {
      const count = await this.length;
      if (matches(count)) return;
      await sleep(interval);
    }

    const actual = await this.length;
    throw new Error(
      `Expected ${this.fullSelector} to have length ${JSON.stringify(expected)}, but got ${actual}`
    );
  }

  async toHaveText(
    expected: string[] | { asymmetricMatch(actual: unknown): boolean },
    options?: WaitOptions,
  ): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const texts = await this.map(async (el) => el.getText());
      if ('asymmetricMatch' in expected && typeof expected.asymmetricMatch === 'function') {
        if (expected.asymmetricMatch(texts)) return;
      } else {
        const sorted = [...texts].sort();
        const expectedSorted = [...(expected as string[])].sort();
        if (JSON.stringify(sorted) === JSON.stringify(expectedSorted)) return;
      }
      await sleep(interval);
    }

    const actual = await this.map(async (el) => el.getText());
    throw new Error(
      `Expected ${this.fullSelector} texts to match ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
    );
  }

  async toHaveTextInOrder(expected: (string | RegExp)[], options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const texts = await this.map(async (el) => el.getText());
      if (texts.length === expected.length) {
        const matches = expected.every((exp, i) => {
          if (typeof exp === 'string') return texts[i] === exp;
          return exp.test(texts[i]);
        });
        if (matches) return;
      }
      await sleep(interval);
    }

    const actual = await this.map(async (el) => el.getText());
    throw new Error(
      `Expected ${this.fullSelector} texts in order ${JSON.stringify(expected.map(String))}, but got ${JSON.stringify(actual)}`
    );
  }

  async map<R>(fn: (el: LiveElement, i: number) => Promise<R>): Promise<R[]> {
    const count = await this.length;
    const results: R[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await fn(this.get(i), i));
    }
    return results;
  }

  async filter(fn: (el: LiveElement, i: number) => Promise<boolean>): Promise<LiveElement[]> {
    const count = await this.length;
    const results: LiveElement[] = [];
    for (let i = 0; i < count; i++) {
      const el = this.get(i);
      if (await fn(el, i)) results.push(el);
    }
    return results;
  }
}

export class TypedElementCollection<T extends BaseComponent> {
  protected device: TVDevice;
  protected selector: string;
  protected parentSelector: string | null;
  private ComponentClass: new (el: LiveElement) => T;

  constructor(
    device: TVDevice,
    selector: string,
    parentSelector: string | undefined,
    ComponentClass: new (el: LiveElement) => T,
  ) {
    this.device = device;
    this.selector = selector;
    this.parentSelector = parentSelector ?? null;
    this.ComponentClass = ComponentClass;
  }

  get fullSelector(): string {
    if (this.parentSelector) {
      return `${this.parentSelector} ${this.selector}`;
    }
    return this.selector;
  }

  get(index: number): T {
    const el = new IndexedLiveElement(this.device, this.fullSelector, index);
    return new this.ComponentClass(el);
  }

  get length(): Promise<number> {
    return this.device.$$(this.fullSelector).then((els) => els.length);
  }
}

class IndexedLiveElement extends LiveElement {
  private index: number;
  private baseSelector: string;

  constructor(device: TVDevice, selector: string, index: number) {
    super(device, selector);
    this.baseSelector = selector;
    this.index = index;
  }

  async resolve() {
    const all = await this.device.$$(this.baseSelector);
    return all[this.index] ?? null;
  }

  async focus(options?: { maxAttempts?: number; timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? 15000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const existing = await this.resolve();

      if (existing?.focused) return;

      if (existing) {
        // Target index exists in tree, use the standard focus algorithm
        return super.focus(options);
      }

      // Target index doesn't exist yet (lazy-loaded content).
      // Focus the last element in the collection using the standard
      // algorithm, then press down to trigger loading more items.
      const all = await this.device.$$(this.baseSelector);
      if (all.length > 0) {
        const lastEl = new IndexedLiveElement(this.device, this.baseSelector, all.length - 1);
        try {
          await lastEl.focus({ timeout: 5000 });
        } catch {
          // couldn't focus last item, press down anyway
        }
      }

      await this.device.press('down');
      await sleep(300);

      // Re-check if target loaded
      const recheck = await this.resolve();
      if (recheck?.focused) return;
    }

    throw new Error(
      `Could not focus element at index ${this.index} of ${this.baseSelector} within ${timeout}ms`
    );
  }
}

export class BaseComponent {
  protected element: LiveElement;
  protected device: TVDevice;

  constructor(element: LiveElement) {
    this.element = element;
    this.device = element.getDevice();
  }

  $(selector: string): LiveElement {
    return this.element.$(selector);
  }

  $$(selector: string): ElementCollection;
  $$<T extends BaseComponent>(selector: string, ComponentClass: new (el: LiveElement) => T): TypedElementCollection<T>;
  $$(selector: string, ComponentClass?: new (el: LiveElement) => any): any {
    return this.element.$$(selector, ComponentClass as any);
  }

  get driver() {
    return this.device;
  }

  async waitUntil(
    predicate: () => Promise<boolean>,
    options?: { timeout?: number; interval?: number; timeoutMsg?: string },
  ): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await predicate()) return;
      await sleep(interval);
    }

    throw new Error(
      options?.timeoutMsg ?? `waitUntil timed out after ${timeout}ms`
    );
  }

  async waitForCondition<T>(
    predicate: () => Promise<T | null | false>,
    options?: WaitOptions,
  ): Promise<T> {
    return this.device.waitForCondition(predicate, options);
  }
}

export class BasePage<TApp = unknown> {
  protected device: TVDevice;
  protected app: TApp;

  constructor(device: TVDevice, app: TApp) {
    this.device = device;
    this.app = app;
  }

  $(selector: string): LiveElement {
    return new LiveElement(this.device, selector);
  }

  $$(selector: string): ElementCollection;
  $$<T extends BaseComponent>(selector: string, ComponentClass: new (el: LiveElement) => T): TypedElementCollection<T>;
  $$(selector: string, ComponentClass?: new (el: LiveElement) => any): any {
    if (ComponentClass) {
      return new TypedElementCollection(this.device, selector, undefined, ComponentClass);
    }
    return new ElementCollection(this.device, selector);
  }

  get driver() {
    return this.device;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function parseBoundsString(b: string): Rect | null {
  const match = b.match(/\{(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\}/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]) };
}

function parseTranslation(t: string): { x: number; y: number } | null {
  const match = t.match(/\{(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\}/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

function getBounds(el: {
  bounds?: Rect;
  parent?: { getAttribute(n: string): string | undefined; parent?: unknown } | null;
  getAttribute(n: string): string | undefined;
}): Rect | null {
  let rect = el.bounds ?? null;

  if (!rect) {
    const b = el.getAttribute('bounds');
    if (!b) return null;
    rect = parseBoundsString(b);
    if (!rect) return null;
  }

  // Walk parent chain accumulating translations for absolute screen position
  if (el.getAttribute('inheritParentTransform') === 'false') return rect;

  let { x, y } = rect;
  let current = el.parent as { getAttribute(n: string): string | undefined; parent?: unknown } | null | undefined;

  while (current) {
    const t = current.getAttribute('translation');
    if (t) {
      const parsed = parseTranslation(t);
      if (parsed) {
        x += parsed.x;
        y += parsed.y;
      }
    }
    if (current.getAttribute('inheritParentTransform') === 'false') break;
    current = (current as { parent?: unknown }).parent as typeof current;
  }

  return { x, y, width: rect.width, height: rect.height };
}

function isAncestorOrDescendant(
  a: { parent?: { id?: string; tag: string } | null; children: Array<{ id?: string; tag: string; children: unknown[] }> ; id?: string; tag: string },
  b: { parent?: { id?: string; tag: string } | null; id?: string; tag: string },
): boolean {
  // Check if b is a descendant of a
  function contains(parent: unknown, child: { parent?: unknown | null }): boolean {
    let current = child.parent;
    while (current) {
      if (current === parent) return true;
      current = (current as { parent?: unknown }).parent;
    }
    return false;
  }

  return contains(a, b) || contains(b, a as { parent?: unknown | null });
}

function captureIdentity(el: { tag: string; getAttribute(n: string): string | undefined }): Record<string, string | undefined> {
  const identity: Record<string, string | undefined> = { tag: el.tag };
  for (const attr of IDENTITY_ATTRS) {
    identity[attr] = el.getAttribute(attr);
  }
  return identity;
}

function matchesIdentity(
  cached: Record<string, string | undefined>,
  current: Record<string, string | undefined>,
): boolean {
  if (cached.tag !== current.tag) return false;
  for (const attr of IDENTITY_ATTRS) {
    const cachedVal = cached[attr];
    const currentVal = current[attr];
    // Only compare attributes that were present in the original
    if (cachedVal !== undefined && cachedVal !== currentVal) return false;
  }
  return true;
}

/** Build a string fingerprint that uniquely identifies an element, even anonymous grid items. */
function elementFingerprint(
  el: { tag: string; id?: string; getAttribute(n: string): string | undefined } | null | undefined,
): string | undefined {
  if (!el) return undefined;
  const name = el.getAttribute('name');
  if (name) return name;
  const id = el.id ?? el.getAttribute('id');
  if (id) return id;
  const uiElementId = el.getAttribute('uiElementId');
  if (uiElementId) return uiElementId;
  const title = el.getAttribute('title');
  if (title) return title;
  // Fallback: compound key using index + bounds to distinguish anonymous siblings
  return `${el.tag}#${el.getAttribute('index') ?? ''}@${el.getAttribute('bounds') ?? ''}`;
}
