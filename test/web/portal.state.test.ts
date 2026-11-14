import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/* Mirrors the types of src/web/portal.state.ts, a script without exports. */
type Step = 'email' | 'code' | 'results' | 'error';

interface State {
  step: Step;
  email: string;
  returnTo: Exclude<Step, 'error'>;
  errorKey: string | null;
  errorText: string | null;
  resendAt: number;
}

type Event =
  | { type: 'otpSent'; email: string; now: number }
  | { type: 'verified' }
  | { type: 'restore' }
  | { type: 'failed'; status: number | null; message: string | null }
  | { type: 'invalidInput'; key: string }
  | { type: 'dismissError' }
  | { type: 'changeEmail' }
  | { type: 'signOut' };

interface StateApi {
  initialPortalState(): State;
  reducePortal(state: State, event: Event): State;
  portalPanel(state: State): Exclude<Step, 'error'>;
  resendSecondsLeft(state: State, now: number): number;
  normalizeCodeInput(value: string): string;
  isHttpsUrl(value: string | null): boolean;
  isAnswered(score: unknown): boolean;
  scoreOutOfTen(score: number, formPoints: number | null): number;
  averageOutOfTen(
    scores: { score: number; formPoints: number | null }[],
  ): number;
  parseStoredTheme(value: string | null): 'light' | 'dark' | null;
  toggledTheme(
    current: 'light' | 'dark' | null,
    prefersDark: boolean,
  ): 'light' | 'dark';
}

/** Loads the browser script, which has no exports, in an isolated context. */
function loadState(): StateApi {
  const source = readFileSync(
    join(process.cwd(), 'src/web/portal.state.ts'),
    'utf8',
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const names = [
    'initialPortalState',
    'reducePortal',
    'portalPanel',
    'resendSecondsLeft',
    'normalizeCodeInput',
    'isHttpsUrl',
    'isAnswered',
    'scoreOutOfTen',
    'averageOutOfTen',
    'parseStoredTheme',
    'toggledTheme',
  ];
  return runInNewContext(`${js}\n({ ${names.join(', ')} })`, {
    URL,
  }) as StateApi;
}

const api = loadState();
const NOW = 1_000_000;

/** Applies the events in order from the initial state. */
function run(...events: Event[]): State {
  return events.reduce(api.reducePortal, api.initialPortalState());
}

const sent: Event = { type: 'otpSent', email: 'a@b.co', now: NOW };

describe('portal state machine', () => {
  it('starts on the email panel without an error', () => {
    expect(api.initialPortalState()).toMatchObject({
      step: 'email',
      errorKey: null,
      errorText: null,
    });
  });

  it('moves email -> code when the code is sent', () => {
    const state = run(sent);

    expect(state).toMatchObject({ step: 'code', email: 'a@b.co' });
    expect(state.resendAt).toBe(NOW + 60_000);
  });

  it('moves code -> results when the code is verified', () => {
    expect(run(sent, { type: 'verified' }).step).toBe('results');
  });

  it('resumes straight to results from a stored session', () => {
    expect(run({ type: 'restore' }).step).toBe('results');
  });

  it('restarts the cooldown when the code is resent', () => {
    const state = run(sent, {
      type: 'otpSent',
      email: 'a@b.co',
      now: NOW + 70_000,
    });

    expect(state.step).toBe('code');
    expect(state.resendAt).toBe(NOW + 130_000);
  });

  it('shows local validation errors on the current panel', () => {
    const state = run({ type: 'invalidInput', key: 'portal.emailInvalid' });

    expect(state).toMatchObject({
      step: 'error',
      returnTo: 'email',
      errorKey: 'portal.emailInvalid',
    });
    expect(api.portalPanel(state)).toBe('email');
  });

  it('stays on the code panel when the code is rejected with 401', () => {
    const state = run(sent, {
      type: 'failed',
      status: 401,
      message: 'Invalid or expired code.',
    });

    expect(state).toMatchObject({
      step: 'error',
      returnTo: 'code',
      errorText: 'Invalid or expired code.',
    });
  });

  it('falls back to email with a session message on 401 from results', () => {
    const state = run(
      sent,
      { type: 'verified' },
      {
        type: 'failed',
        status: 401,
        message: 'ignored',
      },
    );

    expect(state).toMatchObject({
      step: 'error',
      returnTo: 'email',
      errorKey: 'auth.sessionInvalid',
      errorText: null,
      resendAt: 0,
    });
  });

  it('falls back to email on 401 while restoring a stored session', () => {
    const state = run(
      { type: 'restore' },
      {
        type: 'failed',
        status: 401,
        message: null,
      },
    );

    expect(api.portalPanel(state)).toBe('email');
  });

  it('shows the server message for other client errors', () => {
    const state = run(sent, {
      type: 'failed',
      status: 429,
      message: 'Too many requests.',
    });

    expect(state).toMatchObject({
      returnTo: 'code',
      errorText: 'Too many requests.',
    });
  });

  it.each([500, 503, null])(
    'shows the generic server error for status %s',
    (status) => {
      const state = run({
        type: 'failed',
        status,
        message: 'internal detail',
      });

      expect(state).toMatchObject({
        errorKey: 'portal.serverError',
        errorText: null,
      });
    },
  );

  it('uses the generic error when a client error has no message', () => {
    const state = run({ type: 'failed', status: 400, message: null });

    expect(state.errorKey).toBe('portal.serverError');
  });

  it('keeps the panel and clears the error on dismiss', () => {
    const state = run(
      sent,
      { type: 'failed', status: 401, message: 'x' },
      { type: 'dismissError' },
    );

    expect(state).toMatchObject({
      step: 'code',
      errorKey: null,
      errorText: null,
      email: 'a@b.co',
    });
  });

  it('ignores dismiss when there is no error', () => {
    const state = run(sent);

    expect(api.reducePortal(state, { type: 'dismissError' })).toBe(state);
  });

  it('goes back to email from the code panel', () => {
    const state = run(sent, { type: 'changeEmail' });

    expect(state).toMatchObject({ step: 'email', resendAt: 0 });
  });

  it('signs out from results and forgets the email', () => {
    const state = run(sent, { type: 'verified' }, { type: 'signOut' });

    expect(state).toMatchObject({ step: 'email', email: '', resendAt: 0 });
  });

  it('signs out even while an error is shown', () => {
    const state = run(
      sent,
      { type: 'verified' },
      { type: 'failed', status: 500, message: null },
      { type: 'signOut' },
    );

    expect(state).toMatchObject({ step: 'email', errorKey: null });
  });
});

describe('resendSecondsLeft', () => {
  it('counts down, rounding up, and stops at zero', () => {
    const state = run(sent);

    expect(api.resendSecondsLeft(state, NOW)).toBe(60);
    expect(api.resendSecondsLeft(state, NOW + 59_500)).toBe(1);
    expect(api.resendSecondsLeft(state, NOW + 60_000)).toBe(0);
    expect(api.resendSecondsLeft(state, NOW + 90_000)).toBe(0);
  });
});

describe('normalizeCodeInput', () => {
  it('keeps digits only, up to six', () => {
    expect(api.normalizeCodeInput('123 456')).toBe('123456');
    expect(api.normalizeCodeInput('12-34-56-78')).toBe('123456');
    expect(api.normalizeCodeInput('ab')).toBe('');
  });
});

describe('scoreOutOfTen', () => {
  it('rescales to 10 points, keeping 10-point and unknown totals as is', () => {
    expect(api.scoreOutOfTen(18, 20)).toBe(9);
    expect(api.scoreOutOfTen(12, 15)).toBe(8);
    expect(api.scoreOutOfTen(7.5, 10)).toBe(7.5);
    expect(api.scoreOutOfTen(6, null)).toBe(6);
  });
});

describe('isAnswered', () => {
  it('accepts finite numbers, zero included', () => {
    expect(api.isAnswered(0)).toBe(true);
    expect(api.isAnswered(7.5)).toBe(true);
  });

  it('rejects missing, null and non-numeric scores', () => {
    expect(api.isAnswered(null)).toBe(false);
    expect(api.isAnswered(undefined)).toBe(false);
    expect(api.isAnswered(NaN)).toBe(false);
    expect(api.isAnswered('8')).toBe(false);
  });

  it('keeps unanswered forms out of the average', () => {
    const entries: { score?: number | null; formPoints: number }[] = [
      { score: 18, formPoints: 20 },
      { formPoints: 20 },
      { score: null, formPoints: 20 },
    ];
    const answered = entries.flatMap((e) =>
      api.isAnswered(e.score)
        ? [{ score: e.score as number, formPoints: e.formPoints }]
        : [],
    );
    expect(api.averageOutOfTen(answered)).toBe(9);
  });
});

describe('averageOutOfTen', () => {
  it('averages the rescaled scores, not the raw points', () => {
    const scores = [
      { score: 9, formPoints: 10 },
      { score: 18, formPoints: 20 },
      { score: 12, formPoints: 15 },
    ];

    expect(api.averageOutOfTen(scores)).toBeCloseTo(26 / 3);
  });

  it('is zero for no scores', () => {
    expect(api.averageOutOfTen([])).toBe(0);
  });
});

describe('isHttpsUrl', () => {
  it('accepts an HTTPS address', () => {
    expect(api.isHttpsUrl('https://example.org/privacy')).toBe(true);
  });

  it('rejects other schemes, malformed and empty values', () => {
    expect(api.isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(api.isHttpsUrl('http://example.org')).toBe(false);
    expect(api.isHttpsUrl('not a url')).toBe(false);
    expect(api.isHttpsUrl('')).toBe(false);
    expect(api.isHttpsUrl(null)).toBe(false);
  });
});

describe('theme helpers', () => {
  it('parses only valid stored themes', () => {
    expect(api.parseStoredTheme('light')).toBe('light');
    expect(api.parseStoredTheme('dark')).toBe('dark');
    expect(api.parseStoredTheme('blue')).toBeNull();
    expect(api.parseStoredTheme('')).toBeNull();
    expect(api.parseStoredTheme(null)).toBeNull();
  });

  it('toggles from the OS scheme when there is no choice', () => {
    expect(api.toggledTheme(null, false)).toBe('dark');
    expect(api.toggledTheme(null, true)).toBe('light');
  });

  it('toggles an explicit choice regardless of the OS', () => {
    expect(api.toggledTheme('light', true)).toBe('dark');
    expect(api.toggledTheme('light', false)).toBe('dark');
    expect(api.toggledTheme('dark', true)).toBe('light');
    expect(api.toggledTheme('dark', false)).toBe('light');
  });
});
