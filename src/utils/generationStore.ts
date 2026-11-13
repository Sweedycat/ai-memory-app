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
      const decoded = codec.decode(raw);
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
        const raw = codec.encode(candidate);
        // Check the exact encoded representation before writing.
        codec.decode(raw);
        await storage.setItem(key, raw);
        const persisted = await storage.getItem(key);
        if (persisted !== raw) throw new Error('Staged generation verification failed');
        codec.decode(persisted);
        // Recheck the active pointer to refuse concurrent/external changes.
        if (await storage.getItem(POINTER) !== current) {
          throw new Error('Active generation changed during staging');
        }
        // Only this final pointer write activates the staged dataset.
        await storage.setItem(POINTER, id);
        // Do not claim a completed activation until the pointer is verified.
        // If verification fails after the write, recovery must inspect both
        // generations; callers must not retry blindly or delete either one.
        if (await storage.getItem(POINTER) !== id) {
          throw new Error('Activation outcome uncertain; recovery required');
        }
      } finally {
        inFlight = false;
      }
    },
  };
}
