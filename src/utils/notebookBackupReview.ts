import { decodePersonalNotebook, type PersonalNote } from './personalNotebook';

// A separate versioned notebook archive avoids changing existing people backups.
// Call only with authenticated notebook data. This module never writes storage.
export function planNotebookRestoreReview(
  authenticatedNotes: string,
  existingNotes: readonly PersonalNote[],
) {
  const incoming = decodePersonalNotebook(authenticatedNotes);
  const existing = decodePersonalNotebook(JSON.stringify(existingNotes));
  const byId = new Map(existing.map(note => [note.id, note]));
  const additions: PersonalNote[] = [];
  const conflicts: { existing: PersonalNote; incoming: PersonalNote }[] = [];
  let identical = 0;
  for (const note of incoming) {
    const prior = byId.get(note.id);
    if (!prior) additions.push(note);
    else if (JSON.stringify(prior) === JSON.stringify(note)) identical++;
    else conflicts.push({ existing: prior, incoming: note });
  }
  return {
    status: 'review-required' as const,
    existingCount: existing.length,
    incomingCount: incoming.length,
    identical,
    additions,
    conflicts,
    // Existing notes are never deleted implicitly, even for an empty archive.
    // Applying a review requires a separate durable rollback and consent flow.
  };
}
