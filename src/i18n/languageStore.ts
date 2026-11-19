import { isLanguagePreference, type LanguagePreference } from './language';

export const LANGUAGE_PREFERENCE_KEY = '@ai-memory/language-preference-v1';
export type LanguagePreferenceBase = { preference: LanguagePreference; revision: number };
type Document = LanguagePreferenceBase & { version: 1 };
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
export type LanguagePreferenceState = {
  preference: LanguagePreference | null;
  revision: number | null;
  status: 'loading' | 'ready' | 'error';
  busy: boolean;
  error: 'load' | 'save' | 'conflict' | 'invalidated' | null;
};

export function decodeLanguagePreference(raw: string): Document {
  if (typeof raw !== 'string' || raw.length > 256) throw new Error('Invalid language document size');
  const value: unknown = JSON.parse(raw);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid language document');
  const object = value as Record<string, unknown>;
  if (Object.keys(object).length !== 3 || !Object.hasOwn(object, 'version') || object.version !== 1
    || !Object.hasOwn(object, 'revision') || !Number.isSafeInteger(object.revision) || (object.revision as number) < 0
    || !Object.hasOwn(object, 'preference') || !isLanguagePreference(object.preference)) {
    throw new Error('Unsupported language document');
  }
  return { version: 1, revision: object.revision as number, preference: object.preference };
}

/**
 * Inject one shared store per application adapter. No IO occurs on construction.
 * Serialization is per instance, not a cross-process lock/CAS or native crash-atomicity claim.
 * Invalidation fences publication; it cannot undo an already issued storage write.
 */
export function createLanguagePreferenceStore(storage: Storage) {
  let state: LanguagePreferenceState = { preference: null, revision: null, status: 'loading', busy: false, error: null };
  let observedBytes: string | null = null;
  let epoch = 0;
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  const listeners = new Set<(state: LanguagePreferenceState) => void>();
  const getState = (): LanguagePreferenceState => ({ ...state });
  function publish(update: Partial<LanguagePreferenceState>) {
    state = { ...state, ...update };
    for (const listener of listeners) {
      try { listener(getState()); } catch { /* Observer failure cannot change a persisted outcome. */ }
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
  function invalidate(): void {
    epoch++;
    publish({ status: 'error', error: 'invalidated' });
  }
  function reload(): Promise<void> {
    const authority = ++epoch;
    publish({ status: 'loading', error: null });
    return queue(async () => {
      if (authority !== epoch) return;
      try {
        const raw = await storage.getItem(LANGUAGE_PREFERENCE_KEY);
        if (authority !== epoch) return;
        const next = raw === null ? { preference: 'system' as const, revision: 0 } : decodeLanguagePreference(raw);
        observedBytes = raw;
        publish({ preference: next.preference, revision: next.revision, status: 'ready', error: null });
      } catch {
        if (authority === epoch) publish({ status: 'error', error: 'load' });
      }
    });
  }
  function save(preference: LanguagePreference, base: LanguagePreferenceBase): Promise<boolean> {
    if (!isLanguagePreference(preference) || !base || !isLanguagePreference(base.preference)
      || !Number.isSafeInteger(base.revision) || base.revision < 0 || state.status !== 'ready') return Promise.resolve(false);
    const expected = { preference: base.preference, revision: base.revision };
    const authority = epoch;
    const current = () => authority === epoch && state.status === 'ready';
    return queue(async () => {
      if (!current()) return false;
      if (expected.preference !== state.preference || expected.revision !== state.revision) {
        publish({ status: 'error', error: 'conflict' });
        return false;
      }
      let bytes: string;
      try {
        bytes = JSON.stringify({ version: 1, revision: expected.revision + 1, preference });
        decodeLanguagePreference(bytes); // Reject revision overflow before writing.
      } catch { publish({ error: 'save' }); return false; }
      try {
        const before = await storage.getItem(LANGUAGE_PREFERENCE_KEY);
        if (!current()) return false;
        if (before !== observedBytes) {
          publish({ status: 'error', error: 'conflict' });
          return false;
        }
        await storage.setItem(LANGUAGE_PREFERENCE_KEY, bytes);
        if (!current()) return false;
        const confirmed = await storage.getItem(LANGUAGE_PREFERENCE_KEY);
        if (!current()) return false;
        if (confirmed !== bytes) throw new Error('Language save not confirmed');
        const next = decodeLanguagePreference(confirmed);
        observedBytes = confirmed;
        publish({ preference: next.preference, revision: next.revision, error: null });
        return true;
      } catch {
        // Read/write failure can leave an unknown durable result. Never retry or roll back blindly.
        if (authority === epoch) publish({ status: 'error', error: 'save' });
        return false;
      }
    });
  }
  return {
    getState, reload, save, invalidate,
    subscribe(listener: (state: LanguagePreferenceState) => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
