# 6. Client error reporting

Date: 2026-11-13

## Status

Accepted

## Context

Browser errors in the portal never reach a server log, so failures such as a
timed-out call or a script error are invisible. The page reports errors before
sign-in, and the web app accepts anonymous access (`executeAs: USER_DEPLOYING`,
`access: ANYONE_ANONYMOUS`, ADR 0004), so a report has no session and no
`req.user`.

## Decision

- `POST /api/client-errors` is mounted in the API router without
  authentication and handled by gas-webapp's `createClientErrorHandler`. It
  answers 202 `{received: true}`. The handler keeps the library default field
  caps and drops unknown keys.
- One global rate limit bucket (`client-errors:global`) allows 30 reports per
  60 s, using `createRateLimiter` with the `user` lock like the auth limiters.
  Apps Script exposes no client IP and there is no user, so a per-visitor key
  is impossible. Every report is an `error` line and `sheetLevel: 'error'`
  writes it to the log sheet, so the limit also bounds sheet growth.
- The handler gets the email-redacting logger (module `client`), so emails in
  a message, stack, URL or context are masked like request paths are. The
  logger also masks the log message, which embeds the client's `scope`, and
  serialises and masks objects nested past its depth limit, so untrusted
  `context` cannot bypass the masking.
- The handler logs the client's text as `clientMessage`, and the log message
  is `Client error: <scope>`. gas-logger overwrites a `message` field in the
  metadata, so this needs gas-webapp 1.1.3 or later; 1.1.2 lost the text.
- The logger is unbuffered, so the handler's optional `flush()` is not needed.
- The client caps itself at 10 reports per page load and dedupes for 60 s. It
  forwards only client-minted failures, because the server already logs its
  own errors.
- gas-chat alerts are not adopted: they need the `script.external_request`
  scope and a webhook.

## Consequences

- Anyone can write error lines to the log, up to 30 a minute. A flood can
  exhaust the budget and drop genuine reports, and fixed windows allow up to
  2x the limit across a boundary. This trade-off is accepted.
- Reported content is untrusted. The handler truncates and drops unknown
  keys, and the logger writes structured fields, not raw lines.
- Redaction covers emails only; other personal data typed into an error
  message would be logged.
