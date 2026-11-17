import { decodePersonalNotebook, type PersonalNote } from './personalNotebook';

// Adapter contract: authenticated encryption and atomic durable replacement
// must be provided by a reviewed implementation. No plaintext adapter here.
export interface NotebookVault {
  readAuthenticated(): Promise<string | null>;
  replaceAuthenticated(plaintext: string): Promise<void>;
}

function matchesExpected(actual: PersonalNote, expected: PersonalNote): boolean {
  return expected !== null && typeof expected === 'object' && !Array.isArray(expected) &&
    actual.id === expected.id && actual.title === expected.title && actual.body === expected.body &&
    actual.createdAt === expected.createdAt && actual.updatedAt === expected.updatedAt;
}

export async function openNotebookSession(vault: NotebookVault) {
  const raw = await vault.readAuthenticated();
  let current = raw === null ? [] : decodePersonalNotebook(raw);
  let writing = false;
  let settled: Promise<void> = Promise.resolve();
  let finishWrite: (() => void) | undefined;
  let blocked = false;
  let closed = false;

  function assertOpen() {
    if (closed || blocked) throw new Error('Notebook session unavailable');
  }

  function snapshot(): PersonalNote[] {
    assertOpen();
    return current.map(note => ({ ...note }));
  }

  async function commit(next: PersonalNote[]): Promise<void> {
    if (closed || blocked || writing) throw new Error('Notebook unavailable for writing');
    const validated = decodePersonalNotebook(JSON.stringify(next));
    writing = true;
    settled = new Promise<void>(resolve => { finishWrite = resolve; });
    try {
      await vault.replaceAuthenticated(JSON.stringify(validated));
      if (closed) throw new Error('Notebook session closed during save');
      current = validated;
    } catch {
      // An ambiguous write result requires reopening and authenticating.
      blocked = true;
      throw new Error('Notebook save could not be confirmed');
    } finally {
      writing = false;
      finishWrite?.();
      finishWrite = undefined;
    }
  }

  return {
    snapshot,
    whenIdle: () => settled,
    close() {
      closed = true;
      current = [];
    },
    // Expectations protect edits within this session, not writes by other vault instances.
    // null explicitly creates a new note; an existing note requires its complete base.
    async save(note: PersonalNote, expected: PersonalNote | null) {
      const next = snapshot();
      const index = next.findIndex(n => n.id === note.id);
      const existing = next[index];
      if (expected === null) {
        if (existing) throw new Error('Notebook changed since editing began');
        next.push({ ...note });
      } else {
        if (!existing || !matchesExpected(existing, expected)) {
          throw new Error('Notebook changed since editing began');
        }
        if (note.createdAt !== existing.createdAt || note.updatedAt < existing.updatedAt) {
          throw new Error('Invalid note revision');
        }
        next[index] = { ...note };
      }
      await commit(next);
    },
    async remove(id: string, expected: PersonalNote) {
      assertOpen();
      const existing = current.find(n => n.id === id);
      if (!existing) throw new Error('Unknown note');
      if (!matchesExpected(existing, expected)) throw new Error('Notebook changed since editing began');
      await commit(current.filter(n => n.id !== id));
    },
  };
}

export type NotebookSession = Awaited<ReturnType<typeof openNotebookSession>>;
