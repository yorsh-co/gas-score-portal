import { describe, expect, it } from 'vitest';
import { loadApp } from '../harness';

interface Sent {
  to: string;
  subject: string;
  body: string;
  htmlBody: string;
  name: string;
}

function send(locale: string, portalTitle = 'Quiz <Portal>') {
  const sent: Sent[] = [];
  const { app } = loadApp({
    globals: {
      MailApp: {
        getRemainingDailyQuota: () => 100,
        sendEmail: (message: Sent) => sent.push(message),
      },
    },
  });
  app
    .createOtpMailer_(
      () => portalTitle,
      () => locale,
    )
    .sendOtp('ana@x.org', '123456', 10);
  return sent[0]!;
}

describe('OTP mailer', () => {
  it('sends a complete HTML document', () => {
    const mail = send('pt-BR');
    expect(mail.subject).not.toContain('123456');
    expect(mail.htmlBody.startsWith('<!doctype html>')).toBe(true);
    expect(mail.htmlBody).toContain('<html lang="pt-BR">');
    expect(mail.htmlBody).toContain('<meta charset="utf-8">');
    expect(mail.htmlBody).toContain(
      '<title>Quiz &lt;Portal&gt;: seu código de acesso</title>',
    );
  });

  it('includes intro, code, expiry, reason and footer in both parts', () => {
    const mail = send('pt-BR');
    for (const part of [mail.body, mail.htmlBody]) {
      expect(part).toContain('Seu código de acesso é:');
      expect(part).toContain('123456');
      expect(part).toContain('expira em 10 minutos');
      expect(part).toContain('Alguém, provavelmente você');
      expect(part).toContain('mensagem automática');
    }
    expect(mail.body).toContain('cadastrado no Quiz <Portal>');
    expect(mail.htmlBody).toContain('cadastrado no Quiz &lt;Portal&gt;');
  });

  it('escapes quotes and ampersands in the portal title', () => {
    const sent: Sent[] = [];
    const { app } = loadApp({
      globals: {
        MailApp: {
          getRemainingDailyQuota: () => 100,
          sendEmail: (message: Sent) => sent.push(message),
        },
      },
    });
    app
      .createOtpMailer_(
        () => 'O\'Brien & "Co"',
        () => 'en',
      )
      .sendOtp('ana@x.org', '123456', 10);
    const { htmlBody } = sent[0]!;
    expect(htmlBody).toContain('O&#39;Brien &amp; &quot;Co&quot;');
    expect(htmlBody).not.toContain("O'Brien");
  });

  it('escapes the portal title in HTML only', () => {
    const mail = send('en');
    expect(mail.htmlBody).toContain('Quiz &lt;Portal&gt;');
    expect(mail.htmlBody).not.toContain('Quiz <Portal>');
    expect(mail.body).toContain('Quiz <Portal>');
    expect(mail.name).toBe('Quiz <Portal>');
  });

  it('contains no links', () => {
    const mail = send('en');
    for (const part of [mail.body, mail.htmlBody]) {
      expect(part).not.toContain('http');
      expect(part).not.toContain('<a ');
    }
  });

  it('keeps the code as the first 6-digit number in the body', () => {
    expect(/\b(\d{6})\b/.exec(send('en').body)?.[1]).toBe('123456');
  });

  it('puts the code before any portal title that contains digits', () => {
    for (const locale of ['en', 'pt-BR']) {
      const mail = send(locale, 'Quiz 202611');
      expect(/\b(\d{6})\b/.exec(mail.body)?.[1]).toBe('123456');
      const visibleText = mail.htmlBody
        .slice(mail.htmlBody.indexOf('<body'))
        .replace(/<[^>]*>/g, ' ');
      expect(/\b(\d{6})\b/.exec(visibleText)?.[1]).toBe('123456');
    }
  });

  it('falls back to lang="en" for an unknown locale', () => {
    expect(send('fr').htmlBody).toContain('<html lang="en">');
  });
});
