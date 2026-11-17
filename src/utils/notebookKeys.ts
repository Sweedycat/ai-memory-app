import type { NotebookDatabase } from './sqliteNotebookDatabase';

export type NotebookLocalKey = { version: 1; id: string; key: string };
export interface NotebookKeyStore {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}

function decodeKey(raw: string): NotebookLocalKey {
  if (raw.length > 256) throw new Error('Notebook key unavailable');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Notebook key unavailable');
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || typeof record.id !== 'string' || !/^[a-f0-9]{32}$/.test(record.id) ||
      typeof record.key !== 'string' || !/^[a-f0-9]{64}$/.test(record.key)) throw new Error('Notebook key unavailable');
  return { version: 1, id: record.id, key: record.key };
}

// One local notebook/key slot per JS process. No rotation/deletion/fallback key.
// Concurrent bootstrap is refused rather than racing two secure-store writes.
let resolving = false;
export async function resolveNotebookKey(
  database: NotebookDatabase,
  store: NotebookKeyStore,
  generate: () => Promise<NotebookLocalKey>,
): Promise<NotebookLocalKey> {
  if (resolving) throw new Error('Notebook key initialization busy');
  resolving = true;
  try {
    const state = await database.read();
    const raw = await store.read();
    let key = raw === null ? null : decodeKey(raw);
    if (state.keyId !== null) {
      if (!key || key.id !== state.keyId) throw new Error('Notebook key unavailable');
      return key;
    }
    if (state.active !== null || state.previous !== null || state.draft !== null) {
      throw new Error('Notebook key unavailable');
    }
    if (!key) {
      key = decodeKey(JSON.stringify(await generate()));
      // Recheck immediately before writing; never replace a discovered key.
      if (await store.read() !== null || (await database.read()).keyId !== null) {
        throw new Error('Notebook key state changed');
      }
      const encoded = JSON.stringify(key);
      await store.write(encoded);
      if (await store.read() !== encoded) throw new Error('Notebook key write unconfirmed');
    }
    // Reuses an orphan secure key after interruption between key write and bind.
    // An initialized database with a lost key never reaches this path.
    await database.initialize(key.id);
    return key;
  } catch {
    throw new Error('Notebook key unavailable');
  } finally {
    resolving = false;
  }
}
