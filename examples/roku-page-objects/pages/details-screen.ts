import { TVPage } from '@danecodes/uncle-jesse-test';

export class DetailsScreen extends TVPage {
  async isVisible(): Promise<boolean> {
    const el = await this.$('DetailsScreen[focused="true"]');
    return el !== null;
  }

  async waitForLoad(): Promise<void> {
    await this.waitForElement('DetailsScreen[focused="true"]');
  }

  async getButtons() {
    return this.$('LabelList#Buttons');
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
