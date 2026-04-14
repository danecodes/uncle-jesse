import { BasePage } from '@danecodes/uncle-jesse-core';
import { ContentGrid } from '../components/ContentGrid.js';
import { NavBarComponent } from '../components/NavBarComponent.js';

export class HomePage extends BasePage {
  get root() {
    return this.$('HomeScreen');
  }

  get navBar() {
    return new NavBarComponent(this.$('NavBar'));
  }

  get contentGrid() {
    return new ContentGrid(this.$('HomeScreen RowList'));
  }

  get screenTitle() {
    return this.$('HomeScreen Label#screenTitle');
  }

  async waitForLoaded() {
    await this.root.toBeDisplayed();
    await this.$('HomeScreen RowList').waitForExisting();
  }
}
