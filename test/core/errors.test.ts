import { describe, expect, it, vi } from 'vitest';
import { loadApp } from '../harness';

const logger = { warn: vi.fn(), error: vi.fn() };

describe('runMenuAction', () => {
  it('runs the action without side effects on success', () => {
    const error = vi.fn();
    const { app } = loadApp({ globals: { Toast: { error } } });
    const action = vi.fn();

    app.runMenuAction(logger, action);

    expect(action).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
  });

  it('shows an error toast and rethrows the original error', () => {
    const error = vi.fn();
    const { app } = loadApp({ globals: { Toast: { error } } });
    const failure = new Error('boom');

    expect(() =>
      app.runMenuAction(logger, () => {
        throw failure;
      }),
    ).toThrow(failure);
    expect(error).toHaveBeenCalledWith('boom');
  });

  it('logs expected failures at warn and unexpected ones at error', () => {
    const { app } = loadApp();
    const sink = { warn: vi.fn(), error: vi.fn() };

    expect(() =>
      app.runMenuAction(sink, () => {
        throw app.createCancelledError();
      }),
    ).toThrow();
    expect(sink.warn).toHaveBeenCalledOnce();

    expect(() =>
      app.runMenuAction(sink, () => {
        throw new TypeError('bug');
      }),
    ).toThrow();
    expect(sink.error).toHaveBeenCalledOnce();
  });
});
