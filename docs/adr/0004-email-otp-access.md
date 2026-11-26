# 4. Email one-time-code access

Date: 2026-11-06

## Status

Accepted

Amended 2026-11-26: per-email request cooldown and daily cap.

## Context

The legacy web app returned the scores of any respondent to anyone who knew
the respondent's email. The web app runs as the deploying user and accepts
anonymous access (`executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`), so
the platform cannot identify the visitor. The only secret a respondent has is
control of their mailbox.

## Decision

A respondent proves control of their mailbox with a one-time code.

- `POST /api/auth/otp {email}` always answers 200 with the same message. It
  mails a code only when the email is a respondent.
- The 6-digit code is drawn uniformly (rejection sampling) from
  `Utilities.getUuid()` entropy; `Math.random` is never used.
- Only `HMAC-SHA256(code, key)` is stored, in the script cache, for 10 minutes.
  The cache key is the HMAC of the email, so neither emails nor codes are
  stored in clear. The key is 32 random bytes from two UUIDs, created once
  under `GasLock` and kept in the Script Property `otp.hmacKey`. It is a
  secret and is not part of the gas-config settings.
- `POST /api/auth/verify {email, code}` compares in constant time, under the
  user lock, and allows 5 attempts before the code is invalidated. A valid
  code is deleted and a session token (UUID, 30 minutes, stored under its HMAC)
  is returned.
- `GET /api/me/scores?token=...` requires the token and returns only the
  scores of the session's respondent. The route `/api/users/:userId/scores`
  is removed.
- Every `/otp` response takes at least 2,500 ms (`OTP_MIN_RESPONSE_MS`),
  measured from the start of the request, for respondents and non-respondents
  alike. Every verification takes at least 2,500 ms (`VERIFY_MIN_RESPONSE_MS`)
  by the same mechanism, whether or not a code is live.
- `POST /api/auth/otp` is also limited to one request per email every 60
  seconds and to 5 per email per day, on top of the 15 minute limits (see
  "Request cooldown and daily cap").
- `POST /api/auth/verify` is rate limited to 10 attempts per email and 200
  across all emails per 15 minutes, and to 20 attempts per email per day
  (86,400 s window, keyed by the HMAC of the normalized email). The daily
  limiter runs after the 15 minute ones, so rejected attempts do not use the
  daily budget.
- The rate limiters and the OTP read-modify-write use the `user` lock, not the
  `script` lock. `RespondentScoreSynchronizer` holds the `script` lock for a
  whole sync, which would stall every sign-in. Under
  `executeAs: USER_DEPLOYING` every visitor runs as the deploying user, so the
  `user` lock is still global across visitors and keeps the counters correct.
- Logs never contain codes or tokens: the request logger masks the library
  default keys plus `code`, the body is never logged, and emails are masked.

## Threat model

- **Enumeration.** The request route answers identically for known and unknown
  emails, with the same status and message, and counts toward the rate limit
  in both cases. Verification fails with the same message for an unknown
  email, a wrong code and an expired code. The mail quota check runs before
  the respondent lookup, so an exhausted quota looks the same for every email.
  A failed send is logged at `error` with a masked email, the previous
  entry is restored (with its remaining lifetime, so its failed attempts are
  kept) or removed when there was none, and the same 200 response is returned.
- **Timing.** The response floor hides the cost of a send, and the verify
  floor hides whether a code was live. Residual risk: a send or a lock wait
  slower than the floor still makes that response stand out.
- **Brute force.** A code has 10^6 values, 5 attempts and a 10 minute life.
  Issuing a new code carries over the failed attempts of the pending one, but
  still voids the live code. Requests are limited to 3 per email per 15
  minutes and verifications to 10 per email per 15 minutes, so a guess budget
  of at most 10 per email per window: a success chance of about 0.001% per
  window (10 in 10^6). Without a daily cap, 96 windows a day would allow 960
  guesses, about 0.1% per day and roughly 30% over a year of sustained
  attack. Requests are also limited to 1 per 60 seconds and 5 per day per
  email, which bounds the codes issued, and so the sends, to 5 a day (at
  most 20 if the daily counter lapses after 6 hours idle). The daily cap of
  20 per email bounds it to 20 guesses a day: about
  0.002% per day and about 0.7% over a year. Cache entries live at most 6
  hours (`CacheService` limit), so a counter can lapse after 6 hours without
  attempts; in that worst case the cap is 20 per 6 hours, at most 80 guesses
  a day (about 0.008%). A global cap of 50 requests per 15 minutes bounds the mail volume and
  the lock contention.
- **Denial of service.** The global cap is also a weakness: 50 requests lock
  everyone out of requesting a code for the rest of the window (200 requests
  for verification). The per-email limit lets anyone block a given
  respondent's sign-in the same way, and the daily request cap lets an
  attacker keep one respondent from requesting a code for up to a day. Fixed
  windows also allow up to 2x the limit across a window boundary. These
  trade-offs are accepted.
- **Replay.** A code is deleted on success and on the fifth failure. A session
  token is a random UUID, kept only as an HMAC, and expires after 30 minutes
  without renewal. Tokens travel in the query string of a `google.script.run`
  call and are redacted from logs.
- **Mail quota.** `MailApp` allows 100 recipients a day on consumer accounts
  and 1,500 on Google Workspace (`MailApp.getRemainingDailyQuota()`). Each code
  uses one. When the quota is exhausted, the failure is logged at `error` and the
  user sees a generic "try later" message (503). A failed send is logged and
  answered like a success.
- **Mailbox compromise.** Out of scope: whoever reads the mailbox can sign in.

## Request cooldown and daily cap (2026-11-26)

Flooding one inbox with codes gets the sending account flagged as a spammer,
so `POST /api/auth/otp` limits each email to one request every 60 seconds and
5 per day, besides the 3 per 15 minutes per email and 50 per 15 minutes global
limits.

- The middleware order is `validateEmail`, global limit, email limit,
  cooldown, daily limit. The daily limiter runs last, so requests rejected by
  the cooldown or the window limits do not use the daily budget.
- Both apply before the respondent lookup, so an unknown email is rejected
  exactly like a respondent and the enumeration guarantee holds.
- The cooldown is not a fixed-window limiter, which would let two sends go
  out about a second apart across a bucket boundary. It stores the time the
  block ends in the script cache (60 s TTL) under the `user` lock, so it is
  measured from the last allowed request. It is set when a request passes it,
  even if a later limiter rejects the request or the send fails.
- The daily cap reuses the rate limiter with an 86,400 s window. As for the
  verify daily cap, `CacheService` limits the TTL to 6 hours, so a counter idle
  for 6 hours lapses: the worst case is 5 per 6 hours, at most 20 a day.
- Keys are `otp:cooldown:HMAC(limit:<email>)` and `otp:daily:HMAC(limit:<email>)`,
  so no clear email is stored.

## Key exposure (2026-11-15)

Until this fix, `getOtpHmacKey` and `computeOtpHmac` were public Apps Script
globals. The web app runs as the deployer for anonymous visitors, so any
visitor could call them through `google.script.run`. Every deployed version up
to this fix exposed both.

- **What was exposed.** The key itself, through `getOtpHmacKey`, which also
  created the key on first call. An HMAC oracle, through `computeOtpHmac`.
- **What the key derives.** The OTP cache key `otp:HMAC(email:<e>)`, the stored
  `codeHmac = HMAC(code)`, the session cache key `session:HMAC(token:<t>)` and
  the rate-limit keys `<prefix>:HMAC(limit:<e>)` (`src/webapp/routes.ts`).
- **OTP forgery.** Not possible with the key alone: verification compares
  against the `codeHmac` stored in `CacheService`, and no public function read
  or wrote that cache (`CacheService` is only used in `createAuthServices`,
  which needs function arguments that `google.script.run` cannot send). But
  with any cache read, the key lets an attacker compute a victim's OTP cache
  key and invert the 6-digit `codeHmac` offline in at most 10^6 HMACs. That
  recovers the live code and takes over the account. The key was the only
  protection for codes at rest.
- **Session forgery.** Not possible: tokens are random UUIDs (122 bits) kept
  only as an HMAC. The key does not help produce one without a cache write, and
  the HMAC cannot be inverted.
- **Rate limits.** The key lets an attacker compute counter keys, which is
  harmless without a cache write.
- **Conclusion.** Treat the key as compromised and rotate it after every
  deployment serves the fixed code, as described in
  [OTP key rotation](../../README.md#otp-key-rotation).

## Consequences

- The manifest gains the `script.send_mail` scope.
- Sign-ins per day are capped by the mail quota.
- Sessions are not renewable and there is no server-side logout; the token expires.
- Sign-out is client-side only: the page forgets the token, but the server does
  not revoke it. A token copied before sign-out stays valid until its 30-minute
  server TTL.
- The content of the code email is decided in [ADR 9](0009-otp-email-content.md).
