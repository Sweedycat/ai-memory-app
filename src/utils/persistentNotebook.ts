import type { Aes256GcmBackupCipher } from './encryptedBackupEnvelope';
import { createEncryptedNotebookVault } from './encryptedNotebookVault';
import { createNotebookAccessGate } from './notebookAccessGate';
import { openNotebookSession } from './notebookSession';
import { decodePersonalNotebook, MAX_NOTEBOOK_SIZE, type PersonalNote } from './personalNotebook';
import type { NotebookDatabase, NotebookDatabaseState } from './sqliteNotebookDatabase';

const JOURNAL_KIND = 'ai-memory-notebook-recovery-v1\n';
const MAX_JOURNAL = MAX_NOTEBOOK_SIZE + 512;
type Attempt = { version: 1; keyId: string; baseRevision: number; baseDigest: string; candidate: PersonalNote[] };
export type NotebookRecovery = 'none' | 'already-saved' | 'retry-safe' | 'conflict';

function canonical(notes: readonly PersonalNote[]) {
  return JSON.stringify(decodePersonalNotebook(JSON.stringify(notes)));
}

function decodeAttempt(raw: string, keyId: string): Attempt {
  if (raw.length > MAX_JOURNAL || !raw.startsWith(JOURNAL_KIND)) throw new Error('Notebook recovery invalid');
  const value: unknown = JSON.parse(raw.slice(JOURNAL_KIND.length));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Notebook recovery invalid');
  const entry = value as Record<string, unknown>;
  if (entry.version !== 1 || entry.keyId !== keyId || !Number.isSafeInteger(entry.baseRevision) ||
      typeof entry.baseRevision !== 'number' || entry.baseRevision < 0 ||
      typeof entry.baseDigest !== 'string' || !/^[a-f0-9]{64}$/.test(entry.baseDigest)) {
    throw new Error('Notebook recovery invalid');
  }
  const candidate = decodePersonalNotebook(JSON.stringify(entry.candidate));
  return { version: 1, keyId, baseRevision: entry.baseRevision, baseDigest: entry.baseDigest, candidate };
}

// Uses a single bounded encrypted recovery intent. No automatic restore or merge.
// digest is standard SHA-256 over canonical notebook bytes, not a password KDF.
export async function openPersistentNotebook(
  database: NotebookDatabase,
  suppliedCipher: Aes256GcmBackupCipher,
  digest: (value: string) => Promise<string>,
) {
  let closed = false;
  let busy = false;
  let state: NotebookDatabaseState;
  let base = '[]';
  let attempt: Attempt | null = null;
  let recovery: NotebookRecovery = 'none';
  let reviewReady = false;
  let cipher: Aes256GcmBackupCipher | null = suppliedCipher;
  const gate = createNotebookAccessGate();
  let idleAction: Promise<void> = Promise.resolve();
  function assertOpen() { if (closed || !cipher) throw new Error('Notebook closed'); }
  function seal(value: string) { assertOpen(); return cipher!.encryptUtf8ToCombinedBase64(value); }
  function unseal(value: string) { assertOpen(); return cipher!.decryptCombinedBase64ToUtf8(value); }

  async function decodeSnapshot(value: string | null): Promise<string> {
    if (value === null) return '[]';
    assertOpen();
    const raw = await createEncryptedNotebookVault({
      read: async () => value,
      replaceAtomically: async () => { throw new Error('Read only'); },
    }, cipher!).readAuthenticated();
    assertOpen();
    return raw ?? '[]';
  }

  async function classify(proposedAttempt: Attempt | null, proposedBase: string,
    proposedState: NotebookDatabaseState): Promise<NotebookRecovery> {
    assertOpen();
    if (!proposedAttempt) return 'none';
    if (canonical(proposedAttempt.candidate) === proposedBase) return 'already-saved';
    const sameBase = await digest(proposedBase) === proposedAttempt.baseDigest;
    assertOpen();
    const expectedRevision = proposedAttempt.baseRevision + (proposedState.draft === null ? 0 : 1);
    return sameBase && proposedState.revision === expectedRevision ? 'retry-safe' : 'conflict';
  }

  const vault = createEncryptedNotebookVault({
    async read() {
      assertOpen();
      const readState = await database.read();
      assertOpen();
      if (readState.keyId === null) throw new Error('Notebook key unbound');
      const readBase = await decodeSnapshot(readState.active);
      // Preserve corrupt recovery evidence instead of rotating it away.
      await decodeSnapshot(readState.previous);
      const readAttempt = readState.draft === null ? attempt : decodeAttempt(await unseal(readState.draft), readState.keyId);
      const readRecovery = await classify(readAttempt, readBase, readState);
      assertOpen();
      // Publish only a completely authenticated snapshot. Callers separately
      // restore review authority after the entire session open succeeds.
      state = readState;
      base = readBase;
      attempt = readAttempt;
      recovery = readRecovery;
      return readState.active;
    },
    async replaceAtomically(sealed) {
      assertOpen();
      if (state.draft !== null || recovery !== 'none') throw new Error('Notebook recovery requires review');
      const candidate = decodePersonalNotebook(await decodeSnapshot(sealed));
      const baseDigest = await digest(base);
      assertOpen();
      if (!/^[a-f0-9]{64}$/.test(baseDigest)) throw new Error('Notebook digest invalid');
      attempt = { version: 1, keyId: state.keyId!, baseRevision: state.revision, baseDigest, candidate };
      const journal = JOURNAL_KIND + JSON.stringify(attempt);
      if (journal.length > MAX_JOURNAL) throw new Error('Notebook recovery too large');
      const encryptedDraft = await seal(journal);
      assertOpen();
      state = await database.replace(state, { active: state.active, previous: state.previous, draft: encryptedDraft });
      assertOpen();
      state = await database.replace(state, { active: sealed, previous: state.active, draft: null });
      assertOpen();
      base = canonical(candidate);
      attempt = null;
      recovery = 'none';
    },
  }, {
    encryptUtf8ToCombinedBase64: value => seal(value),
    decryptCombinedBase64ToUtf8: value => unseal(value),
  });

  let latestSession = await gate.unlock(vault);
  reviewReady = true;
  function pauseSession() { gate.lock(); return latestSession.whenIdle(); }
  function exclusive<T>(action: () => Promise<T>): Promise<T> {
    assertOpen();
    if (busy) return Promise.reject(new Error('Notebook busy'));
    busy = true;
    reviewReady = false;
    const result = action().finally(() => { busy = false; });
    idleAction = result.then(() => undefined, () => undefined);
    return result;
  }
  return {
    getSession() { assertOpen(); return gate.getSession(); },
    getRecovery(): { status: NotebookRecovery; candidate: PersonalNote[] | null; durable: boolean } {
      assertOpen();
      if (!reviewReady) throw new Error('Notebook recovery requires authenticated reopening');
      return { status: recovery, candidate: attempt ? attempt.candidate.map(note => ({ ...note })) : null,
        durable: state.draft !== null };
    },
    async checkpointDraft(note: PersonalNote, expected: PersonalNote | null) {
      assertOpen();
      if (!reviewReady || recovery !== 'none' || state.draft !== null || attempt !== null) {
        throw new Error('Review existing Notebook recovery first');
      }
      return exclusive(async () => {
        await pauseSession();
        assertOpen();
        // A save that was already running may have left a new uncertain intent
        // during the drain. Never replace it, even if it exists only in memory.
        if (recovery !== 'none' || state.draft !== null || attempt !== null) {
          throw new Error('Review existing Notebook recovery first');
        }
        // Reuse the same conditional-create/edit validation as a committed save.
        // This temporary session validates in memory; only the sealed intent is persisted.
        let candidateRaw = '';
        const validation = await openNotebookSession({ readAuthenticated: async () => base,
          replaceAuthenticated: async value => { candidateRaw = value; } });
        try { await validation.save(note, expected); } finally { validation.close(); }
        const baseDigest = await digest(base);
        assertOpen();
        if (!/^[a-f0-9]{64}$/.test(baseDigest)) throw new Error('Notebook digest invalid');
        attempt = { version: 1, keyId: state.keyId!, baseRevision: state.revision, baseDigest,
          candidate: decodePersonalNotebook(candidateRaw) };
        const journal = JOURNAL_KIND + JSON.stringify(attempt);
        if (journal.length > MAX_JOURNAL) throw new Error('Notebook recovery too large');
        const sealed = await seal(journal);
        assertOpen();
        state = await database.replace(state, { active: state.active, previous: state.previous, draft: sealed });
        assertOpen();
        latestSession = await gate.unlock(vault);
        reviewReady = true;
      });
    },
    reopen() {
      return exclusive(async () => {
        await pauseSession();
        assertOpen();
        latestSession = await gate.unlock(vault);
        reviewReady = true;
        return recovery;
      });
    },
    async resolveRecovery(choice: 'retry' | 'discard') {
      assertOpen();
      if (busy) throw new Error('Notebook busy');
      if (!reviewReady) throw new Error('Notebook recovery requires authenticated reopening');
      if (!attempt || recovery === 'none') throw new Error('No recovery to review');
      if (choice !== 'retry' && choice !== 'discard') throw new Error('Invalid recovery choice');
      if (choice === 'retry' && recovery === 'conflict') throw new Error('Notebook recovery conflict');
      const reviewedAttempt = attempt;
      return exclusive(async () => {
        await pauseSession();
        assertOpen();
        if (choice === 'retry' && recovery === 'retry-safe') {
          let sealed: string | undefined;
          await createEncryptedNotebookVault({ read: async () => null, replaceAtomically: async value => { sealed = value; } }, cipher!)
            .replaceAuthenticated(canonical(reviewedAttempt.candidate));
          assertOpen();
          // No new write journal is needed: the existing intent stays until this
          // transaction commits. CAS refuses stale/replaced recovery decisions.
          if (state.draft === null) {
            const encryptedDraft = await seal(JOURNAL_KIND + JSON.stringify(reviewedAttempt));
            assertOpen();
            state = await database.replace(state, { active: state.active, previous: state.previous, draft: encryptedDraft });
            assertOpen();
          }
          state = await database.replace(state, { active: sealed!, previous: state.active, draft: null });
        } else if (state.draft !== null) {
          state = await database.replace(state, { active: state.active, previous: state.previous, draft: null });
        }
        assertOpen();
        attempt = null;
        recovery = 'none';
        latestSession = await gate.unlock(vault);
        reviewReady = true;
      });
    },
    close() {
      closed = true;
      reviewReady = false;
      gate.lock();
      base = '';
      attempt = null;
      recovery = 'none';
      cipher = null;
    },
    whenIdle: (): Promise<void> => Promise.all([latestSession.whenIdle(), idleAction]).then(() => undefined),
  };
}

export type PersistentNotebook = Awaited<ReturnType<typeof openPersistentNotebook>>;
