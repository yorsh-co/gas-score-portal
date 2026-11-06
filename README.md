# Score Portal

A Google Apps Script web app that syncs Google Forms scores to a spreadsheet and serves them to respondents.

## Testing

- `npm run check` runs formatting, lint, typecheck, the vitest suite (in-memory fakes) and the config check.
- `npm run test:gas:build` builds the Apps Script tests from `gas-test/` into one script, without running it.
- `npm run test:gas` runs them in real Apps Script. It needs a **dedicated** standalone test project: a run replaces the project's whole contents, so never use the dev script.
  1. Create the project and link it to a standard Google Cloud project.
  2. `clasp login --extra-scopes https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/script.storage,https://www.googleapis.com/auth/forms`
  3. Set `GAS_TEST_SCRIPT_ID` and `GAS_TEST_SPREADSHEET_ID` (see `.env.example`).

Tests create sheets named `__gt_<epochMs>_...` and delete them afterwards.
