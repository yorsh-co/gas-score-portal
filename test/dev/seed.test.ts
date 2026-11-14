import { describe, expect, it } from 'vitest';
import { FakeTable } from '../fakes/sheetdb.fake';
import { loadApp } from '../harness';

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
    expect(custom.respondents).toHaveLength(12);
    expect(custom.forms).toHaveLength(3);

    const defaults = app.buildDemoData();
    expect(defaults.respondents).toHaveLength(40);
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

  it('gives every respondent a score and exercises alternative emails', () => {
    const data = app.buildDemoData();
    const owner = new Map<string, string>();
    for (const r of data.respondents) {
      owner.set(r.email, r.email);
      if (r.alternatives) owner.set(r.alternatives, r.email);
    }
    const scored = new Set(data.scores.map((s) => owner.get(s.email)));
    expect(data.respondents.every((r) => scored.has(r.email))).toBe(true);
    expect(
      data.scores.some(
        (s) => !data.respondents.some((r) => r.email === s.email),
      ),
    ).toBe(true);
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
});
