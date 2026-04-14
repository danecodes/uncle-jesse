# Uncle Jesse

E2E testing framework for smart TVs. TypeScript, off-device, over HTTP. Roku first, with other platforms planned.

Uncle Jesse talks directly to the Roku External Control Protocol (ECP) on port 8060. No Appium, no WebdriverIO, no Selenium Grid, no Java runtime. Your tests run in Node and send HTTP requests to the device.

## Install

```bash
npm install @danecodes/uncle-jesse-core @danecodes/uncle-jesse-roku @danecodes/uncle-jesse-test
```

## Quick Start

### 1. Configure your device

```typescript
// uncle-jesse.config.ts
import { defineConfig } from '@danecodes/uncle-jesse-core';

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
import { setDeviceFactory } from '@danecodes/uncle-jesse-test';
import { RokuAdapter } from '@danecodes/uncle-jesse-roku';
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
import { test } from '@danecodes/uncle-jesse-test';
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

## focusPath

A chainable builder for verifying D-pad spatial navigation. It runs every step and collects all failures instead of bailing on the first one, so you can see the full scope of a broken nav flow at once.

```typescript
import { test, focusPath } from '@danecodes/uncle-jesse-test';
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

When steps fail, the output tells you exactly what happened:

```
Step 3: After pressing RIGHT, expected focus on #heroItem2 but found focus on #heroItem1
Step 7: After pressing DOWN, expected focus on #categoryRow1 but found focus on <nothing>
```

Pass `{ record: true }` to capture a visual replay of each step (see [Visual Replay Debugger](#visual-replay-debugger)).

## Custom Assertions

Extends vitest's `expect` with matchers for TV UI elements:

```typescript
expect(element).toBeFocused();
expect(element).toBeVisible();
expect(element).toHaveText('Movies');
expect(element).toExist();
expect(element).toHaveAttribute('opacity', '1.0');
```

## Page Object Model

Wrap screen-specific selectors and actions in classes that extend `TVPage`:

```typescript
import { TVPage } from '@danecodes/uncle-jesse-test';

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

## Visual Replay Debugger

focusPath can record a timeline of UI tree snapshots at each step. The output is a self-contained HTML file you can scrub through like a video, showing which element had focus at each step and whether it matched the expectation.

```typescript
const result = await focusPath(tv, { record: true, testName: 'hero nav' })
  .start('#heroItem0')
  .press('right').expectFocus('#heroItem1')
  .verify();

if (result.replay) {
  const { saveReplay } = await import('@danecodes/uncle-jesse-test');
  await saveReplay(result.replay, './test-results');
  // Writes test-results/hero-nav-replay.html
}
```

## Device Discovery

Find Roku devices on your local network:

```bash
npx uncle-jesse discover
```

```typescript
import { RokuDiscovery } from '@danecodes/uncle-jesse-roku';

const discovery = new RokuDiscovery();
const devices = await discovery.findAll({ timeout: 5000 });
```

## CI (GitHub Actions)

Unit tests (selector engine, parsers, matchers) run on any CI runner. Device tests need a self-hosted runner on the same network as the Roku.

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
@danecodes/uncle-jesse-test    expect API, focusPath, vitest plugin
      |
@danecodes/uncle-jesse-core    TVDevice interface, UIElement, selectors
      |
@danecodes/uncle-jesse-roku    adapter wrapping @danecodes/roku-ecp
      |
ECP HTTP API         port 8060 on the Roku device
```

## Packages

| Package | Description |
|---------|-------------|
| `@danecodes/uncle-jesse-core` | Platform-agnostic interfaces, UIElement, SelectorEngine, config |
| `@danecodes/uncle-jesse-roku` | Roku adapter wrapping [@danecodes/roku-ecp](https://github.com/danecodes/roku-ecp) |
| `@danecodes/uncle-jesse-test` | focusPath, assertions, vitest plugin, TVPage |
| `uncle-jesse` | CLI and reporters (console, JUnit XML) |

## Examples

The [`examples/`](./examples) directory has three working test suites that run against a bundled Roku sample app:

- `roku-basic` - launch, navigate, select items, back navigation
- `roku-focus-path` - focusPath builder, failure reporting
- `roku-page-objects` - page object pattern with GridScreen and DetailsScreen

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned work including WebOS support, a device dashboard, and visual regression testing.

## License

MIT
