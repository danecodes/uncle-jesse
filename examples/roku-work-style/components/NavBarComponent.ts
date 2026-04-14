import { BaseComponent, type LiveElement } from '@danecodes/uncle-jesse-core';

export class NavBarComponent extends BaseComponent {
  get homeTab() {
    return this.$('NavTab#tabHome');
  }

  get searchTab() {
    return this.$('NavTab#tabSearch');
  }

  get settingsTab() {
    return this.$('NavTab#tabSettings');
  }

  async selectHome() {
    await this.homeTab.select();
  }

  async selectSearch() {
    await this.searchTab.select();
  }

  async selectSettings() {
    await this.settingsTab.select();
  }
}
