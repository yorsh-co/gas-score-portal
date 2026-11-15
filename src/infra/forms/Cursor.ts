/** Options to build a `FormsCursor`. */
interface FormsCursorOptions {
  key?: string;
  user?: string;
  lastFormUrl?: string;
  complete?: boolean;
}

/**
 * Progress of a synchronization across executions, persisted in Script
 * Properties so a continuation trigger can resume it.
 */
class FormsCursor {
  key: string;
  user: string;
  readonly type = 'FORMS_RESPONSES';
  /** URL of the last form processed; forms are walked in URL order. */
  lastFormUrl: string;
  complete: boolean;
  error = '';

  constructor({
    key = '',
    user = Session.getEffectiveUser().getEmail(),
    lastFormUrl = '',
    complete = false,
  }: FormsCursorOptions = {}) {
    this.key = key;
    this.user = user;
    this.lastFormUrl = lastFormUrl;
    this.complete = complete;
  }

  /**
   * Starts a new cursor, saves it and removes the cursors of earlier runs.
   */
  static initialize(): FormsCursor {
    const cursor = new FormsCursor();
    const prefix = `cursor:${cursor.type}:${cursor.user}:`;
    cursor.key = `${prefix}${new Date().toISOString()}`;
    cursor.save();
    FormsCursor.deleteTrailing(prefix, cursor.key);
    return cursor;
  }

  /**
   * Deletes the stored cursors that start with a prefix.
   * @param prefix Key prefix.
   * @param keepKey Key to keep.
   */
  static deleteTrailing(prefix: string, keepKey: string): void {
    const properties = PropertiesService.getScriptProperties();
    for (const key of properties.getKeys()) {
      if (key.startsWith(prefix) && key !== keepKey)
        properties.deleteProperty(key);
    }
  }

  /**
   * Loads a stored cursor.
   * @param key Cursor key.
   * @returns The cursor, or `undefined` when it is missing or unreadable.
   */
  static load(key: string): FormsCursor | undefined {
    if (!key) throw new Error('Key is required');

    const raw = PropertiesService.getScriptProperties().getProperty(key);
    if (!raw) {
      createModuleLogger_('cursor').warn('Cursor not found', { key });
      return undefined;
    }

    try {
      return new FormsCursor(JSON.parse(raw) as FormsCursorOptions);
    } catch (err) {
      createModuleLogger_('cursor').error('Failed to parse the cursor', {
        key,
        error: String(err),
      });
      return undefined;
    }
  }

  /** Stores the cursor. */
  save(): void {
    PropertiesService.getScriptProperties().setProperty(
      this.key,
      JSON.stringify(this),
    );
  }

  /** Removes the stored cursor. */
  delete(): void {
    PropertiesService.getScriptProperties().deleteProperty(this.key);
  }
}
