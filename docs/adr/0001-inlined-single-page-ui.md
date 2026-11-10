# 1. Inlined single-page UI

Date: 2026-11-06

## Status

Accepted

Amended 2026-11-10: tool names updated for gasdev 3.0 (gasdev ADRs 0018, 0019); the decision is unchanged.

## Context

The legacy web app rendered HTML on the server: a hand-rolled framework
composed layouts, views and partials from an HtmlService template tree, and the
page called the API through `google.script.run`. gas-webapp serves JSON and
text through `res.send` and `res.json`; it does not return an `HtmlOutput` as a
routed response, so the template tree has no place to render from.

## Decision

The UI is one single-page app, edited as `src/web/portal.html`,
`portal.css` and `portal.ts`, with the gas-webapp browser client vendored in
`src/web/vendor/gas-webapp/`.

- `gasdev html` inlines the page, its stylesheet and its scripts
  (TypeScript is transpiled) into `src/generated/portal.html.ts`, a single
  string constant `_PORTAL_HTML` that is committed and listed in `loadOrder`.
- `doGet` serves it with `HtmlService.createHtmlOutput` when the request has no
  `route` parameter, taking the title and favicon from the settings. Every
  other request goes to `app.doGet` and `app.doPost`.
- The page calls the API over `google.script.run` through the client's
  `GasWebApp.api`.
- `build:frontend` type-checks the page with `tsconfig.frontend.json` and
  regenerates the constant; `npm run check` fails when the constant is stale.

## Consequences

- No server-side templating: the page is static and the data comes from API
  routes, which the OTP flow later protects.
- One generated Apps Script source replaces the tree of `.html` partials.
- The generated file must be committed and regenerated after each UI change.
- `url(...)` in the stylesheet is not rewritten, so assets must be absolute
  URLs or `data:` URIs.
