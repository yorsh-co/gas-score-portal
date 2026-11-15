import { describe, expect, it } from 'vitest';
import { FakeTable } from '../fakes/sheetdb.fake';
import { loadApp } from '../harness';

describe('forms repository', () => {
  it('inserts a missing form with defaults and updates an existing one', () => {
    const { app } = loadApp();
    const table = new FakeTable();
    const forms = app.createFormsRepo_(table);

    forms.upsert({ url: 'u1', title: 'B' });
    forms.upsert({ url: 'u1', maxPoints: 0 });

    expect(table.rows).toHaveLength(1);
    expect(forms.get('u1')).toMatchObject({
      title: 'B',
      maxPoints: 0,
      status: 'linked',
      syncedAt: null,
    });
  });

  it('lists forms sorted by title', () => {
    const { app } = loadApp();
    const forms = app.createFormsRepo_(new FakeTable());
    forms.upsert({ url: 'u1', title: 'Beta' });
    forms.upsert({ url: 'u2', title: 'Alpha' });

    expect(forms.list().map((f) => f.url)).toEqual(['u2', 'u1']);
  });

  it('updates the status and rejects unknown forms', () => {
    const { app } = loadApp();
    const forms = app.createFormsRepo_(new FakeTable());
    forms.upsert({ url: 'u1' });

    expect(forms.updateStatus('u1', 'error', 'boom')).toMatchObject({
      status: 'error',
      error: 'boom',
    });
    expect(() => forms.updateStatus('nope', 'linked')).toThrow(/not found/);
  });
});

describe('respondents repository', () => {
  it('finds by email ignoring case and spaces', () => {
    const { app } = loadApp();
    const respondents = app.createRespondentsRepo_(
      new FakeTable([{ email: 'ana@x.org', name: 'Ana', alternatives: '' }]),
    );

    expect(respondents.findByEmail('  ANA@x.org ')?.name).toBe('Ana');
    expect(respondents.findByEmail('bob@x.org')).toBeNull();
  });

  it('finds precomposed and decomposed addresses as one respondent', () => {
    const { app } = loadApp();
    const nfc = app.createRespondentsRepo_(
      new FakeTable([
        { email: 'jo\u00e3o@x.org', name: 'Joao', alternatives: '' },
      ]),
    );
    const nfd = app.createRespondentsRepo_(
      new FakeTable([
        { email: 'joa\u0303o@x.org', name: 'Joao', alternatives: '' },
      ]),
    );

    expect(nfc.findByEmail('joa\u0303o@x.org')?.name).toBe('Joao');
    expect(nfd.findByEmail('jo\u00e3o@x.org')?.name).toBe('Joao');
  });

  it('matches an address whose lowercasing composes under NFC', () => {
    const { app } = loadApp();
    const repo = app.createRespondentsRepo_(
      new FakeTable([
        { email: '\u0390@x.org', name: 'Iota', alternatives: '' },
      ]),
    );

    expect(repo.findByEmail('\u03aa\u0301@x.org')?.name).toBe('Iota');
  });

  it('finds the respondents that list an alternative email', () => {
    const { app } = loadApp();
    const respondents = app.createRespondentsRepo_(
      new FakeTable([
        { email: 'a@x.org', name: 'A', alternatives: '' },
        { email: 'b@x.org', name: 'B', alternatives: 'A@x.org, c@x.org' },
      ]),
    );

    expect(
      respondents.findByAlternative('a@x.org').map((r) => r.email),
    ).toEqual(['b@x.org']);
  });

  it('matches alternatives exactly, not by substring', () => {
    const { app } = loadApp();
    const respondents = app.createRespondentsRepo_(
      new FakeTable([
        { email: 'b@x.org', name: 'B', alternatives: 'ana@x.com' },
        { email: 'c@x.org', name: 'C', alternatives: 'x@y.org;\n Na@X.com' },
      ]),
    );

    expect(
      respondents.findByAlternative('na@x.com').map((r) => r.email),
    ).toEqual(['c@x.org']);
  });

  it('finds an alternative stored in the other Unicode form', () => {
    const { app } = loadApp();
    const respondents = app.createRespondentsRepo_(
      new FakeTable([
        { email: 'b@x.org', name: 'B', alternatives: 'joa\u0303o@x.org' },
      ]),
    );

    expect(
      respondents.findByAlternative('jo\u00e3o@x.org').map((r) => r.email),
    ).toEqual(['b@x.org']);
  });

  it('upserts by normalized email and inserts only missing ones in a batch', () => {
    const { app } = loadApp();
    const table = new FakeTable();
    const respondents = app.createRespondentsRepo_(table);

    respondents.upsert({ email: ' Ana@X.org ', name: 'Ana' });
    respondents.upsert({ email: 'ana@x.org', alternatives: 'b@x.org' });
    const added = respondents.insertMissing([
      { email: 'ANA@x.org', name: 'Other', alternatives: '' },
      { email: 'bob@x.org', name: 'Bob', alternatives: '' },
      { email: 'bob@x.org', name: 'Bob 2', alternatives: '' },
      { email: ' ', name: 'Blank', alternatives: '' },
    ]);

    expect(added).toBe(1);
    expect(table.calls.insertMany).toBe(1);
    expect(respondents.findByEmail('ana@x.org')).toEqual({
      email: 'ana@x.org',
      name: 'Ana',
      alternatives: 'b@x.org',
    });
  });
});

describe('scores repository', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('writes only new and changed scores, in one batch each', () => {
    const { app } = loadApp();
    const table = new FakeTable();
    const scores = app.createScoresRepo_(table);

    scores.upsertMany('f1', [
      { email: 'a@x.org', score: 5 },
      { email: 'b@x.org', score: 7 },
    ]);
    const result = scores.upsertMany(
      'f1',
      [
        { email: 'A@x.org', score: 5 },
        { email: 'b@x.org', score: 8 },
        { email: 'c@x.org', score: 1 },
      ],
      now,
    );

    expect(result).toEqual({ inserted: 1, updated: 1, unchanged: 1 });
    expect(table.calls.updateWhere).toBe(1);
    expect(table.calls.insertMany).toBe(2);
    expect([...scores.getByForm('f1')]).toEqual([
      ['a@x.org', 5],
      ['b@x.org', 8],
      ['c@x.org', 1],
    ]);
  });

  it('updates, rather than inserts, a score stored under the other Unicode form', () => {
    const { app } = loadApp();
    const scores = app.createScoresRepo_(new FakeTable());

    scores.upsertMany('f1', [{ email: 'jo\u00e3o@x.org', score: 5 }]);
    const result = scores.upsertMany('f1', [
      { email: 'joa\u0303o@x.org', score: 6 },
    ]);

    expect(result).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
    expect([...scores.getByForm('f1')]).toEqual([['jo\u00e3o@x.org', 6]]);
  });

  it('finds scores stored in the other Unicode form', () => {
    const { app } = loadApp();
    const scores = app.createScoresRepo_(
      new FakeTable([
        { email: 'joa\u0303o@x.org', formUrl: 'f1', score: 4, updatedAt: now },
      ]),
    );

    expect(scores.getByEmails(['jo\u00e3o@x.org']).map((s) => s.score)).toEqual(
      [4],
    );
  });

  it('updates a score whose stored email is in the other Unicode form', () => {
    const { app } = loadApp();
    const table = new FakeTable([
      { email: 'joa\u0303o@x.org', formUrl: 'f1', score: 4, updatedAt: now },
    ]);
    const scores = app.createScoresRepo_(table);

    const result = scores.upsertMany('f1', [
      { email: 'jo\u00e3o@x.org', score: 6 },
    ]);

    expect(result).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
    expect(table.calls.insertMany).toBe(0);
    expect([...scores.getByForm('f1')]).toEqual([['jo\u00e3o@x.org', 6]]);
  });

  it('does not write when nothing changed', () => {
    const { app } = loadApp();
    const table = new FakeTable();
    const scores = app.createScoresRepo_(table);
    scores.upsertMany('f1', [{ email: 'a@x.org', score: 5 }]);
    const writes = table.calls.insertMany;

    scores.upsertMany('f1', [{ email: 'a@x.org', score: 5 }]);

    expect(table.calls.insertMany).toBe(writes);
    expect(table.calls.updateWhere).toBe(0);
  });

  it('keeps a score of 0 and scopes scores per form', () => {
    const { app } = loadApp();
    const scores = app.createScoresRepo_(new FakeTable());
    scores.upsertMany('f1', [{ email: 'a@x.org', score: 0 }]);
    scores.upsertMany('f2', [{ email: 'a@x.org', score: 3 }]);

    expect(scores.getByForm('f1').get('a@x.org')).toBe(0);
    expect(
      scores
        .getByEmails([' A@x.org '])
        .map((s) => [s.formUrl, s.score])
        .sort(),
    ).toEqual([
      ['f1', 0],
      ['f2', 3],
    ]);
  });
});
