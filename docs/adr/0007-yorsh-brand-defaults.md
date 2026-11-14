# 7. Yorsh brand defaults and overrides

Date: 2026-11-14

## Status

Accepted

## Context

The portal shipped with a generic indigo identity and system fonts. It now
carries the Yorsh identity by default, while owners can still adapt it from
the settings dialog.

## Decision

- Colour overrides: `primaryColor` overrides copper (`--accent`, the primary
  button) and `--accent-strong` is derived as
  `color-mix(in srgb, <c> 85%, black)`. The new `secondaryColor` overrides
  petrol (`--brand`: links, focus ring). Each setting is one
  hex code used in both light and dark; empty keeps the Yorsh `light-dark()`
  pair. Contrast of an override is the owner's responsibility, as the setting
  description says.
- Fonts: Space Grotesk and DM Sans (OFL 1.1) are inlined as base64 woff2 in a
  generated `src/web/portal.fonts.css`, as gas-config ADR 0001 does. There are
  no third-party font requests. This adds about 80 KB to the page.
- Default mark: the Yorsh mark, Light variant in light mode and Dark variant in
  dark mode (`<picture>` with `prefers-color-scheme`). The default
  `faviconUrl` is `https://yorsh.co/assets/icon/favicon-32x32.png`, because
  the Apps Script tab icon only comes from `HtmlOutput.setFaviconUrl` and
  needs a hosted URL.
- Layout and copy are unchanged; only tokens and components change. There is
  no theme toggle: the page follows the OS colour scheme.
- The gas-config settings dialog keeps the default `workspace` theme.

## Consequences

- An owner-chosen colour with poor contrast is not caught by the app.
- The tab icon depends on yorsh.co being reachable unless `faviconUrl` is
  overridden.
- The fonts make the page heavier and must be regenerated if they change.
