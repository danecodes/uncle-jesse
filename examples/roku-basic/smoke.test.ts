import { test } from '@danecodes/uncle-jesse-test';
import { expect } from 'vitest';

async function launchHome(tv: any) {
  await tv.closeApp();
  await tv.home();
  await tv.launchApp('dev');
  await tv.waitForElement('HomeScreen RowList#contentGrid');
}

test('app launches and shows home grid', async ({ tv }) => {
  await launchHome(tv);

  const grid = await tv.waitForElement('HomeScreen RowList#contentGrid');
  expect(grid).toExist();
});

test('grid screen has focused element', async ({ tv }) => {
  await launchHome(tv);

  const focused = await tv.getFocusedElement();
  expect(focused).toExist();
  expect(focused).toBeFocused();
  expect(focused?.getAttribute('title')).toBe('featured-item-1');
});

test('can navigate grid with D-pad', async ({ tv }) => {
  await launchHome(tv);

  await tv.press('right');
  const focused = await tv.getFocusedElement();
  expect(focused).toBeFocused();
  expect(focused?.getAttribute('title')).toBe('featured-item-2');
});

test('selecting grid item shows details screen', async ({ tv }) => {
  await launchHome(tv);
  await tv.select();

  const details = await tv.waitForElement('DetailsScreen');
  expect(details).toExist();
  expect(details.getAttribute('visible')).not.toBe('false');

  const buttons = await tv.waitForElement('DetailsScreen LabelList#actionButtons');
  expect(buttons).toExist();
});

test('back from details returns to home grid', async ({ tv }) => {
  await launchHome(tv);
  await tv.select();
  await tv.waitForElement('DetailsScreen LabelList#actionButtons');

  await tv.back();

  const grid = await tv.waitForElement('HomeScreen RowList#contentGrid');
  expect(grid).toExist();
  const focused = await tv.getFocusedElement();
  expect(focused?.getAttribute('title')).toBe('featured-item-1');
});
