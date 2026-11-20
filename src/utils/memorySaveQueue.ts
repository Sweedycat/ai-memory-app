export type MemorySaveStatus = 'idle' | 'saving' | 'error';

// One process-local writer per storage key. This serializes replacements; it
// does not claim native crash durability or a transaction with notifications.
export function createMemorySaveQueue(write: (value: string) => Promise<void>) {
  let status: MemorySaveStatus = 'idle';
  let pending: string | null = null;
  let running = false;
  let idle: Promise<void> = Promise.resolve();
  let acknowledged: string | null = null;
  let inFlight: string | null = null;
  const acknowledgements = new Set<{ value: string; finish: (saved: boolean) => void }>();
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
          inFlight = value;
          publish('saving');
          await write(value);
          acknowledged = value;
          for (const waiter of [...acknowledgements]) {
            if (waiter.value === value) waiter.finish(pending === value);
          }
          if (pending === value) pending = null;
        }
        publish('idle');
      } catch {
        // Retain the newest desired bytes, without logging adapter errors.
        // Retrying a replacement is idempotent even if acknowledgement failed.
        publish('error');
      } finally {
        inFlight = null;
        for (const waiter of [...acknowledgements]) {
          if (waiter.value !== pending) waiter.finish(false);
        }
        running = false;
      }
    });
  }

  return {
    enqueue(value: string) {
      pending = value;
      for (const waiter of [...acknowledgements]) {
        if (waiter.value !== value && waiter.value !== inFlight) waiter.finish(false);
      }
      if (status !== 'error') start();
    },
    // A failed adapter acknowledgement is ambiguous. Keep waiting through an
    // explicit retry of these exact final-record bytes; never replay UI/native
    // side effects. Abort only detaches this caller, not the queued write.
    waitFor(value: string, signal?: AbortSignal): Promise<boolean> {
      if (signal?.aborted) return Promise.resolve(false);
      if (pending === null && acknowledged === value) return Promise.resolve(true);
      if (pending !== value && inFlight !== value) return Promise.resolve(false);
      return new Promise(resolve => {
        const abort = () => waiter.finish(false);
        const waiter = { value, finish(saved: boolean) {
          acknowledgements.delete(waiter);
          signal?.removeEventListener('abort', abort);
          resolve(saved);
        } };
        acknowledgements.add(waiter);
        signal?.addEventListener('abort', abort, { once: true });
      });
    },
    retry() { start(); },
    // enqueue schedules the adapter on a microtask. Expose pending intent as
    // saving immediately so callers cannot mutate during that render gap.
    getStatus: (): MemorySaveStatus => status === 'idle' && pending !== null ? 'saving' : status,
    getPending: () => pending,
    whenIdle: () => idle,
    subscribe(listener: (status: MemorySaveStatus) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
