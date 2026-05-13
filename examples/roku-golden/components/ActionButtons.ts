import { BaseComponent } from '@danecodes/uncle-jesse-core';

export class ActionButtons extends BaseComponent {
  get play() {
    return this.$('Label[text="Play"]');
  }

  get addToList() {
    return this.$('Label[text="Add to List"]');
  }

  get related() {
    return this.$('Label[text="Related"]');
  }

  async expectDefaultActions() {
    await this.play.toExist();
    await this.addToList.toExist();
    await this.related.toExist();
  }
}
