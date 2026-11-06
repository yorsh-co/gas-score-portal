import { describe, expect, it } from 'vitest';
import { FakeTable } from '../fakes/sheetdb.fake';
import { loadApp } from '../harness';

/** Builds a scores service over in-memory tables. */
function setup(
  options: {
    respondents?: Record<string, unknown>[];
    forms?: Record<string, unknown>[];
    scores?: Record<string, unknown>[];
    excluded?: string[];
    strip?: string[];
    locale?: string;
  } = {},
) {
  const { app } = loadApp();
  const forms = app.createFormsRepo(new FakeTable(options.forms ?? []));
  const respondents = app.createRespondentsRepo(
    new FakeTable(options.respondents ?? []),
  );
  const scores = app.createScoresRepo(new FakeTable(options.scores ?? []));
  return app.createScoresService(() => ({
    forms,
    respondents,
    scores,
    getExcludedUrls: () => options.excluded ?? [],
    getTitleStripPatterns: () => options.strip ?? ['\\bdraft\\b'],
    getLocale: () => options.locale ?? 'en',
  }));
}

const FORMS = [
  { url: 'f1', title: 'Module B - Draft', maxPoints: 5, status: 'linked' },
  { url: 'f2', title: 'Module A', maxPoints: 10, status: 'linked' },
  { url: 'f3', title: 'Excluded', maxPoints: 10, status: 'linked' },
];

describe('ScoresService.getByUser', () => {
  it('returns null for an unknown email', () => {
    expect(setup().getByUser('nobody@x.org')).toBeNull();
  });

  it('masks the name and email, drops excluded forms and sorts by title', () => {
    const service = setup({
      forms: FORMS,
      excluded: ['f3'],
      respondents: [
        { email: 'ana@x.org', name: 'Ana Maria Souza Lima', alternatives: '' },
      ],
      scores: [
        { email: 'ana@x.org', formUrl: 'f1', score: 4 },
        { email: 'ana@x.org', formUrl: 'f2', score: 0 },
        { email: 'ana@x.org', formUrl: 'f3', score: 9 },
      ],
    });

    const result = service.getByUser('ANA@x.org');

    expect(result).toEqual({
      email: 'ana@x.org',
      name: 'Ana ... L.',
      alternatives: ['an...@x.org'],
      scores: [
        { formTitle: 'Module A', formPoints: 10, score: 0 },
        { formTitle: 'Module B', formPoints: 5, score: 4 },
      ],
    });
  });

  it('masks a two-part name and keeps a single name', () => {
    const service = setup({
      respondents: [
        { email: 'a@x.org', name: 'Ana Lima', alternatives: '' },
        { email: 'b@x.org', name: 'Bia', alternatives: '' },
      ],
    });

    expect(service.getByUser('a@x.org')?.name).toBe('Ana L.');
    expect(service.getByUser('b@x.org')?.name).toBe('Bia');
  });

  it('fills missing forms from alternative emails without overriding', () => {
    const service = setup({
      forms: FORMS,
      respondents: [
        { email: 'ana@x.org', name: 'Ana', alternatives: '' },
        { email: 'ana2@y.org', name: 'Ana', alternatives: 'ana@x.org' },
      ],
      scores: [
        { email: 'ana@x.org', formUrl: 'f1', score: 4 },
        { email: 'ana2@y.org', formUrl: 'f1', score: 1 },
        { email: 'ana2@y.org', formUrl: 'f2', score: 7 },
      ],
    });

    const result = service.getByUser('ana@x.org');

    expect(result?.scores.map((s) => s.score)).toEqual([null, 7, 4]);
    expect(result?.alternatives).toEqual(['an...@x.org', 'an...@y.org']);
  });

  it('lists unanswered forms with a null score, except excluded ones', () => {
    const service = setup({
      forms: [
        ...FORMS,
        { url: 'f4', title: 'Hidden', maxPoints: null, status: 'excluded' },
        { url: 'f5', title: 'Open', maxPoints: null, status: 'linked' },
      ],
      excluded: ['f3'],
      respondents: [{ email: 'a@x.org', name: 'A', alternatives: '' }],
      scores: [{ email: 'a@x.org', formUrl: 'f1', score: 4 }],
    });

    expect(service.getByUser('a@x.org')?.scores).toEqual([
      { formTitle: 'Module A', formPoints: 10, score: null },
      { formTitle: 'Module B', formPoints: 5, score: 4 },
      { formTitle: 'Open', formPoints: null, score: null },
    ]);
  });

  it('sorts by the locale', () => {
    const service = setup({
      locale: 'pt-BR',
      forms: [
        { url: 'f1', title: 'Zebra', maxPoints: 10, status: 'linked' },
        { url: 'f2', title: 'Álamo', maxPoints: 10, status: 'linked' },
      ],
      respondents: [{ email: 'a@x.org', name: 'A', alternatives: '' }],
      scores: [
        { email: 'a@x.org', formUrl: 'f1', score: 1 },
        { email: 'a@x.org', formUrl: 'f2', score: 2 },
      ],
    });

    expect(
      service.getByUser('a@x.org')?.scores.map((s) => s.formTitle),
    ).toEqual(['Álamo', 'Zebra']);
  });

  it('removes the configured title patterns and ignores invalid ones', () => {
    const service = setup({
      strip: ['(', 'quiz \\d+'],
      forms: [
        {
          url: 'f1',
          title: 'Unit 2 - Quiz 4',
          maxPoints: 10,
          status: 'linked',
        },
      ],
      respondents: [{ email: 'a@x.org', name: 'A', alternatives: '' }],
    });

    expect(service.getByUser('a@x.org')?.scores[0]?.formTitle).toBe('Unit 2');
  });

  it('keeps the title when no pattern is configured', () => {
    const service = setup({
      strip: [],
      forms: [
        {
          url: 'f1',
          title: 'Module B - Draft',
          maxPoints: 10,
          status: 'linked',
        },
      ],
      respondents: [{ email: 'a@x.org', name: 'A', alternatives: '' }],
    });

    expect(service.getByUser('a@x.org')?.scores[0]?.formTitle).toBe(
      'Module B - Draft',
    );
  });
});
