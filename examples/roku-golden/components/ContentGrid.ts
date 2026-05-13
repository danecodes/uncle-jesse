import { BaseComponent } from '@danecodes/uncle-jesse-core';

export class ContentGrid extends BaseComponent {
  get root() {
    return this.element;
  }

  get rows() {
    return this.$$('RowListItem');
  }

  get items() {
    return this.$$('RenderableNode[title]');
  }

  async expectSeedContent() {
    await this.rows.toHaveLength({ gte: 1 });
    await this.items.toHaveLength({ gte: 4 });
  }
}
