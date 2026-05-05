import { test as base, onTestFinished } from 'vitest';
import { RokuTestSession, type RokuSessionOptions } from './roku-session.js';
import { patchErrorStack } from './code-frame.js';

export type { RokuSessionOptions };

type SessionFactory = (ctx?: any) => RokuSessionOptions;

let _sessionFactory: SessionFactory | null = null;

/**
 * Configure the session factory used by the `test`/`it` fixtures.
 * Call once in your vitest setup file or via the plugin.
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
  session: async ({}: any, use: any) => {
    if (!_sessionFactory) {
      throw new Error(
        'Uncle Jesse not configured. Call configureUncleJesse({ sessionFactory }) in your setup file.'
      );
    }
    const opts = _sessionFactory();
    const session = await RokuTestSession.create(opts);

    // Register cleanup
    onTestFinished(async (ctx: any) => {
      const task = ctx?.task ?? ctx;
      const failed = task?.result?.state === 'fail';
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
