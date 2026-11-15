/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { declaresGlobal, loadApp } from '../harness';

const RESPONDENTS = new Set(['ana@x.org', 'bob@x.org']);

function setup(options: { quota?: number; sendFails?: boolean } = {}) {
  const state = { mailFails: options.sendFails ?? false };
  const sent: {
    to: string;
    subject: string;
    body: string;
    htmlBody: string;
  }[] = [];
  const logged: string[] = [];
  const lookups: string[] = [];
  const env = loadApp({
    realUuids: true,
    globals: {
      MailApp: {
        getRemainingDailyQuota: () => options.quota ?? 100,
        sendEmail: (message: (typeof sent)[number]) => {
          if (state.mailFails)
            throw new Error('Service invoked too many times');
          sent.push(message);
        },
      },
    },
  });
  const { app } = env;
  const auth = app.createAuthServices(
    () => ({
      findByEmail: (email: string) =>
        RESPONDENTS.has(email)
          ? { email, name: email, alternatives: '' }
          : null,
    }),
    { error: (message: string) => logged.push(message) },
  );
  const webApp = app.createWebApp(
    {
      getByUser: (email: string) => {
        lookups.push(email);
        return { email, name: email, alternatives: [], scores: [] };
      },
    },
    auth,
  );

  const post = (route: string, body: object) =>
    webApp.doPost({
      parameter: { route },
      postData: { contents: JSON.stringify(body), type: 'application/json' },
    });
  const attempt = (fn: () => unknown) => {
    try {
      return { response: fn() as { data: Record<string, any> } };
    } catch (err) {
      return { error: (err as Error).message };
    }
  };
  const requestCode = (email: string) =>
    attempt(() => post('/api/auth/otp', { email }));
  const verify = (email: string, code: string) =>
    attempt(() => post('/api/auth/verify', { email, code }));
  const scores = (token?: string) =>
    attempt(() =>
      webApp.doGet({ parameter: { route: '/api/me/scores', token } }),
    );
  const lastCode = () =>
    /\b(\d{6})\b/.exec(sent[sent.length - 1]?.body ?? '')?.[1] ?? '';
  const login = (email: string) => {
    requestCode(email);
    const { response } = verify(email, lastCode());
    return response?.data.token as string;
  };

  return {
    ...env,
    state,
    sent,
    logged,
    lookups,
    requestCode,
    verify,
    scores,
    lastCode,
    login,
  };
}

const WRONG = '000000';

describe('requesting a code', () => {
  it('mails a 6-digit code to a respondent and stores only its hash', () => {
    const s = setup();

    const { response } = s.requestCode(' Ana@X.org ');

    expect(response?.data.message).toMatch(/If this email is registered/);
    expect(s.sent).toHaveLength(1);
    expect(s.sent[0].to).toBe('ana@x.org');
    expect(s.lastCode()).toMatch(/^\d{6}$/);
    expect(s.sent[0].htmlBody).toContain(s.lastCode());
    const stored = s
      .cacheKeys()
      .map((key) => `${key}=${s.cache.get(key)}`)
      .join('\n');
    expect(stored).not.toContain(s.lastCode());
    expect(stored).not.toContain('ana@x.org');
  });

  it('answers an unknown email the same way and sends nothing', () => {
    const s = setup();

    const known = s.requestCode('ana@x.org');
    const unknown = s.requestCode('zed@x.org');

    expect(unknown).toEqual({ response: expect.anything() });
    expect(unknown.response?.data).toEqual(known.response?.data);
    expect(s.sent).toHaveLength(1);
  });

  it('rejects a malformed email', () => {
    expect(setup().requestCode('nope').error).toMatch(/400/);
  });

  it('answers 429 after 3 requests for the same email', () => {
    const s = setup();

    s.requestCode('ana@x.org');
    s.requestCode('ana@x.org');
    s.requestCode('ana@x.org');

    expect(s.requestCode('ana@x.org').error).toMatch(/429/);
    expect(s.requestCode('zed@x.org').error).toBeUndefined();
  });

  it('counts unknown emails toward the limit too', () => {
    const s = setup();
    for (let i = 0; i < 3; i++) s.requestCode('zed@x.org');

    expect(s.requestCode('zed@x.org').error).toMatch(/429/);
  });

  it('logs at error and says try later when the quota is exhausted, for any email', () => {
    const s = setup({ quota: 0 });

    const known = s.requestCode('ana@x.org');
    const unknown = s.requestCode('zed@x.org');

    expect(known.error).toMatch(/try again later/i);
    expect(unknown.error).toBe(known.error);
    expect(s.logged).toHaveLength(2);
    expect(s.sent).toHaveLength(0);
  });

  it('logs the failure with a masked email and answers like a success when the send fails', () => {
    const ok = setup().requestCode('ana@x.org');
    const s = setup({ sendFails: true });

    const failed = s.requestCode('ana@x.org');

    expect(failed.response?.data).toEqual(ok.response?.data);
    expect(s.logged).toEqual(['OTP email failed']);
    expect(s.verify('ana@x.org', WRONG).error).toMatch(/401/);
  });

  it('restores the previous entry when a re-issue fails to send', () => {
    const s = setup();
    s.requestCode('ana@x.org');
    const first = s.lastCode();
    const wrong = first === WRONG ? '111111' : WRONG;
    s.verify('ana@x.org', wrong);
    s.verify('ana@x.org', wrong);
    s.state.mailFails = true;

    s.requestCode('ana@x.org');
    s.state.mailFails = false;

    // The old code is live again with its 2 failed attempts kept.
    for (let i = 0; i < 2; i++) s.verify('ana@x.org', wrong);
    expect(s.verify('ana@x.org', first).response?.data.token).toBeTruthy();
  });

  it('keeps the failed attempts when a new code is issued', () => {
    const s = setup();
    s.requestCode('ana@x.org');
    const first = s.lastCode();
    const wrong = first === WRONG ? '111111' : WRONG;
    for (let i = 0; i < 3; i++) s.verify('ana@x.org', wrong);

    s.requestCode('ana@x.org');
    const second = s.lastCode();
    const wrong2 = second === WRONG ? '111111' : WRONG;
    s.verify('ana@x.org', wrong2);
    s.verify('ana@x.org', wrong2);

    // 3 + 2 wrong attempts used up the budget, so the live code is void.
    expect(s.verify('ana@x.org', second).error).toMatch(/401/);
  });
});

describe('verify rate limit', () => {
  it('answers 429 after 10 attempts for the same email', () => {
    const s = setup();
    for (let i = 0; i < 10; i++) s.verify('ana@x.org', WRONG);

    expect(s.verify('ana@x.org', WRONG).error).toMatch(/429/);
    expect(s.verify('bob@x.org', WRONG).error).toMatch(/401/);
  });

  it('answers 429 after 20 attempts for the same email in a day', () => {
    const s = setup();
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 10; i++) s.verify('ana@x.org', WRONG);
      s.advance(901);
    }

    expect(s.verify('ana@x.org', WRONG).error).toMatch(/429/);
    expect(s.verify('bob@x.org', WRONG).error).toMatch(/401/);
  });

  it('does not spend the daily budget on attempts the window limit rejected', () => {
    const s = setup();
    for (let i = 0; i < 15; i++) s.verify('ana@x.org', WRONG);
    s.advance(901);

    for (let i = 0; i < 10; i++) {
      expect(s.verify('ana@x.org', WRONG).error).toMatch(/401/);
    }
    expect(s.verify('ana@x.org', WRONG).error).toMatch(/429/);
  });

  it('applies a global cap across emails', () => {
    const s = setup();
    for (let i = 0; i < 200; i++) s.verify(`u${i}@x.org`, WRONG);

    expect(s.verify('bob@x.org', WRONG).error).toMatch(/429/);
  });
});

describe('OTP service internals', () => {
  function service(uuid: string, workMs = 0) {
    const env = loadApp({ realUuids: true });
    const sent: string[] = [];
    const sleeps: number[] = [];
    const clock = { now: 1_000_000 };
    const otp = env.app.createOtpService({
      cache: env.cache,
      hmac: (value: string) => `h(${value})`,
      uuid: () => uuid,
      now: () => clock.now,
      sleep: (ms: number) => {
        sleeps.push(ms);
        clock.now += ms;
      },
      isRespondent: (email: string) => {
        clock.now += workMs;
        return RESPONDENTS.has(email);
      },
      mailer: {
        hasQuota: () => true,
        sendOtp: (_to: string, code: string) => sent.push(code),
      },
      getLocale: () => 'en',
      logger: { error: () => undefined },
    });
    return { otp, sent, sleeps, clock };
  }

  it('skips the version and variant digits of the UUID', () => {
    const s = service('123456ab-cdef-4fff-8fff-0123456789ab');

    s.otp.request('ana@x.org');

    expect(s.sent).toEqual(['193046']);
  });

  it('rejects samples at or above 16,000,000', () => {
    // 0xf42400 = 16,000,000 is rejected; 0xf423ff = 15,999,999 is kept.
    const s = service('f42400f4-23ff-4fff-8fff-ffffffffffff');

    s.otp.request('ana@x.org');

    expect(s.sent).toEqual(['999999']);
  });

  it('rejects out-of-range samples before taking a later one', () => {
    const s = service('ffffffff-ffff-4fff-8fff-000001ffffff');

    s.otp.request('ana@x.org');

    expect(s.sent).toEqual(['000001']);
  });

  it('pads every request to the response time floor, known email or not', () => {
    const s = service('123456ab-cdef-4fff-8fff-0123456789ab');

    s.otp.request('ana@x.org');
    s.otp.request('zed@x.org');

    expect(s.sleeps).toEqual([2500, 2500]);
  });

  it('only sleeps the remainder, and not at all when already slower', () => {
    const fast = service('123456ab-cdef-4fff-8fff-0123456789ab', 1000);
    const slow = service('123456ab-cdef-4fff-8fff-0123456789ab', 3000);

    fast.otp.request('ana@x.org');
    slow.otp.request('ana@x.org');

    expect(fast.sleeps).toEqual([1500]);
    expect(slow.sleeps).toEqual([]);
  });

  it('pads every verification to the floor, with or without a live code', () => {
    const s = service('123456ab-cdef-4fff-8fff-0123456789ab');
    s.otp.request('ana@x.org');
    s.sleeps.length = 0;

    const live = s.otp.verify('ana@x.org', '000000');
    const none = s.otp.verify('zed@x.org', '000000');
    const right = s.otp.verify('ana@x.org', '193046');

    expect([live, none, right]).toEqual([false, false, true]);
    expect(s.sleeps).toEqual([2500, 2500, 2500]);
  });
});

describe('logging', () => {
  it('never contains the code, the token or the raw email', () => {
    const lines: string[] = [];
    const capture = (...args: unknown[]) => void lines.push(args.join(' '));
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (m) => vi.spyOn(console, m).mockImplementation(capture),
    );
    try {
      const s = setup();
      const token = s.login('ana@x.org');
      s.scores(token);
      s.verify('ana@x.org', WRONG);
      const failing = setup({ sendFails: true });
      failing.requestCode('ana@x.org');

      const output = lines.join('\n') + s.logged.join('\n');
      expect(lines.length).toBeGreaterThan(0);
      expect(output).not.toContain(token);
      expect(output).not.toContain('ana@x.org');
      expect(output).not.toMatch(/\b\d{6}\b/);
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });
});

describe('verifying a code', () => {
  it('issues a token for the right code', () => {
    const s = setup();
    s.requestCode('ana@x.org');

    const { response } = s.verify('ana@x.org', s.lastCode());

    expect(response?.data.token).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('is single-use', () => {
    const s = setup();
    s.requestCode('ana@x.org');
    const code = s.lastCode();
    s.verify('ana@x.org', code);

    expect(s.verify('ana@x.org', code).error).toMatch(/401/);
  });

  it('expires after 10 minutes', () => {
    const s = setup();
    s.requestCode('ana@x.org');
    s.advance(601);

    expect(s.verify('ana@x.org', s.lastCode()).error).toMatch(/401/);
  });

  it('invalidates the code after 5 wrong attempts', () => {
    const s = setup();
    s.requestCode('ana@x.org');
    const code = s.lastCode();
    const wrong = code === WRONG ? '111111' : WRONG;

    for (let i = 0; i < 5; i++) {
      expect(s.verify('ana@x.org', wrong).error).toMatch(/401/);
    }

    expect(s.verify('ana@x.org', code).error).toMatch(/401/);
    expect(s.cacheKeys().filter((k) => k.startsWith('otp:'))).toEqual([]);
  });

  it('still accepts the right code after fewer than 5 wrong attempts', () => {
    const s = setup();
    s.requestCode('ana@x.org');
    const code = s.lastCode();
    const wrong = code === WRONG ? '111111' : WRONG;
    for (let i = 0; i < 4; i++) s.verify('ana@x.org', wrong);

    expect(s.verify('ana@x.org', code).response?.data.token).toBeTruthy();
  });

  it('fails the same way for an unknown email and a malformed code', () => {
    const s = setup();
    s.requestCode('ana@x.org');

    expect(s.verify('zed@x.org', WRONG).error).toMatch(
      /Invalid or expired code/,
    );
    expect(s.verify('ana@x.org', 'abc').error).toMatch(
      /Invalid or expired code/,
    );
  });
});

describe('GET /api/me/scores', () => {
  it('returns the scores of the signed-in respondent', () => {
    const s = setup();
    const token = s.login('ana@x.org');

    const { response } = s.scores(token);

    expect(response?.data.email).toBe('ana@x.org');
    expect(s.lookups).toEqual(['ana@x.org']);
  });

  it('answers 401 without a token and with a forged one', () => {
    const s = setup();
    s.login('ana@x.org');

    expect(s.scores().error).toMatch(/401/);
    expect(s.scores('forged').error).toMatch(/401/);
    expect(s.lookups).toEqual([]);
  });

  it('answers 401 once the session expires', () => {
    const s = setup();
    const token = s.login('ana@x.org');
    s.advance(1801);

    expect(s.scores(token).error).toMatch(/401/);
  });

  it('never lets one respondent read another', () => {
    const s = setup();
    const ana = s.login('ana@x.org');
    s.login('bob@x.org');

    s.scores(ana);

    expect(s.lookups).toEqual(['ana@x.org']);
  });

  it('removed the unauthenticated lookup route', () => {
    expect(setup().scores().error).toMatch(/401/);
  });
});

describe('google.script.run surface', () => {
  it.each(['getOtpHmacKey', 'computeOtpHmac'])(
    'declares %s only as a private function',
    (name) => {
      expect(declaresGlobal(name)).toBe(false);
      expect(declaresGlobal(`${name}_`)).toBe(true);
    },
  );
});
