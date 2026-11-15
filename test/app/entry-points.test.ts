import { describe, expect, it, vi } from 'vitest';
import { FakeTable } from '../fakes/sheetdb.fake';
import {
  type AppExports,
  loadApp,
  WEB_APP_VISITORS,
  webAppSession,
} from '../harness';

const OWNER = 'owner@x.org';
const LINKED_URL = 'https://forms.example/linked';
const NEW_URL = 'https://forms.example/new';
const LEGACY_URL = 'https://forms.example/legacy';
const TIME_ZONE = 'America/Sao_Paulo';
const COLUMNS = [
  'url',
  'title',
  'status',
  'error',
  'email',
  'name',
  'formUrl',
  'score',
  '_isDeleted',
];
const TABLE_METHODS = [
  'find',
  'findWhere',
  'findOneWhere',
  'insert',
  'insertMany',
  'updateWhere',
  'updateOneWhere',
  'deleteWhere',
] as const;

/** A `FakeTable` with the sheet metadata that the menu handlers read. */
class SheetTable extends FakeTable {
  readonly schema = {
    ensureColumns: () => undefined,
    columnKeys: COLUMNS,
  };
  readonly rowNumbers = { firstData: 2 };
  readonly sheet = {
    getActiveRangeList: () => ({
      getRanges: () => [{ getRow: () => 2, getLastRow: () => 2 }],
    }),
    getRange: () => ({ getValues: () => [[LINKED_URL]] }),
  };

  constructor(readonly sheetName: string) {
    super();
  }
}

/**
 * Loads the app with fakes of the services that the entry points use. The
 * script runs as `OWNER`; the caller is a web app visitor when `visitor` is
 * given, or `OWNER` running it from the editor or a menu otherwise.
 * @param visitor Email of the web app visitor; blank when anonymous.
 * @param options `uiAvailable: false` makes `getUi` fail, as in a web app.
 */
function setup(
  visitor?: string,
  { uiAvailable = true }: { uiAvailable?: boolean } = {},
) {
  const tables = {
    forms: new SheetTable('Forms'),
    respondents: new SheetTable('Respondents'),
    scores: new SheetTable('Scores'),
  };
  const toasts: { message: string; title: string }[] = [];
  const triggers = [{ id: 'trigger-1', handler: 'timedSyncScores' }];
  const wrap = (t: { id: string; handler: string }) => ({
    getUniqueId: () => t.id,
    getHandlerFunction: () => t.handler,
  });

  const ui = {
    ButtonSet: { OK_CANCEL: 'OK_CANCEL' },
    Button: { OK: 'OK' },
    alert: vi.fn(() => 'OK'),
    prompt: vi.fn(() => ({
      getSelectedButton: () => 'OK',
      getResponseText: () => NEW_URL,
    })),
    showModalDialog: vi.fn(),
  };
  const getUi = vi.fn(() => {
    if (!uiAvailable) throw new Error('getUi is not available');
    return ui;
  });

  const setName = vi.fn();
  const getSheetByName = vi.fn((name: string) => {
    if (name === 'Overview') return overview;
    if (name !== '🟪 Forms') return null;
    return {
      getName: () => name,
      setName,
      getLastRow: () => 3,
      getRange: () => ({
        getValues: () => [[LEGACY_URL, 'Legacy', '', '']],
      }),
    };
  });
  const setFormula = vi.fn();
  const protection = {
    setWarningOnly: () => protection,
    setDescription: () => protection,
  };
  const overview = {
    clear: vi.fn(),
    getRange: () => ({ setFormula, getDisplayValue: () => '' }),
    setFrozenRows: vi.fn(),
    getProtections: () => [],
    protect: () => protection,
  };
  const setSpreadsheetTimeZone = vi.fn();
  const spreadsheet = {
    toast: (message: string, title: string) => {
      toasts.push({ message, title });
    },
    getOwner: () => ({ getEmail: () => OWNER }),
    getEditors: () => [],
    getActiveSheet: () => ({ getName: () => 'Forms' }),
    getSheetByName,
    insertSheet: () => overview,
    setSpreadsheetTimeZone,
  };
  const getActiveSpreadsheet = vi.fn(() => spreadsheet);

  const scriptApp = {
    AuthMode: { FULL: 'FULL' },
    AuthorizationStatus: { REQUIRED: 'REQUIRED' },
    getAuthorizationInfo: vi.fn(() => ({
      getAuthorizationStatus: () => 'NOT_REQUIRED',
    })),
    invalidateAuth: vi.fn(),
    requireAllScopes: vi.fn(),
    getProjectTriggers: vi.fn(() => triggers.map(wrap)),
    deleteTrigger: vi.fn((trigger: { getUniqueId(): string }) => {
      const i = triggers.findIndex((t) => t.id === trigger.getUniqueId());
      if (i >= 0) triggers.splice(i, 1);
    }),
    newTrigger: vi.fn((handler: string) => ({
      timeBased: () => ({
        everyMinutes: () => ({
          create: () => {
            triggers.push({ id: `trigger-${triggers.length + 1}`, handler });
          },
        }),
      }),
    })),
  };
  const openByUrl = vi.fn(() => ({
    getEditUrl: () => NEW_URL,
    getTitle: () => 'New quiz',
  }));

  const session = {
    ...webAppSession(visitor ?? OWNER),
    getScriptTimeZone: () => TIME_ZONE,
  };
  const env = loadApp({
    properties: { keep: '1' },
    globals: {
      Session: session,
      SpreadsheetApp: {
        getActiveSpreadsheet,
        getUi,
        flush: vi.fn(),
        ProtectionType: { SHEET: 'SHEET' },
      },
      ScriptApp: scriptApp,
      FormApp: { openByUrl },
    },
  });

  env.app.dbTables.Forms = tables.forms;
  env.app.dbTables.Respondents = tables.respondents;
  env.app.dbTables.Scores = tables.scores;
  env.app
    .createFormsRepo(tables.forms)
    .upsert({ url: LINKED_URL, title: 'Linked', status: 'linked', error: '' });
  tables.respondents.insert({ email: 'ana@x.org', name: 'Ana' });
  tables.scores.insert({ email: 'ana@x.org', formUrl: LINKED_URL, score: 1 });

  const showDialog = vi.fn();
  (env.app.getConfig() as unknown as { showDialog: unknown }).showDialog =
    showDialog;

  const tableSpies = Object.values(tables).flatMap((table) =>
    TABLE_METHODS.map((method) => vi.spyOn(table, method)),
  );
  const spies = [
    getUi,
    getActiveSpreadsheet,
    getSheetByName,
    ...Object.values(scriptApp).filter(vi.isMockFunction),
    openByUrl,
    showDialog,
    ui.alert,
    ui.prompt,
    ui.showModalDialog,
    ...tableSpies,
  ];
  spies.forEach((spy) => spy.mockClear());
  toasts.length = 0;
  env.locks.acquired = 0;
  env.locks.released = 0;

  return {
    ...env,
    tables,
    toasts,
    triggers,
    ui,
    getUi,
    getSheetByName,
    setName,
    setFormula,
    setSpreadsheetTimeZone,
    scriptApp,
    openByUrl,
    showDialog,
    spies,
    tableSpies,
  };
}

type Env = ReturnType<typeof setup>;

/** The public entry points that act on the spreadsheet or script settings. */
const ENTRY_POINTS: {
  name: string;
  /** Runs inside `runMenuAction`, so a refusal is toasted. */
  menu: boolean;
  call: (app: AppExports) => unknown;
  /** Asserts the main effect of a successful call. */
  verify: (env: Env, result: unknown) => void;
}[] = [
  {
    name: 'menuInstall',
    menu: true,
    call: (app) => app.menuInstall(),
    verify: (env) => {
      expect(env.scriptApp.getAuthorizationInfo).toHaveBeenCalled();
      expect(env.scriptApp.newTrigger).toHaveBeenCalledWith('timedSyncScores');
      expect(env.triggers.map((t) => t.handler)).toEqual(['timedSyncScores']);
      expect(env.setSpreadsheetTimeZone).toHaveBeenCalledWith(TIME_ZONE);
      expect(env.setFormula).toHaveBeenCalled();
    },
  },
  {
    name: 'menuUninstall',
    menu: true,
    call: (app) => app.menuUninstall(),
    verify: (env) => {
      expect(env.triggers).toEqual([]);
      expect(env.properties.getKeys()).toEqual([]);
    },
  },
  {
    name: 'menuSystemReset',
    menu: true,
    call: (app) => app.menuSystemReset(),
    verify: (env) => {
      expect(env.tables.forms.rows).toEqual([]);
      expect(env.tables.respondents.rows).toEqual([]);
      expect(env.tables.scores.rows).toEqual([]);
      expect(env.scriptApp.invalidateAuth).toHaveBeenCalled();
    },
  },
  {
    name: 'menuLinkNewForm',
    menu: true,
    call: (app) => app.menuLinkNewForm(),
    verify: (env) => {
      expect(env.tables.forms.rows).toContainEqual(
        expect.objectContaining({
          url: NEW_URL,
          title: 'New quiz',
          status: 'linked',
        }),
      );
    },
  },
  {
    name: 'menuRemoveForms',
    menu: true,
    call: (app) => app.menuRemoveForms(),
    verify: (env) => {
      expect(env.tables.forms.rows).toContainEqual(
        expect.objectContaining({ url: LINKED_URL, status: 'excluded' }),
      );
    },
  },
  {
    name: 'menuSettings',
    menu: false,
    call: (app) => app.menuSettings(),
    verify: (env) => {
      expect(env.showDialog).toHaveBeenCalledWith(env.ui);
    },
  },
  {
    name: 'migrateLegacySheets',
    menu: false,
    call: (app) => app.migrateLegacySheets(),
    verify: (env, result) => {
      expect(result).toEqual({
        forms: 1,
        respondents: 0,
        scores: 0,
        invalidScores: 0,
      });
      expect(env.tables.forms.rows).toContainEqual(
        expect.objectContaining({ url: LEGACY_URL }),
      );
      expect(env.setName).toHaveBeenCalledWith('LEGACY 🟪 Forms');
    },
  },
];

/**
 * Asserts that nothing ran after the load: no spreadsheet, UI, trigger,
 * authorization or table access, no lock, and no property or row change.
 * @param env Environment from `setup`.
 * @param before Properties and table rows taken right after the load.
 */
function expectUntouched(
  env: Env,
  before: { properties: Record<string, string>; rows: unknown[][] },
) {
  expect(env.properties.getProperties()).toEqual(before.properties);
  expect(Object.values(env.tables).map((table) => table.rows)).toEqual(
    before.rows,
  );
  expect(env.triggers).toHaveLength(1);
  expect(env.locks.acquired).toBe(0);
  // getActiveSpreadsheet is not asserted: the Forbidden toast needs it.
  expect(env.getUi).not.toHaveBeenCalled();
  expect(env.getSheetByName).not.toHaveBeenCalled();
  expect(env.openByUrl).not.toHaveBeenCalled();
  expect(env.showDialog).not.toHaveBeenCalled();
  expect(env.scriptApp.getAuthorizationInfo).not.toHaveBeenCalled();
  expect(env.scriptApp.invalidateAuth).not.toHaveBeenCalled();
  expect(env.scriptApp.getProjectTriggers).not.toHaveBeenCalled();
  expect(env.scriptApp.deleteTrigger).not.toHaveBeenCalled();
  expect(env.scriptApp.newTrigger).not.toHaveBeenCalled();
  env.tableSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
}

/** Snapshot of the state that a refused call must leave unchanged. */
function snapshot(env: Env) {
  return {
    properties: env.properties.getProperties(),
    rows: Object.values(env.tables).map((table) =>
      table.rows.map((row) => ({ ...row })),
    ),
  };
}

describe.each(ENTRY_POINTS)('$name', ({ menu, call, verify }) => {
  it.each(WEB_APP_VISITORS)(
    'rejects a web app call by %s before any side effect',
    (_, visitor) => {
      const env = setup(visitor);
      const before = snapshot(env);

      expect(() => call(env.app)).toThrow(/Forbidden/);

      expectUntouched(env, before);
      if (menu) expect(env.toasts.map((t) => t.message)).toEqual(['Forbidden']);
      else expect(env.toasts).toEqual([]);
    },
  );

  it('runs for a user who runs it with their own authority', () => {
    const env = setup();

    const result = call(env.app);

    verify(env, result);
    expect(env.toasts.map((t) => t.message).join('\n')).not.toMatch(
      /Forbidden|error/i,
    );
  });
});

describe('onOpen', () => {
  it.each(WEB_APP_VISITORS)(
    'fails at getUi and writes nothing for a web app call by %s',
    (_, visitor) => {
      const env = setup(visitor, { uiAvailable: false });
      const before = snapshot(env);

      expect(() => env.app.onOpen()).toThrow(/getUi/);

      expect(env.getUi).toHaveBeenCalled();
      expect(env.properties.getProperties()).toEqual(before.properties);
      expect(Object.values(env.tables).map((table) => table.rows)).toEqual(
        before.rows,
      );
      env.tableSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
      expect(env.triggers).toHaveLength(1);
      expect(env.scriptApp.newTrigger).not.toHaveBeenCalled();
      expect(env.scriptApp.deleteTrigger).not.toHaveBeenCalled();
      expect(env.locks.acquired).toBe(0);
    },
  );
});
