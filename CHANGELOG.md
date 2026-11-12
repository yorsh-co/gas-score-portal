# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Migrated the toolchain to `gasdev` 3.0 (`3.0.0`), which replaces `gas-dev-config`, `gas-dev-bundle`, `gas-dev-release` and `gas-dev-ci`: the `package.json` settings are nested under the `gasdev` key, the scripts call `gasdev` (`deploy:setup` runs `gasdev setup`), the deploy workflow calls `yorsh-co/gasdev@v3.0.0`, and Node.js `^22.15.0` is required.

### Added

- Deploy workflow calling the shared `gas-dev-ci` reusable workflow: `develop` deploys to `dev`, `main` to `live`.
- `gas-dev-ci` CLI as a devDependency, run by the deploy workflow.
- Tooling scaffold: TypeScript, ESLint, Prettier, Vitest and the gas-dev-\* toolchain.
- Build pipeline: `scripts/build.js` cleans `dist/`, compiles `src/` with tsc, inlines the web UI, and copies HTML assets and `appsscript.json`; supports `--watch`. The web UI sources under `src/web/` are inlined only and not copied as pages.
- Bundled gas-\* libraries in `src/lib/gas-libraries.js`, copied verbatim to `dist/lib/`, with typings in `types/gas-libraries.d.ts`.
- `gas-logger`, `gas-config`, `gas-error` and `gas-lock` for logging, settings, errors and locking. Warnings and errors go to the execution log; only errors are written to the `Log` sheet.
- `gas-config` settings in Script Properties, edited in a settings dialog and restricted to the owner and editors of the spreadsheet. They replace the `Config` sheet: language, portal title, favicon, Drive folder, Forms title and content filters, and excluded Forms.
- `gas-sheetdb` tables `Forms`, `Respondents` and `Scores` (long-format scores, ADR 0002), a read-only `Overview` sheet with the score matrix, created on install, and a migration of the legacy `Notas` and `Forms` sheets, which are renamed with a `LEGACY ` prefix and never deleted.
- Score synchronization in TypeScript: it runs under the script lock, reads each form's scores once and continues in a new execution through a URL-based continuation when the time runs out.
- `gas-webapp` portal: a routed web app with an inlined single-page UI (ADR 0001), the `/api/users/:userId/scores` route, and an acknowledgement tracker on `/ack`. Respondent emails are masked in the logs. The vendored gas-webapp browser client is included.
- `gas-test` suites that run in Apps Script (`npm run test:gas:build`, `npm run test:gas`), alongside the Vitest unit tests.
- English and Brazilian Portuguese (`pt-BR`) message catalogue for the menu, toasts and web app, selected by the new `locale` setting.
- `GET /api/meta` route that serves the locale, portal title and brand to the web app.
- Brand settings `portalTitle`, `primaryColor` and `logoUrl`, and `formTitleStripPatterns`, a list of case-insensitive regular expressions removed from the Form titles. Invalid patterns are rejected when saving.
- Neutral Score Portal web UI with dark mode.
- MIT licence.
- `.clasp.example.json` pins `core/logger.js` after the library bundle in `filePushOrder`, because clasp loads the other files alphabetically.
- Email one-time-code sign-in (`POST /api/auth/otp`, `POST /api/auth/verify`), `GET /api/me/scores` for the signed-in respondent, and the portal email-and-code flow. Requests and verifications are rate limited per email and globally, and verifications also per email per day (ADR 0004).

### Changed

- **BREAKING:** the manifest adds the `script.send_mail` OAuth scope to mail the codes, so owners must re-authorize the script after updating.
- Domain, Drive/Forms discovery, Forms importer, score synchronizer, triggers and utilities migrated to strict TypeScript.
- A failing form no longer stalls the synchronization: its error is stored as the form status and the next form is processed.
- `menuSystemReset` clears the `Forms`, `Respondents` and `Scores` tables instead of restoring template sheets.
- The Drive folder prompted during an import is saved in the settings.
- `excludedFormUrls` is newline-separated.
- The scores lookup answers 404 for an unknown respondent.
- Alternative emails of a respondent are matched exactly (separated by commas, semicolons or whitespace) instead of by substring.
- The web app is created on first request, so that file load order does not matter.
- Project renamed to gas-app-score-portal.
- Legacy sources moved under `src/`; legacy HTML docs moved to `docs/legacy/`.

### Fixed

- The portal's average score now uses the same 10-point scale as each row. It summed raw points, so forms worth more than 10 points could push it past 10.
- Portal buttons use the page font, and "Not answered" no longer hyphenates in the score column.

### Removed

- **BREAKING:** the unauthenticated `/api/users/:userId/scores` route. Use `GET /api/me/scores` with a session token.
- `WebAppDeployer`, the `AppsScript` library and the deploy menu items; deployment is handled outside the app (ADR 0003).
- The `script.projects`, `script.deployments` and `script.external_request` OAuth scopes.
- The legacy framework and client.
- The `Config` sheet, replaced by the `gas-config` settings.
- Unused legacy utilities: `csvDb`, `arrayUtils`, `dateUtils`, `objectUtils`, `timedLoopToggle`, the unused trigger installers and `src/config/Sheets.js`.
- `docs/legacy/`, the legacy HTML docs.
- The hard-coded Form title clean-up. **Upgrade note:** set `formTitleStripPatterns` to keep a clean-up; see "Upgrading from the legacy app" in the README.
- `.claspignore`, replaced by `.clasp.json` with `rootDir: dist`.

### Security

- Access to scores now requires proof of mailbox control through a one-time code. See [ADR 0004](docs/adr/0004-email-otp-access.md) for the threat model, rate limits and residual risks.
