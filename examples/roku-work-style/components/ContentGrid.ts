import { BaseComponent } from '@danecodes/uncle-jesse-core';

export class ContentGrid extends BaseComponent {
  get rows() {
    return this.$$('RowListItem');
  }

  get items() {
    return this.$$('RenderableNode[title]');
  }

  async getRowCount(): Promise<number> {
    return this.rows.length;
  }
}
