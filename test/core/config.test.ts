import { describe, expect, it } from 'vitest';
import { declaresGlobal, loadApp } from '../harness';

describe('getConfig_', () => {
  it('returns the defaults when nothing is stored', () => {
    const { app } = loadApp();

    expect(app.getConfig_().getAll()).toMatchObject({
      locale: 'en',
      portalTitle: 'Score Portal',
      faviconUrl:
        'https://cdn.jsdelivr.net/gh/yorsh-co/gas-score-portal@main/src/web/brand/favicon-32x32.png',
      privacyPolicyUrl: 'https://yorsh.co/privacy',
      termsUrl: 'https://yorsh.co/terms',
      excludedFormUrls: null,
    });
  });

  it('is memoized within an execution', () => {
    const { app } = loadApp();

    expect(app.getConfig_()).toBe(app.getConfig_());
  });

  it('resolves the editors from the owner and the spreadsheet editors', () => {
    const { app } = loadApp({
      owner: 'Owner@Example.org',
      editors: ['ed1@example.org', 'ED2@example.org'],
    });

    expect([...app.getConfig_().editors].sort()).toEqual([
      'ed1@example.org',
      'ed2@example.org',
      'owner@example.org',
    ]);
  });

  it('handles a spreadsheet without an owner', () => {
    const { app } = loadApp({ owner: null, editors: ['ed@example.org'] });

    expect(app.getConfig_().editors).toEqual(['ed@example.org']);
  });

  it('falls back to the default for an invalid stored value', () => {
    const { app } = loadApp({ properties: { 'gasConfig:locale': '"fr"' } });

    expect(app.getConfig_().get('locale')).toBe('en');
  });
});

describe('excluded forms', () => {
  it('parses one URL per line, ignoring blanks', () => {
    const { app, properties } = loadApp();
    properties.setProperty(
      'gasConfig:excludedFormUrls',
      JSON.stringify(' https://a \n\nhttps://b\n'),
    );

    expect(app.getExcludedFormUrls_()).toEqual(['https://a', 'https://b']);
  });

  it('saves the list when the user is an editor', () => {
    const { app } = loadApp({
      owner: 'owner@example.org',
      activeUser: 'owner@example.org',
    });

    app.saveExcludedFormUrls_(['https://a', 'https://b']);

    expect(app.getExcludedFormUrls_()).toEqual(['https://a', 'https://b']);
  });

  it('rejects the save for a user who is not an editor', () => {
    const { app } = loadApp({
      owner: 'owner@example.org',
      activeUser: 'intruder@example.org',
    });

    expect(() => app.saveExcludedFormUrls_(['https://a'])).toThrow();
  });
});

describe('form title strip patterns', () => {
  it('rejects an invalid regular expression with a message', () => {
    const { app } = loadApp({
      owner: 'owner@example.org',
      activeUser: 'owner@example.org',
    });

    expect(() =>
      app.saveConfigValues_({ formTitleStripPatterns: '^ok\n(unclosed' }),
    ).toThrow(/\(unclosed/);
  });

  it('stores valid patterns', () => {
    const { app } = loadApp({
      owner: 'owner@example.org',
      activeUser: 'owner@example.org',
    });

    app.saveConfigValues_({ formTitleStripPatterns: '^t4\\s*\n\nquiz' });

    expect(app.getFormTitleStripPatterns_()).toEqual(['^t4\\s*', 'quiz']);
  });
});

describe('brand settings validation', () => {
  const owner = { owner: 'owner@example.org', activeUser: 'owner@example.org' };

  it('rejects a malformed secondaryColor', () => {
    const { app } = loadApp(owner);

    expect(() => app.saveConfigValues_({ secondaryColor: 'red' })).toThrow(
      expect.objectContaining({ name: 'GasValidationError' }),
    );
  });

  it.each(['http://example.com/i.png', 'javascript:alert(1)'])(
    'rejects the non-https faviconUrl %s',
    (faviconUrl) => {
      const { app } = loadApp(owner);

      expect(() => app.saveConfigValues_({ faviconUrl })).toThrow(
        expect.objectContaining({ name: 'GasValidationError' }),
      );
    },
  );

  it.each([
    ['privacyPolicyUrl', 'javascript:alert(1)'],
    ['termsUrl', 'javascript:alert(1)'],
    ['privacyPolicyUrl', 'http://example.org/privacy'],
    ['termsUrl', 'http://example.org/privacy'],
  ])('rejects %s value %s', (key, value) => {
    const { app } = loadApp(owner);

    expect(() => app.saveConfigValues_({ [key]: value })).toThrow(
      expect.objectContaining({ name: 'GasValidationError' }),
    );
  });
});

describe('settings reads through GasConfigRpc', () => {
  const stored = {
    owner: 'owner@example.org',
    properties: { 'gasConfig:excludedFormUrls': JSON.stringify('https://a') },
  };

  it('denies an anonymous web app visitor', () => {
    const { app } = loadApp({ ...stored, effectiveUser: 'owner@example.org' });

    expect(() => app.GasConfigRpc('getSettings')).toThrow(/"status":401/);
  });

  it('denies a signed-in web app visitor who is not an editor', () => {
    const { app } = loadApp({
      ...stored,
      activeUser: 'visitor@example.org',
      effectiveUser: 'owner@example.org',
    });

    expect(() => app.GasConfigRpc('getSettings')).toThrow(/"status":401/);
  });

  it('shows a web app visitor who is an editor the settings', () => {
    const { app } = loadApp({
      ...stored,
      editors: ['ed@example.org'],
      activeUser: 'ed@example.org',
      effectiveUser: 'owner@example.org',
    });

    expect(app.GasConfigRpc('getSettings')).toMatchObject({
      canEdit: true,
      values: { excludedFormUrls: 'https://a' },
    });
  });

  it('shows a spreadsheet user who is not a listed editor the settings read-only', () => {
    const { app } = loadApp({ ...stored, activeUser: 'shared@example.org' });

    expect(app.GasConfigRpc('getSettings')).toMatchObject({
      canEdit: false,
      values: { excludedFormUrls: 'https://a' },
    });
  });

  it('shows the owner the settings read-only when the editors cannot be resolved', () => {
    const { app } = loadApp({
      ...stored,
      activeUser: 'owner@example.org',
      globals: {
        SpreadsheetApp: {
          getActiveSpreadsheet: () => {
            throw new Error('Access denied');
          },
        },
      },
    });

    expect(app.GasConfigRpc('getSettings')).toMatchObject({
      canEdit: false,
      values: { excludedFormUrls: 'https://a' },
    });
  });
});

describe('google.script.run surface', () => {
  it.each([
    'getExcludedFormUrls',
    'getFormTitleStripPatterns',
    'refreshOverview',
    'saveConfigValues',
    'saveExcludedFormUrls',
    'saveDriveFolderUrl',
    'installTriggers',
    'getConfig',
    'tr',
    'getApp',
    'createFormsRepo',
    'writeDemoData',
    'displayMenu',
  ])('declares %s only as a private function', (name) => {
    expect(declaresGlobal(name)).toBe(false);
    expect(declaresGlobal(`${name}_`)).toBe(true);
  });
});
