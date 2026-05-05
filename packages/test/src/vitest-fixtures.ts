import { test as base, onTestFinished } from 'vitest';
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

export const test = base.extend<UncleJesseFixtures>({
  session: async ({ task }: any, use: any) => {
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

    // Register cleanup
    onTestFinished(async (ctx: any) => {
      const finishTask = ctx?.task ?? ctx;
      const failed = finishTask?.result?.state === 'fail';
      const testName = sanitizeName(finishTask?.name ?? 'unknown');

      if (failed && (session as any)._artifacts?.screenshotOnFail !== false) {
        try {
          const path = await session.saveScreenshot(testName);
          if (path) attachToTask(finishTask, 'screenshot', 'image/png', path);
        } catch { /* don't break teardown */ }
      }

      if ((session as any)._artifacts?.captureLog) {
        try {
          const path = await session.saveLog(testName);
          if (path) attachToTask(finishTask, 'log', 'text/plain', path);
        } catch { /* don't break teardown */ }
      }

      if (failed && finishTask?.result?.errors) {
        for (const err of finishTask.result.errors) {
          if (err instanceof Error) patchErrorStack(err);
        }
      }

      await session.dispose();
    });

    await use(session);
  },
  device: async ({ session }: any, use: any) => {
    await use(session.device);
  },
  app: async ({ session }: any, use: any) => {
    await use(session.app);
  },
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
