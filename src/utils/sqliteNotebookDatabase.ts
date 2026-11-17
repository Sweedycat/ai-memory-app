import type { SQLiteDatabase } from 'expo-sqlite';

// The caller owns opening/closing this dedicated database. Never use the people store.
export const NOTEBOOK_DATABASE_NAME = 'ai-memory-notebook-v1.db';
export const MAX_NOTEBOOK_CIPHERTEXT_LENGTH = 24_000_000;

export interface NotebookDatabaseState {
  revision: number;
  keyId: string | null;
  active: string | null;
  previous: string | null;
  draft: string | null;
}

export interface NotebookDatabase {
  read(): Promise<NotebookDatabaseState>;
  initialize(keyId: string): Promise<NotebookDatabaseState>;
  replace(
    expected: NotebookDatabaseState,
    next: Pick<NotebookDatabaseState, 'active' | 'previous' | 'draft'>,
  ): Promise<NotebookDatabaseState>;
}

type Executor = Pick<SQLiteDatabase, 'execAsync' | 'getAllAsync' | 'getFirstAsync' | 'runAsync'>;
type StateRow = NotebookDatabaseState & { id: number };
const SCHEMA = `CREATE TABLE notebook_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  keyId TEXT,
  active TEXT,
  previous TEXT,
  draft TEXT
)`;
const FIELDS = ['revision', 'keyId', 'active', 'previous', 'draft'] as const;

// Only our own errors leave the boundary; native errors can contain private values.
class NotebookDatabaseError extends Error {}
function reject(message: string): never { throw new NotebookDatabaseError(message); }
async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof NotebookDatabaseError) throw error;
    throw new NotebookDatabaseError('Notebook database operation failed; reread before retrying');
  }
}

function validateKeyId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{32}$/.test(value)) {
    reject('Invalid notebook key marker');
  }
}

function base64Value(code: number): number {
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 71;
  if (code >= 48 && code <= 57) return code + 4;
  return code === 43 ? 62 : code === 47 ? 63 : -1;
}

// Validate canonical base64 in bounded linear work, without recursive regex backtracking.
// Authentication belongs to the cipher layer; shape validation cannot prove encryption.
function validateCiphertext(value: unknown): asserts value is string | null {
  if (value === null) return;
  if (typeof value !== 'string' || value.length < 40 ||
      value.length > MAX_NOTEBOOK_CIPHERTEXT_LENGTH || value.length % 4 !== 0) {
    reject('Invalid notebook ciphertext');
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const end = value.length - padding;
  for (let index = 0; index < end; index += 1) {
    if (base64Value(value.charCodeAt(index)) < 0) reject('Invalid notebook ciphertext');
  }
  const tail = base64Value(value.charCodeAt(end - 1));
  if ((padding === 2 && (tail & 15) !== 0) || (padding === 1 && (tail & 3) !== 0)) {
    reject('Invalid notebook ciphertext');
  }
}

function validateState(value: unknown): asserts value is NotebookDatabaseState {
  if (!value || typeof value !== 'object') reject('Invalid notebook state');
  const state = value as NotebookDatabaseState;
  if (!Number.isSafeInteger(state.revision) || state.revision < 0) reject('Invalid notebook revision');
  validateCiphertext(state.active);
  validateCiphertext(state.previous);
  validateCiphertext(state.draft);
  if (state.keyId === null) {
    if (state.revision !== 0 || state.active !== null || state.previous !== null || state.draft !== null) {
      reject('Unbound notebook contains data');
    }
  } else {
    validateKeyId(state.keyId);
    if (state.revision < 1) reject('Invalid notebook revision');
  }
}

function copyState(state: NotebookDatabaseState): NotebookDatabaseState {
  return { revision: state.revision, keyId: state.keyId, active: state.active,
    previous: state.previous, draft: state.draft };
}
function sameState(left: NotebookDatabaseState, right: NotebookDatabaseState): boolean {
  return FIELDS.every(field => left[field] === right[field]);
}
function normalizedSchema(sql: string): string { return sql.replace(/\s+/g, ' ').trim(); }

async function inspectSchema(db: Executor): Promise<boolean> {
  const synchronous = await db.getFirstAsync<{ synchronous: number }>('PRAGMA synchronous');
  if (synchronous?.synchronous !== 2) reject('Notebook requires FULL SQLite durability');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const objects = await db.getAllAsync<{ type: string; name: string; sql: string | null }>(
    "SELECT type, name, substr(sql, 1, 1024) AS sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' LIMIT 2",
  );
  if (version?.user_version === 0 && objects.length === 0) return false;
  if (version?.user_version !== 1 || objects.length !== 1 ||
      objects[0]?.type !== 'table' || objects[0].name !== 'notebook_state' ||
      objects[0].sql === null || normalizedSchema(objects[0].sql) !== normalizedSchema(SCHEMA)) {
    reject('Unsupported notebook database schema');
  }
  return true;
}

async function readState(db: Executor): Promise<NotebookDatabaseState> {
  if (!await inspectSchema(db)) reject('Notebook database schema is missing');
  // Do not materialize arbitrarily many or arbitrarily large corrupt values into JS.
  const sizes = await db.getAllAsync<{
    id: number; activeSize: number | null; previousSize: number | null; draftSize: number | null;
    keySize: number | null; keyType: string; activeType: string; previousType: string; draftType: string;
  }>(`SELECT id, length(CAST(active AS BLOB)) AS activeSize,
    length(CAST(previous AS BLOB)) AS previousSize, length(CAST(draft AS BLOB)) AS draftSize,
    length(CAST(keyId AS BLOB)) AS keySize, typeof(keyId) AS keyType,
    typeof(active) AS activeType, typeof(previous) AS previousType, typeof(draft) AS draftType
    FROM notebook_state LIMIT 2`);
  if (sizes.length !== 1 || sizes[0]?.id !== 1) reject('Invalid notebook state row');
  if (![sizes[0].keyType, sizes[0].activeType, sizes[0].previousType, sizes[0].draftType]
    .every(type => type === 'null' || type === 'text') ||
    (sizes[0].keySize !== null && sizes[0].keySize !== 32)) {
    reject('Invalid notebook state field');
  }
  for (const size of [sizes[0].activeSize, sizes[0].previousSize, sizes[0].draftSize]) {
    if (size !== null && (!Number.isSafeInteger(size) || size > MAX_NOTEBOOK_CIPHERTEXT_LENGTH)) {
      reject('Invalid notebook ciphertext size');
    }
  }
  const row = await db.getFirstAsync<StateRow>('SELECT id, revision, keyId, active, previous, draft FROM notebook_state WHERE id = 1');
  validateState(row);
  return copyState(row);
}

/** Creates only a fresh dedicated schema; never migrates, resets or restores existing data. */
export async function openNotebookDatabase(database: SQLiteDatabase): Promise<NotebookDatabase> {
  return guarded(async () => {
    await database.execAsync('PRAGMA synchronous = FULL');
    await database.withExclusiveTransactionAsync(async transaction => {
      if (!await inspectSchema(transaction)) {
        await transaction.execAsync(SCHEMA);
        await transaction.runAsync('INSERT INTO notebook_state (id, revision, keyId, active, previous, draft) VALUES (1, 0, NULL, NULL, NULL, NULL)');
        await transaction.execAsync('PRAGMA user_version = 1');
      }
      await readState(transaction);
    });

    const read = () => guarded(async () => {
      let state: NotebookDatabaseState | undefined;
      await database.withExclusiveTransactionAsync(async transaction => { state = await readState(transaction); });
      if (!state) reject('Notebook read did not complete');
      return state;
    });

    async function write(
      update: (current: NotebookDatabaseState) => NotebookDatabaseState,
    ): Promise<NotebookDatabaseState> {
      return guarded(async () => {
        let committed: NotebookDatabaseState | undefined;
        await database.withExclusiveTransactionAsync(async transaction => {
          const current = await readState(transaction);
          const next = update(current);
          validateState(next);
          if (!sameState(current, next)) {
            const result = await transaction.runAsync(
              'UPDATE notebook_state SET revision = ?, keyId = ?, active = ?, previous = ?, draft = ? WHERE id = 1 AND revision = ?',
              next.revision, next.keyId, next.active, next.previous, next.draft, current.revision,
            );
            if (result.changes !== 1) reject('Notebook write did not complete');
          }
          const verified = await readState(transaction);
          if (!sameState(next, verified)) reject('Notebook write verification failed');
          committed = verified;
        });
        // Resolve only after commit acknowledgement and a fresh committed read. Failure
        // after commit remains ambiguous to the caller; never undo it or blindly retry.
        const verified = await read();
        if (!committed || !sameState(committed, verified)) reject('Notebook commit acknowledgement is uncertain');
        return verified;
      });
    }

    await read();
    return {
      read,
      initialize(keyId) {
        return guarded(async () => {
          validateKeyId(keyId);
          return write(current => {
            if (current.keyId === keyId) return current;
            if (current.keyId !== null) reject('Notebook key marker mismatch');
            return { ...current, revision: 1, keyId };
          });
        });
      },
      replace(expected, next) {
        return guarded(async () => {
          validateState(expected);
          // Snapshot caller-owned objects before awaiting any database work.
          const expectedCopy = copyState(expected);
          if (!next || typeof next !== 'object') reject('Invalid notebook replacement');
          const proposed = { active: next.active, previous: next.previous, draft: next.draft };
          validateCiphertext(proposed.active);
          validateCiphertext(proposed.previous);
          validateCiphertext(proposed.draft);
          return write(current => {
            if (current.keyId === null) reject('Notebook key marker is missing');
            if (!sameState(current, expectedCopy)) reject('Stale notebook state');
            if (proposed.active !== current.active && proposed.previous !== current.active) {
              reject('Notebook replacement must retain the previous active ciphertext');
            }
            if (proposed.active === current.active && proposed.previous !== current.previous) {
              reject('Notebook draft update must preserve the previous ciphertext');
            }
            if (current.revision === Number.MAX_SAFE_INTEGER) reject('Notebook revision exhausted');
            return { ...current, ...proposed, revision: current.revision + 1 };
          });
        });
      },
    };
  });
}
