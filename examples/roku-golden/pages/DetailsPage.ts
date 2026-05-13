import { BasePage } from '@danecodes/uncle-jesse-core';
import type { App } from './App.js';
import { ActionButtons } from '../components/ActionButtons.js';

export class DetailsPage extends BasePage<App> {
  get root() {
    return this.$('DetailsScreen');
  }

  get titleLabel() {
    return this.$('DetailsScreen Label#titleLabel');
  }

  get actionButtons() {
    return new ActionButtons(this.$('DetailsScreen LabelList#actionButtons'));
  }

  async waitForLoaded() {
    await this.root.toBeDisplayed();
    await this.$('DetailsScreen LabelList#actionButtons').waitForExisting();
  }
}
