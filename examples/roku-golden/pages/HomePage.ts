import { BasePage } from '@danecodes/uncle-jesse-core';
import type { App } from './App.js';
import { ContentGrid } from '../components/ContentGrid.js';

export class HomePage extends BasePage<App> {
  get root() {
    return this.$('HomeScreen');
  }

  get title() {
    return this.$('HomeScreen Label#screenTitle');
  }

  get contentGrid() {
    return new ContentGrid(this.$('HomeScreen RowList#contentGrid'));
  }

  async waitForLoaded() {
    await this.root.toBeDisplayed();
    await this.title.toHaveText('Home');
    await this.contentGrid.root.waitForExisting();
  }

  async openFocusedItem() {
    await this.driver.select();
    await this.app.details.waitForLoaded();
  }
}
