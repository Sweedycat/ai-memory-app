import type { MemoryPerson } from '../types';
import {
  prepareInMemoryBackupSnapshot,
  planRestoreForReview,
  type BackupOwnerProfile,
  type RestoreReview,
} from './backupSnapshot';
import {
  validateEncryptedBackupEnvelope,
  type Aes256GcmBackupCipher,
  type EncryptedBackupEnvelopeV1,
} from './encryptedBackupEnvelope';

/**
 * Versioned, encrypted identity binding. Legacy v1 archives remain review-only
 * and MUST NOT be automatically assigned to an account or company workspace.
 * This module does not persist, upload, restore, or authorize server access.
 */
export const BOUND_BACKUP_KIND = 'ai-memory-bound-private-snapshot';
export const BOUND_BACKUP_VERSION = 2;

export type BackupIdentity = { ownerId: string; workspaceId: string };
export type BoundBackupReview = {
  review: RestoreReview;
  authenticatedIdentity: BackupIdentity;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function identity(value: unknown): BackupIdentity {
  const v = record(value);
  if (!v || typeof v.ownerId !== 'string' ||
      typeof v.workspaceId !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v.ownerId) ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v.workspaceId)) {
    throw new Error('Backup identity is invalid');
  }
  return { ownerId: v.ownerId, workspaceId: v.workspaceId };
}

function same(a: BackupIdentity, b: BackupIdentity): boolean {
  return a.ownerId === b.ownerId && a.workspaceId === b.workspaceId;
}

/** Bind the owner and workspace INSIDE authenticated ciphertext, not metadata. */
export async function sealBoundBackupInMemory(
  input: {
    identity: BackupIdentity;
    owner: BackupOwnerProfile;
    people: MemoryPerson[];
    createdAt?: string;
  },
  cipher: Aes256GcmBackupCipher,
): Promise<EncryptedBackupEnvelopeV1> {
  const boundIdentity = identity(input.identity);
  const snapshot = prepareInMemoryBackupSnapshot(input);
  const plaintext = JSON.stringify({
    kind: BOUND_BACKUP_KIND,
    version: BOUND_BACKUP_VERSION,
    identity: boundIdentity,
    snapshot,
  });
  const encryptedPayload = await cipher.encryptUtf8ToCombinedBase64(plaintext);
  return validateEncryptedBackupEnvelope({
    kind: 'ai-memory-aesgcm-backup',
    version: 1,
    algorithm: 'AES-256-GCM',
    encryptedPayload,
  });
}

/**
 * Caller MUST supply an independently trusted local/session identity.
 * Authentication of ciphertext alone is not authorization to restore.
 */
export async function reviewBoundBackup(
  envelope: unknown,
  existingPeople: MemoryPerson[],
  expectedIdentity: BackupIdentity,
  cipher: Aes256GcmBackupCipher,
): Promise<BoundBackupReview> {
  const expected = identity(expectedIdentity);
  const validated = validateEncryptedBackupEnvelope(envelope);
  let plaintext: string;
  try {
    plaintext = await cipher.decryptCombinedBase64ToUtf8(validated.encryptedPayload);
  } catch {
    throw new Error('Cannot authenticate or decrypt this backup');
  }
  if (typeof plaintext !== 'string' || plaintext.length > 8_000_000) {
    throw new Error('Bound backup is invalid or too large');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error('Bound backup is invalid');
  }
  const v = record(parsed);
  if (!v || v.kind !== BOUND_BACKUP_KIND ||
      v.version !== BOUND_BACKUP_VERSION) {
    throw new Error('Bound backup version is unsupported');
  }
  const authenticatedIdentity = identity(v.identity);
  if (!same(authenticatedIdentity, expected)) {
    throw new Error('Backup identity or workspace mismatch');
  }
  const review = planRestoreForReview(v.snapshot, existingPeople);
  return { review, authenticatedIdentity };
}
