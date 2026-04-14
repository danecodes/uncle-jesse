import { BasePage } from '@danecodes/uncle-jesse-core';
import { ActionButtons } from '../components/ActionButtons.js';

export class DetailsPage extends BasePage {
  get root() {
    return this.$('DetailsScreen');
  }

  get titleLabel() {
    return this.$('DetailsScreen Label#titleLabel');
  }

  get descriptionLabel() {
    return this.$('DetailsScreen Label#descriptionLabel');
  }

  get yearLabel() {
    return this.$('DetailsScreen Label#yearLabel');
  }

  get actionButtons() {
    return new ActionButtons(this.$('DetailsScreen LabelList#actionButtons'));
  }

  async waitForLoaded() {
    await this.root.toBeDisplayed();
    await this.$('DetailsScreen LabelList#actionButtons').waitForExisting();
  }
}
