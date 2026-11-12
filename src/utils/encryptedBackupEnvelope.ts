import type { MemoryPerson } from '../types';
import {
  BACKUP_SNAPSHOT_VERSION,
  MAX_SNAPSHOT_CHARACTERS,
  planRestoreForReview,
  prepareInMemoryBackupSnapshot,
  type BackupOwnerProfile,
  type RestoreReview,
} from './backupSnapshot';

/**
 * The encrypted-backup envelope is safe to store only when produced by a
 * reviewed, real AES-256-GCM adapter that generates a unique random nonce for
 * EACH encryption and authenticates the ciphertext with a full-length tag.
 *
 * This module does not supply or generate an encryption key. A separate,
 * security-reviewed key-management flow must establish a recoverable key that
 * does not live in the backed-up file and survives a lost/replaced device.
 *
 * No file/network/storage I/O occurs here; caller remains responsible for
 * user consent before exporting/uploading any archive.
 */
export const ENCRYPTED_BACKUP_KIND = 'ai-memory-aesgcm-backup';
export const ENCRYPTED_BACKUP_VERSION = 1;
export const MAX_ENCRYPTED_BACKUP_CHARACTERS = 48_000_000;

/**
 * Crypto implementation port, intentionally NOT a fake "encrypt" fallback.
 * A mobile implementation should use Expo SDK 57's AES-GCM primitives.
 *
 * Encrypt/decrypt strings as exact UTF-8 byte sequences. The base64 output
 * must contain the authenticated AES-GCM sealed payload: nonce + ciphertext
 * + authentication tag; never reuse a nonce with the same key.
 */
export type Aes256GcmBackupCipher = {
  encryptUtf8ToCombinedBase64(plaintext: string): Promise<string>;
  decryptCombinedBase64ToUtf8(ciphertext: string): Promise<string>;
};

export type EncryptedBackupEnvelopeV1 = {
  kind: typeof ENCRYPTED_BACKUP_KIND;
  version: typeof ENCRYPTED_BACKUP_VERSION;
  algorithm: 'AES-256-GCM';
  encryptedPayload: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isCanonicalBase64(value: string): boolean {
  return (
    value.length >= 40 &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}

export function validateEncryptedBackupEnvelope(input: unknown): EncryptedBackupEnvelopeV1 {
  const value = record(input);
  if (
    !value ||
    value.kind !== ENCRYPTED_BACKUP_KIND ||
    value.version !== ENCRYPTED_BACKUP_VERSION ||
    value.algorithm !== 'AES-256-GCM' ||
    typeof value.encryptedPayload !== 'string' ||
    value.encryptedPayload.length > MAX_ENCRYPTED_BACKUP_CHARACTERS ||
    !isCanonicalBase64(value.encryptedPayload)
  ) {
    throw new Error('Encrypted backup is invalid or unsupported');
  }

  return {
    kind: ENCRYPTED_BACKUP_KIND,
    version: ENCRYPTED_BACKUP_VERSION,
    algorithm: 'AES-256-GCM',
    encryptedPayload: value.encryptedPayload,
  };
}

/**
 * Create ONLY an encrypted in-memory envelope; plaintext is never returned by
 * this API and nothing is written to any destination.
 */
export async function sealBackupInMemory(
  input: { owner: BackupOwnerProfile; people: MemoryPerson[]; createdAt?: string },
  cipher: Aes256GcmBackupCipher,
): Promise<EncryptedBackupEnvelopeV1> {
  const snapshot = prepareInMemoryBackupSnapshot(input);
  const plaintext = JSON.stringify(snapshot);
  if (plaintext.length > MAX_SNAPSHOT_CHARACTERS) {
    throw new Error('Backup plaintext exceeds supported size');
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
 * Fail closed: validate the external envelope, authenticate/decrypt, validate
 * the decrypted schema, then offer a REVIEW only. Existing records are
 * immutable and nothing is written or rescheduled.
 */
export async function unsealBackupForReview(
  untrustedEnvelope: unknown,
  existingPeople: MemoryPerson[],
  cipher: Aes256GcmBackupCipher,
): Promise<RestoreReview> {
  const envelope = validateEncryptedBackupEnvelope(untrustedEnvelope);
  let plaintext: string;
  try {
    plaintext = await cipher.decryptCombinedBase64ToUtf8(envelope.encryptedPayload);
  } catch {
    // Avoid exposing key/cryptography error details, which may be sensitive.
    throw new Error('Cannot authenticate or decrypt this backup');
  }
  if (typeof plaintext !== 'string' || plaintext.length > MAX_SNAPSHOT_CHARACTERS) {
    throw new Error('Decrypted backup exceeds supported size');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error('Decrypted backup has invalid JSON');
  }
  return planRestoreForReview(parsed, existingPeople);
}
