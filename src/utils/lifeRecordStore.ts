import { completeLifeRecord, LIFE_LIMITS, type LifeRecord, validateLifeRecord, validateLifeRecords } from './lifeRecords';

export const LIFE_STORAGE_KEY = '@ai-memory/life-records-v1';
type Snapshot = { revision: number; records: LifeRecord[] };
export type LifeDocument = Snapshot & { version: 1; previous: Snapshot | null };
export type LifeState = {
  records: LifeRecord[];
  status: 'loading' | 'ready' | 'error';
  busy: boolean;
  error: 'load' | 'save' | 'conflict' | null;
};
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function exactObject(value: unknown, fields: string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}

function snapshot(value: unknown): Snapshot {
  if (!exactObject(value, ['revision', 'records']) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0) {
    throw new Error('Invalid life snapshot');
  }
  return { revision: value.revision as number, records: validateLifeRecords(value.records) };
}

export function decodeLifeDocument(raw: string): LifeDocument {
  if (typeof raw !== 'string' || raw.length > LIFE_LIMITS.documentCharacters) throw new Error('Invalid life document size');
  const value: unknown = JSON.parse(raw);
  if (!exactObject(value, ['version', 'revision', 'records', 'previous']) || value.version !== 1) {
    throw new Error('Unsupported life document');
  }
  const current = snapshot({ revision: value.revision, records: value.records });
  const previous = value.previous === null ? null : snapshot(value.previous);
  if (previous !== null && previous.revision !== current.revision - 1) throw new Error('Invalid life revision');
  return { version: 1, ...current, previous };
}

const emptyDocument = (): LifeDocument => ({ version: 1, revision: 0, records: [], previous: null });
const copyRecords = (records: LifeRecord[]): LifeRecord[] => records.map(record => validateLifeRecord(record));
const sameRecord = (left: LifeRecord, right: LifeRecord): boolean => JSON.stringify(left) === JSON.stringify(right);

/**
 * One store is shared by every hook mount. All reads/writes run in this queue.
 * setItem/readback is an adapter contract, NOT proof of native crash atomicity.
 * No restore/migration is exposed; previous is bounded comparison evidence only.
 */
export function createLifeRecordStore(storage: Storage) {
  let document = emptyDocument();
  let observedBytes: string | null = null;
  let state: LifeState = { records: [], status: 'loading', busy: false, error: null };
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  const listeners = new Set<(state: LifeState) => void>();

  function getState(): LifeState { return { ...state, records: copyRecords(state.records) }; }
  function publish(update: Partial<LifeState>) {
    state = { ...state, ...update };
    for (const listener of listeners) {
      // Observers must never turn a persisted write into an ambiguous failure.
      try { listener(getState()); } catch { /* isolate observers */ }
    }
  }
  function queue<T>(operation: () => Promise<T>): Promise<T> {
    pending++;
    publish({ busy: true });
    const result = tail.then(operation);
    const settled = result.finally(() => { pending--; publish({ busy: pending !== 0 }); });
    tail = settled.then(() => undefined, () => undefined);
    return settled;
  }

  function reload(): Promise<void> {
    return queue(async () => {
      publish({ status: 'loading', error: null });
      try {
        const raw = await storage.getItem(LIFE_STORAGE_KEY);
        const next = raw === null ? emptyDocument() : decodeLifeDocument(raw);
        document = next;
        observedBytes = raw;
        publish({ records: copyRecords(next.records), status: 'ready', error: null });
      } catch {
        // Keep previously published records and original persisted bytes intact.
        publish({ status: 'error', error: 'load' });
      }
    });
  }

  function mutation(change: (records: LifeRecord[]) => LifeRecord[] | null): Promise<boolean> {
    if (state.status !== 'ready') return Promise.resolve(false);
    return queue(async () => {
      if (state.status !== 'ready') return false;
      let nextRecords: LifeRecord[] | null;
      let bytes: string;
      try {
        nextRecords = change(copyRecords(document.records));
        if (nextRecords === null) { publish({ error: 'conflict' }); return false; }
        const next: LifeDocument = {
          version: 1, revision: document.revision + 1, records: validateLifeRecords(nextRecords),
          previous: { revision: document.revision, records: copyRecords(document.records) },
        };
        bytes = JSON.stringify(next);
        // Also rejects revision overflow and combined snapshot limits before writing.
        decodeLifeDocument(bytes);
      } catch {
        publish({ error: 'save' });
        return false;
      }
      try {
        // Detect external writers instead of replacing a document we never saw.
        if (await storage.getItem(LIFE_STORAGE_KEY) !== observedBytes) {
          publish({ status: 'error', error: 'conflict' });
          return false;
        }
        await storage.setItem(LIFE_STORAGE_KEY, bytes);
        const confirmed = await storage.getItem(LIFE_STORAGE_KEY);
        if (confirmed !== bytes) throw new Error('Life save not confirmed');
        const next = decodeLifeDocument(confirmed);
        document = next;
        observedBytes = confirmed;
        publish({ records: copyRecords(next.records), status: 'ready', error: null });
        return true;
      } catch {
        // Failure may be before OR after durable write. Never blindly retry/rollback.
        publish({ status: 'error', error: 'save' });
        return false;
      }
    });
  }

  function invalid(): Promise<boolean> { publish({ error: 'save' }); return Promise.resolve(false); }

  function save(value: LifeRecord, base: LifeRecord | null): Promise<boolean> {
    let record: LifeRecord;
    let expected: LifeRecord | null;
    try { record = validateLifeRecord(value); expected = base === null ? null : validateLifeRecord(base); }
    catch { return invalid(); }
    if (expected === null ? record.history.length !== 0 || record.completedAt !== undefined
      : record.id !== expected.id || record.completedAt !== expected.completedAt || JSON.stringify(record.history) !== JSON.stringify(expected.history)) return invalid();
    return mutation(records => {
      const index = records.findIndex(item => item.id === record.id);
      if (expected === null) return index < 0 ? [...records, record] : null;
      if (index < 0 || !sameRecord(records[index]!, expected)) return null;
      records[index] = record;
      return records;
    });
  }

  function remove(base: LifeRecord): Promise<boolean> {
    let expected: LifeRecord;
    try { expected = validateLifeRecord(base); } catch { return invalid(); }
    return mutation(records => {
      const index = records.findIndex(item => item.id === expected.id);
      if (index < 0 || !sameRecord(records[index]!, expected)) return null;
      return records.filter((_, i) => i !== index);
    });
  }

  function complete(base: LifeRecord, now: Date, nextDate: string | null): Promise<boolean> {
    let expected: LifeRecord;
    let completed: LifeRecord;
    try { expected = validateLifeRecord(base); completed = completeLifeRecord(expected, now, nextDate); }
    catch { return invalid(); }
    return mutation(records => {
      const index = records.findIndex(item => item.id === expected.id);
      if (index < 0 || !sameRecord(records[index]!, expected)) return null;
      records[index] = completed;
      return records;
    });
  }

  return {
    getState, reload, save, remove, complete,
    subscribe(listener: (state: LifeState) => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
