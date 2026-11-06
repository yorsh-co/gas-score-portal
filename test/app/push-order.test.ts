import { describe, expect, it } from 'vitest';
import { loadApp } from '../harness';

describe('clasp push order', () => {
  it('runs the top level of every file without a ReferenceError', () => {
    expect(() => loadApp({ claspOrder: true })).not.toThrow();
  });

  it('serves doGet after loading in clasp order', () => {
    const { app } = loadApp({ claspOrder: true });

    expect(() => app.doGet({ parameter: { route: '/nope' } })).toThrow(/404/);
  });
});
