/**
 * Experimental generation store for crash-safe local restore.
 * NOT wired into the current people-v1 hook. No plaintext backups or keys
 * should be passed to this adapter until at-rest encryption is reviewed.
 *
 * Atomicity assumption: one AsyncStorage.setItem replaces a single pointer
 * value; candidate data is verified before that pointer is changed.
 */
export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
export type GenerationCodec<T> = {
  encode(value: T): string;
  decode(raw: string): T;
};
export type GenerationStore<T> = {
  readActive(): Promise<T | null>;
  stageAndActivate(candidate: T): Promise<void>;
};
const ROOT = '@ai-memory/generation-v1/';
const POINTER = ROOT + 'active';
const GEN = ROOT + 'data/';
const ID_PATTERN = /^[a-f0-9]{32}$/i;

function generationKey(id: string): string {
  if (!ID_PATTERN.test(id)) throw new Error('Invalid generation identifier');
  return GEN + id;
}

/**
 * Caller must supply a cryptographically random, unique 128-bit hex id.
 * This helper intentionally has no delete operation: previous generations
 * remain available for manual recovery after an interrupted activation.
 */
export function createGenerationStore<T>(
  storage: KeyValueStore,
  codec: GenerationCodec<T>,
  newGenerationId: () => string,
): GenerationStore<T> {
  let inFlight = false;
  return {
    async readActive(): Promise<T | null> {
      const id = await storage.getItem(POINTER);
      if (id === null) {
        // Do not mistake a concurrent first activation for an empty store.
        if (await storage.getItem(POINTER) !== null) {
          throw new Error('Active generation changed during read');
        }
        return null;
      }
      const key = generationKey(id);
      const raw = await storage.getItem(key);
      if (raw === null) throw new Error('Active generation missing; recovery required');
      if (typeof raw !== 'string' || raw.length === 0) {
        throw new Error('Active generation data invalid; recovery required');
      }
      const decoded = codec.decode(raw);
      if (codec.encode(decoded) !== raw) {
        throw new Error('Active generation codec roundtrip verification failed');
      }
      // Refuse a torn read when another writer switched generations mid-read.
      if (await storage.getItem(POINTER) !== id) {
        throw new Error('Active generation changed during read');
      }
      return decoded;
    },
    async stageAndActivate(candidate: T): Promise<void> {
      if (inFlight) throw new Error('Generation activation already in progress');
      inFlight = true;
      try {
        const current = await storage.getItem(POINTER);
        if (current === null && await storage.getItem(POINTER) !== null) {
          throw new Error('Active generation changed before staging');
        }
        if (current !== null) {
          // Never replace a missing or corrupted active generation.
          await this.readActive();
          // The active dataset must still be the one observed at the start.
          // A concurrent activation must not be overwritten by this restore.
          if (await storage.getItem(POINTER) !== current) {
            throw new Error('Active generation changed before staging');
          }
        }
        const id = newGenerationId();
        const key = generationKey(id);
        if (id === current || await storage.getItem(key) !== null) {
          throw new Error('Generation identifier already exists');
        }
        // Recheck collision before encoding untrusted candidate data.
        if (await storage.getItem(key) !== null) {
          throw new Error('Generation identifier already exists');
        }
        const raw = codec.encode(candidate);
        if (typeof raw !== 'string' || raw.length === 0) {
          throw new Error('Generation codec produced invalid data');
        }
        // Require a stable canonical encoding; a lossy or unstable codec
        // must not activate a dataset that cannot roundtrip faithfully.
        if (codec.encode(codec.decode(raw)) !== raw) {
          throw new Error('Generation codec roundtrip verification failed');
        }
        // A concurrent writer could have reserved this ID during encoding.
        if (await storage.getItem(key) !== null) {
          throw new Error('Generation identifier already exists');
        }
        await storage.setItem(key, raw);
        const persisted = await storage.getItem(key);
        if (persisted !== raw) throw new Error('Staged generation verification failed');
        if (codec.encode(codec.decode(persisted)) !== persisted) {
          throw new Error('Staged generation roundtrip verification failed');
        }
        // Recheck the active pointer to refuse concurrent/external changes.
        if (await storage.getItem(POINTER) !== current) {
          throw new Error('Active generation changed during staging');
        }
        // Re-read the staged value immediately before activation. A changed
        // candidate must never be made active even if the pointer is stable.
        if (await storage.getItem(key) !== raw) {
          throw new Error('Staged generation changed before activation');
        }
        // These are defensive checks, not a cross-instance lock or CAS.
        // A competing writer can still race after the final pointer read.
        // Only this final pointer write activates the staged dataset.
        await storage.setItem(POINTER, id);
        // Do not claim a completed activation until the pointer is verified.
        // If verification fails after the write, recovery must inspect both
        // generations; callers must not retry blindly or delete either one.
        if (await storage.getItem(POINTER) !== id ||
            await storage.getItem(key) !== raw ||
            await storage.getItem(POINTER) !== id) {
          throw new Error('Activation outcome uncertain; recovery required');
        }
      } finally {
        inFlight = false;
      }
    },
  };
}
