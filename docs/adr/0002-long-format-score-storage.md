# 2. Long-format score storage

Date: 2026-11-06

## Status

Accepted

## Context

Scores lived in a wide matrix sheet: one row per respondent, one column per
form, with form metadata in header rows. Every new form inserted a column,
lookups relied on fixed row and column numbers, and the sheet could not be
queried or validated as data.

## Decision

Store data in three gas-sheetdb tables, one record per fact:

- `Forms(url, title, maxPoints, status, syncedAt, error)`
- `Respondents(email, name, alternatives)`
- `Scores(email, formUrl, score, updatedAt)`

Table sheet names stay in English; only the UI is localized. Emails are
normalized (trimmed, lowercased) on write and on lookup.

A read-only `Overview` sheet keeps the people-friendly matrix. It is a single
`QUERY ... pivot` formula over `Scores`, joined to `Forms` titles and
`Respondents` names with `VLOOKUP`, behind a warning-only protection. It holds
no data, so it can be regenerated at any time.

Repositories (`src/infra/db`) wrap the tables and take the table as a
parameter, so tests run against an in-memory fake. Score writes are
differential: only new or changed scores are written, as one `updateWhere` and
one `insertMany` per form, under the script lock. An empty cell means "no
score"; `0` is a real score and is preserved.

`migrateLegacySheets()` copies the legacy `💯 Notas` and `🟪 Forms` sheets into
the tables, never overwriting rows that exist, then renames the legacy sheets
with a `LEGACY ` prefix. They are never deleted. After the rename a rerun finds
nothing to migrate.

## Consequences

- Adding a form adds rows, not columns; lookups no longer depend on layout.
- A respondent's scores are one filtered read, which suits the per-user API.
- The matrix is no longer editable by hand; edits go through the tables.
- Each table read is a full-sheet read, which is acceptable at the expected
  size (hundreds of respondents, tens of forms).
