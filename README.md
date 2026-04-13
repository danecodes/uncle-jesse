# Uncle Jesse

E2E testing framework for smart TVs. Roku-first, TypeScript, off-device automation over HTTP.

**Rooibos tests your code. Uncle Jesse tests your app.**

Rooibos and Rocha are BrightScript unit testing frameworks that run on the device. Uncle Jesse is E2E automation from outside the device — TypeScript, over HTTP, no Appium, no WebdriverIO, no Java.

## Why

There is no open-source E2E testing framework for TV apps. The options today:

1. **Commercial platforms** (Suitest, TV Labs, Witbe) — enterprise pricing, proprietary hardware
2. **Appium stack** — 5-layer middleware (Tests > WebdriverIO > Appium > appium-roku-driver > ECP). Requires Java runtime, Selenium Grid, flaky session management
3. **Abandoned repos** — single-digit GitHub stars, no maintenance

The key insight: the Appium drivers are just calling ECP under the hood. Uncle Jesse calls it directly.

## Install

```bash
npm install @uncle-jesse/core @uncle-jesse/roku @uncle-jesse/test
```

## Quick Start

### 1. Configure your device

```typescript
// uncle-jesse.config.ts
import { defineConfig } from '@uncle-jesse/core';

export default defineConfig({
  devices: [
    {
      name: 'living-room',
      platform: 'roku',
      ip: '192.168.1.100',
      rokuDevPassword: 'rokudev',
    },
  ],
  defaults: { timeout: 10000, pressDelay: 150 },
  app: { rokuAppId: 'dev' },
});
```

### 2. Set up vitest

```typescript
// setup.ts
import { setDeviceFactory } from '@uncle-jesse/test';
import { RokuAdapter } from '@uncle-jesse/roku';
import config from './uncle-jesse.config.js';

const device = config.devices[0];

setDeviceFactory(async () => {
  return new RokuAdapter({
    name: device.name,
    ip: device.ip,
    devPassword: device.rokuDevPassword,
    timeout: config.defaults?.timeout,
    pressDelay: config.defaults?.pressDelay,
  });
});
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./setup.ts'],
    testTimeout: 30000,
  },
});
```

### 3. Write a test

```typescript
import { test } from '@uncle-jesse/test';
import { expect } from 'vitest';

test('app launches and shows grid', async ({ tv }) => {
  await tv.launchApp('dev');
  const grid = await tv.waitForElement('RowList');
  expect(grid).toExist();
});
```

### 4. Run it

```bash
npx uncle-jesse test
# or
npx vitest run
```

## focusPath()

The killer feature. A chainable builder for testing D-pad spatial navigation that collects ALL failures instead of aborting on the first one:

```typescript
import { test, focusPath } from '@uncle-jesse/test';
import { expect } from 'vitest';

test('hero carousel navigation', async ({ tv }) => {
  const result = await focusPath(tv)
    .start('#heroItem0')
    .press('right').expectFocus('#heroItem1')
    .press('right').expectFocus('#heroItem2')
    .press('down').expectFocus('#categoryRow1')
    .verify();

  expect(result.passed).toBe(true);
});
```

When steps fail, you get the full picture:

```
Step 3: After pressing RIGHT, expected focus on #heroItem2 but found focus on #heroItem1
Step 7: After pressing DOWN, expected focus on #categoryRow1 but found focus on <nothing>
```

## Custom Assertions

Uncle Jesse extends vitest's `expect` with TV-specific matchers:

```typescript
expect(element).toBeFocused();
expect(element).toBeVisible();
expect(element).toHaveText('Movies');
expect(element).toExist();
expect(element).toHaveAttribute('opacity', '1.0');
```

## Page Object Model

Encapsulate screen-specific selectors in reusable classes:

```typescript
import { TVPage } from '@uncle-jesse/test';

class GridScreen extends TVPage {
  async waitForLoad() {
    await this.waitForElement('RowList');
  }

  async selectCurrentItem() {
    await this.device.select();
  }
}

test('browse and select', async ({ tv }) => {
  const grid = new GridScreen(tv);
  await grid.waitForLoad();
  await grid.selectCurrentItem();
});
```

## Device Discovery

Find Roku devices on your network:

```bash
npx uncle-jesse discover
```

Or programmatically:

```typescript
import { RokuDiscovery } from '@uncle-jesse/roku';

const discovery = new RokuDiscovery();
const devices = await discovery.findAll({ timeout: 5000 });
```

## CI/CD (GitHub Actions)

```yaml
name: TV Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install
      - run: pnpm test

  device-tests:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install
      - run: npx uncle-jesse test --reporter junit
        env:
          UNCLE_JESSE_ROKU_IP: 10.0.1.50
```

## Architecture

```
Test Script (user code)
      |
@uncle-jesse/test    expect API, focusPath, vitest plugin
      |
@uncle-jesse/core    TVDevice interface, UIElement, selectors
      |
@uncle-jesse/roku    adapter wrapping @danecodes/roku-ecp
      |
ECP HTTP API         port 8060 on the Roku device
```

## Packages

| Package | Description |
|---------|-------------|
| `@uncle-jesse/core` | Platform-agnostic interfaces, UIElement, SelectorEngine, config |
| `@uncle-jesse/roku` | Roku adapter wrapping `@danecodes/roku-ecp` |
| `@uncle-jesse/test` | focusPath(), assertions, vitest plugin, TVPage |
| `uncle-jesse` | CLI (`test`, `discover`) and reporters |

## Examples

See the [`examples/`](./examples) directory:

- **roku-basic** — smoke tests: launch, navigate, select, back
- **roku-focus-path** — focusPath() showcase with failure reporting demo
- **roku-page-objects** — Page Object Model pattern

## License

MIT
