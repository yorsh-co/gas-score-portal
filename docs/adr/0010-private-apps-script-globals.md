# 10. Private Apps Script globals

Date: 2026-11-15

## Status

Accepted

## Context

The web app runs with `executeAs: USER_DEPLOYING` and `access: ANYONE_ANONYMOUS`.
Apps Script exposes every top-level function whose name has no trailing `_` to
`google.script.run`, the editor Run menu and library consumers. Any visitor can
therefore call each of them, and the call runs as the deployer. Most helpers
were harmless only because `google.script.run` cannot pass functions, which is
an accident rather than a design. `getOtpHmacKey` and `computeOtpHmac` were not
harmless.

## Decision

Everything is private by default: top-level functions end with `_`, which
Apps Script hides from `google.script.run`, the Run menu and libraries. The
code already used the convention (`resolveConfigEditors_`).

The public surface is an allowlist:

- `doGet`, `doPost`: web app entry points.
- `GasConfigRpc`: bundled library RPC, with its own authorization.
- `onOpen`: simple trigger that builds the menu.
- `menuSettings`, `menuInstall`, `menuUninstall`, `menuSystemReset`,
  `menuImportDriveForms`, `menuLinkNewForm`, `menuRemoveForms`: menu handlers,
  addressed by name from the menu.
- `timedSyncScores`, `continueSyncScores`: trigger handlers, addressed by name.
- `seedDemoData`, `clearDemoData`, `migrateLegacySheets`: run from the editor
  or `clasp run`.
- `t`, `resolveLocale`: compiled into both the server and the portal client,
  and pure lookups of strings the page already shows.

The menu handlers and the editor-run functions call the shared guard in
`src/core/caller.ts` (`assertCallerEffectiveUser_`) first. The others do not:
`doGet` and `doPost` authenticate through the web app router; `GasConfigRpc`
authorizes its own callers; `timedSyncScores` and `continueSyncScores` accept
only their own project trigger (`timedSyncScores` also accepts a call through
`isCallerEffectiveUser_`); `t` and `resolveLocale` are pure lookups. `onOpen`
has no guard: as a simple trigger it can run with a blank active user, so a
guard would hide the menu from legitimate editors. Called from the web app, it
fails at `SpreadsheetApp.getUi()` before any side effect.

`refreshOverview`, `saveConfigValues`, `saveExcludedFormUrls` and
`saveDriveFolderUrl` are private and unguarded: nothing outside the script
calls them, and the scheduled sync calls `saveDriveFolderUrl` where a guard
would change behaviour. `installTriggers` is private and keeps its guard.

## Rejected alternative

`const` namespaces (for example `const Auth = { ... }`) would hide the
functions too, but they restructure every file and the test harness for the same
result, and the codebase already uses the trailing underscore.

## Consequences

- Private functions no longer appear in the editor Run menu.
- A new public function needs an allowlist entry, enforced at build time.
- The shared guard is mandatory for each public entry point.
