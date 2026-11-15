import { describe, expect, it, vi } from 'vitest';
import { loadApp } from '../harness';

const logger = { warn: vi.fn(), error: vi.fn() };

describe('runMenuAction_', () => {
  it('runs the action without side effects on success', () => {
    const { app, toasts } = loadApp();
    const action = vi.fn();

    app.runMenuAction_(logger, action);

    expect(action).toHaveBeenCalledOnce();
    expect(toasts).toEqual([]);
  });

  it('shows an error toast and rethrows the original error', () => {
    const { app, toasts } = loadApp();
    const failure = new Error('boom');

    expect(() =>
      app.runMenuAction_(logger, () => {
        throw failure;
      }),
    ).toThrow(failure);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ message: 'boom', timeout: 15 });
  });

  it('logs expected failures at warn and unexpected ones at error', () => {
    const { app } = loadApp();
    const sink = { warn: vi.fn(), error: vi.fn() };

    expect(() =>
      app.runMenuAction_(sink, () => {
        throw app.createCancelledError_();
      }),
    ).toThrow();
    expect(sink.warn).toHaveBeenCalledOnce();

    expect(() =>
      app.runMenuAction_(sink, () => {
        throw new TypeError('bug');
      }),
    ).toThrow();
    expect(sink.error).toHaveBeenCalledOnce();
  });
});

describe('lock timeouts in menu actions', () => {
  it('shows a warning toast instead of failing', () => {
    const { app, toasts } = loadApp();
    const sink = { warn: vi.fn(), error: vi.fn() };

    expect(() =>
      app.runMenuAction_(sink, () => {
        throw new Error('Lock timeout: another process was holding the lock');
      }),
    ).not.toThrow();

    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.message).toMatch(/synchronization is in progress/);
    expect(sink.error).not.toHaveBeenCalled();
  });

  it('does not treat other errors as lock timeouts', () => {
    const { app } = loadApp();

    expect(app.isLockTimeoutError_(new Error('boom'))).toBe(false);
    expect(app.isLockTimeoutError_(new Error('Lock timeout'))).toBe(true);
  });
});
