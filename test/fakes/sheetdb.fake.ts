type Entry = Record<string, unknown>;
type Predicate = (entry: Entry) => boolean;
type Update = Entry | ((entry: Entry) => Entry | void);

/** Call counters of a `FakeTable`, to assert batching. */
export interface FakeTableCalls {
  insert: number;
  insertMany: number;
  updateWhere: number;
  updateOneWhere: number;
}

/**
 * In-memory stand-in for a gas-sheetdb table. Implements the methods the
 * repositories use, and returns copies so callers cannot mutate storage.
 */
export class FakeTable {
  readonly rows: Entry[] = [];
  readonly calls: FakeTableCalls = {
    insert: 0,
    insertMany: 0,
    updateWhere: 0,
    updateOneWhere: 0,
  };
  private nextId = 1;

  constructor(initial: Entry[] = []) {
    initial.forEach((entry) => this.add(entry));
  }

  private add(entry: Entry): Entry {
    const stored = { _id: `id-${this.nextId++}`, ...entry };
    this.rows.push(stored);
    return { ...stored };
  }

  find = () => this.rows.map((row) => ({ ...row }));

  findWhere = (predicate: Predicate) => this.find().filter(predicate);

  findOneWhere = (predicate: Predicate) => this.find().find(predicate) ?? null;

  insert = (entry: Entry) => {
    this.calls.insert++;
    return this.add(entry);
  };

  insertMany = (entries: Entry[]) => {
    this.calls.insertMany++;
    return entries.map((entry) => this.add(entry));
  };

  private apply(row: Entry, update: Update): void {
    const patch = typeof update === 'function' ? update({ ...row }) : update;
    if (patch) Object.assign(row, patch);
  }

  updateWhere = (predicate: Predicate, update: Update) => {
    this.calls.updateWhere++;
    const matched = this.rows.filter((row) => predicate({ ...row }));
    matched.forEach((row) => this.apply(row, update));
    return matched.map((row) => ({ ...row }));
  };

  updateOneWhere = (predicate: Predicate, update: Update) => {
    this.calls.updateOneWhere++;
    const row = this.rows.find((candidate) => predicate({ ...candidate }));
    if (!row) return null;
    this.apply(row, update);
    return { ...row };
  };
}
