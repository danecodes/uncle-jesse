import { BasePage } from '@danecodes/uncle-jesse-core';

export class SearchPage extends BasePage {
  get root() {
    return this.$('SearchScreen');
  }

  get keyboard() {
    return this.$('SearchScreen Keyboard#searchInput');
  }

  get resultsLabel() {
    return this.$('SearchScreen Label#resultsLabel');
  }

  get resultsList() {
    return this.$('SearchScreen LabelList#resultsList');
  }

  async waitForLoaded() {
    await this.root.toBeDisplayed();
    await this.keyboard.waitForExisting();
  }
}
