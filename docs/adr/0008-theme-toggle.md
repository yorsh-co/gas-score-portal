# 8. Light/Dark theme toggle

Date: 2026-11-14

## Status

Accepted

## Context

[ADR 0007](0007-yorsh-brand-defaults.md) decided that the portal only follows
the OS colour scheme. Users asked to pick a theme regardless of the OS.

## Decision

- Two states, Light and Dark. With no stored choice the page follows the OS
  exactly as before and no `data-theme` attribute is set.
- Clicking the toggle stores the explicit choice in `localStorage`
  (`scorePortal.theme`) and sets `data-theme` on `:root`. Storage access is
  wrapped in try/catch, as the Apps Script iframe may block it.
- The theme is applied through `color-scheme` per `:root[data-theme]`. All
  tokens already use `light-dark()`, so none is duplicated.
- The `<picture>` dark logo source uses a `prefers-color-scheme` media query
  that ignores the toggle. While a theme is explicit, its `media` is set to
  `all` or `not all`; with no choice it returns to the OS query. A brand
  `logoUrl` override removes the source and keeps working.

## Consequences

- The choice is per browser.
- When storage is blocked, the choice lasts for the page only.
- The tab favicon still follows the OS, as it is a static `<link>` media query.
