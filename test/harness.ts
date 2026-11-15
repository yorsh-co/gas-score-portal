import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGasLoader, loadOrderFiles } from 'gasdev/test';

const ROOT = process.cwd();
const BUNDLE = 'src/lib/gas-libraries.js';

/** Globals of the app and the bundled libraries that tests may need. */
export interface AppExports {
  GasConfig: new (options: object) => unknown;
  GasLock: { withLock<T>(scope: string, callback: () => T): T };
  GasError: new (message: string, options?: object) => Error;
  getConfig_(): {
    get(key: string): unknown;
    getAll(): Record<string, unknown>;
    editors: string[];
  };
  GForms: {
    responses: {
      getScores(
        form: object,
        options: {
          after?: Date;
          multipleResponsesPerUser: 'newest' | 'oldest';
        },
      ): { email: string; name: string; score: number }[];
    };
  };
  MISSING_RESPONDENT_EMAIL: string;
  missingRespondentEmail_(responseId: string): string;
  isValidEmail_(email: string): boolean;
  MESSAGES_EN: Record<string, string>;
  MESSAGES_PT_BR: Record<string, string>;
  t(
    locale: string | undefined,
    key: MessageKeyApi,
    params?: Record<string, string | number>,
  ): string;
  tr_(key: MessageKeyApi, params?: Record<string, string | number>): string;
  isCallerEffectiveUser_(): boolean;
  assertCallerEffectiveUser_(message?: string): void;
  getExcludedFormUrls_(): string[];
  saveExcludedFormUrls_(urls: string[]): void;
  saveConfigValues_(changes: Record<string, string>): void;
  getFormTitleStripPatterns_(): string[];
  GasConfigRpc(method: string, payload?: unknown): unknown;
  runMenuAction_(logger: unknown, action: () => void): void;
  createCancelledError_(): Error;
  createFormsRepo_(table: object): FormsRepoApi;
  createRespondentsRepo_(table: object): RespondentsRepoApi;
  createScoresRepo_(table: object): ScoresRepoApi;
  migrateLegacyData_(
    legacy: { forms: unknown[][]; scores: unknown[][] },
    repos: { forms: object; respondents: object; scores: object },
    now?: Date,
  ): MigrationCountsApi;
  runLegacyMigration_(
    spreadsheet: object,
    repos: { forms: object; respondents: object; scores: object },
    refresh: () => void,
  ): MigrationCountsApi;
  FormsCursor: {
    new (options?: { key?: string; lastFormUrl?: string }): FormsCursorApi;
    initialize(): FormsCursorApi;
    deleteTrailing(prefix: string, keepKey: string): void;
  };
  TriggerUtils: {
    createContinuation(
      handler: string,
      options?: { interval?: number; dataString?: string | null },
    ): string;
    consumeContinuation(triggerId: string): string | null;
    isProjectTrigger(triggerUid: string | undefined, handler: string): boolean;
    deleteContinuations(handler: string): void;
  };
  continueSyncScores(e: { triggerUid: string }): void;
  timedSyncScores(e?: { triggerUid: string }): void;
  installTriggers_(): void;
  menuImportDriveForms(): void;
  menuInstall(): void;
  menuUninstall(): void;
  menuSystemReset(): void;
  menuLinkNewForm(): void;
  menuRemoveForms(): void;
  menuSettings(): void;
  onOpen(): void;
  migrateLegacySheets(): MigrationCountsApi;
  /** Tables cached by name; seeding it replaces the Sheets-backed ones. */
  dbTables: Record<string, unknown>;
  isLockTimeoutError_(err: unknown): boolean;
  RespondentScoreSynchronizer: new (
    cursor: FormsCursorApi,
    deps: SyncDepsApi,
  ) => { run(): void };
  columnLetter_(index: number): string;
  buildOverviewFormula_(
    forms: object,
    respondents: object,
    scores: object,
    separators?: { arg: string; column: string },
  ): string;
  detectFormulaSeparators_(sheet: object): { arg: string; column: string };
  refreshOverview_(
    spreadsheet: object,
    forms: object,
    respondents: object,
    scores: object,
  ): unknown;
  createScoresService_(getDeps: () => object): {
    getByUser(userId: string): UserScoresApi | null;
  };
  createRedactedLogger_(module?: string): {
    error(message: string, meta?: object): void;
  };
  createWebApp_(
    service: object,
    auth: object,
  ): {
    doGet(e: object): unknown;
    doPost(e: object): unknown;
  };
  createOtpService_(deps: object): {
    request(email: string): void;
    verify(email: string, code: string): boolean;
  };
  createSessionService_(deps: object): {
    create(email: string): string;
    resolve(token: string): string | null;
  };
  createOtpMailer_(
    getPortalTitle: () => string,
    getLocale: () => string,
  ): {
    hasQuota(): boolean;
    sendOtp(to: string, code: string, minutes: number): void;
  };
  createAuthServices_(
    respondents: () => object,
    logger: object,
  ): { otp: object; sessions: object; hmac(value: string): string };
  buildDemoData_(options?: {
    respondents?: number;
    forms?: number;
    seed?: number;
  }): DemoDataApi;
  isDemoEmail_(email: string): boolean;
  isDemoFormUrl_(url: string): boolean;
  writeDemoData_(
    data: DemoDataApi,
    repos: { forms: object; respondents: object; scores: object },
  ): { forms: number; respondents: number; scores: number };
  seedDemoData(
    tables?: { forms: object; respondents: object; scores: object },
    refresh?: () => unknown,
  ): { forms: number; respondents: number; scores: number };
  clearDemoData(
    tables?: { forms: object; respondents: object; scores: object },
    refresh?: () => unknown,
  ): { forms: number; respondents: number; scores: number };
  removeDemoData_(tables: {
    forms: object;
    respondents: object;
    scores: object;
  }): {
    forms: number;
    respondents: number;
    scores: number;
  };
  getApp_(): { doGet(e: object): unknown; doPost(e: object): unknown };
  doGet(e: object): unknown;
  doPost(e: object): unknown;
}

/** A message key; the catalogues are typed by the app, not by the tests. */
export type MessageKeyApi = string;

export interface UserScoresApi {
  email: string;
  name: string;
  alternatives: string[];
  scores: { formTitle: string; formPoints: number | null; score: number }[];
}

export interface FormsCursorApi {
  key: string;
  lastFormUrl: string;
  complete: boolean;
  save(): void;
  delete(): void;
}

export interface SyncDepsApi {
  forms: FormsRepoApi;
  respondents: RespondentsRepoApi;
  scores: ScoresRepoApi;
  timer: {
    start(): number;
    setSafetyMargin(ms: number): void;
    hasTimeLeft(): boolean;
    getTimeRemainingSafe(): number;
  };
  getExcludedUrls(): string[];
  openForm(url: string): unknown;
  getFormScores(
    form: unknown,
    after: Date | undefined,
  ): { email: string; name: string; score: number }[];
  scheduleContinuation(cursorKey: string): void;
  now(): Date;
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

export interface DemoDataApi {
  forms: FormRecordApi[];
  respondents: RespondentRecordApi[];
  scores: { email: string; formUrl: string; score: number }[];
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
  'GForms',
  'MISSING_RESPONDENT_EMAIL',
  'missingRespondentEmail_',
  'isValidEmail_',
  'getConfig_',
  'MESSAGES_EN',
  'MESSAGES_PT_BR',
  't',
  'tr_',
  'isCallerEffectiveUser_',
  'assertCallerEffectiveUser_',
  'getExcludedFormUrls_',
  'saveExcludedFormUrls_',
  'saveConfigValues_',
  'getFormTitleStripPatterns_',
  'GasConfigRpc',
  'runMenuAction_',
  'createCancelledError_',
  'FormsCursor',
  'TriggerUtils',
  'continueSyncScores',
  'timedSyncScores',
  'installTriggers_',
  'menuImportDriveForms',
  'menuInstall',
  'menuUninstall',
  'menuSystemReset',
  'menuLinkNewForm',
  'menuRemoveForms',
  'menuSettings',
  'onOpen',
  'migrateLegacySheets',
  'dbTables',
  'isLockTimeoutError_',
  'RespondentScoreSynchronizer',
  'createFormsRepo_',
  'createRespondentsRepo_',
  'createScoresRepo_',
  'migrateLegacyData_',
  'runLegacyMigration_',
  'columnLetter_',
  'buildOverviewFormula_',
  'detectFormulaSeparators_',
  'refreshOverview_',
  'createScoresService_',
  'createRedactedLogger_',
  'createWebApp_',
  'createOtpService_',
  'createSessionService_',
  'createOtpMailer_',
  'createAuthServices_',
  'buildDemoData_',
  'isDemoEmail_',
  'isDemoFormUrl_',
  'writeDemoData_',
  'removeDemoData_',
  'seedDemoData',
  'clearDemoData',
  'getApp_',
  'doGet',
  'doPost',
];

const load = createGasLoader<AppExports>({
  files: [BUNDLE, ...loadOrderFiles(ROOT)],
  exports: EXPORTS,
  root: ROOT,
});

/**
 * Files in the order clasp pushes them with `filePushOrder` from
 * `.clasp.example.json`: those first, then the rest alphabetically.
 */
function claspPushOrder(): string[] {
  const config = JSON.parse(
    readFileSync(join(ROOT, '.clasp.example.json'), 'utf8'),
  ) as { filePushOrder: string[] };
  const toSource = (path: string) =>
    path === 'dist/lib/gas-libraries.js'
      ? BUNDLE
      : path.replace(/^dist\//, 'src/').replace(/\.js$/, '.ts');
  const pinned = config.filePushOrder.map(toSource);
  const rest = loadOrderFiles(ROOT)
    .filter((file) => !pinned.includes(file))
    .sort((a, b) =>
      a.replace(/\.ts$/, '.js') < b.replace(/\.ts$/, '.js') ? -1 : 1,
    );
  return [...pinned, ...rest];
}

const loadInClaspOrder = createGasLoader<AppExports>({
  files: claspPushOrder(),
  exports: EXPORTS,
  root: ROOT,
});

/**
 * Whether the loaded app sources declare a global with this name, in the
 * scope `google.script.run` resolves function names against.
 * @param name Global name.
 */
export function declaresGlobal(name: string): boolean {
  const probe = createGasLoader({
    files: [BUNDLE, ...loadOrderFiles(ROOT)],
    exports: [name],
    root: ROOT,
  });
  try {
    probe({
      console,
      Error,
      SpreadsheetApp: {
        getActiveSpreadsheet: () => ({
          getOwner: () => null,
          getEditors: () => [],
        }),
      },
    });
    return true;
  } catch (err) {
    if (String(err).includes(`export "${name}" is not defined`)) return false;
    throw err;
  }
}

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

/**
 * `Session` of a `google.script.run` call to the web app, which executes as
 * the deployer `owner@x.org`.
 * @param visitor Email of the visitor; blank when anonymous.
 */
export const webAppSession = (visitor: string) => ({
  getActiveUser: () => ({ getEmail: () => visitor }),
  getEffectiveUser: () => ({ getEmail: () => 'owner@x.org' }),
});

/** Web app visitors other than the deployer: label and email. */
export const WEB_APP_VISITORS: [string, string][] = [
  ['an anonymous visitor', ''],
  ['another signed-in user', 'visitor@x.org'],
];

/** Options of the fake Apps Script environment. */
export interface FakeEnvironmentOptions {
  properties?: Record<string, string>;
  owner?: string | null;
  editors?: string[];
  activeUser?: string;
  /** Email of the user the script runs as. Defaults to `activeUser`. */
  effectiveUser?: string;
  /** Extra or overriding globals, such as spies. */
  globals?: Record<string, unknown>;
  /** Uses random UUIDs instead of a counter. */
  realUuids?: boolean;
  /** Loads the files in the order clasp pushes them. */
  claspOrder?: boolean;
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
  const toasts: { message: string; title: string; timeout: number }[] = [];
  const spreadsheet = {
    toast: (message: string, title: string, timeout: number) => {
      toasts.push({ message, title, timeout });
    },
    getOwner: () => (options.owner === null ? null : user(options.owner ?? '')),
    getEditors: () => (options.editors ?? []).map(user),
  };
  let uuid = 0;
  const triggers: { id: string; handler: string }[] = [];
  let triggerSeq = 0;
  const wrapTrigger = (t: { id: string; handler: string }) => ({
    getUniqueId: () => t.id,
    getHandlerFunction: () => t.handler,
  });
  const scriptApp = {
    newTrigger: (handler: string) => ({
      timeBased: () => ({
        after: () => ({
          create: () => {
            const t = { id: `trigger-${++triggerSeq}`, handler };
            triggers.push(t);
            return wrapTrigger(t);
          },
        }),
      }),
    }),
    getProjectTriggers: () => triggers.map(wrapTrigger),
    deleteTrigger: (trigger: { getUniqueId(): string }) => {
      const i = triggers.findIndex((t) => t.id === trigger.getUniqueId());
      if (i >= 0) triggers.splice(i, 1);
    },
  };

  let clock = Date.now();
  const cacheStore = new Map<string, { value: string; expiresAt: number }>();
  const live = (key: string) => {
    const entry = cacheStore.get(key);
    if (entry && entry.expiresAt <= clock) cacheStore.delete(key);
    return cacheStore.get(key);
  };
  const cache = {
    put: (key: string, value: string, ttl = 600) =>
      void cacheStore.set(key, { value, expiresAt: clock + ttl * 1000 }),
    get: (key: string) => live(key)?.value ?? null,
    remove: (key: string) => void cacheStore.delete(key),
    getAll: (keys: string[]) =>
      Object.fromEntries(
        keys.filter((k) => live(k)).map((k) => [k, live(k)?.value]),
      ),
    removeAll: (keys: string[]) => keys.forEach((k) => cacheStore.delete(k)),
  };

  const app = (options.claspOrder ? loadInClaspOrder : load)({
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
      getEffectiveUser: () =>
        user(options.effectiveUser ?? options.activeUser ?? ''),
    },
    ScriptApp: scriptApp,
    CacheService: { getScriptCache: () => cache },
    Utilities: {
      sleep: () => undefined,
      getUuid: options.realUuids ? randomUUID : () => `uuid-${++uuid}`,
      computeHmacSha256Signature: (value: string, key: string) =>
        [...createHmac('sha256', key).update(value).digest()].map((b) =>
          b > 127 ? b - 256 : b,
        ),
    },
    ...options.globals,
  });

  return {
    app,
    properties,
    locks,
    toasts,
    triggers,
    cache,
    cacheKeys: () => [...cacheStore.keys()],
    /** Moves the fake cache clock forward. */
    advance: (seconds: number) => void (clock += seconds * 1000),
  };
}
