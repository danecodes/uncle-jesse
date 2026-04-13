import type { TVDevice, UIElement } from '@danecodes/uncle-jesse-core';

export abstract class TVPage {
  protected device: TVDevice;

  constructor(device: TVDevice) {
    this.device = device;
  }

  async $(selector: string): Promise<UIElement | null> {
    return this.device.$(selector);
  }

  async $$(selector: string): Promise<UIElement[]> {
    return this.device.$$(selector);
  }

  async waitForElement(selector: string, timeout?: number): Promise<UIElement> {
    return this.device.waitForElement(selector, { timeout });
  }

  async waitForFocus(selector: string, timeout?: number): Promise<UIElement> {
    return this.device.waitForFocus(selector, { timeout });
  }
}
