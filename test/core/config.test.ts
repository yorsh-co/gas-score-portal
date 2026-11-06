import { describe, expect, it } from 'vitest';
import { loadApp } from '../harness';

describe('getConfig', () => {
  it('returns the defaults when nothing is stored', () => {
    const { app } = loadApp();

    expect(app.getConfig().getAll()).toMatchObject({
      locale: 'en',
      portalTitle: 'Score Portal',
      excludedFormUrls: null,
    });
  });

  it('is memoized within an execution', () => {
    const { app } = loadApp();

    expect(app.getConfig()).toBe(app.getConfig());
  });

  it('resolves the editors from the owner and the spreadsheet editors', () => {
    const { app } = loadApp({
      owner: 'Owner@Example.org',
      editors: ['ed1@example.org', 'ED2@example.org'],
    });

    expect([...app.getConfig().editors].sort()).toEqual([
      'ed1@example.org',
      'ed2@example.org',
      'owner@example.org',
    ]);
  });

  it('handles a spreadsheet without an owner', () => {
    const { app } = loadApp({ owner: null, editors: ['ed@example.org'] });

    expect(app.getConfig().editors).toEqual(['ed@example.org']);
  });

  it('falls back to the default for an invalid stored value', () => {
    const { app } = loadApp({ properties: { 'gasConfig:locale': '"fr"' } });

    expect(app.getConfig().get('locale')).toBe('en');
  });
});

describe('excluded forms', () => {
  it('parses one URL per line, ignoring blanks', () => {
    const { app, properties } = loadApp();
    properties.setProperty(
      'gasConfig:excludedFormUrls',
      JSON.stringify(' https://a \n\nhttps://b\n'),
    );

    expect(app.getExcludedFormUrls()).toEqual(['https://a', 'https://b']);
  });

  it('saves the list when the user is an editor', () => {
    const { app } = loadApp({
      owner: 'owner@example.org',
      activeUser: 'owner@example.org',
    });

    app.saveExcludedFormUrls(['https://a', 'https://b']);

    expect(app.getExcludedFormUrls()).toEqual(['https://a', 'https://b']);
  });

  it('rejects the save for a user who is not an editor', () => {
    const { app } = loadApp({
      owner: 'owner@example.org',
      activeUser: 'intruder@example.org',
    });

    expect(() => app.saveExcludedFormUrls(['https://a'])).toThrow();
  });
});

describe('form title strip patterns', () => {
  it('rejects an invalid regular expression with a message', () => {
    const { app } = loadApp({
      owner: 'owner@example.org',
      activeUser: 'owner@example.org',
    });

    expect(() =>
      app.saveConfigValues({ formTitleStripPatterns: '^ok\n(unclosed' }),
    ).toThrow(/\(unclosed/);
  });

  it('stores valid patterns', () => {
    const { app } = loadApp({
      owner: 'owner@example.org',
      activeUser: 'owner@example.org',
    });

    app.saveConfigValues({ formTitleStripPatterns: '^t4\\s*\n\nquiz' });

    expect(app.getFormTitleStripPatterns()).toEqual(['^t4\\s*', 'quiz']);
  });
});
