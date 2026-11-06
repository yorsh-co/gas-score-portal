/** Sends the access code to a respondent. */
interface OtpMailer {
  /** Whether `MailApp` can still send today. */
  hasQuota(): boolean;
  /**
   * Sends the code as a localized HTML and plain-text email.
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
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Creates the mailer backed by `MailApp`.
 * @param getPortalTitle Portal title shown in the email.
 * @param getLocale Locale of the email.
 */
function createOtpMailer(
  getPortalTitle: () => string,
  getLocale: () => string,
): OtpMailer {
  return {
    hasQuota: () => MailApp.getRemainingDailyQuota() > 0,
    sendOtp(to, code, minutes) {
      const locale = getLocale();
      const portalTitle = getPortalTitle();
      const intro = t(locale, 'email.otpIntro', { portalTitle });
      const expiry = t(locale, 'email.otpExpiry', { minutes });
      MailApp.sendEmail({
        to,
        subject: t(locale, 'email.otpSubject', { portalTitle }),
        body: `${intro}\n\n${code}\n\n${expiry}`,
        htmlBody:
          `<p>${escapeHtml(intro)}</p>` +
          `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;font-family:monospace">${code}</p>` +
          `<p>${escapeHtml(expiry)}</p>`,
        name: portalTitle,
      });
    },
  };
}
