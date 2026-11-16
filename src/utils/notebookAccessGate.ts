import { openNotebookSession, type NotebookVault } from './notebookSession';

type Session = Awaited<ReturnType<typeof openNotebookSession>>;

// One gate per notebook. Caller must connect lock() to app-lock/background
// transitions and supply a vault only after successful authentication.
// Serializes opening; does not cancel native I/O or erase external copies.
export function createNotebookAccessGate() {
  let generation = 0;
  let session: Session | null = null;
  let opening = false;
  function lock() {
    generation++;
    session?.close();
    session = null;
  }
  return {
    lock,
    async unlock(vault: NotebookVault): Promise<Session> {
      if (opening || session) throw new Error('Notebook already opening or open');
      const token = ++generation;
      opening = true;
      try {
        const candidate = await openNotebookSession(vault);
        if (token !== generation) {
          candidate.close();
          throw new Error('Notebook locked during authentication');
        }
        session = candidate;
        return candidate;
      } finally {
        opening = false;
      }
    },
    getSession(): Session {
      if (!session) throw new Error('Notebook locked');
      return session;
    },
  };
}
