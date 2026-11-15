import { describe, expect, it, vi } from 'vitest';
import { FakeTable } from '../fakes/sheetdb.fake';
import { type FakeEnvironmentOptions, loadApp } from '../harness';

describe('demo data generator', () => {
  const { app } = loadApp();

  it('is deterministic per seed and differs across seeds', () => {
    expect(app.buildDemoData({ seed: 7 })).toEqual(
      app.buildDemoData({ seed: 7 }),
    );
    expect(app.buildDemoData({ seed: 7 })).not.toEqual(
      app.buildDemoData({ seed: 8 }),
    );
  });

  it('honours the requested counts and defaults', () => {
    const custom = app.buildDemoData({ respondents: 12, forms: 3 });
    // 12 primary rows plus an alias row for every 5th respondent.
    expect(custom.respondents).toHaveLength(15);
    expect(custom.forms).toHaveLength(3);

    const defaults = app.buildDemoData();
    expect(defaults.respondents).toHaveLength(48);
    expect(defaults.forms).toHaveLength(8);
  });

  it('marks every email and form URL as demo data', () => {
    const data = app.buildDemoData();
    expect(data.respondents.every((r) => app.isDemoEmail(r.email))).toBe(true);
    expect(data.scores.every((s) => app.isDemoEmail(s.email))).toBe(true);
    expect(data.forms.every((f) => app.isDemoFormUrl(f.url))).toBe(true);
    expect(data.forms.every((f) => f.status === 'linked')).toBe(true);
  });

  it('keeps scores within the form maximum without duplicates', () => {
    const data = app.buildDemoData();
    const max = new Map(data.forms.map((f) => [f.url, f.maxPoints ?? 0]));
    const keys = new Set<string>();
    for (const s of data.scores) {
      expect(Number.isInteger(s.score)).toBe(true);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(max.get(s.formUrl) as number);
      keys.add(`${s.email}|${s.formUrl}`);
    }
    expect(keys.size).toBe(data.scores.length);
  });

  it('gives every primary respondent a score, counting alias scores', () => {
    const data = app.buildDemoData();
    const owner = new Map<string, string>();
    for (const r of data.respondents) {
      owner.set(r.email, r.alternatives || r.email);
    }
    const scored = new Set(data.scores.map((s) => owner.get(s.email)));
    const primaries = data.respondents.filter((r) => !r.alternatives);
    expect(primaries).toHaveLength(40);
    expect(primaries.every((r) => scored.has(r.email))).toBe(true);
  });

  it('has a Respondents row for every score email', () => {
    const data = app.buildDemoData();
    const emails = new Set(data.respondents.map((r) => r.email));
    expect(data.scores.every((s) => emails.has(s.email))).toBe(true);
  });

  it('exposes alias scores through the scores service', () => {
    const data = app.buildDemoData();
    const tables = {
      forms: new FakeTable(),
      respondents: new FakeTable(),
      scores: new FakeTable(),
    };
    const repos = {
      forms: app.createFormsRepo(tables.forms),
      respondents: app.createRespondentsRepo(tables.respondents),
      scores: app.createScoresRepo(tables.scores),
    };
    app.writeDemoData(data, repos);
    const service = app.createScoresService(() => ({
      ...repos,
      getExcludedUrls: () => [],
      getTitleStripPatterns: () => [],
      getLocale: () => 'en',
    }));

    const aliased = data.respondents.filter((r) => r.alternatives);
    expect(aliased.length).toBeGreaterThan(0);
    const withAliasScores = aliased.filter((alias) =>
      data.scores.some((s) => s.email === alias.email),
    );
    expect(withAliasScores.length).toBeGreaterThan(0);
    for (const alias of withAliasScores) {
      const own = new Set(
        data.scores
          .filter((s) => s.email === alias.alternatives)
          .map((s) => s.formUrl),
      );
      const aliasUrls = data.scores
        .filter((s) => s.email === alias.email)
        .map((s) => s.formUrl);
      const result = service.getByUser(alias.alternatives);
      const answered = result?.scores.filter((e) => e.score !== null);
      expect(answered).toHaveLength(new Set([...own, ...aliasUrls]).size);
    }
  });

  it('does not treat real addresses or URLs as demo data', () => {
    expect(app.isDemoEmail('ana@gmail.com')).toBe(false);
    expect(app.isDemoFormUrl('https://forms.gle/abc')).toBe(false);
  });

  describe('storage', () => {
    const setup = () => {
      const tables = {
        forms: new FakeTable(),
        respondents: new FakeTable(),
        scores: new FakeTable(),
      };
      const repos = {
        forms: app.createFormsRepo(tables.forms),
        respondents: app.createRespondentsRepo(tables.respondents),
        scores: app.createScoresRepo(tables.scores),
      };
      return { tables, repos };
    };

    it('inserts nothing new when written twice', () => {
      const { tables, repos } = setup();
      const data = app.buildDemoData();

      const first = app.writeDemoData(data, repos);
      const second = app.writeDemoData(data, repos);

      expect(first.respondents).toBe(data.respondents.length);
      expect(first.scores).toBe(data.scores.length);
      expect(second).toMatchObject({ respondents: 0, scores: 0 });
      expect(tables.forms.rows).toHaveLength(data.forms.length);
      expect(tables.respondents.rows).toHaveLength(data.respondents.length);
      expect(tables.scores.rows).toHaveLength(data.scores.length);
    });

    it('removes demo rows and keeps real ones', () => {
      const { tables, repos } = setup();
      tables.forms.insert({ url: 'https://forms.gle/real', title: 'Real' });
      tables.respondents.insert({ email: 'ana@gmail.com', name: 'Ana' });
      tables.scores.insert({
        email: 'ana@gmail.com',
        formUrl: 'https://forms.gle/real',
        score: 5,
      });
      const data = app.buildDemoData();
      app.writeDemoData(data, repos);

      const removed = app.removeDemoData(tables);

      expect(removed).toEqual({
        forms: data.forms.length,
        respondents: data.respondents.length,
        scores: data.scores.length,
      });
      expect(tables.forms.rows).toHaveLength(1);
      expect(tables.respondents.rows).toHaveLength(1);
      expect(tables.scores.rows).toHaveLength(1);
    });
  });

  describe('editor entry points', () => {
    const setup = (
      options: FakeEnvironmentOptions = { activeUser: 'owner@gmail.com' },
    ) => {
      const env = loadApp(options);
      const tables = {
        forms: new FakeTable(),
        respondents: new FakeTable(),
        scores: new FakeTable(),
      };
      const sizes = () => ({
        forms: tables.forms.rows.length,
        respondents: tables.respondents.rows.length,
        scores: tables.scores.rows.length,
      });
      const refreshedWith: ReturnType<typeof sizes>[] = [];
      const refresh = vi.fn(() => void refreshedWith.push(sizes()));
      return { ...env, tables, sizes, refresh, refreshedWith };
    };

    it('seedDemoData writes the default demo data under the script lock', () => {
      const { app, locks, tables, sizes, refresh, refreshedWith } = setup();
      const data = app.buildDemoData();

      const counts = app.seedDemoData(tables, refresh);

      expect(counts).toEqual({
        forms: data.forms.length,
        respondents: data.respondents.length,
        scores: data.scores.length,
      });
      expect(sizes()).toEqual(counts);
      expect(refreshedWith).toEqual([counts]);
      expect(locks.acquired).toBeGreaterThan(0);
      expect(locks.released).toBe(locks.acquired);
    });

    it('seedDemoData adds no rows when run again', () => {
      const { app, tables, sizes, refresh } = setup();
      app.seedDemoData(tables, refresh);
      const before = sizes();

      const counts = app.seedDemoData(tables, refresh);

      expect(counts).toMatchObject({ respondents: 0, scores: 0 });
      expect(sizes()).toEqual(before);
      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('clearDemoData removes the seeded rows and keeps real ones', () => {
      const { app, locks, tables, sizes, refresh, refreshedWith } = setup();
      tables.forms.insert({ url: 'https://forms.gle/real', title: 'Real' });
      tables.respondents.insert({ email: 'ana@gmail.com', name: 'Ana' });
      tables.scores.insert({
        email: 'ana@gmail.com',
        formUrl: 'https://forms.gle/real',
        score: 5,
      });
      const seeded = app.seedDemoData(tables, refresh);

      const removed = app.clearDemoData(tables, refresh);

      expect(removed).toEqual(seeded);
      expect(sizes()).toEqual({ forms: 1, respondents: 1, scores: 1 });
      expect(tables.respondents.rows[0]).toMatchObject({
        email: 'ana@gmail.com',
      });
      expect(refreshedWith.at(-1)).toEqual(sizes());
      expect(locks.released).toBe(locks.acquired);
    });

    it('clearDemoData releases the lock when the refresh fails', () => {
      const { app, locks, tables } = setup();

      expect(() =>
        app.clearDemoData(tables, () => {
          throw new Error('sheet missing');
        }),
      ).toThrow('sheet missing');
      expect(locks.released).toBe(locks.acquired);
    });

    it('refuses an anonymous web app visitor before opening the spreadsheet', () => {
      const getActiveSpreadsheet = vi.fn();
      const { app, locks } = setup({
        activeUser: '',
        effectiveUser: 'owner@gmail.com',
        globals: { SpreadsheetApp: { getActiveSpreadsheet } },
      });
      // Loading the config reads the spreadsheet once; only later calls count.
      getActiveSpreadsheet.mockClear();

      expect(() => app.seedDemoData()).toThrow(/Apps Script editor/);
      expect(() => app.clearDemoData()).toThrow(/Apps Script editor/);
      expect(getActiveSpreadsheet).not.toHaveBeenCalled();
      expect(locks.acquired).toBe(0);
    });

    it('refuses a signed-in visitor who is not the user the script runs as', () => {
      const { app, locks, tables, sizes, refresh } = setup({
        activeUser: 'visitor@school.org',
        effectiveUser: 'owner@gmail.com',
      });

      expect(() => app.seedDemoData(tables, refresh)).toThrow(
        /Apps Script editor/,
      );
      expect(() => app.clearDemoData(tables, refresh)).toThrow(
        /Apps Script editor/,
      );
      expect(sizes()).toEqual({ forms: 0, respondents: 0, scores: 0 });
      expect(refresh).not.toHaveBeenCalled();
      expect(locks.acquired).toBe(0);
    });

    it('runs for an editor who is neither the owner nor a listed editor', () => {
      const { app, tables, sizes, refresh } = setup({
        owner: 'owner@gmail.com',
        editors: [],
        activeUser: 'member@school.org',
      });

      const seeded = app.seedDemoData(tables, refresh);
      expect(sizes()).toEqual(seeded);

      expect(app.clearDemoData(tables, refresh)).toEqual(seeded);
      expect(sizes()).toEqual({ forms: 0, respondents: 0, scores: 0 });
    });
  });
});
