export type MemorySaveStatus = 'idle' | 'saving' | 'error';

// One process-local writer per storage key. This serializes replacements; it
// does not claim native crash durability or a transaction with notifications.
export function createMemorySaveQueue(write: (value: string) => Promise<void>) {
  let status: MemorySaveStatus = 'idle';
  let pending: string | null = null;
  let running = false;
  let idle: Promise<void> = Promise.resolve();
  const listeners = new Set<(status: MemorySaveStatus) => void>();

  function publish(next: MemorySaveStatus) {
    status = next;
    for (const listener of listeners) listener(next);
  }

  function start() {
    if (running || pending === null) return;
    running = true;
    // Assign the drain promise before invoking the adapter, including adapters
    // that throw synchronously. Keep only the newest pending replacement.
    idle = Promise.resolve().then(async () => {
      try {
        while (pending !== null) {
          const value = pending;
          publish('saving');
          await write(value);
          if (pending === value) pending = null;
        }
        publish('idle');
      } catch {
        // Retain the newest desired bytes, without logging adapter errors.
        // Retrying a replacement is idempotent even if acknowledgement failed.
        publish('error');
      } finally {
        running = false;
      }
    });
  }

  return {
    enqueue(value: string) {
      pending = value;
      if (status !== 'error') start();
    },
    retry() { start(); },
    getStatus: () => status,
    getPending: () => pending,
    whenIdle: () => idle,
    subscribe(listener: (status: MemorySaveStatus) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
