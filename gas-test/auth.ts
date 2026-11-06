/** A mail captured by the fake mailer. */
interface SentOtp {
  to: string;
  code: string;
}

/** Collaborators of the OTP service that the tests control. */
interface OtpHarness {
  otp: OtpService;
  sessions: SessionService;
  sent: SentOtp[];
  /** Moves the fake clock forward. */
  advance(ms: number): void;
}

/** Outcome of an RPC call: the envelope, whether it was returned or thrown. */
interface RpcResult {
  ok: boolean;
  status: number;
  data?: unknown;
}

/**
 * Builds the OTP and session services over the real `CacheService` and
 * `Utilities` HMAC, with a recording mailer and a controllable clock.
 * @param respondents Emails the app treats as respondents.
 */
function createOtpHarness(respondents: string[]): OtpHarness {
  const sent: SentOtp[] = [];
  let offset = 0;
  const cache = CacheService.getScriptCache();
  const deps = {
    cache,
    hmac: computeOtpHmac,
    uuid: () => Utilities.getUuid(),
    now: () => Date.now() + offset,
    sleep: () => undefined,
    isRespondent: (email: string) => respondents.indexOf(email) !== -1,
    mailer: {
      hasQuota: () => true,
      sendOtp: (to: string, code: string) => {
        sent.push({ to, code });
      },
    },
    getLocale: () => 'en',
    logger: { error: () => undefined },
  };
  return {
    otp: createOtpService(deps),
    sessions: createSessionService(deps),
    sent,
    advance: (ms) => {
      offset += ms;
    },
  };
}

/**
 * Returns a mailbox unique to this run, so cache entries never collide.
 */
function uniqueEmail(): string {
  return `${Utilities.getUuid().slice(0, 8)}@gas-test.example`;
}

/**
 * Returns a 6-digit code that differs from the given one.
 * @param code Code to avoid.
 */
function otherCode(code: string): string {
  return code === '000000' ? '000001' : '000000';
}

/**
 * Calls the web app the way the browser client does: `doGet`/`doPost` with a
 * simulated event. Failures arrive as a returned or a thrown envelope.
 * @param app Web app.
 * @param method HTTP method.
 * @param route Route, e.g. `/api/auth/otp`.
 * @param options Query parameters and body.
 */
function callRpc(
  app: GasWebApp,
  method: 'GET' | 'POST',
  route: string,
  options: { params?: Record<string, string>; body?: unknown } = {},
): RpcResult {
  const event: SimulatedEvent = {
    parameter: { ...options.params, route },
    ...(options.body === undefined
      ? {}
      : {
          postData: {
            contents: JSON.stringify(options.body),
            type: 'application/json',
          },
        }),
  };
  try {
    return (
      method === 'GET' ? app.doGet(event as never) : app.doPost(event as never)
    ) as RpcResult;
  } catch (err) {
    return JSON.parse(getErrorMessage(err)) as RpcResult;
  }
}

test('an OTP is issued, mailed once and consumed on verify', () => {
  const email = uniqueEmail();
  const { otp, sent } = createOtpHarness([email]);

  otp.request(email);

  assert(sent.length === 1, `one mail expected, got ${sent.length}`);
  const code = sent[0]!.code;
  assert(/^\d{6}$/.test(code), `the code must be 6 digits: ${code}`);
  assert(otp.verify(email, code), 'the right code must verify');
  assert(!otp.verify(email, code), 'the code is single-use');
});

test('an unknown email gets no mail and no code', () => {
  const { otp, sent } = createOtpHarness([]);
  const email = uniqueEmail();

  otp.request(email);

  assert(sent.length === 0, 'no mail may be sent to a non-respondent');
  assert(!otp.verify(email, '123456'), 'nothing may verify');
});

test('five wrong attempts invalidate the code', () => {
  const email = uniqueEmail();
  const { otp, sent } = createOtpHarness([email]);
  otp.request(email);
  const code = sent[0]!.code;

  for (let i = 0; i < 5; i++) {
    assert(!otp.verify(email, otherCode(code)), 'a wrong code must fail');
  }

  assert(!otp.verify(email, code), 'the right code must fail after 5 misses');
});

test('an OTP expires after its lifetime', () => {
  const email = uniqueEmail();
  const { otp, sent, advance } = createOtpHarness([email]);
  otp.request(email);

  advance(OTP_TTL_SECONDS * 1000 + 1000);

  assert(!otp.verify(email, sent[0]!.code), 'an expired code must fail');
});

test('a session token resolves to its email and a forged one does not', () => {
  const email = uniqueEmail();
  const { sessions } = createOtpHarness([email]);

  const token = sessions.create(email);

  assert(sessions.resolve(token) === email, 'the token must resolve');
  assert(sessions.resolve(Utilities.getUuid()) === null, 'forged token');
  assert(sessions.resolve('') === null, 'empty token');
});

test('the sign-in flow round-trips through the web app over RPC', () => {
  const email = uniqueEmail();
  const other = uniqueEmail();
  const harness = createOtpHarness([email, other]);
  const app = createWebApp(
    {
      getByUser: (userId) => ({
        email: userId,
        name: 'Test',
        alternatives: [],
        scores: [],
      }),
    },
    { otp: harness.otp, sessions: harness.sessions, hmac: computeOtpHmac },
  );

  const requested = callRpc(app, 'POST', '/api/auth/otp', {
    body: { email },
  });
  assert(requested.ok, 'the OTP request must succeed');
  assert(harness.sent.length === 1, 'the code must be mailed');

  const denied = callRpc(app, 'GET', '/api/me/scores');
  assert(!denied.ok && denied.status === 401, 'no token must give 401');

  const wrong = callRpc(app, 'POST', '/api/auth/verify', {
    body: { email, code: otherCode(harness.sent[0]!.code) },
  });
  assert(!wrong.ok && wrong.status === 401, 'a wrong code must give 401');

  const verified = callRpc(app, 'POST', '/api/auth/verify', {
    body: { email, code: harness.sent[0]!.code },
  });
  assert(verified.ok, 'the right code must verify');
  const token = (verified.data as { token: string }).token;

  const scores = callRpc(app, 'GET', '/api/me/scores', {
    params: { token },
  });
  assert(scores.ok, 'the token must open the scores');
  assert(
    (scores.data as UserScores).email === email,
    'only the signed-in respondent is served',
  );

  const forged = callRpc(app, 'GET', '/api/me/scores', {
    params: { token: Utilities.getUuid() },
  });
  assert(!forged.ok && forged.status === 401, 'a forged token must give 401');
});
