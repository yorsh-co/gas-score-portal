/** A row of the `Scores` table. */
interface ScoreRecord {
  email: string;
  formUrl: string;
  score: number;
  updatedAt: Date | null;
}

/** A score to store for a respondent. */
interface ScoreInput {
  email: string;
  score: number;
}

/** Outcome of `ScoresRepo.upsertMany`. */
interface UpsertScoresResult {
  inserted: number;
  updated: number;
  unchanged: number;
}

/** Repository over the `Scores` table. */
interface ScoresRepo {
  /** Scores of one form, keyed by normalized email. */
  getByForm(formUrl: string): Map<string, number>;
  /** All scores of the given emails. */
  getByEmails(emails: string[]): ScoreRecord[];
  /**
   * Inserts the scores whose `(email, formUrl)` pair is not stored yet, with
   * one read and one `insertMany`. Stored scores are never changed. Returns
   * the number inserted.
   */
  insertMissing(
    scores: (ScoreInput & { formUrl: string })[],
    now?: Date,
  ): number;
  /**
   * Stores the scores of one form, writing only those that are new or
   * changed: one `updateWhere` and one `insertMany` per call.
   */
  upsertMany(
    formUrl: string,
    scores: ScoreInput[],
    now?: Date,
  ): UpsertScoresResult;
}

/**
 * Maps a stored entry to a score record.
 * @param entry Table entry.
 */
function toScoreRecord(entry: GasSheetDbEntry): ScoreRecord {
  return {
    email: normalizeEmail(entry.email),
    formUrl: cellToString(entry.formUrl),
    score: cellToNumber(entry.score) ?? 0,
    updatedAt: cellToDate(entry.updatedAt),
  };
}

/**
 * Creates the scores repository.
 * @param table Backing table.
 */
function createScoresRepo(table: DbTable): ScoresRepo {
  const getByForm = (formUrl: string): Map<string, number> => {
    const scores = new Map<string, number>();
    for (const entry of table.findWhere((e) => e.formUrl === formUrl)) {
      const record = toScoreRecord(entry);
      scores.set(record.email, record.score);
    }
    return scores;
  };

  return {
    getByForm,
    insertMissing(scores, now = new Date()) {
      return GasLock.withLock('script', () => {
        const key = (email: string, formUrl: string) => `${formUrl}\n${email}`;
        const known = new Set(
          table
            .find()
            .map((e) => key(normalizeEmail(e.email), cellToString(e.formUrl))),
        );
        const added: GasSheetDbEntry[] = [];
        for (const { email, formUrl, score } of scores) {
          const normalized = normalizeEmail(email);
          const id = key(normalized, formUrl);
          if (known.has(id)) continue;
          known.add(id);
          added.push({ email: normalized, formUrl, score, updatedAt: now });
        }
        if (added.length) table.insertMany(added);
        return added.length;
      });
    },
    getByEmails(emails) {
      const wanted = new Set(emails.map(normalizeEmail));
      return table
        .findWhere((entry) => wanted.has(normalizeEmail(entry.email)))
        .map(toScoreRecord);
    },
    upsertMany(formUrl, scores, now = new Date()) {
      return GasLock.withLock('script', () => {
        const stored = getByForm(formUrl);
        const incoming = new Map<string, number>();
        for (const { email, score } of scores)
          incoming.set(normalizeEmail(email), score);

        const changed = new Map<string, number>();
        const added: GasSheetDbEntry[] = [];
        let unchanged = 0;
        for (const [email, score] of incoming) {
          if (!stored.has(email)) {
            added.push({ email, formUrl, score, updatedAt: now });
          } else if (stored.get(email) === score) {
            unchanged++;
          } else {
            changed.set(email, score);
          }
        }

        if (changed.size) {
          table.updateWhere(
            (entry) =>
              entry.formUrl === formUrl &&
              changed.has(normalizeEmail(entry.email)),
            (entry) => ({
              score: changed.get(normalizeEmail(entry.email)),
              updatedAt: now,
            }),
          );
        }
        if (added.length) table.insertMany(added);

        return { inserted: added.length, updated: changed.size, unchanged };
      });
    },
  };
}
