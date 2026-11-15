/** Time kept in reserve so the run can save its cursor and schedule a continuation. */
const SYNC_SAFETY_MARGIN_MS = 120 * 1000;
/** Longest wait for the script lock before giving up on a run. */
const SYNC_LOCK_TIMEOUT_MS = 60 * 1000;
/** Responses are re-read from this long before the last sync, to absorb clock skew. */
const SYNC_OVERLAP_MS = 60 * 60 * 1000;
/** Handler that resumes a synchronization. */
const CONTINUATION_HANDLER = 'continueSyncScores';

/** Collaborators of `RespondentScoreSynchronizer`, replaceable in tests. */
interface SyncDeps {
  forms: FormsRepo;
  respondents: RespondentsRepo;
  scores: ScoresRepo;
  /** Started timer of the execution. */
  timer: ExecutionTimerApi;
  /** URLs of the Forms excluded in the settings. */
  getExcludedUrls(): string[];
  openForm(url: string): GoogleAppsScript.Forms.Form | null;
  getFormScores(
    form: GoogleAppsScript.Forms.Form,
    after: Date | undefined,
  ): FormScore[];
  /** Schedules the run that resumes the cursor. */
  scheduleContinuation(cursorKey: string): void;
  now(): Date;
}

/**
 * Creates a started timer with the synchronization's safety margin. Create it
 * at the top of the execution so every step shares one budget.
 */
function createSyncTimer(): ExecutionTimerApi {
  const timer = ExecutionTimer();
  timer.start();
  timer.setSafetyMargin(SYNC_SAFETY_MARGIN_MS);
  return timer;
}

/**
 * Creates the collaborators backed by the spreadsheet and the Apps Script
 * services.
 * @param timer Started timer of the execution.
 */
function createSyncDeps(
  timer: ExecutionTimerApi = createSyncTimer(),
): SyncDeps {
  return {
    forms: createFormsRepo(getFormsTable()),
    respondents: createRespondentsRepo(getRespondentsTable()),
    scores: createScoresRepo(getScoresTable()),
    timer,
    getExcludedUrls: getExcludedFormUrls_,
    openForm: (url) => GForms.forms.get({ url }),
    getFormScores: (form, after) =>
      GForms.responses.getScores(form, {
        after,
        multipleResponsesPerUser: 'newest',
      }),
    scheduleContinuation: (cursorKey) => {
      TriggerUtils.createContinuation(CONTINUATION_HANDLER, {
        dataString: cursorKey,
      });
    },
    now: () => new Date(),
  };
}

/**
 * Copies the respondents' scores from the linked Forms into the tables.
 * It walks the forms from a persisted cursor and, when time runs out, saves
 * the cursor and schedules a continuation. Writes are differential: only new
 * or changed scores are stored.
 */
class RespondentScoreSynchronizer {
  private readonly logger = createModuleLogger('sync');

  constructor(
    private readonly cursor: FormsCursor,
    private readonly deps: SyncDeps = createSyncDeps(),
  ) {}

  /**
   * Runs the synchronization while holding the script lock, so two runs never
   * overlap. Returns without doing anything when the lock cannot be acquired.
   */
  run(): void {
    const { timer } = this.deps;

    let started = false;
    try {
      GasLock.withLock(
        'script',
        () => {
          started = true;
          this.syncForms();
        },
        {
          timeoutMs: Math.min(
            timer.getTimeRemainingSafe(),
            SYNC_LOCK_TIMEOUT_MS,
          ),
        },
      );
    } catch (err) {
      if (started) throw err;
      this.logger.warn('Another synchronization is running, skipping', {
        error: getErrorMessage(err),
      });
      this.cursor.delete();
      return;
    }

    if (this.cursor.complete) {
      this.logger.info('Finished syncing respondent scores for all forms');
      this.cursor.delete();
    } else {
      this.logger.info('Forms are still to be processed', {
        lastFormUrl: this.cursor.lastFormUrl,
      });
      this.deps.scheduleContinuation(this.cursor.key);
    }
  }

  private syncForms(): void {
    const { cursor, deps } = this;
    const forms = deps.forms
      .list()
      .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
    const excluded = new Set(deps.getExcludedUrls());
    // Forms are walked in URL order, so the cursor survives forms being added
    // or removed between executions.
    const pending = forms.filter((form) => form.url > cursor.lastFormUrl);
    let done = 0;
    let count = 0;

    for (const form of pending) {
      if (!deps.timer.hasTimeLeft()) break;

      if (excluded.has(form.url) || form.status === 'excluded') {
        this.logger.info('Skipping an excluded form', { form: form.url });
      } else if (this.syncForm(form)) {
        count++;
      }

      cursor.lastFormUrl = form.url;
      cursor.save();
      done++;
    }

    cursor.complete = done >= pending.length;
    this.logger.info('Synced forms', { count });
  }

  /**
   * Synchronizes one form. A failure is stored as the form's status so the
   * remaining forms are still processed.
   * @returns Whether the form was synchronized.
   */
  private syncForm(record: FormRecord): boolean {
    try {
      this.processForm(record);
      return true;
    } catch (err) {
      this.logger.error('Failed to sync a form', {
        form: record.url,
        error: getErrorMessage(err),
      });
      this.deps.forms.updateStatus(record.url, 'error', getErrorMessage(err));
      return false;
    }
  }

  private processForm(record: FormRecord): void {
    const { deps } = this;
    const linked = LinkedForm.fromRecord(record);
    linked.form = deps.openForm(record.url);
    if (!linked.form) throw new GasNotFoundError(tr('error.fileInaccessible'));

    const maxPoints = linked.getMaxPoints();
    const formScores = deps.getFormScores(
      linked.form,
      this.getAfterTimestamp(linked),
    );

    deps.respondents.insertMissing(
      formScores.map(({ email, name }) => ({ email, name, alternatives: '' })),
    );
    const result = deps.scores.upsertMany(
      record.url,
      formScores.map(({ email, score }) => ({ email, score })),
      deps.now(),
    );
    this.logger.info('Stored scores', { form: record.url, ...result });

    deps.forms.upsert({
      url: record.url,
      title: linked.form.getTitle(),
      maxPoints,
      syncedAt: deps.now(),
      status: 'linked',
      error: '',
    });
  }

  /** Start of the window of responses to read, or `undefined` for all of them. */
  private getAfterTimestamp(linked: LinkedForm): Date | undefined {
    return linked.syncedAt
      ? new Date(linked.syncedAt.getTime() - SYNC_OVERLAP_MS)
      : undefined;
  }
}
