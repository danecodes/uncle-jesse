import { TVPage } from '@danecodes/uncle-jesse-test';

export class HomeScreen extends TVPage {
  async isVisible(): Promise<boolean> {
    const el = await this.$('HomeScreen');
    return el !== null && el.getAttribute('visible') !== 'false';
  }

  async waitForLoad(): Promise<void> {
    await this.waitForElement('HomeScreen RowList#contentGrid');
  }

  async getRowList() {
    return this.$('HomeScreen RowList#contentGrid');
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
