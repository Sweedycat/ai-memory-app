import { decodePersonalNotebook, type PersonalNote } from './personalNotebook';
import { planNotebookRestoreReview } from './notebookBackupReview';

export type NotebookConflictChoice = {
  id: string;
  action: 'keep-existing' | 'use-incoming';
};

// Pure candidate preparation only. Caller must authenticate archive, obtain
// explicit consent, recheck current state and create durable rollback before
// committing. No storage operations or implicit deletions occur here.
export function prepareNotebookRestoreCandidate(input: {
  authenticatedNotes: string;
  reviewedExistingNotes: readonly PersonalNote[];
  currentNotes: readonly PersonalNote[];
  choices: readonly NotebookConflictChoice[];
  includeAdditions: boolean;
}): PersonalNote[] {
  const reviewed = decodePersonalNotebook(JSON.stringify(input.reviewedExistingNotes));
  const current = decodePersonalNotebook(JSON.stringify(input.currentNotes));
  if (JSON.stringify(reviewed) !== JSON.stringify(current)) {
    throw new Error('Notebook changed since review');
  }
  const plan = planNotebookRestoreReview(input.authenticatedNotes, current);
  const decisions = new Map<string, NotebookConflictChoice['action']>();
  const conflictIds = new Set(plan.conflicts.map(c => c.existing.id));
  for (const choice of input.choices) {
    if (!conflictIds.has(choice.id) || decisions.has(choice.id) ||
        (choice.action !== 'keep-existing' && choice.action !== 'use-incoming')) {
      throw new Error('Invalid restore choice');
    }
    decisions.set(choice.id, choice.action);
  }
  if (decisions.size !== conflictIds.size) throw new Error('Unresolved restore conflict');
  const replacements = new Map(plan.conflicts
    .filter(c => decisions.get(c.existing.id) === 'use-incoming')
    .map(c => [c.existing.id, c.incoming]));
  const candidate = current.map(n => replacements.get(n.id) ?? n);
  if (input.includeAdditions === true) candidate.push(...plan.additions);
  return decodePersonalNotebook(JSON.stringify(candidate));
}
