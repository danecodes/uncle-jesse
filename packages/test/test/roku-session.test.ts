import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { RokuTestSession } from '../src/roku-session.js';
import type { TVDevice } from '@danecodes/uncle-jesse-core';

function makeSession(options: {
  baseDir: string;
  logText?: string;
  breadcrumbs?: string[];
}): RokuTestSession {
  const session = Object.create(RokuTestSession.prototype) as RokuTestSession & {
    _device: TVDevice & { logs?: { toText: () => string } };
    _artifacts: { baseDir: string; captureLog: boolean };
    _logLines: string[];
  };

  session._device = {
    logs: options.logText !== undefined ? { toText: () => options.logText ?? '' } : undefined,
  } as TVDevice & { logs?: { toText: () => string } };
  session._artifacts = { baseDir: options.baseDir, captureLog: true };
  session._logLines = options.breadcrumbs ?? [];

  return session;
}

describe('RokuTestSession.saveLog', () => {
  it('saves Roku log session output when available', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'uncle-jesse-logs-'));
    const session = makeSession({
      baseDir,
      logText: 'brightscript line\n',
      breadcrumbs: ['breadcrumb line'],
    });

    const path = await session.saveLog('test-log');

    expect(path).toBe(join(baseDir, 'test-log.log'));
    await expect(readFile(path!, 'utf-8')).resolves.toBe('brightscript line\n');
  });

  it('falls back to framework logger breadcrumbs', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'uncle-jesse-logs-'));
    const session = makeSession({
      baseDir,
      logText: '',
      breadcrumbs: ['first breadcrumb', 'second breadcrumb'],
    });

    const path = await session.saveLog('breadcrumbs');

    await expect(readFile(path!, 'utf-8')).resolves.toBe('first breadcrumb\nsecond breadcrumb\n');
  });

  it('returns null when no log output was captured', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'uncle-jesse-logs-'));
    const session = makeSession({ baseDir, logText: '', breadcrumbs: [] });

    await expect(session.saveLog('empty')).resolves.toBeNull();
  });
});
