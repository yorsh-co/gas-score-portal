/** A row of the `Respondents` table. */
interface RespondentRecord {
  email: string;
  name: string;
  /** Free text listing other emails that the respondent also answered with. */
  alternatives: string;
}

/** Repository over the `Respondents` table. */
interface RespondentsRepo {
  /** Finds a respondent by email, ignoring case, surrounding spaces and Unicode
   * composition form. */
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
 * Trims, lowercases and NFC-normalizes an email. Lowercasing runs before
 * NFC so the result is idempotent.
 * @param email Raw email.
 */
function normalizeEmail_(email: unknown): string {
  return cellToString_(email).trim().toLowerCase().normalize('NFC');
}

/**
 * Maps a stored entry to a respondent record.
 * @param entry Table entry.
 */
function toRespondentRecord_(entry: GasSheetDbEntry): RespondentRecord {
  return {
    email: cellToString_(entry.email),
    name: cellToString_(entry.name),
    alternatives: cellToString_(entry.alternatives),
  };
}

/**
 * Splits the free-text `alternatives` cell into normalized emails. Entries are
 * separated by commas, semicolons or whitespace, including line breaks.
 * @param text Cell content.
 */
function parseAlternatives_(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map(normalizeEmail_)
    .filter((email) => email !== '');
}

/**
 * Creates the respondents repository.
 * @param table Backing table.
 */
function createRespondentsRepo_(table: DbTable): RespondentsRepo {
  const byEmail = (email: string) => (entry: GasSheetDbEntry) =>
    normalizeEmail_(entry.email) === email;

  return {
    findByEmail(email) {
      const entry = table.findOneWhere(byEmail(normalizeEmail_(email)));
      return entry ? toRespondentRecord_(entry) : null;
    },
    findByAlternative(email) {
      const needle = normalizeEmail_(email);
      if (!needle) return [];
      return table
        .findWhere(
          (entry) =>
            normalizeEmail_(entry.email) !== needle &&
            parseAlternatives_(cellToString_(entry.alternatives)).includes(
              needle,
            ),
        )
        .map(toRespondentRecord_);
    },
    insertMissing(respondents) {
      return GasLock.withLock('script', () => {
        const known = new Set(
          table.find().map((e) => normalizeEmail_(e.email)),
        );
        const added: GasSheetDbEntry[] = [];
        for (const respondent of respondents) {
          const email = normalizeEmail_(respondent.email);
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
      const email = normalizeEmail_(respondent.email);
      return GasLock.withLock('script', () => {
        const patch: GasSheetDbEntry = {};
        if (respondent.name !== undefined) patch.name = respondent.name;
        if (respondent.alternatives !== undefined)
          patch.alternatives = respondent.alternatives;
        const updated = table.updateOneWhere(byEmail(email), patch);
        if (updated) return toRespondentRecord_(updated);
        return toRespondentRecord_(
          table.insert({ email, name: '', alternatives: '', ...patch }),
        );
      });
    },
  };
}
