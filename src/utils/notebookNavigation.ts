import type { PersonalNote } from './personalNotebook';

export type NotebookChange = { id: string; current: PersonalNote | null; candidate: PersonalNote | null };
export function notebookRecoveryChanges(current: readonly PersonalNote[], candidate: readonly PersonalNote[]): NotebookChange[] {
  const before = new Map(current.map(note => [note.id, note]));
  const after = new Map(candidate.map(note => [note.id, note]));
  const changes: NotebookChange[] = [];
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(id) ?? null, b = after.get(id) ?? null;
    if (a && b && a.title === b.title && a.body === b.body && a.createdAt === b.createdAt && a.updatedAt === b.updatedAt) continue;
    changes.push({ id, current: a ? { ...a } : null, candidate: b ? { ...b } : null });
  }
  return changes;
}
