import { expect } from 'vitest';
import { focusPath, saveReplay } from '@danecodes/uncle-jesse-test';
import { test } from '@danecodes/uncle-jesse-test/vitest';

test('opens details from home and saves useful artifacts @smoke', async ({ app, device, session }) => {
  await app.home.waitForLoaded();
  await app.home.contentGrid.expectSeedContent();

  await session.saveScreenshot('home-loaded');

  await device.focusByKeys('featured-2', {
    keys: ['right'],
    maxPressesPerKey: 3,
  });

  const result = await focusPath(device, {
    record: true,
    testName: 'golden-home-navigation',
  })
    .press('right')
    .expectFocus('[title="featured-item-3"]')
    .verify();

  expect(result.passed).toBe(true);
  if (result.replay) {
    await saveReplay(result.replay, 'test-results');
  }

  await app.home.openFocusedItem();
  await app.details.actionButtons.expectDefaultActions();

  const title = await app.details.titleLabel.getText();
  expect(title).toContain('featured-item-3');

  await session.saveScreenshot('details-opened');
  await session.saveLog('details-opened');
});
