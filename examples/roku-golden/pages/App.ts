import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { HomePage } from './HomePage.js';
import { DetailsPage } from './DetailsPage.js';

export class App {
  readonly home: HomePage;
  readonly details: DetailsPage;

  constructor(device: TVDevice) {
    this.home = new HomePage(device, this);
    this.details = new DetailsPage(device, this);
  }
}
