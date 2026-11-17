import type { PersistentNotebook } from './persistentNotebook';
import type { PersonalNote } from './personalNotebook';

type Target = { kind: 'edit'; id: string } | { kind: 'create'; id: string; createdAt: string };
type Mode = 'editing' | 'recoverable' | 'conflict' | 'uncertain' | 'saved' | 'unavailable';
export type NotebookEditorView = { mode: Mode; title: string; body: string; busy: boolean;
  current: PersonalNote | null; dirty: boolean; checkpointed: boolean };
const same = (a: PersonalNote | null, b: PersonalNote | null) => JSON.stringify(a) === JSON.stringify(b);

// One editor owns one target. A recovered whole-notebook intent may be presented
// here only when it changes this one note; other intents remain untouched.
export function createNotebookEditor(workspace: PersistentNotebook, target: Target, now: () => string) {
  let original = workspace.getSession().snapshot().find(note => note.id === target.id) ?? null;
  let title = original?.title ?? '', body = original?.body ?? '';
  let current = original, mode: Mode = 'editing', busy = false, disposed = false;
  if (target.kind === 'create' && original) throw new Error('Notebook note already exists');

  function ownRecovery(adopt = false) {
    const review = workspace.getRecovery();
    if (!review.candidate) return review;
    const active = workspace.getSession().snapshot();
    const candidate = review.candidate.find(note => note.id === target.id);
    const others = (notes: PersonalNote[]) => notes.filter(note => note.id !== target.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!candidate || JSON.stringify(others(active)) !== JSON.stringify(others(review.candidate))) {
      throw new Error('Notebook recovery belongs to another operation');
    }
    if (!adopt && (title !== candidate.title || body !== candidate.body)) {
      throw new Error('Notebook recovery differs from the editor draft');
    }
    title = candidate.title; body = candidate.body;
    current = active.find(note => note.id === target.id) ?? null;
    return review;
  }
  function applyReview(adopt = false) {
    const review = ownRecovery(adopt);
    if (review.status === 'already-saved' || review.status === 'retry-safe') mode = 'recoverable';
    else if (review.status === 'conflict') mode = 'conflict';
    else {
      current = workspace.getSession().snapshot().find(note => note.id === target.id) ?? null;
      mode = same(original, current) ? 'editing' : 'conflict';
    }
    return review.status;
  }
  applyReview(true);
  if (target.kind === 'edit' && !original && mode === 'editing') throw new Error('Notebook note missing');

  async function run(action: () => Promise<void>) {
    if (disposed || busy) return;
    busy = true;
    try { await action(); }
    catch { if (!disposed) mode = 'uncertain'; }
    finally {
      busy = false;
      if (disposed) { title = ''; body = ''; original = null; current = null; }
    }
  }
  function candidate(): PersonalNote {
    return { id: target.id, title, body,
      createdAt: original?.createdAt ?? (target.kind === 'create' ? target.createdAt : ''), updatedAt: now() };
  }
  function assertLive() {
    if (disposed) throw new Error('Notebook editor closed');
    workspace.getRecovery();
  }
  function dispose() { disposed = true; title = ''; body = ''; original = null; current = null; }
  return {
    getView(): NotebookEditorView {
      const dirty = !disposed && (title !== (original?.title ?? '') || body !== (original?.body ?? ''));
      try { assertLive(); }
      catch { return { mode: 'unavailable', title: '', body: '', busy, current: null, dirty, checkpointed: false }; }
      const checkpointed = (mode === 'recoverable' || mode === 'conflict') && workspace.getRecovery().durable;
      return { mode, title, body, busy, current: current ? { ...current } : null,
        dirty, checkpointed };
    },
    change(next: { title?: string; body?: string }) {
      assertLive();
      if (!busy && mode === 'editing') {
        if (next.title !== undefined) title = next.title;
        if (next.body !== undefined) body = next.body;
      }
    },
    checkpoint() {
      if (mode !== 'editing') return Promise.resolve();
      return run(async () => {
        assertLive();
        await workspace.checkpointDraft(candidate(), original);
        if (disposed) return;
        applyReview();
      });
    },
    save() {
      if (mode !== 'editing') return Promise.resolve();
      return run(async () => {
        assertLive();
        await workspace.getSession().save(candidate(), original);
        if (!disposed) mode = 'saved';
      });
    },
    review() {
      return run(async () => {
        if (disposed) return;
        await workspace.reopen();
        if (disposed) return;
        if (applyReview() === 'already-saved') {
          await workspace.resolveRecovery('retry');
          if (!disposed) mode = 'saved';
        }
      });
    },
    commitRecovery() {
      if (mode !== 'recoverable') return Promise.resolve();
      return run(async () => {
        assertLive(); ownRecovery();
        await workspace.resolveRecovery('retry');
        if (!disposed) mode = 'saved';
      });
    },
    discardRecovery() {
      if (mode !== 'recoverable' && mode !== 'conflict') return Promise.resolve();
      return run(async () => {
        assertLive();
        // A conflict without a stored intent must be reviewed by reopening an
        // editor from the current record, never by rebasing silently here.
        const recovery = ownRecovery();
        if (recovery.status === 'none') { mode = 'unavailable'; return; }
        await workspace.resolveRecovery('discard');
        if (disposed) return;
        original = workspace.getSession().snapshot().find(note => note.id === target.id) ?? null;
        current = original;
        title = original?.title ?? ''; body = original?.body ?? '';
        mode = (target.kind === 'edit' && !original) || (target.kind === 'create' && original) ? 'unavailable' : 'editing';
      });
    },
    dispose,
    lock() { workspace.close(); dispose(); },
  };
}

export type NotebookEditor = ReturnType<typeof createNotebookEditor>;
