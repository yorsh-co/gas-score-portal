# 11. Typed respondent emails

Date: 2026-11-15

## Status

Accepted. Normalization superseded by [0012](0012-nfc-email-normalization.md).
Accepted emails narrowed by [0013](0013-reject-malformed-respondent-emails.md).

## Context

`getRespondentEmail` takes the respondent address from Google's respondent
email, then falls back to a free-text "email" question. Depending on the Form
setting, Google's address is either verified ("Verified") or typed by the
respondent ("Responder input"). The sync keys the scores by that address, and
the OTP portal treats the same address as the identity that may read them.

OTP sign-in proves that the reader owns the inbox. It does not prove who wrote
the scores. A submitter can type any address on the Form, so they can plant or
overwrite scores under it (security findings F5 and F6).

## Decision

Accept typed emails ("Responder input" and the free-text fallback), so
respondents do not need a Google account. Ingest normalizes the address only by
trimming and lowercasing, the same as sign-in (`normalizeEmail_`), so one
address maps to one identity.

## Rejected alternative

Accept only verified emails, read through the Forms REST API
`settings.emailCollectionType`. It needs the `script.external_request` and
`forms.body.readonly` scopes and would exclude respondents without Google
accounts. `collectsEmail()` cannot tell "Verified" from "Responder input".

## Consequences

- Any submitter can plant or overwrite scores under an address they type
  (F5 and F6). This risk is accepted.
- OTP gates reading, not writing.
- Form owners should choose "Verified" email collection when every respondent
  has a Google account.
- Rows stored under an address that the old normalization stripped are not
  migrated.
