import { BasePage } from '@danecodes/uncle-jesse-core';

export class SettingsPage extends BasePage {
  get root() {
    return this.$('SettingsScreen');
  }

  get settingsList() {
    return this.$('SettingsScreen LabelList#settingsList');
  }

  get statusLabel() {
    return this.$('SettingsScreen Label#statusLabel');
  }

  async waitForLoaded() {
    await this.root.toBeDisplayed();
    await this.settingsList.waitForExisting();
  }
}
