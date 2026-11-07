# 5. CI/CD through gas-dev-ci

Date: 2026-11-06

## Status

Accepted

## Context

ADR 0003 moved deployment out of the app. The first deployment is interactive
(`gas-dev-ci setup`), but every later push to `develop` or `main` should be
checked, built and pushed to Apps Script without manual steps.

Deploy automation could live in the setup wizard, but that is an
interactive web-app flow, and not every gas-\* project has a web app
(libraries and sheet- or form-bound scripts only need `clasp push`).

## Decision

CI/CD lives in a new shared repository, `yorsh-co/gas-dev-ci`.

- A reusable workflow, `.github/workflows/gas-deploy.yml` (`workflow_call`),
  runs checkout, `npm ci`, `npm run check`, `npm run build`, then
  `npx gas-dev-ci deploy`.
- The `gas-dev-ci deploy` CLI writes the clasp credentials and `.clasp.json`
  from environment secrets, runs `clasp push --force`, and, only when a
  deployment ID is configured, creates a version and updates that deployment.
- This repository calls the workflow from `.github/workflows/deploy.yml`:
  `develop` deploys to the `dev` GitHub environment, `main` to `live`. Each
  environment holds its own secret `CLASPRC_JSON` and the variables
  `GAS_SCRIPT_ID` and optional `GAS_DEPLOYMENT_ID`. The IDs are variables, not
  secrets, because GitHub drops job outputs that contain secrets and the web-app
  URL contains the deployment ID.
- The CLI is installed as a devDependency because the workflow runs
  `npx --no-install`.
- The CLI fails when the pushed manifest's `oauthScopes` differ from the
  deployed version's, because a scope change needs a manual re-consent
  deployment (gas-dev-ci ADR 0004).
- Builds run from source; CI does not depend on `gas-dev-release`.

## Consequences

- One implementation serves every gas-\* project, versioned through moving minor tags (`@v0.2` while pre-1.0).
- `CLASPRC_JSON` is a long-lived user credential stored as a GitHub secret.
  Refresh tokens can expire or be revoked, so deploys can start failing until
  the secret is renewed with `clasp login`.
- The `live` environment only exists after `npm run deploy:setup` is run on
  the live spreadsheet copy.
