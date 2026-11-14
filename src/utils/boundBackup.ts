import type { MemoryPerson } from '../types';
import {
  prepareInMemoryBackupSnapshot,
  MAX_SNAPSHOT_CHARACTERS,
  planRestoreForReview,
  type BackupOwnerProfile,
  type RestoreReview,
} from './backupSnapshot';
import {
  validateEncryptedBackupEnvelope,
  ENCRYPTED_BACKUP_KIND,
  ENCRYPTED_BACKUP_VERSION,
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
// A v1 snapshot can fill its own limit; reserve space for the authenticated wrapper.
export const MAX_BOUND_BACKUP_CHARACTERS = MAX_SNAPSHOT_CHARACTERS + 1024;
// Conservative UTF-8 ceiling. Character checks alone undercount Unicode bytes.
export const MAX_BOUND_BACKUP_UTF8_BYTES = 16 * 1024 * 1024;

function utf8Bytes(value: string): number {
  // TextEncoder is available in modern React Native runtimes, but must be
  // verified on the target Hermes/Android build before enabling restore.
  if (typeof TextEncoder === 'undefined') {
    throw new Error('UTF-8 size validation unavailable');
  }
  // Encode in bounded chunks to avoid allocating a second full-size byte
  // buffer solely for validation. Never split a UTF-16 surrogate pair.
  const encoder = new TextEncoder();
  let bytes = 0;
  const chunkSize = 16_384;
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + chunkSize, value.length);
    if (end < value.length) {
      const last = value.charCodeAt(end - 1);
      const next = value.charCodeAt(end);
      if (last >= 0xD800 && last <= 0xDBFF &&
          next >= 0xDC00 && next <= 0xDFFF) end--;
    }
    bytes += encoder.encode(value.slice(start, end)).byteLength;
    if (bytes > MAX_BOUND_BACKUP_UTF8_BYTES) return bytes;
    start = end;
  }
  return bytes;
}

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
  if (plaintext.length > MAX_BOUND_BACKUP_CHARACTERS) {
    throw new Error('Bound backup exceeds supported size');
  }
  if (utf8Bytes(plaintext) > MAX_BOUND_BACKUP_UTF8_BYTES) {
    throw new Error('Bound backup exceeds UTF-8 byte budget');
  }
  const encryptedPayload = await cipher.encryptUtf8ToCombinedBase64(plaintext);
  return validateEncryptedBackupEnvelope({
    kind: ENCRYPTED_BACKUP_KIND,
    version: ENCRYPTED_BACKUP_VERSION,
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
  if (typeof plaintext !== 'string' || plaintext.length > MAX_BOUND_BACKUP_CHARACTERS) {
    throw new Error('Bound backup is invalid or too large');
  }
  if (utf8Bytes(plaintext) > MAX_BOUND_BACKUP_UTF8_BYTES) {
    throw new Error('Bound backup exceeds UTF-8 byte budget');
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
