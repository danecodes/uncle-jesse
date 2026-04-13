import { describe, it, expect } from 'vitest';
import { TimeoutError, DeviceConnectionError, ECPError } from '../src/errors.js';

describe('TimeoutError', () => {
  it('includes selector and elapsed time', () => {
    const err = new TimeoutError('#myBtn', 5000);
    expect(err.message).toContain('#myBtn');
    expect(err.message).toContain('5000ms');
    expect(err.selector).toBe('#myBtn');
    expect(err.elapsed).toBe(5000);
    expect(err.name).toBe('TimeoutError');
    expect(err).toBeInstanceOf(Error);
  });

  it('stores last UI tree', () => {
    const tree = { tag: 'Scene' };
    const err = new TimeoutError('#x', 1000, tree);
    expect(err.lastUITree).toBe(tree);
  });
});

describe('DeviceConnectionError', () => {
  it('includes ip', () => {
    const err = new DeviceConnectionError('192.168.1.100');
    expect(err.message).toContain('192.168.1.100');
    expect(err.ip).toBe('192.168.1.100');
    expect(err.name).toBe('DeviceConnectionError');
  });

  it('chains cause', () => {
    const cause = new Error('ECONNREFUSED');
    const err = new DeviceConnectionError('10.0.0.1', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('ECPError', () => {
  it('includes status code and endpoint', () => {
    const err = new ECPError(404, '/query/app-ui');
    expect(err.message).toContain('404');
    expect(err.message).toContain('/query/app-ui');
    expect(err.statusCode).toBe(404);
    expect(err.endpoint).toBe('/query/app-ui');
    expect(err.name).toBe('ECPError');
  });
});
