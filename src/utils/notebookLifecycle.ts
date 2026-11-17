import type { PersistentNotebook } from './persistentNotebook';

// Mounted beneath PrivacyGate. Background/lock immediately revokes sessions,
// even when the surrounding App Lock has a longer user-selected delay.
export function createNotebookLifecycle(open: () => Promise<PersistentNotebook>) {
  let generation = 0;
  let current: PersistentNotebook | null = null;
  let opening = false;
  let drain: Promise<void> = Promise.resolve();
  return {
    lock() {
      generation++;
      if (current) {
        current.close();
        drain = current.whenIdle();
        current = null;
      }
    },
    async unlock() {
      if (opening || current) throw new Error('Notebook already open or opening');
      const token = ++generation;
      opening = true;
      try {
        await drain;
        if (token !== generation) throw new Error('Notebook locked');
        const candidate = await open();
        if (token !== generation) {
          candidate.close();
          drain = candidate.whenIdle();
          throw new Error('Notebook locked');
        }
        current = candidate;
        return candidate;
      } finally { opening = false; }
    },
    get() {
      if (!current) throw new Error('Notebook locked');
      return current;
    },
  };
}
