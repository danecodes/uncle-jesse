import { BaseComponent } from '@danecodes/uncle-jesse-core';

export class ActionButtons extends BaseComponent {
  get playBtn() {
    return this.$('Label[text="Play"]');
  }

  get addToListBtn() {
    return this.$('Label[text="Add to List"]');
  }

  get relatedBtn() {
    return this.$('Label[text="Related"]');
  }
}
