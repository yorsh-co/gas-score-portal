/** Sync state of a linked form. */
type FormStatus = 'linked' | 'excluded' | 'error';

/** A row of the `Forms` table. */
interface FormRecord {
  url: string;
  title: string;
  maxPoints: number | null;
  status: FormStatus;
  syncedAt: Date | null;
  error: string;
}

/** Repository over the `Forms` table. */
interface FormsRepo {
  /** All forms, sorted by title. */
  list(): FormRecord[];
  get(url: string): FormRecord | null;
  /** Inserts the form, or applies the given fields to the existing one. */
  upsert(form: Partial<FormRecord> & { url: string }): FormRecord;
  /** Sets the status and the error text. Throws when the form is unknown. */
  updateStatus(url: string, status: FormStatus, error?: string): FormRecord;
}

/**
 * Maps a stored entry to a form record.
 * @param entry Table entry.
 */
function toFormRecord(entry: GasSheetDbEntry): FormRecord {
  return {
    url: cellToString(entry.url),
    title: cellToString(entry.title),
    maxPoints: cellToNumber(entry.maxPoints),
    status: (cellToString(entry.status) || 'linked') as FormStatus,
    syncedAt: cellToDate(entry.syncedAt),
    error: cellToString(entry.error),
  };
}

/**
 * Creates the forms repository.
 * @param table Backing table.
 */
function createFormsRepo(table: DbTable): FormsRepo {
  const byUrl = (url: string) => (entry: GasSheetDbEntry) => entry.url === url;

  const get = (url: string): FormRecord | null => {
    const entry = table.findOneWhere(byUrl(url));
    return entry ? toFormRecord(entry) : null;
  };

  const upsert = (form: Partial<FormRecord> & { url: string }): FormRecord =>
    GasLock.withLock('script', () => {
      const patch: GasSheetDbEntry = {};
      for (const [key, value] of Object.entries(form)) {
        if (key !== 'url' && value !== undefined && value !== null)
          patch[key] = value;
      }
      const updated = table.updateOneWhere(byUrl(form.url), patch);
      if (updated) return toFormRecord(updated);
      return toFormRecord(
        table.insert({
          url: form.url,
          title: '',
          maxPoints: '',
          status: 'linked',
          syncedAt: '',
          error: '',
          ...patch,
        }),
      );
    });

  return {
    list: () =>
      table
        .find()
        .map(toFormRecord)
        .sort((a, b) => a.title.localeCompare(b.title)),
    get,
    upsert,
    updateStatus(url, status, error = '') {
      const updated = table.updateOneWhere(byUrl(url), { status, error });
      if (!updated) throw new GasNotFoundError(`Form not found: ${url}`);
      return toFormRecord(updated);
    },
  };
}
