import { createGasLoader, loadOrderFiles } from 'gas-dev-config/test';

const ROOT = process.cwd();
const BUNDLE = 'src/lib/gas-libraries.js';

/** Globals of the app and the bundled libraries that tests may need. */
export interface AppExports {
  GasConfig: new (options: object) => unknown;
  GasLock: { withLock<T>(scope: string, callback: () => T): T };
  GasError: new (message: string, options?: object) => Error;
  getConfig(): {
    get(key: string): unknown;
    getAll(): Record<string, unknown>;
    editors: string[];
  };
  getExcludedFormUrls(): string[];
  saveExcludedFormUrls(urls: string[]): void;
  runMenuAction(logger: unknown, action: () => void): void;
  createCancelledError(): Error;
  createFormsRepo(table: object): FormsRepoApi;
  createRespondentsRepo(table: object): RespondentsRepoApi;
  createScoresRepo(table: object): ScoresRepoApi;
  migrateLegacyData(
    legacy: { forms: unknown[][]; scores: unknown[][] },
    repos: { forms: object; respondents: object; scores: object },
    now?: Date,
  ): MigrationCountsApi;
  runLegacyMigration(
    spreadsheet: object,
    repos: { forms: object; respondents: object; scores: object },
    refresh: () => void,
  ): MigrationCountsApi;
  columnLetter(index: number): string;
  buildOverviewFormula(
    forms: object,
    respondents: object,
    scores: object,
  ): string;
  refreshOverview(
    spreadsheet: object,
    forms: object,
    respondents: object,
    scores: object,
  ): unknown;
}

export interface FormRecordApi {
  url: string;
  title: string;
  maxPoints: number | null;
  status: string;
  syncedAt: Date | null;
  error: string;
}

export interface FormsRepoApi {
  list(): FormRecordApi[];
  get(url: string): FormRecordApi | null;
  upsert(form: Partial<FormRecordApi> & { url: string }): FormRecordApi;
  updateStatus(url: string, status: string, error?: string): FormRecordApi;
}

export interface RespondentRecordApi {
  email: string;
  name: string;
  alternatives: string;
}

export interface RespondentsRepoApi {
  findByEmail(email: string): RespondentRecordApi | null;
  findByAlternative(email: string): RespondentRecordApi[];
  upsert(
    respondent: Partial<RespondentRecordApi> & { email: string },
  ): RespondentRecordApi;
  insertMissing(respondents: RespondentRecordApi[]): number;
}

export interface ScoresRepoApi {
  getByForm(formUrl: string): Map<string, number>;
  getByEmails(
    emails: string[],
  ): { email: string; formUrl: string; score: number }[];
  insertMissing(
    scores: { email: string; formUrl: string; score: number }[],
    now?: Date,
  ): number;
  upsertMany(
    formUrl: string,
    scores: { email: string; score: number }[],
    now?: Date,
  ): { inserted: number; updated: number; unchanged: number };
}

export interface MigrationCountsApi {
  forms: number;
  respondents: number;
  scores: number;
  invalidScores: number;
}

const EXPORTS: (keyof AppExports)[] = [
  'GasConfig',
  'GasLock',
  'GasError',
  'getConfig',
  'getExcludedFormUrls',
  'saveExcludedFormUrls',
  'runMenuAction',
  'createCancelledError',
  'createFormsRepo',
  'createRespondentsRepo',
  'createScoresRepo',
  'migrateLegacyData',
  'runLegacyMigration',
  'columnLetter',
  'buildOverviewFormula',
  'refreshOverview',
];

const load = createGasLoader<AppExports>({
  files: [BUNDLE, ...loadOrderFiles(ROOT)],
  exports: EXPORTS,
  root: ROOT,
});

/** In-memory `PropertiesService.getScriptProperties()`. */
export function createFakeProperties(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const properties = {
    getProperty: (key: string) => store.get(key) ?? null,
    setProperty(key: string, value: string) {
      store.set(key, value);
      return properties;
    },
    setProperties(values: Record<string, string>) {
      Object.entries(values).forEach(([k, v]) => store.set(k, v));
      return properties;
    },
    deleteProperty(key: string) {
      store.delete(key);
      return properties;
    },
    deleteAllProperties() {
      store.clear();
      return properties;
    },
    getProperties: () => Object.fromEntries(store),
    getKeys: () => [...store.keys()],
  };
  return properties;
}

/** Options of the fake Apps Script environment. */
export interface FakeEnvironmentOptions {
  properties?: Record<string, string>;
  owner?: string | null;
  editors?: string[];
  activeUser?: string;
  /** Extra or overriding globals, such as spies. */
  globals?: Record<string, unknown>;
}

/** Records the lock operations of the fake `LockService`. */
export interface LockLog {
  acquired: number;
  released: number;
}

/**
 * Loads the app sources against in-memory fakes of the Apps Script services.
 * @param options Fake state.
 */
export function loadApp(options: FakeEnvironmentOptions = {}) {
  const properties = createFakeProperties(options.properties);
  const locks: LockLog = { acquired: 0, released: 0 };
  const lock = {
    waitLock: () => {
      locks.acquired++;
    },
    tryLock: () => {
      locks.acquired++;
      return true;
    },
    releaseLock: () => {
      locks.released++;
    },
    hasLock: () => locks.acquired > locks.released,
  };
  const user = (email: string) => ({ getEmail: () => email });
  const spreadsheet = {
    getOwner: () => (options.owner === null ? null : user(options.owner ?? '')),
    getEditors: () => (options.editors ?? []).map(user),
  };
  let uuid = 0;

  const app = load({
    console,
    Error,
    PropertiesService: { getScriptProperties: () => properties },
    LockService: {
      getScriptLock: () => lock,
      getDocumentLock: () => lock,
      getUserLock: () => lock,
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    Session: {
      getActiveUser: () => user(options.activeUser ?? ''),
      getEffectiveUser: () => user(options.activeUser ?? ''),
    },
    Utilities: { getUuid: () => `uuid-${++uuid}` },
    Toast: { error: () => undefined },
    ...options.globals,
  });

  return { app, properties, locks };
}
