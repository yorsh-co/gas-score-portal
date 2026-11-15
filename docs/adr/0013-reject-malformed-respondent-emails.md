# 13. Reject malformed respondent emails

Date: 2026-11-15

## Status

Accepted. Narrows [0011](0011-typed-respondent-emails.md).

## Context

ADR 0011 accepts any non-blank typed email. A respondent who types
`E-mail não fornecido (<another response's ID>)` produces exactly the
placeholder key of that other response, so both share one key and the typed one
overwrites the other's score.

## Decision

Ingest keeps a collected or typed email only if `isValidEmail_` accepts it, the
same check as sign-in. Otherwise it moves to the next source and finally to the
per-response placeholder.

## Consequences

- Malformed submissions are stored under their own placeholder, not lost.
- Rows already stored under malformed keys are not migrated.
- Several responses with the same malformed answer (e.g. two people typing `ana`) no longer collapse into one row under `multipleResponsesPerUser`; each gets its own placeholder row.
- Typing a valid address remains accepted (F5 and F6 in 0011).
