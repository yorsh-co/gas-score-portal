# 5. CI/CD through gas-dev-ci

Date: 2026-11-06

## Status

Accepted

## Context

ADR 0003 moved deployment out of the app. The first deployment is interactive
(`gas-dev-deploy`), but every later push to `develop` or `main` should be
checked, built and pushed to Apps Script without manual steps.

Deploy automation could live in `gas-dev-deploy`, but that project is an
interactive web-app setup wizard, and not every gas-\* project has a web app
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
  environment holds its own `CLASPRC_JSON`, `GAS_SCRIPT_ID` and optional
  `GAS_DEPLOYMENT_ID`.
- The CLI fails when the pushed manifest's `oauthScopes` differ from the
  deployed version's, because a scope change needs a manual re-consent
  deployment (gas-dev-deploy ADR 0001).
- Builds run from source; CI does not depend on `gas-dev-release`.

## Consequences

- One implementation serves every gas-\* project, versioned through tags (`@v1`).
- `CLASPRC_JSON` is a long-lived user credential stored as a GitHub secret.
  Refresh tokens can expire or be revoked, so deploys can start failing until
  the secret is renewed with `clasp login`.
- The `live` environment only exists after `npm run deploy:setup` is run on
  the live spreadsheet copy.
- The caller workflow can only be added once `gas-dev-ci` v1 is released.
