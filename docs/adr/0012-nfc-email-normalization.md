# 12. NFC email normalization

Date: 2026-11-15

## Status

Accepted. Supersedes the normalization rule of [0011](0011-typed-respondent-emails.md).

## Context

ADR 0011 normalizes emails by trimming and lowercasing. A precomposed
`joão@x.org` (U+00E3) and a decomposed `joão@x.org` (`a` + U+0303)
render the same but are different strings, so they became two identities at
ingest and at sign-in.

## Decision

`normalizeEmail_` also applies Unicode NFC normalization:
`trim().toLowerCase().normalize('NFC')`. Lowercasing runs before NFC so the
result is idempotent: lowercasing can produce sequences that NFC composes
further. Ingest, the repositories, OTP issue
and check, and the auth middleware share this function, so sign-in and ingest
stay identical. The repositories normalize the stored cell before they compare,
so rows stored in another form still match.

## Consequences

- No data migration. Rows are rewritten in NFC only when they are next written.
- If a form already holds both an NFC row and an NFD row for one person, they
  collapse into one key in `getByForm`, and `updateWhere` updates both rows.
  This is accepted.
- NFKC was rejected. It folds compatibility characters (for example fullwidth
  letters) and changes more than this fix calls for.
