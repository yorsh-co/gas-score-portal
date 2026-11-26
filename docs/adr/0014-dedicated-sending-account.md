# 14. Dedicated sending account

Date: 2026-11-26

## Status

Accepted.

## Context

The web app runs with `executeAs: USER_DEPLOYING`, so `MailApp` sends every access code as the account that owns the deployment. That is the account whose clasp credentials run `npm run deploy:setup` and the CI deploys (`CLASPRC_JSON`, [ADR 3](0003-deployment-outside-the-app.md)). Spam reports and bounces build up against that account and its domain.

`MailApp` allows 100 recipients per day on consumer accounts and 1,500 per day on Workspace.

Alternatives considered:

- Transactional APIs through `UrlFetchApp` (Brevo, Resend, Mailjet, SMTP2GO, Amazon SES). All need an owned domain with SPF, DKIM and DMARC for good delivery, the `script.external_request` scope, an API key in Script Properties, and passing respondent emails to a third party. Free-tier limits change often.
- Skipping email through `Session.getActiveUser()`. It only works inside a single Workspace domain.

## Decision

Keep `MailApp` and deploy from a dedicated account used only for this portal. Revisit a transactional API if the portal outgrows the quota or gets an owned sending domain.

## Risks

- **Reputation is only partly isolated.** On a Workspace user of your domain, spam reports still hurt the domain's reputation. Only a separate domain or a consumer account isolates it fully. Gmail also scores content and the Apps Script sending infrastructure. Mitigation: the per-email cooldown and daily cap ([ADR 4](0004-email-otp-access.md)), and authenticated mail ([ADR 9](0009-otp-email-content.md)).
- **Suspension takes the portal down.** If Google suspends or locks the account, codes and sign-in stop. Mitigation: keep recovery options current and keep a second editor on the spreadsheet who can redeploy.
- **CI holds a powerful credential.** `CLASPRC_JSON` holds a refresh token for the account's granted scopes. Mitigation: use the account for nothing else, own no other files with it, and restrict the `live` environment.
- **Consumer limits.** 100 codes per day, a `@gmail.com` sender (no DKIM or brand of your own), and Google may delete consumer accounts inactive for 2 years. Mitigation: sign in periodically.
- **Quota and trigger ownership.** Apps Script quotas apply to the account they run as, and installable triggers run as whoever created them. Mitigation: decide which account owns the triggers.
- **Access to respondent data.** The account can read the spreadsheet and Forms, which adds one more identity to protect. Mitigation: enable 2-Step Verification and grant only the access the portal needs.

## Consequences

- The `From` address is the dedicated account.
- A consumer account means a gmail.com sender and 100 codes per day.
- Changing the deployer needs re-consent and new `CLASPRC_JSON` secrets.
