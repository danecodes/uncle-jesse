import { test as base, onTestFailed } from 'vitest';
import { RokuTestSession, type RokuSessionOptions } from './roku-session.js';
import { patchErrorStack } from './code-frame.js';
import { extractTags } from './tag-filter.js';

export type { RokuSessionOptions };

export interface SessionFactoryContext {
  /** The Vitest task object. */
  task: any;
  /** Test name. */
  testName: string;
  /** Tags extracted from the test name (e.g. ['@smoke', '@auth']). */
  tags: Array<{ name: string; arg?: string }>;
}

export type SessionFactory =
  | (() => RokuSessionOptions | Promise<RokuSessionOptions>)
  | ((ctx: SessionFactoryContext) => RokuSessionOptions | Promise<RokuSessionOptions>);

let _sessionFactory: SessionFactory | null = null;

/**
 * Configure the session factory used by the `test`/`it` fixtures.
 * Call once in your vitest setup file or via the plugin.
 *
 * The factory can be sync or async, and optionally receives a
 * SessionFactoryContext with the Vitest task, test name, and tags.
 */
export function configureUncleJesse(opts: {
  sessionFactory: SessionFactory;
}): void {
  _sessionFactory = opts.sessionFactory;
}

export interface UncleJesseFixtures {
  session: RokuTestSession<any>;
  device: RokuTestSession<any>['device'];
  app: any;
}

const sessionFixture = withFixtureSignature(
  async ({ task }: any, use: any) => {
    if (!_sessionFactory) {
      throw new Error(
        'Uncle Jesse not configured. Call configureUncleJesse({ sessionFactory }) in your setup file.'
      );
    }

    // Build context for the factory
    const factoryCtx: SessionFactoryContext = {
      task,
      testName: task?.name ?? '',
      tags: extractTags(task?.name ?? ''),
    };

    // Call factory: support both zero-arg (3.1 compat) and ctx-arg forms,
    // and both sync and async return values.
    const result = _sessionFactory.length === 0
      ? (_sessionFactory as () => RokuSessionOptions | Promise<RokuSessionOptions>)()
      : (_sessionFactory as (ctx: SessionFactoryContext) => RokuSessionOptions | Promise<RokuSessionOptions>)(factoryCtx);
    const opts = await Promise.resolve(result);

    const session = await RokuTestSession.create(opts);

    let failed = false;
    let testError: unknown;

    onTestFailed(() => {
      failed = true;
    });

    try {
      await use(session);
    } catch (err) {
      failed = true;
      testError = err;
      throw err;
    } finally {
      const testName = sanitizeName(task?.name ?? 'unknown');

      if (failed && (session as any)._artifacts?.screenshotOnFail !== false) {
        try {
          const path = await session.saveScreenshot(testName);
          if (path) attachToTask(task, 'screenshot', 'image/png', path);
        } catch { /* don't break teardown */ }
      }

      if ((session as any)._artifacts?.captureLog) {
        try {
          const path = await session.saveLog(testName);
          if (path) attachToTask(task, 'log', 'text/plain', path);
        } catch { /* don't break teardown */ }
      }

      if (failed && task?.result?.errors) {
        for (const err of task.result.errors) {
          if (err instanceof Error) patchErrorStack(err);
        }
      }
      if (failed && testError instanceof Error) patchErrorStack(testError);

      await session.dispose();
    }
  },
  'async ({ task }, use) => {}',
);

const deviceFixture = withFixtureSignature(
  async ({ session }: any, use: any) => {
    await use(session.device);
  },
  'async ({ session }, use) => {}',
);

const appFixture = withFixtureSignature(
  async ({ session }: any, use: any) => {
    await use(session.app);
  },
  'async ({ session }, use) => {}',
);

export const test = base.extend<UncleJesseFixtures>({
  session: sessionFixture,
  device: deviceFixture,
  app: appFixture,
});

export const it = test;

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
}

function attachToTask(task: any, name: string, contentType: string, path: string): void {
  if (!task?.meta) return;
  if (!task.meta.attachments) task.meta.attachments = [];
  task.meta.attachments.push({ name, contentType, path });
}

function withFixtureSignature<T extends (...args: any[]) => any>(fn: T, signature: string): T {
  // Vitest parses fixture dependencies from Function#toString(). Some bundler
  // transforms preserve runtime semantics while rewriting destructured params
  // to a single `context` argument, which breaks that parser. Pinning the
  // parse-only signature keeps the public fixture usable from built packages.
  Object.defineProperty(fn, 'toString', { value: () => signature });
  return fn;
}
