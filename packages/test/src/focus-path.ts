import type { TVDevice, RemoteKey } from '@danecodes/uncle-jesse-core';
import { ReplayRecorder } from './replay/recorder.js';
import type { ReplayTimeline } from './replay/types.js';

interface FocusPathStep {
  key: RemoteKey;
  expectedSelector: string;
}

export interface FocusPathResult {
  passed: boolean;
  failures: FocusPathFailure[];
  replay?: ReplayTimeline;
}

export interface FocusPathFailure {
  step: number;
  key: RemoteKey;
  expectedSelector: string;
  actualFocus: string | undefined;
  message: string;
}

export interface FocusPathOptions {
  record?: boolean;
  testName?: string;
}

function describeFocused(el: { id?: string; tag: string; getAttribute(n: string): string | undefined } | null): string {
  if (!el) return '<nothing>';
  if (el.id) return '#' + el.id;
  const title = el.getAttribute('title');
  if (title) return el.tag + '[title="' + title + '"]';
  return el.tag;
}

function matchesFocused(
  el: { id?: string; tag: string; getAttribute(n: string): string | undefined } | null,
  selector: string,
): boolean {
  if (!el) return false;

  // #id - match by name/id
  if (selector.startsWith('#')) {
    return el.id === selector.slice(1);
  }

  // [attr="value"] - match by attribute
  const attrMatch = selector.match(/^\[(\w+)="([^"]+)"\]$/);
  if (attrMatch) {
    return el.getAttribute(attrMatch[1]) === attrMatch[2];
  }

  // Tag[attr="value"] - match tag + attribute
  const tagAttrMatch = selector.match(/^(\w+)\[(\w+)="([^"]+)"\]$/);
  if (tagAttrMatch) {
    return el.tag === tagAttrMatch[1] && el.getAttribute(tagAttrMatch[2]) === tagAttrMatch[3];
  }

  // Tag#id - match tag + id
  const tagIdMatch = selector.match(/^(\w+)#(\w+)$/);
  if (tagIdMatch) {
    return el.tag === tagIdMatch[1] && el.id === tagIdMatch[2];
  }

  // Plain tag name
  if (/^\w+$/.test(selector)) {
    return el.tag === selector;
  }

  // Fallback: try id match
  return el.id === selector;
}

class FocusPathBuilder {
  private device: TVDevice;
  private startSelector: string | null = null;
  private steps: FocusPathStep[] = [];
  private options: FocusPathOptions;

  constructor(device: TVDevice, options: FocusPathOptions = {}) {
    this.device = device;
    this.options = options;
  }

  start(selector: string): this {
    this.startSelector = selector;
    return this;
  }

  press(key: RemoteKey): FocusPathExpect {
    return new FocusPathExpect(this, key);
  }

  addStep(key: RemoteKey, expectedSelector: string): this {
    this.steps.push({ key, expectedSelector });
    return this;
  }

  async verify(): Promise<FocusPathResult> {
    const failures: FocusPathFailure[] = [];
    const recorder = this.options.record
      ? new ReplayRecorder(this.options.testName ?? 'focusPath')
      : null;

    if (this.startSelector) {
      await this.device.waitForFocus(this.startSelector);
    }

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      await this.device.press(step.key);

      // Poll for the expected focus state, giving the UI time to settle
      let focused = await this.device.getFocusedElement();
      let passed = matchesFocused(focused, step.expectedSelector);

      if (!passed) {
        const pollStart = Date.now();
        const pollTimeout = 3000;
        while (!passed && Date.now() - pollStart < pollTimeout) {
          await new Promise((r) => setTimeout(r, 150));
          focused = await this.device.getFocusedElement();
          passed = matchesFocused(focused, step.expectedSelector);
        }
      }

      const actualDesc = describeFocused(focused);

      if (!passed) {
        failures.push({
          step: i + 1,
          key: step.key,
          expectedSelector: step.expectedSelector,
          actualFocus: actualDesc,
          message: `Step ${i + 1}: After pressing ${step.key.toUpperCase()}, expected focus on ${step.expectedSelector} but found focus on ${actualDesc}`,
        });
      }

      if (recorder) {
        const tree = await this.device.getUITree();
        let screenshot: Buffer | undefined;
        try {
          screenshot = await this.device.screenshot();
        } catch {
          // screenshot not available
        }
        recorder.recordStep(
          i + 1,
          step.key,
          step.expectedSelector,
          actualDesc,
          passed,
          tree,
          screenshot,
        );
      }
    }

    const result: FocusPathResult = {
      passed: failures.length === 0,
      failures,
    };

    if (recorder) {
      result.replay = recorder.toTimeline();
    }

    return result;
  }
}

class FocusPathExpect {
  private builder: FocusPathBuilder;
  private key: RemoteKey;

  constructor(builder: FocusPathBuilder, key: RemoteKey) {
    this.builder = builder;
    this.key = key;
  }

  expectFocus(selector: string): FocusPathBuilder {
    return this.builder.addStep(this.key, selector);
  }
}

export function focusPath(device: TVDevice, options?: FocusPathOptions): FocusPathBuilder {
  return new FocusPathBuilder(device, options);
}
