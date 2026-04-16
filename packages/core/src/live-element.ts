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
    return el?.getAttribute('text') ?? '';
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
    const el = await this.resolve();
    if (el?.focused) return;

    // Check if the target's parent container is in the focus chain.
    // Roku's focus model requires the parent to be focused before
    // children can receive focus. If the parent isn't focused,
    // we need to focus it first.
    const target = await this.resolve();
    if (target?.parent && !target.parent.focused) {
      const parentId = target.parent.id ?? target.parent.tag;
      const parentSelector = target.parent.id
        ? `#${target.parent.id}`
        : target.parent.tag;
      const parentEl = new LiveElement(this.device, parentSelector);
      const parentResolved = await parentEl.resolve();
      if (parentResolved && !parentResolved.focused) {
        await parentEl.focus(options);
      }
    }

    // Re-check after parent focus
    const afterParent = await this.resolve();
    if (afterParent?.focused) return;

    const maxAttempts = options?.maxAttempts ?? 20;
    const timeout = options?.timeout ?? 15000;
    const start = Date.now();
    let lastFocusedId: string | undefined;
    let stuckCount = 0;
    const fallbackDirections: Direction[] = ['down', 'right', 'up', 'left'];

    for (let i = 0; i < maxAttempts && Date.now() - start < timeout; i++) {
      const current = await this.resolve();
      if (!current) {
        // Element not in the tree yet. Press down to scroll and trigger
        // lazy loading, then check again.
        await this.device.press('down');
        await sleep(200);
        continue;
      }
      if (current.focused) return;

      // Element exists but might be off-screen (not displayed).
      // If it's not displayed, scroll within its parent container
      // to bring it into view before attempting bounds-based navigation.
      if (current.getAttribute('visible') === 'false') {
        const focused = await this.device.getFocusedElement();
        if (focused) {
          const direction = computeDirection(current, focused) ?? 'down';
          await this.device.press(direction);
          await sleep(200);
          continue;
        }
      }

      const focused = await this.device.getFocusedElement();
      if (!focused) {
        await sleep(200);
        continue;
      }

      let direction: Direction;

      if (stuckCount >= 2) {
        // Bounds-based navigation failed repeatedly. The target is likely
        // off-screen in a scrollable container where bounds don't reflect
        // the actual screen position. Cycle through directions to find
        // one that moves focus toward the target.
        direction = fallbackDirections[stuckCount % fallbackDirections.length];
      } else {
        direction = computeDirection(current, focused) ?? 'down';
      }

      await this.device.press(direction);
      await sleep(200);

      const newFocused = await this.device.getFocusedElement();
      const newId = newFocused?.id ?? newFocused?.getAttribute('title') ?? newFocused?.tag;

      if (newId === lastFocusedId) {
        stuckCount++;

        if (stuckCount === 1) {
          // First stuck: try the secondary axis
          const altDirection = computeAlternateDirection(current, focused);
          if (altDirection) {
            await this.device.press(altDirection);
            await sleep(200);
          }
        }
      } else {
        stuckCount = 0;
      }

      lastFocusedId = newId;
    }

    const final = await this.resolve();
    if (final?.focused) return;

    throw new Error(
      `Could not focus ${this.fullSelector} after ${maxAttempts} attempts`
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

  // Assertions that poll with timeout.
  // Checks if the element has focused="true" in its attributes,
  // meaning it's anywhere in the Roku focus chain (not just the leaf).
  async toBeFocused(options?: WaitOptions & { inverted?: boolean }): Promise<void> {
    if (options?.inverted) {
      return this.toNotBeFocused(options);
    }
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

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
    // First check if the element already exists and is focused
    const existing = await this.resolve();
    if (existing?.focused) return;

    // If the target index exists, use normal bounds-based focus
    if (existing) {
      // Check if it's displayed. If not, scroll within its container
      // until it becomes visible
      if (existing.getAttribute('visible') === 'false' || !getBounds(existing)) {
        await this.scrollIntoView(options);
        const afterScroll = await this.resolve();
        if (afterScroll?.focused) return;
      }
      return super.focus(options);
    }

    // Target index doesn't exist yet (lazy-loaded content).
    // Focus the last existing item, then press down to trigger loading.
    const maxAttempts = options?.maxAttempts ?? 30;
    const timeout = options?.timeout ?? 30000;
    const start = Date.now();
    let lastCount = 0;
    let stuckIterations = 0;

    for (let i = 0; i < maxAttempts && Date.now() - start < timeout; i++) {
      const all = await this.device.$$(this.baseSelector);
      const count = all.length;

      if (count > this.index) {
        // Target index now exists, focus it normally
        return super.focus(options);
      }

      if (count === lastCount) {
        stuckIterations++;
        if (stuckIterations > 5) {
          throw new Error(
            `Could not load element at index ${this.index} of ${this.baseSelector}. ` +
            `Collection stuck at ${count} items.`
          );
        }
      } else {
        stuckIterations = 0;
      }
      lastCount = count;

      // Focus the last item in the collection to scroll near the bottom
      if (count > 0) {
        const lastItem = all[count - 1];
        if (lastItem && !lastItem.focused) {
          const lastEl = new LiveElement(this.device, this.baseSelector);
          // Press down to move toward the end and trigger lazy loading
          await this.device.press('down');
          await sleep(300);
        }
      } else {
        await this.device.press('down');
        await sleep(300);
      }
    }

    throw new Error(
      `Could not focus element at index ${this.index} of ${this.baseSelector} after ${maxAttempts} attempts`
    );
  }

  private async scrollIntoView(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const el = await this.resolve();
      if (!el) return;
      if (el.getAttribute('visible') !== 'false' && getBounds(el)) return;
      await this.device.press('down');
      await sleep(200);
    }
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

interface Rect {
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

function computeDirection(
  target: { bounds?: Rect; getAttribute(n: string): string | undefined },
  current: { bounds?: Rect; getAttribute(n: string): string | undefined },
): Direction | null {
  const targetRect = getBounds(target);
  const currentRect = getBounds(current);
  if (!targetRect || !currentRect) return 'down'; // fallback if no bounds

  const targetCenterX = targetRect.x + targetRect.width / 2;
  const targetCenterY = targetRect.y + targetRect.height / 2;
  const currentCenterX = currentRect.x + currentRect.width / 2;
  const currentCenterY = currentRect.y + currentRect.height / 2;

  const dx = targetCenterX - currentCenterX;
  const dy = targetCenterY - currentCenterY;

  // Move along the axis with the greater distance
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy < 0 ? 'up' : 'down';
  }
  return dx < 0 ? 'left' : 'right';
}

function computeAlternateDirection(
  target: { bounds?: Rect; getAttribute(n: string): string | undefined },
  current: { bounds?: Rect; getAttribute(n: string): string | undefined },
): Direction | null {
  const targetRect = getBounds(target);
  const currentRect = getBounds(current);
  if (!targetRect || !currentRect) return null;

  const dx = (targetRect.x + targetRect.width / 2) - (currentRect.x + currentRect.width / 2);
  const dy = (targetRect.y + targetRect.height / 2) - (currentRect.y + currentRect.height / 2);

  // Return the secondary axis direction
  if (Math.abs(dy) >= Math.abs(dx)) {
    if (Math.abs(dx) < 5) return null;
    return dx < 0 ? 'left' : 'right';
  }
  if (Math.abs(dy) < 5) return null;
  return dy < 0 ? 'up' : 'down';
}

function describeBounds(el: { id?: string; tag: string; bounds?: Rect; getAttribute(n: string): string | undefined }): string {
  const name = el.id ?? el.getAttribute('title') ?? el.tag;
  const rect = getBounds(el);
  if (rect) return `${name} at (${rect.x},${rect.y})`;
  return name;
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
