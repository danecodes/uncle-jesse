import type { TVDevice } from './tv-device.js';
import type { WaitOptions } from './types.js';
import { TimeoutError } from './errors.js';

export class LiveElement {
  protected device: TVDevice;
  private selector: string;
  private parentSelector: string | null;

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
    return this.device.$(this.fullSelector);
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

  async select(): Promise<void> {
    await this.focus();
    await this.device.select();
  }

  async focus(): Promise<void> {
    await this.waitForExisting();
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
  async toBeFocused(options?: WaitOptions): Promise<void> {
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
}

export class BaseComponent {
  protected element: LiveElement;
  protected device: TVDevice;

  constructor(element: LiveElement);
  constructor(element: LiveElement, device?: TVDevice) {
    this.element = element;
    this.device = device ?? (element as any).device;
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
