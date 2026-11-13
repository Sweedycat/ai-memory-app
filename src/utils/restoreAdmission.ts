import type { RestoreReview } from './backupSnapshot';

/**
 * Pure, fail-closed admission gate. This does NOT write to storage or activate
 * a restore. Caller must still implement a durable rollback transaction.
 */
export type RestoreTarget = {
  workspaceId: string;
  ownerId: string;
};

export type RestoreAdmission = {
  approved: true;
  target: RestoreTarget;
  expectedIncomingPeople: number;
  expectedExistingPeople: number;
};

function validId(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length >= 1 && value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function sameTarget(a: RestoreTarget, b: RestoreTarget): boolean {
  return a.workspaceId === b.workspaceId && a.ownerId === b.ownerId;
}

/**
 * A checked review and an explicit user approval must refer to the same
 * workspace and owner as the CURRENT active dataset. Refuse silent cross-tenant
 * restores, stale review counts and missing rollback readiness.
 *
 * Never use this check as server-side authorization: the backend must enforce
 * membership and permissions independently.
 */
export function admitRestoreForStaging(input: {
  review: RestoreReview;
  selectedTarget: RestoreTarget;
  activeTarget: RestoreTarget;
  backupTarget: RestoreTarget;
  confirmedTarget: RestoreTarget;
  userConfirmed: boolean;
  durableRollbackReady: boolean;
  activePeopleCount: number;
}): RestoreAdmission {
  const { review, selectedTarget, activeTarget, backupTarget, confirmedTarget } = input;
  if (!validId(selectedTarget.workspaceId) || !validId(selectedTarget.ownerId) ||
      !validId(activeTarget.workspaceId) || !validId(activeTarget.ownerId) ||
      !validId(backupTarget.workspaceId) || !validId(backupTarget.ownerId) ||
      !validId(confirmedTarget.workspaceId) || !validId(confirmedTarget.ownerId)) {
    throw new Error('Restore target is invalid');
  }
  if (!sameTarget(selectedTarget, activeTarget) ||
      !sameTarget(selectedTarget, backupTarget) ||
      !sameTarget(selectedTarget, confirmedTarget)) {
    throw new Error('Restore identity or workspace mismatch');
  }
  if (!input.userConfirmed || !input.durableRollbackReady) {
    throw new Error('Restore requires confirmation and verified rollback');
  }
  if (review.status !== 'review-required' ||
      !Number.isSafeInteger(input.activePeopleCount) ||
      input.activePeopleCount < 0 ||
      review.existingPeople !== input.activePeopleCount ||
      !Array.isArray(review.candidatePeople) ||
      review.incomingPeople !== review.candidatePeople.length ||
      !Number.isSafeInteger(review.incomingPeople) ||
      review.incomingPeople < 0 ||
      !Number.isSafeInteger(review.existingPeople) ||
      review.existingPeople < 0) {
    throw new Error('Restore review is stale or invalid');
  }
  return {
    approved: true,
    target: { ...selectedTarget },
    expectedIncomingPeople: review.incomingPeople,
    expectedExistingPeople: review.existingPeople,
  };
}
