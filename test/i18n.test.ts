import { describe, expect, it } from 'vitest';
import { loadApp, type MessageKeyApi } from './harness';

describe('i18n catalogues', () => {
  it('define the same keys in en and pt-BR', () => {
    const { app } = loadApp();

    expect(Object.keys(app.MESSAGES_PT_BR).sort()).toEqual(
      Object.keys(app.MESSAGES_EN).sort(),
    );
  });

  it('use the same placeholders in en and pt-BR', () => {
    const { app } = loadApp();
    const placeholders = (text: string) =>
      (text.match(/\{\w+\}/g) ?? []).sort();

    for (const [key, text] of Object.entries(app.MESSAGES_EN)) {
      expect(placeholders(app.MESSAGES_PT_BR[key] ?? ''), key).toEqual(
        placeholders(text),
      );
    }
  });
});

describe('t', () => {
  it('translates into the requested locale', () => {
    const { app } = loadApp();

    expect(app.t('pt-BR', 'toast.error')).toBe('Erro');
    expect(app.t('en', 'toast.error')).toBe('Error');
  });

  it('interpolates placeholders and keeps unknown ones', () => {
    const { app } = loadApp();

    expect(app.t('en', 'forms.linked', { title: 'Quiz $1' })).toBe(
      '"Quiz $1" linked',
    );
    expect(app.t('en', 'forms.linked')).toBe('"{title}" linked');
    expect(app.t('en', 'forms.linked', {})).toBe('"{title}" linked');
  });

  it('falls back to en for an unknown locale', () => {
    const { app } = loadApp();

    expect(app.t('fr', 'toast.error')).toBe('Error');
    expect(app.t(undefined, 'toast.error')).toBe('Error');
  });

  it('returns the key when no catalogue has it', () => {
    const { app } = loadApp();

    expect(app.t('en', 'missing.key' as MessageKeyApi)).toBe('missing.key');
  });
});

describe('tr', () => {
  it('follows the locale setting', () => {
    const { app } = loadApp({ properties: { 'gasConfig:locale': '"pt-BR"' } });

    expect(app.tr('toast.error')).toBe('Erro');
  });

  it('defaults to English', () => {
    expect(loadApp().app.tr('toast.error')).toBe('Error');
  });
});

describe('GET /api/meta', () => {
  it('passes the configured brand through', () => {
    const { app } = loadApp({
      properties: {
        'gasConfig:portalTitle': '"Acme Scores"',
        'gasConfig:primaryColor': '"#112233"',
        'gasConfig:logoUrl': '"https://example.org/logo.png"',
        'gasConfig:faviconUrl': '"https://example.org/icon.png"',
      },
    });
    const webApp = app.createWebApp({ getByUser: () => null });

    const response = webApp.doGet({ parameter: { route: '/api/meta' } });

    expect(response).toMatchObject({
      ok: true,
      data: {
        portalTitle: 'Acme Scores',
        brand: {
          primaryColor: '#112233',
          logoUrl: 'https://example.org/logo.png',
          faviconUrl: 'https://example.org/icon.png',
        },
      },
    });
  });

  it('returns the locale, title and brand', () => {
    const { app } = loadApp({ properties: { 'gasConfig:locale': '"pt-BR"' } });
    const webApp = app.createWebApp({ getByUser: () => null });

    const response = webApp.doGet({ parameter: { route: '/api/meta' } });

    expect(response).toMatchObject({
      ok: true,
      data: {
        locale: 'pt-BR',
        portalTitle: 'Score Portal',
        brand: { primaryColor: null, logoUrl: null, faviconUrl: null },
      },
    });
  });
});
