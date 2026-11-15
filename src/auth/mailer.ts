/** Sends the access code to a respondent. */
interface OtpMailer {
  /** Whether `MailApp` can still send today. */
  hasQuota(): boolean;
  /**
   * Sends the code as a localized, link-free HTML document with a matching
   * plain-text part (see ADR 9).
   * @param to Recipient.
   * @param code The 6-digit code.
   * @param minutes Minutes until the code expires.
   */
  sendOtp(to: string, code: string, minutes: number): void;
}

/**
 * Escapes text for HTML.
 * @param text Plain text.
 */
function escapeHtml_(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Creates the mailer backed by `MailApp`.
 *
 * The message is a complete HTML document with a plain-text twin, states why
 * it was sent and by whom, and carries no links, so it does not resemble
 * phishing templates. The code precedes any text that interpolates the portal
 * title, so it stays the first 6-digit number in the visible content.
 * @param getPortalTitle Portal title shown in the email.
 * @param getLocale Locale of the email.
 */
function createOtpMailer_(
  getPortalTitle: () => string,
  getLocale: () => string,
): OtpMailer {
  return {
    hasQuota: () => MailApp.getRemainingDailyQuota() > 0,
    sendOtp(to, code, minutes) {
      const locale = getLocale();
      const lang = resolveLocale(locale);
      const portalTitle = getPortalTitle();
      const subject = t(locale, 'email.otpSubject', { portalTitle });
      const reason = t(locale, 'email.otpReason', { portalTitle });
      const intro = t(locale, 'email.otpIntro');
      const expiry = t(locale, 'email.otpExpiry', { minutes });
      const footer = t(locale, 'email.otpFooter', { portalTitle });
      const paragraph = (text: string) =>
        `<p style="margin:0 0 16px">${escapeHtml_(text)}</p>`;
      MailApp.sendEmail({
        to,
        subject,
        body: [intro, code, expiry, reason, footer].join('\n\n'),
        htmlBody:
          `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
          `<title>${escapeHtml_(subject)}</title></head>` +
          '<body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;color:#202124">' +
          paragraph(intro) +
          `<p style="margin:0 0 16px;font-size:24px;font-weight:bold;letter-spacing:4px">${escapeHtml_(code)}</p>` +
          paragraph(expiry) +
          paragraph(reason) +
          `<p style="margin:24px 0 0;font-size:12px;color:#5f6368">${escapeHtml_(footer)}</p>` +
          '</body></html>',
        name: portalTitle,
      });
    },
  };
}
