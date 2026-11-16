import { decodePersonalNotebook, type PersonalNote } from './personalNotebook';

// Adapter contract: authenticated encryption and atomic durable replacement
// must be provided by a reviewed implementation. No plaintext adapter here.
export interface NotebookVault {
  readAuthenticated(): Promise<string | null>;
  replaceAuthenticated(plaintext: string): Promise<void>;
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
    async save(note: PersonalNote) {
      const next = snapshot();
      const index = next.findIndex(n => n.id === note.id);
      if (index < 0) next.push({ ...note });
      else {
        if (note.createdAt !== next[index].createdAt || note.updatedAt < next[index].updatedAt) {
          throw new Error('Invalid note revision');
        }
        next[index] = { ...note };
      }
      await commit(next);
    },
    async remove(id: string) {
      assertOpen();
      if (!current.some(n => n.id === id)) throw new Error('Unknown note');
      await commit(current.filter(n => n.id !== id));
    },
  };
}
