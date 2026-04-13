import { TVPage } from '@danecodes/uncle-jesse-test';

export class GridScreen extends TVPage {
  async isVisible(): Promise<boolean> {
    const el = await this.$('GridScreen');
    return el !== null && el.getAttribute('visible') !== 'false';
  }

  async waitForLoad(): Promise<void> {
    await this.waitForElement('RowList');
  }

  async getRowList() {
    return this.$('RowList');
  }

  async selectCurrentItem(): Promise<void> {
    await this.device.select();
  }

  async navigateRight(steps = 1): Promise<void> {
    await this.device.navigate('right', steps);
  }

  async navigateDown(steps = 1): Promise<void> {
    await this.device.navigate('down', steps);
  }
}
