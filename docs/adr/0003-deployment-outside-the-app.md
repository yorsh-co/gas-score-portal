# 3. Deployment outside the app

Date: 2026-11-06

## Status

Accepted

## Context

The legacy app deployed itself. A `WebAppDeployer` class called the Apps Script
API through the `AppsScript` library (`1rNkf…`), created versions and
deployments, and stored the deployment ID and URL in the configuration sheet.
Menu items triggered it. This required the sensitive `script.projects` and
`script.deployments` scopes, and a user had to consent to a script able to
rewrite its own code and access.

## Decision

The app no longer deploys itself.

- `WebAppDeployer`, the `AppsScript` library dependency, the Deploy and
  Install-webapp menu items and the two scopes are removed from the code and
  from both manifests.
- The first deployment is made once by `gas-dev-deploy` (`npm run deploy:setup`).
- Later deployments are made by the shared `gas-dev-ci` workflow on every push
  to `develop` and `main`.
- The deployment ID and web app URL are no longer stored in the settings.

## Consequences

- The script asks for fewer, less sensitive permissions. Users consenting to
  the container-bound script no longer grant control over the project itself.
- Deploying needs a developer machine or CI with `clasp` credentials, not
  the spreadsheet owner's browser.
- A change of `oauthScopes` still requires a manual re-consent deployment.
- Existing installations keep working: the removed settings are ignored.
