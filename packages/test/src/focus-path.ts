import type { TVDevice, RemoteKey } from '@uncle-jesse/core';

interface FocusPathStep {
  key: RemoteKey;
  expectedSelector: string;
}

interface FocusPathResult {
  passed: boolean;
  failures: FocusPathFailure[];
}

interface FocusPathFailure {
  step: number;
  key: RemoteKey;
  expectedSelector: string;
  actualFocusId: string | undefined;
  message: string;
}

class FocusPathBuilder {
  private device: TVDevice;
  private startSelector: string | null = null;
  private steps: FocusPathStep[] = [];

  constructor(device: TVDevice) {
    this.device = device;
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

    if (this.startSelector) {
      await this.device.waitForFocus(this.startSelector);
    }

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      await this.device.press(step.key);

      const focused = await this.device.getFocusedElement();
      const focusedId = focused?.id;
      const expectedId = step.expectedSelector.replace(/^#/, '');

      if (focusedId !== expectedId) {
        failures.push({
          step: i + 1,
          key: step.key,
          expectedSelector: step.expectedSelector,
          actualFocusId: focusedId,
          message: `Step ${i + 1}: After pressing ${step.key.toUpperCase()}, expected focus on ${step.expectedSelector} but found focus on ${focusedId ? '#' + focusedId : '<nothing>'}`,
        });
      }
    }

    return {
      passed: failures.length === 0,
      failures,
    };
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

export function focusPath(device: TVDevice): FocusPathBuilder {
  return new FocusPathBuilder(device);
}
