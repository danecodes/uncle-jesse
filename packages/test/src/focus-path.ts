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
  actualFocusId: string | undefined;
  message: string;
}

export interface FocusPathOptions {
  record?: boolean;
  testName?: string;
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

      const focused = await this.device.getFocusedElement();
      const focusedId = focused?.id;
      const expectedId = step.expectedSelector.replace(/^#/, '');
      const passed = focusedId === expectedId;

      if (!passed) {
        failures.push({
          step: i + 1,
          key: step.key,
          expectedSelector: step.expectedSelector,
          actualFocusId: focusedId,
          message: `Step ${i + 1}: After pressing ${step.key.toUpperCase()}, expected focus on ${step.expectedSelector} but found focus on ${focusedId ? '#' + focusedId : '<nothing>'}`,
        });
      }

      if (recorder) {
        const tree = await this.device.getUITree();
        let screenshot: Buffer | undefined;
        try {
          screenshot = await this.device.screenshot();
        } catch {
          // screenshot not available (e.g. dev mode off)
        }
        recorder.recordStep(
          i + 1,
          step.key,
          step.expectedSelector,
          focusedId,
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
