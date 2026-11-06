/** Names and layout of the legacy sheets, kept only to migrate them. */
const LEGACY = {
  formsSheet: '🟪 Forms',
  scoresSheet: '💯 Notas',
  renamePrefix: 'LEGACY ',
  /** 0-based row and column offsets of the `💯 Notas` matrix. */
  scores: {
    urlRow: 0,
    timestampRow: 1,
    pointsRow: 2,
    titleRow: 3,
    firstRow: 4,
    emailCol: 0,
    nameCol: 1,
    alternativesCol: 2,
    firstCol: 3,
  },
  /** 1-based layout of the `🟪 Forms` sheet. */
  forms: { firstRow: 3, numCols: 4 },
} as const;

/** Status texts the legacy `🟪 Forms` sheet could show. */
const LEGACY_EXCLUDED_STATUS = 'Consta na lista de Forms removidos';
const LEGACY_LINKED_STATUS = 'Vinculado ao sistema';

/** Cell values of the two legacy sheets. */
interface LegacyData {
  /** `🟪 Forms` rows from the first data row: url, title, status, timestamp. */
  forms: unknown[][];
  /** The whole `💯 Notas` range, from row 1. */
  scores: unknown[][];
}

/** The repositories that the migration writes to. */
interface MigrationRepos {
  forms: FormsRepo;
  respondents: RespondentsRepo;
  scores: ScoresRepo;
}

/** What a migration run wrote. A rerun reports zeros. */
interface MigrationCounts {
  forms: number;
  respondents: number;
  scores: number;
  /** Score cells ignored for not being numbers. */
  invalidScores: number;
}

/**
 * Returns a `syncedAt` patch, or nothing when the date is missing.
 * @param date Parsed legacy timestamp.
 */
function dateField(date: Date | null): { syncedAt?: Date } {
  return date ? { syncedAt: date } : {};
}

/**
 * Maps the free-text legacy status to a form status and error text.
 * @param text Legacy status cell.
 */
function mapLegacyStatus(text: string): { status: FormStatus; error: string } {
  if (!text || text === LEGACY_LINKED_STATUS)
    return { status: 'linked', error: '' };
  if (text === LEGACY_EXCLUDED_STATUS) return { status: 'excluded', error: '' };
  return { status: 'error', error: text.replace(/^Erro:\s*/, '') };
}

/**
 * Copies the legacy data into the tables. Existing rows are never touched,
 * so a rerun writes nothing, and an empty score cell is skipped while a `0`
 * is kept.
 * @param legacy Legacy sheet values.
 * @param repos Target repositories.
 * @param now Timestamp stored on migrated scores.
 */
function migrateLegacyData(
  legacy: LegacyData,
  repos: MigrationRepos,
  now: Date = new Date(),
): MigrationCounts {
  const counts: MigrationCounts = {
    forms: 0,
    respondents: 0,
    scores: 0,
    invalidScores: 0,
  };
  const known = new Map(repos.forms.list().map((form) => [form.url, form]));

  for (const row of legacy.forms) {
    const url = cellToString(row[0]).trim();
    if (!url || known.has(url)) continue;
    const { status, error } = mapLegacyStatus(cellToString(row[2]).trim());
    known.set(
      url,
      repos.forms.upsert({
        url,
        title: cellToString(row[1]),
        status,
        error,
        ...dateField(cellToDate(row[3])),
      }),
    );
    counts.forms++;
  }

  const layout = LEGACY.scores;
  const matrix = legacy.scores;
  if (matrix.length <= layout.firstRow) return counts;

  const formColumns: { col: number; url: string }[] = [];
  const header = matrix[layout.urlRow] ?? [];
  for (let col = layout.firstCol; col < header.length; col++) {
    const url = cellToString(header[col]).trim();
    if (url) formColumns.push({ col, url });
  }

  for (const { col, url } of formColumns) {
    const title = cellToString(matrix[layout.titleRow]?.[col]);
    const maxPoints = cellToNumber(matrix[layout.pointsRow]?.[col]);
    const stored = known.get(url);
    if (!stored) {
      known.set(
        url,
        repos.forms.upsert({
          url,
          title,
          ...dateField(cellToDate(matrix[layout.timestampRow]?.[col])),
          ...(maxPoints === null ? {} : { maxPoints }),
        }),
      );
      counts.forms++;
      continue;
    }
    const patch: Partial<FormRecord> = {};
    if (!stored.title && title) patch.title = title;
    if (stored.maxPoints === null && maxPoints !== null)
      patch.maxPoints = maxPoints;
    if (Object.keys(patch).length)
      known.set(url, repos.forms.upsert({ url, ...patch }));
  }

  const people = matrix.slice(layout.firstRow);
  counts.respondents = repos.respondents.insertMissing(
    people.map((row) => ({
      email: cellToString(row[layout.emailCol]),
      name: cellToString(row[layout.nameCol]),
      alternatives: cellToString(row[layout.alternativesCol]),
    })),
  );

  const toInsert: { email: string; formUrl: string; score: number }[] = [];
  for (const { col, url } of formColumns) {
    const seen = new Set<string>();
    for (const row of people) {
      const email = normalizeEmail(row[layout.emailCol]);
      const cell = row[col];
      if (!email || cell === '' || cell === undefined || cell === null)
        continue;
      if (seen.has(email)) continue;
      const score = cellToNumber(cell);
      if (score === null) {
        counts.invalidScores++;
        continue;
      }
      seen.add(email);
      toInsert.push({ email, formUrl: url, score });
    }
  }
  counts.scores = repos.scores.insertMissing(toInsert, now);

  return counts;
}

/**
 * Migrates the legacy sheets of a spreadsheet and renames them with a
 * `LEGACY ` prefix. The overview is refreshed even when nothing is left to
 * migrate, so a run that failed after the rename recovers on the next one.
 * @param spreadsheet Spreadsheet holding the legacy sheets.
 * @param repos Target repositories.
 * @param refresh Rebuilds the overview sheet.
 */
function runLegacyMigration(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  repos: MigrationRepos,
  refresh: () => void,
): MigrationCounts {
  const logger = createModuleLogger('migration');
  const formsSheet = spreadsheet.getSheetByName(LEGACY.formsSheet);
  const scoresSheet = spreadsheet.getSheetByName(LEGACY.scoresSheet);
  if (!formsSheet && !scoresSheet) {
    logger.info('No legacy sheets found, nothing to migrate');
    refresh();
    return { forms: 0, respondents: 0, scores: 0, invalidScores: 0 };
  }

  for (const sheet of [formsSheet, scoresSheet]) {
    if (
      sheet &&
      spreadsheet.getSheetByName(LEGACY.renamePrefix + sheet.getName())
    )
      throw new GasConflictError(
        `A sheet named "${LEGACY.renamePrefix}${sheet.getName()}" already exists`,
      );
  }

  let formRows: unknown[][] = [];
  if (formsSheet) {
    const count = formsSheet.getLastRow() - (LEGACY.forms.firstRow - 1);
    if (count > 0)
      formRows = formsSheet
        .getRange(LEGACY.forms.firstRow, 1, count, LEGACY.forms.numCols)
        .getValues();
  }
  const matrix = scoresSheet ? scoresSheet.getDataRange().getValues() : [];

  const counts = migrateLegacyData({ forms: formRows, scores: matrix }, repos);

  for (const sheet of [formsSheet, scoresSheet])
    if (sheet) sheet.setName(LEGACY.renamePrefix + sheet.getName());

  refresh();
  logger.info('Legacy sheets migrated', { ...counts });
  return counts;
}

/**
 * Migrates the legacy `💯 Notas` and `🟪 Forms` sheets into the data tables,
 * then renames them with a `LEGACY ` prefix. The legacy sheets are never
 * deleted. Idempotent. Runnable from the editor or through `clasp run`.
 */
function migrateLegacySheets(): MigrationCounts {
  return GasLock.withLock('script', () =>
    runLegacyMigration(
      SpreadsheetApp.getActiveSpreadsheet(),
      {
        forms: createFormsRepo(getFormsTable()),
        respondents: createRespondentsRepo(getRespondentsTable()),
        scores: createScoresRepo(getScoresTable()),
      },
      () => refreshOverview(),
    ),
  );
}
