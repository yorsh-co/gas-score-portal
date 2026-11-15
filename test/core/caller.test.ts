import { describe, expect, it } from 'vitest';
import { declaresGlobal, loadApp } from '../harness';

/**
 * Loads the app with a `Session` fake.
 * @param active Active user email, or a function that throws.
 */
const load = (active: string | (() => never)) =>
  loadApp({
    globals: {
      Session: {
        getActiveUser: () => ({
          getEmail: typeof active === 'string' ? () => active : active,
        }),
        getEffectiveUser: () => ({ getEmail: () => 'owner@x.org' }),
      },
    },
  }).app;

describe('isCallerEffectiveUser_', () => {
  it('is true when the active user is the effective user', () => {
    expect(load('owner@x.org').isCallerEffectiveUser_()).toBe(true);
  });

  it.each([
    ['blank', ''],
    ['another account', 'visitor@x.org'],
  ])('is false when the active user is %s', (_label, active) => {
    expect(load(active).isCallerEffectiveUser_()).toBe(false);
  });

  it('is false when the session cannot be read', () => {
    const app = load(() => {
      throw new Error('no session');
    });
    expect(app.isCallerEffectiveUser_()).toBe(false);
  });
});

describe('assertCallerEffectiveUser_', () => {
  it('does not throw for the effective user', () => {
    expect(() =>
      load('owner@x.org').assertCallerEffectiveUser_(),
    ).not.toThrow();
  });

  it('throws Forbidden by default', () => {
    expect(() => load('').assertCallerEffectiveUser_()).toThrow(/Forbidden/);
  });

  it('throws a GasForbiddenError', () => {
    expect(() => load('').assertCallerEffectiveUser_()).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('throws the given message', () => {
    expect(() =>
      load('visitor@x.org').assertCallerEffectiveUser_('msg'),
    ).toThrow('msg');
  });
});

describe('google.script.run surface', () => {
  it.each(['isCallerEffectiveUser', 'assertDemoDataCaller'])(
    'does not declare %s as a global',
    (name) => {
      expect(declaresGlobal(name)).toBe(false);
    },
  );

  it.each(['isCallerEffectiveUser_', 'assertCallerEffectiveUser_'])(
    'declares %s as a private global',
    (name) => {
      expect(declaresGlobal(name)).toBe(true);
    },
  );
});
