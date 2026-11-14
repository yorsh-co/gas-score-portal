import { describe, expect, it } from 'vitest';
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
});
