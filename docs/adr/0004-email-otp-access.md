# 4. Email one-time-code access

Date: 2026-11-06

## Status

Accepted

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
  alike.
- `POST /api/auth/verify` is rate limited to 10 attempts per email and 200
  across all emails per 15 minutes.
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
  A failed send is logged at `error` with a masked email, the pending code is
  removed, and the same 200 response is returned.
- **Timing.** The response floor hides the cost of a send. Residual risk: a
  send slower than the floor still makes that response stand out.
- **Brute force.** A code has 10^6 values, 5 attempts and a 10 minute life.
  Issuing a new code carries over the failed attempts of the pending one, but
  still voids the live code. Requests are limited to 3 per email per 15
  minutes and verifications to 10 per email per 15 minutes, so a guess budget
  of at most 10 per email per window: a success chance of about 0.001% per
  window. A global cap of 50 requests per 15 minutes bounds the mail volume and
  the lock contention.
- **Denial of service.** The global cap is also a weakness: 50 requests lock
  everyone out of requesting a code for the rest of the window (200 requests
  for verification). The per-email limit lets anyone block a given
  respondent's sign-in the same way. Fixed windows also allow up to 2x the
  limit across a window boundary. These trade-offs are accepted.
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

## Consequences

- The manifest gains the `script.send_mail` scope.
- Sign-ins per day are capped by the mail quota.
- Sessions are not renewable and there is no logout; the token simply expires.
