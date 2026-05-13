import { TVPage } from '@danecodes/uncle-jesse-test';

export class DetailsScreen extends TVPage {
  async isVisible(): Promise<boolean> {
    const el = await this.$('DetailsScreen');
    return el !== null && el.getAttribute('visible') !== 'false';
  }

  async waitForLoad(): Promise<void> {
    await this.waitForElement('DetailsScreen LabelList#actionButtons');
  }

  async getButtons() {
    return this.$('LabelList#actionButtons');
  }

  async getDescription() {
    return this.$('Description');
  }

  async goBack(): Promise<void> {
    await this.device.back();
  }

  async selectButton(): Promise<void> {
    await this.device.select();
  }

  async navigateButtons(direction: 'up' | 'down', steps = 1): Promise<void> {
    await this.device.navigate(direction, steps);
  }
}
