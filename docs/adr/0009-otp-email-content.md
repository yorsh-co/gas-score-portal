# 9. OTP email content

Date: 2026-11-14

## Status

Accepted

## Context

Gmail flagged access-code emails as spam, with the banner "looks similar to
other emails that are spam". The email was a bare HTML fragment with one
sentence and a large number, a shape that matches phishing and OTP-spam
templates. Content is one half of the verdict; sender reputation and domain
authentication are the other.

## Decision

- The email is a complete HTML document (doctype, `<html lang>`, charset,
  title) with a matching plain-text part. `lang` is the resolved locale
  (`en` or `pt-BR`), never the raw config value.
- It states why the recipient got it and ends with a footer naming the portal.
- It contains no links. `script.google.com` web app URLs are heavily abused in
  phishing and raise the spam score; the user already has the portal open.
- The code is not in the subject, to keep it out of lock-screen notifications.
- Every interpolated string is HTML-escaped.
- `MailApp` is kept instead of `GmailApp`: same sending identity, and no need
  for the broad `gmail` scope.

## Consequences

- Adding a link or dropping the reason and footer lines may bring the issue back.
- Content changes only reduce the spam signal. Authenticating the sending
  domain (DKIM, SPF, DMARC) remains a deployer task, described in the README.
