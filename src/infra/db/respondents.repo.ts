/** A row of the `Respondents` table. */
interface RespondentRecord {
  email: string;
  name: string;
  /** Free text listing other emails that the respondent also answered with. */
  alternatives: string;
}

/** Repository over the `Respondents` table. */
interface RespondentsRepo {
  /** Finds a respondent by email, ignoring case and surrounding spaces. */
  findByEmail(email: string): RespondentRecord | null;
  /** Respondents that list the email among their alternatives. */
  findByAlternative(email: string): RespondentRecord[];
  /** Inserts the respondent, or applies the given fields to the existing one. */
  upsert(
    respondent: Partial<RespondentRecord> & { email: string },
  ): RespondentRecord;
  /**
   * Inserts the respondents whose email is not stored yet, in one batch.
   * Existing respondents are left untouched. Returns the number inserted.
   */
  insertMissing(respondents: RespondentRecord[]): number;
}

/**
 * Trims and lowercases an email.
 * @param email Raw email.
 */
function normalizeEmail(email: unknown): string {
  return cellToString(email).trim().toLowerCase();
}

/**
 * Maps a stored entry to a respondent record.
 * @param entry Table entry.
 */
function toRespondentRecord(entry: GasSheetDbEntry): RespondentRecord {
  return {
    email: cellToString(entry.email),
    name: cellToString(entry.name),
    alternatives: cellToString(entry.alternatives),
  };
}

/**
 * Splits the free-text `alternatives` cell into normalized emails. Entries are
 * separated by commas, semicolons or whitespace, including line breaks.
 * @param text Cell content.
 */
function parseAlternatives(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map(normalizeEmail)
    .filter((email) => email !== '');
}

/**
 * Creates the respondents repository.
 * @param table Backing table.
 */
function createRespondentsRepo(table: DbTable): RespondentsRepo {
  const byEmail = (email: string) => (entry: GasSheetDbEntry) =>
    normalizeEmail(entry.email) === email;

  return {
    findByEmail(email) {
      const entry = table.findOneWhere(byEmail(normalizeEmail(email)));
      return entry ? toRespondentRecord(entry) : null;
    },
    findByAlternative(email) {
      const needle = normalizeEmail(email);
      if (!needle) return [];
      return table
        .findWhere(
          (entry) =>
            normalizeEmail(entry.email) !== needle &&
            parseAlternatives(cellToString(entry.alternatives)).includes(
              needle,
            ),
        )
        .map(toRespondentRecord);
    },
    insertMissing(respondents) {
      return GasLock.withLock('script', () => {
        const known = new Set(table.find().map((e) => normalizeEmail(e.email)));
        const added: GasSheetDbEntry[] = [];
        for (const respondent of respondents) {
          const email = normalizeEmail(respondent.email);
          if (!email || known.has(email)) continue;
          known.add(email);
          added.push({
            email,
            name: respondent.name,
            alternatives: respondent.alternatives,
          });
        }
        if (added.length) table.insertMany(added);
        return added.length;
      });
    },
    upsert(respondent) {
      const email = normalizeEmail(respondent.email);
      return GasLock.withLock('script', () => {
        const patch: GasSheetDbEntry = {};
        if (respondent.name !== undefined) patch.name = respondent.name;
        if (respondent.alternatives !== undefined)
          patch.alternatives = respondent.alternatives;
        const updated = table.updateOneWhere(byEmail(email), patch);
        if (updated) return toRespondentRecord(updated);
        return toRespondentRecord(
          table.insert({ email, name: '', alternatives: '', ...patch }),
        );
      });
    },
  };
}
