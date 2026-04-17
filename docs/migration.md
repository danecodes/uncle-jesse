# Migrating from Appium/WebdriverIO

How to move a Roku E2E test suite from the Appium stack (WebdriverIO + appium-roku-driver + Selenium Grid) to Uncle Jesse. See also: [API Reference](./api.md), [Roku Focus Behavior](./roku-focus.md).

## What changes

| Before | After |
|--------|-------|
| WebdriverIO client | `@danecodes/uncle-jesse-core` LiveElement |
| appium-roku-driver | `@danecodes/uncle-jesse-roku` RokuAdapter |
| Appium server (Java) | Nothing. Uncle Jesse talks ECP directly. |
| Selenium Grid | Not yet supported. Single device for now. |
| `browser.$('selector')` | `this.$('selector')` (same CSS selectors) |
| `element.click()` | `element.select()` |
| `element.waitForDisplayed()` | `element.toBeDisplayed()` |
| `driver.sendKeys(Key.Right)` | `device.press('right')` |

## Selectors

Your existing CSS selectors work without changes. Uncle Jesse uses the same selector syntax against the same SceneGraph XML tree:

```typescript
// These selectors work the same way
this.$('HomePage HeroCarousel')
this.$('Button#infoBtn')
this.$('#infoContainer Label')
this.$('ContentList ContentCard')
this.$('HomePage ContentShelf:has(+ ContentShelf)')
this.$('Label[text="Play"]')
```

## Page objects

Replace `BasePage` and `BaseComponent` imports:

```typescript
// Before
import { BasePage } from '../internal/atf.js';
import { BaseComponent } from '../internal/atf.js';

// After
import { BasePage, BaseComponent } from '@danecodes/uncle-jesse-core';
```

The class structure stays the same:

```typescript
export class HeroCarousel extends BaseComponent {
  get currentCard() {
    return new HeroCarouselCard(this.$('HeroCarouselCard'));
  }

  get cards() {
    return this.$$('HeroCarouselCard', HeroCarouselCard);
  }

  get paginator() {
    return this.$('CarouselPaginator#paginator');
  }
}
```

## Element assertions

Replace WebdriverIO assertion patterns with LiveElement methods. Same behavior -- they poll until the condition is met or timeout.

```typescript
// Before
await element.waitForDisplayed();
await element.waitForExist();
await expect(element).toBeFocused();

// After
await element.toBeDisplayed();
await element.toExist();
await element.toBeFocused();
```

All assertions accept an optional `{ timeout }` parameter:

```typescript
await element.toBeFocused({ timeout: 5000 });
await element.toHaveText('Play', { timeout: 3000 });
```

## Device interaction

```typescript
// Before
await device.sendKeys(Key.Right, { times: 2, delay: 500 });
await device.sendKeys(Key.Select);
await device.sendKeys(Key.Back);
await device.pause(1000);

// After
await device.press('right', { times: 2, delay: 500 });
await device.select();
await device.back();
// No pause needed - assertions poll automatically
```

## Element methods

```typescript
// Before
const text = await element.getText();
const attr = await element.getAttribute('opacity');
const visible = await element.isDisplayed();
const exists = await element.isExisting();

// After (same API)
const text = await element.getText();
const attr = await element.getAttribute('opacity');
const visible = await element.isDisplayed();
const exists = await element.isExisting();
```

## Test setup

```typescript
// Before
import { RokuBuilder } from '../../src/RokuBuilder.js';

beforeEach(async (ctx) => {
  const roku = await new RokuBuilder(ctx)
    .withRegistry(RegistryState.skipOnboarding())
    .connect();
  app = roku.app;
  device = roku.device;
});

// After
import { RokuAdapter } from '@danecodes/uncle-jesse-roku';
import { RegistryState } from '@danecodes/uncle-jesse-core';

beforeEach(async () => {
  device = new RokuAdapter({
    name: 'test',
    ip: process.env.ROKU_IP ?? '192.168.1.100',
    devPassword: 'rokudev',
  });
  await device.connect();
  home = new HomePage(device, null);
  await device.home();
  const registry = RegistryState.skipOnboarding();
  await device.launchApp('dev', registry.toLaunchParams());
  await home.waitForLoaded();
});

afterEach(async () => {
  await device.disconnect();
});
```

## element.focus() and select()

```typescript
// Before
await element.focus();
await element.select({ ifNotDisplayedNavigate: Direction.DOWN });

// After
// focus() uses element bounds to determine which direction to navigate.
// It also focuses the parent container first if needed.
await element.focus();
await element.select({ ifNotDisplayedNavigate: 'down' });
```

## Multi-device parallel

```typescript
// Before: Selenium Grid distributes sessions across runners

// After: DevicePool manages device allocation
import { DevicePool } from '@danecodes/uncle-jesse-core';

const pool = new DevicePool(devices, { acquireTimeout: 30000 });
const device = await pool.acquire();
// ... run tests ...
pool.release(device);
```

## What's not yet supported

- Selenium Grid protocol (DevicePool replaces this with a simpler model)
- `driver.waitUntil()` (use `waitForCondition()` or assertion polling instead)
