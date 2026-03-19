class FormsCursor {
  constructor({
    key,
    user = Session.getEffectiveUser().getEmail(),
    formUrlIndex = 0,
    complete = false,
  } = {}) {
    this.key = key;
    this.user = user;
    this.type = 'FORMS_RESPONSES';

    this.formUrlIndex = formUrlIndex;

    this.complete = complete;

    this.error = '';
  }

  /**
   *
   * @param {string}
   * @returns {FormsCursor}
   */
  static initialize() {   
    const cursor = new FormsCursor();
    cursor.key = `cursor:${cursor.type}:${cursor.user}:${new Date().toISOString()}`;

    Logger.log('Initialized FormsCursor %s', JSON.stringify(cursor));
    cursor.save();

    this.deleteTrailing(`cursor:${cursor.type}:${cursor.user}:`);
    
    return cursor;
  }

  /**
   * 
   */
  static deleteTrailing(keyQuery) {
    Object.keys(ScriptProps.getAll()).forEach(
      (key) =>
        key.includes(keyQuery) &&
        ScriptProps.del(key),
    );
    Logger.log('Deleted trailing cursors');
  }

  static load(key) {
    if (!key) throw new Error('Key is required');
    Logger.log('Loading cursor "%s"', key);

    const raw = ScriptProps.get(key, true);
    if (!raw) {
      Logger.log('No FormsCursor "%s" found in script properties', key);
      return;
    }

    try {
      const cursor = new FormsCursor(JSON.parse(raw));
      Logger.log(
        'Loaded FormsCursor "%s" from script properties: %s',
        key,
        JSON.stringify(cursor),
      );
      return cursor;
    } catch (err) {
      console.error(
        'Failed to parse FormsCursor from script properties',
        key,
        err,
      );
    }
  }

  save() {
    const stringified = JSON.stringify(this);
    ScriptProps.add(this.key, stringified);
    Logger.log('Saved FormsCursor to script properties: %s', stringified);
  }

  delete() {
    ScriptProps.del(this.key);
    Logger.log('Deleted finished cursor from script properties');
  }
}
