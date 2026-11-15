import { describe, expect, it, vi } from 'vitest';
import { FakeTable } from '../fakes/sheetdb.fake';
import { loadApp } from '../harness';

const synced = new Date('2025-05-05T10:00:00Z');

/** Builds the `💯 Notas` matrix: urls, timestamps, points, titles, then people. */
function matrix() {
  return [
    ['', '', '', 'u1', 'u2', 'u3'],
    ['', '', '', synced, '', ''],
    ['', '', '', 10, 20, ''],
    ['', '', '', 'Quiz 4 - Alpha', 'Beta', 'Gamma'],
    ['Ana@X.org', 'Ana Souza', '', 10, 0, ''],
    ['bob@x.org', 'Bob', 'ana@x.org', '', 15, 'n/a'],
    ['', 'No email', '', 9, 9, 9],
  ];
}

const legacyForms = [
  ['u1', 'Alpha', 'Vinculado ao sistema', synced],
  ['u2', 'Beta', 'Consta na lista de Forms removidos', ''],
  ['u9', 'Broken', 'Erro: sem acesso', ''],
];

function setup() {
  const { app } = loadApp();
  const tables = {
    forms: new FakeTable(),
    respondents: new FakeTable(),
    scores: new FakeTable(),
  };
  const repos = {
    forms: app.createFormsRepo_(tables.forms),
    respondents: app.createRespondentsRepo_(tables.respondents),
    scores: app.createScoresRepo_(tables.scores),
  };
  const run = (legacy = { forms: legacyForms, scores: matrix() }) =>
    app.migrateLegacyData_(legacy, repos);
  return { repos, tables, run };
}

describe('migrateLegacyData_', () => {
  it('reads and writes scores once for the whole migration', () => {
    const { tables, run } = setup();

    run();

    expect(tables.scores.calls.insertMany).toBe(1);
    expect(tables.scores.calls.updateWhere).toBe(0);
  });

  it('copies forms, respondents and scores', () => {
    const { repos, run } = setup();

    const counts = run();

    expect(counts).toEqual({
      forms: 4,
      respondents: 2,
      scores: 3,
      invalidScores: 1,
    });
    expect(repos.forms.get('u1')).toMatchObject({
      title: 'Alpha',
      status: 'linked',
      maxPoints: 10,
      syncedAt: synced,
    });
    expect(repos.forms.get('u2')).toMatchObject({
      status: 'excluded',
      maxPoints: 20,
    });
    expect(repos.forms.get('u9')).toMatchObject({
      status: 'error',
      error: 'sem acesso',
    });
    expect(repos.forms.get('u3')).toMatchObject({
      title: 'Gamma',
      maxPoints: null,
    });
  });

  it('keeps alternatives and normalizes emails', () => {
    const { repos, run } = setup();
    run();

    expect(repos.respondents.findByEmail('ana@x.org')?.name).toBe('Ana Souza');
    expect(repos.respondents.findByEmail('bob@x.org')?.alternatives).toBe(
      'ana@x.org',
    );
  });

  it('skips empty cells but preserves a score of 0', () => {
    const { repos, run } = setup();
    run();

    expect([...repos.scores.getByForm('u1')]).toEqual([['ana@x.org', 10]]);
    expect([...repos.scores.getByForm('u2')]).toEqual([
      ['ana@x.org', 0],
      ['bob@x.org', 15],
    ]);
    expect(repos.scores.getByForm('u3').size).toBe(0);
  });

  it('is a no-op on rerun', () => {
    const { tables, run } = setup();
    run();
    const snapshot = JSON.stringify([
      tables.forms.rows,
      tables.respondents.rows,
      tables.scores.rows,
    ]);

    const callsAfterFirstRun = {
      ...tables.forms.calls,
      insertMany: tables.scores.calls.insertMany,
    };

    const counts = run();

    expect(counts).toEqual({
      forms: 0,
      respondents: 0,
      scores: 0,
      invalidScores: 1,
    });
    expect(tables.forms.calls.updateOneWhere).toBe(
      callsAfterFirstRun.updateOneWhere,
    );
    expect(tables.forms.calls.insert).toBe(callsAfterFirstRun.insert);
    expect(tables.scores.calls.insertMany).toBe(callsAfterFirstRun.insertMany);
    expect(tables.scores.calls.updateWhere).toBe(0);
    expect(
      JSON.stringify([
        tables.forms.rows,
        tables.respondents.rows,
        tables.scores.rows,
      ]),
    ).toBe(snapshot);
  });

  it('does not overwrite scores synced after the first run', () => {
    const { repos, run } = setup();
    run();
    repos.scores.upsertMany('u1', [{ email: 'ana@x.org', score: 99 }]);

    run();

    expect(repos.scores.getByForm('u1').get('ana@x.org')).toBe(99);
  });

  it('handles empty legacy sheets', () => {
    const { run } = setup();

    expect(run({ forms: [], scores: [] })).toEqual({
      forms: 0,
      respondents: 0,
      scores: 0,
      invalidScores: 0,
    });
  });
});

describe('runLegacyMigration_', () => {
  function fakeSheet(name: string, values: unknown[][]) {
    return {
      name,
      getName() {
        return this.name;
      },
      setName(next: string) {
        this.name = next;
      },
      getLastRow: () => values.length,
      getRange: (row: number) => ({
        getValues: () => values.slice(row - 1),
      }),
      getDataRange: () => ({ getValues: () => values }),
    };
  }

  function fakeSpreadsheet(sheets: ReturnType<typeof fakeSheet>[]) {
    return {
      getSheetByName: (name: string) =>
        sheets.find((s) => s.name === name) ?? null,
    };
  }

  function prepare(sheets: ReturnType<typeof fakeSheet>[]) {
    const { app } = loadApp();
    const tables = {
      forms: new FakeTable(),
      respondents: new FakeTable(),
      scores: new FakeTable(),
    };
    const refresh = vi.fn();
    const run = () =>
      app.runLegacyMigration_(
        fakeSpreadsheet(sheets),
        {
          forms: app.createFormsRepo_(tables.forms),
          respondents: app.createRespondentsRepo_(tables.respondents),
          scores: app.createScoresRepo_(tables.scores),
        },
        refresh,
      );
    return { tables, refresh, run };
  }

  it('migrates, renames the legacy sheets and is a no-op on rerun', () => {
    const forms = fakeSheet('🟪 Forms', [[], [], ...legacyForms]);
    const notas = fakeSheet('💯 Notas', matrix());
    const { tables, refresh, run } = prepare([forms, notas]);

    expect(run().scores).toBe(3);
    expect([forms.name, notas.name]).toEqual([
      'LEGACY 🟪 Forms',
      'LEGACY 💯 Notas',
    ]);

    const rows = tables.scores.rows.length;
    expect(run()).toEqual({
      forms: 0,
      respondents: 0,
      scores: 0,
      invalidScores: 0,
    });
    expect(tables.scores.rows).toHaveLength(rows);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('fails before writing when a LEGACY sheet already exists', () => {
    const notas = fakeSheet('💯 Notas', matrix());
    const taken = fakeSheet('LEGACY 💯 Notas', []);
    const { tables, refresh, run } = prepare([notas, taken]);

    expect(() => run()).toThrow(/already exists/);
    expect(tables.scores.rows).toHaveLength(0);
    expect(notas.name).toBe('💯 Notas');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('finishes a run where only one legacy sheet was renamed', () => {
    const forms = fakeSheet('LEGACY 🟪 Forms', [[], [], ...legacyForms]);
    const notas = fakeSheet('💯 Notas', matrix());
    const { tables, run } = prepare([forms, notas]);

    const counts = run();

    expect(counts.scores).toBe(3);
    expect(notas.name).toBe('LEGACY 💯 Notas');
    expect(forms.name).toBe('LEGACY 🟪 Forms');
    expect(tables.forms.rows.map((r) => r.url)).toContain('u3');
  });

  it('still refreshes the overview when no legacy sheet is left', () => {
    const { refresh, run } = prepare([]);

    expect(run().scores).toBe(0);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
