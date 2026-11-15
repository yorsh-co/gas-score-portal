import { describe, expect, it, vi } from 'vitest';
import { FakeTable } from '../fakes/sheetdb.fake';
import {
  loadApp,
  type FakeEnvironmentOptions,
  type SyncDepsApi,
} from '../harness';

type FormScores = { email: string; name: string; score: number }[];

interface Scenario {
  formRows?: Record<string, unknown>[];
  scoreRows?: Record<string, unknown>[];
  /** Scores returned by the fake Forms API, by form URL. */
  responses?: Record<string, FormScores | Error>;
  excluded?: string[];
  /** Number of forms the timer allows before time runs out. */
  timeBudget?: number;
  inaccessible?: string[];
  lastFormUrl?: string;
  env?: FakeEnvironmentOptions;
}

function setup(scenario: Scenario = {}) {
  const env = loadApp(scenario.env);
  const { app } = env;
  const formsTable = new FakeTable(
    scenario.formRows ?? [{ url: 'f1', title: 'One', status: 'linked' }],
  );
  const respondentsTable = new FakeTable();
  const scoresTable = new FakeTable(scenario.scoreRows ?? []);

  let checks = 0;
  const budget = scenario.timeBudget ?? Infinity;
  const form = (url: string) => ({
    isQuiz: () => true,
    getItems: () => [],
    getTitle: () => `Title of ${url}`,
  });
  const scheduleContinuation = vi.fn();
  const openForm = vi.fn((url: string) =>
    scenario.inaccessible?.includes(url) ? null : { url, ...form(url) },
  );

  const deps: SyncDepsApi = {
    forms: app.createFormsRepo_(formsTable),
    respondents: app.createRespondentsRepo_(respondentsTable),
    scores: app.createScoresRepo_(scoresTable),
    timer: {
      start: () => 0,
      setSafetyMargin: () => undefined,
      hasTimeLeft: () => checks++ < budget,
      getTimeRemainingSafe: () => 240_000,
    },
    getExcludedUrls: () => scenario.excluded ?? [],
    openForm,
    getFormScores: (opened) => {
      const result = scenario.responses?.[(opened as { url: string }).url];
      if (result instanceof Error) throw result;
      return result ?? [];
    },
    scheduleContinuation,
    now: () => new Date('2026-03-01T10:00:00Z'),
  };

  const cursor = new env.app.FormsCursor({
    key: 'cursor:test',
    ...(scenario.lastFormUrl ? { lastFormUrl: scenario.lastFormUrl } : {}),
  });
  const run = () => new env.app.RespondentScoreSynchronizer(cursor, deps).run();
  return {
    ...env,
    deps,
    cursor,
    run,
    formsTable,
    respondentsTable,
    scoresTable,
    scheduleContinuation,
    openForm,
  };
}

describe('RespondentScoreSynchronizer', () => {
  it('writes only new and changed scores, in one batch each', () => {
    const t = setup({
      scoreRows: [
        { email: 'a@x.org', formUrl: 'f1', score: 5 },
        { email: 'b@x.org', formUrl: 'f1', score: 3 },
      ],
      responses: {
        f1: [
          { email: 'a@x.org', name: 'Ana', score: 5 },
          { email: 'b@x.org', name: 'Bob', score: 4 },
          { email: 'c@x.org', name: 'Cy', score: 0 },
        ],
      },
    });

    t.run();

    expect(t.scoresTable.calls).toMatchObject({
      updateWhere: 1,
      insertMany: 1,
    });
    expect(t.scoresTable.rows.map((r) => [r.email, r.score]).sort()).toEqual([
      ['a@x.org', 5],
      ['b@x.org', 4],
      ['c@x.org', 0],
    ]);
    expect(t.respondentsTable.rows.map((r) => r.name).sort()).toEqual([
      'Ana',
      'Bob',
      'Cy',
    ]);
  });

  it('writes nothing when the scores did not change', () => {
    const t = setup({
      responses: { f1: [{ email: 'a@x.org', name: 'Ana', score: 5 }] },
    });
    t.run();
    const before = { ...t.scoresTable.calls };

    new t.app.RespondentScoreSynchronizer(
      new t.app.FormsCursor({ key: 'cursor:again' }),
      t.deps,
    ).run();

    expect(t.scoresTable.calls).toEqual(before);
  });

  it('records the form title, max points and sync time', () => {
    const t = setup({ responses: { f1: [] } });

    t.run();

    expect(t.deps.forms.get('f1')).toMatchObject({
      title: 'Title of f1',
      maxPoints: 0,
      status: 'linked',
      syncedAt: new Date('2026-03-01T10:00:00Z'),
    });
  });

  it('skips forms on the exclusion list and excluded forms', () => {
    const t = setup({
      formRows: [
        { url: 'f1', title: 'One', status: 'linked' },
        { url: 'f2', title: 'Two', status: 'excluded' },
        { url: 'f3', title: 'Three', status: 'linked' },
      ],
      excluded: ['f1'],
      responses: { f3: [{ email: 'a@x.org', name: 'Ana', score: 1 }] },
    });

    t.run();

    expect(t.openForm.mock.calls.map(([url]) => url)).toEqual(['f3']);
    expect(t.cursor.complete).toBe(true);
  });

  it('saves the cursor and schedules a continuation when time runs out', () => {
    const t = setup({
      formRows: [
        { url: 'f1', title: 'One', status: 'linked' },
        { url: 'f2', title: 'Two', status: 'linked' },
      ],
      timeBudget: 1,
    });

    t.run();

    expect(t.openForm.mock.calls.map(([url]) => url)).toEqual(['f1']);
    expect(t.cursor.complete).toBe(false);
    expect(t.cursor.lastFormUrl).toBe('f1');
    expect(t.scheduleContinuation).toHaveBeenCalledWith('cursor:test');
    expect(
      JSON.parse(t.properties.getProperty('cursor:test') ?? '{}'),
    ).toMatchObject({ lastFormUrl: 'f1', complete: false });
  });

  it('deletes the cursor and schedules nothing once every form is done', () => {
    const t = setup();

    t.run();

    expect(t.cursor.complete).toBe(true);
    expect(t.scheduleContinuation).not.toHaveBeenCalled();
    expect(t.properties.getProperty('cursor:test')).toBeNull();
  });

  it('records a form failure as its status and continues with the next form', () => {
    const t = setup({
      formRows: [
        { url: 'f1', title: 'One', status: 'linked' },
        { url: 'f2', title: 'Two', status: 'linked' },
        { url: 'f3', title: 'Three', status: 'linked' },
      ],
      responses: {
        f1: new Error('quota exceeded'),
        f3: [{ email: 'a@x.org', name: 'Ana', score: 2 }],
      },
      inaccessible: ['f2'],
    });

    t.run();

    expect(t.deps.forms.get('f1')).toMatchObject({
      status: 'error',
      error: 'quota exceeded',
    });
    expect(t.deps.forms.get('f2')?.status).toBe('error');
    expect(t.deps.forms.get('f3')?.status).toBe('linked');
    expect(t.scoresTable.rows).toHaveLength(1);
    expect(t.cursor.complete).toBe(true);
  });

  it('holds the script lock for the whole run and releases it', () => {
    const t = setup();

    t.run();

    expect(t.locks.acquired).toBeGreaterThan(0);
    expect(t.locks.released).toBe(t.locks.acquired);
  });

  it('does nothing when the lock cannot be acquired', () => {
    const lock = {
      waitLock: () => {
        throw new Error('Lock timeout');
      },
      tryLock: () => false,
      releaseLock: () => undefined,
      hasLock: () => false,
    };
    const t = setup({
      env: {
        globals: {
          LockService: {
            getScriptLock: () => lock,
            getDocumentLock: () => lock,
            getUserLock: () => lock,
          },
        },
      },
    });

    t.run();

    expect(t.openForm).not.toHaveBeenCalled();
    expect(t.scheduleContinuation).not.toHaveBeenCalled();
  });

  it('rethrows an error raised after the lock was acquired', () => {
    const t = setup();
    t.deps.forms.list = () => {
      throw new Error('sheet unavailable');
    };

    expect(() => t.run()).toThrow('sheet unavailable');
    expect(t.locks.released).toBe(t.locks.acquired);
  });

  it('deletes the fresh cursor when the lock is busy', () => {
    const lock = {
      waitLock: () => {
        throw new Error('Lock timeout');
      },
      tryLock: () => false,
      releaseLock: () => undefined,
      hasLock: () => false,
    };
    const t = setup({
      env: { globals: { LockService: { getScriptLock: () => lock } } },
    });
    t.cursor.save();

    t.run();

    expect(t.properties.getProperty('cursor:test')).toBeNull();
  });

  it('resumes after the last processed URL when a form is inserted before it', () => {
    const t = setup({
      formRows: [
        { url: 'f1', title: 'One', status: 'linked' },
        { url: 'f2', title: 'New', status: 'linked' },
        { url: 'f3', title: 'Three', status: 'linked' },
        { url: 'f5', title: 'Five', status: 'linked' },
      ],
      lastFormUrl: 'f3',
    });

    t.run();

    expect(t.openForm.mock.calls.map(([url]) => url)).toEqual(['f5']);
  });

  it('resumes at the next URL when the last processed form was removed', () => {
    const t = setup({
      formRows: [
        { url: 'f1', title: 'One', status: 'linked' },
        { url: 'f4', title: 'Four', status: 'linked' },
      ],
      lastFormUrl: 'f3',
    });

    t.run();

    expect(t.openForm.mock.calls.map(([url]) => url)).toEqual(['f4']);
  });

  it('saves the cursor after every form', () => {
    const t = setup({
      formRows: [
        { url: 'f1', title: 'One', status: 'linked' },
        { url: 'f2', title: 'Two', status: 'linked' },
      ],
      timeBudget: 1,
    });
    t.run();

    expect(
      JSON.parse(t.properties.getProperty('cursor:test') ?? '{}').lastFormUrl,
    ).toBe('f1');
  });
});
