import type { MemoryPerson } from '../types';
import {
  createEncryptedAppDataUpload,
  getEncryptedAppDataBackup,
  listEncryptedAppDataBackups,
  type DriveRequestDescriptor,
} from './driveBackupProtocol';
import {
  MAX_ENCRYPTED_BACKUP_CHARACTERS,
  unsealBackupForReview,
  validateEncryptedBackupEnvelope,
  type Aes256GcmBackupCipher,
  type EncryptedBackupEnvelopeV1,
} from './encryptedBackupEnvelope';
import type { RestoreReview } from './backupSnapshot';

/**
 * Preview-only Google Drive appDataFolder transport for ALREADY ENCRYPTED archives.
 *
 * This intentionally does not authenticate users, store access tokens, create a
 * backup from private records, or write restored records to AsyncStorage.
 * Future account UI must obtain a minimally scoped, short-lived OAuth token,
 * verify explicit consent, and prepare the envelope with native AES-GCM.
 * Production/owner data must never be sent while those gates are untested.
 */

type BackupResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers?: { get(name: string): string | null };
};

export type BackupFetcher = (
  url: string,
  init: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
  },
) => Promise<BackupResponse>;

export type DriveEncryptedBackup = {
  id: string;
  name: string;
  createdTime: string;
  sizeBytes: number | null;
};

export type DriveBackupPage = {
  backups: DriveEncryptedBackup[];
  nextPageToken?: string;
};

const MAX_METADATA_CHARS = 256_000;
const MAX_DOWNLOAD_CHARS = MAX_ENCRYPTED_BACKUP_CHARACTERS + 512;
const NAME_PATTERN = /^ai-memory-encrypted-v1-\d{8}T\d{9}Z\.json$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{10,256}$/;

function validateOAuthAccessToken(token: string): void {
  // Google access tokens are opaque; only constrain obvious injection/absence.
  // Never log, export, persist, interpolate into a URL or return this value.
  if (typeof token !== 'string' || !/^[A-Za-z0-9._~+\/-]{10,4096}$/.test(token)) {
    throw new Error('A valid Google authorization is required');
  }
}

async function sendPrivateDriveRequest(
  descriptor: DriveRequestDescriptor,
  token: string,
  fetcher: BackupFetcher,
): Promise<BackupResponse> {
  validateOAuthAccessToken(token);
  if (!descriptor.url.startsWith('https://www.googleapis.com/')) {
    throw new Error('Refusing to send private backup to an unknown host');
  }

  // Fetch computes its own Content-Length. The pure multipart builder checks
  // actual UTF-8 bytes, so never manually override a platform-computed length.
  const headers: Record<string, string> = {
    ...descriptor.headers,
    Authorization: 'Bearer ' + token,
  };
  delete headers['Content-Length'];

  const response = await fetcher(descriptor.url, {
    method: descriptor.method,
    headers,
    ...(descriptor.body === undefined ? {} : { body: descriptor.body }),
  });
  if (!response.ok) {
    // Never expose provider error bodies; they can contain account metadata.
    if (response.status === 401 || response.status === 403) {
      throw new Error('Google Drive authorization expired or access denied');
    }
    if (response.status === 413 || response.status === 507) {
      throw new Error('Google Drive storage or upload size limit reached');
    }
    throw new Error('Encrypted Google Drive request failed');
  }
  return response;
}

async function readBoundedJson(
  response: BackupResponse,
  maxChars: number,
): Promise<unknown> {
  const declaredLength = response.headers?.get('content-length');
  if (declaredLength && Number(declaredLength) > maxChars) {
    throw new Error('Google Drive response exceeds the safe size');
  }
  const body = await response.text();
  if (body.length > maxChars) {
    throw new Error('Google Drive response exceeds the safe size');
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error('Google Drive returned invalid backup metadata');
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validBackupFile(value: unknown): DriveEncryptedBackup | null {
  const file = objectValue(value);
  if (!file || typeof file.id !== 'string' || !ID_PATTERN.test(file.id) ||
      typeof file.name !== 'string' || !NAME_PATTERN.test(file.name) ||
      typeof file.createdTime !== 'string' ||
      !Number.isFinite(Date.parse(file.createdTime)) ||
      file.mimeType !== 'application/json') {
    return null;
  }

  const rawSize = file.size;
  const sizeBytes = typeof rawSize === 'string' && /^\d+$/.test(rawSize)
    ? Number(rawSize)
    : null;
  if (sizeBytes !== null && (!Number.isSafeInteger(sizeBytes) || sizeBytes > MAX_DOWNLOAD_CHARS)) {
    return null;
  }
  return { id: file.id, name: file.name, createdTime: file.createdTime, sizeBytes };
}

/** Explicit opt-in: upload ONLY a previously sealed and authenticated envelope. */
export async function uploadEncryptedBackupToDrive(input: {
  encryptedEnvelope: EncryptedBackupEnvelopeV1;
  backupTimeUtc: string;
  multipartBoundary: string;
  googleAccessToken: string;
  userConfirmed: true;
  fetcher: BackupFetcher;
}): Promise<string> {
  if (input.userConfirmed !== true) {
    throw new Error('Owner must explicitly confirm encrypted backup upload');
  }
  const descriptor = createEncryptedAppDataUpload(
    input.encryptedEnvelope,
    input.backupTimeUtc,
    input.multipartBoundary,
  );
  const response = await sendPrivateDriveRequest(
    descriptor, input.googleAccessToken, input.fetcher,
  );
  const parsed = objectValue(await readBoundedJson(response, MAX_METADATA_CHARS));
  if (!parsed || typeof parsed.id !== 'string' || !ID_PATTERN.test(parsed.id)) {
    throw new Error('Google Drive did not confirm a valid backup ID');
  }
  return parsed.id;
}

/** Metadata only; never returns or displays private plaintext or a key. */
export async function listEncryptedBackupsFromDrive(input: {
  googleAccessToken: string;
  pageToken?: string;
  fetcher: BackupFetcher;
}): Promise<DriveBackupPage> {
  const response = await sendPrivateDriveRequest(
    listEncryptedAppDataBackups(input.pageToken),
    input.googleAccessToken,
    input.fetcher,
  );
  const parsed = objectValue(await readBoundedJson(response, MAX_METADATA_CHARS));
  if (!parsed || !Array.isArray(parsed.files) || parsed.files.length > 100) {
    throw new Error('Unexpected Google Drive backup list');
  }
  const next = parsed.nextPageToken;
  if (next !== undefined && (typeof next !== 'string' || !next || next.length > 2048)) {
    throw new Error('Unexpected Google Drive pagination');
  }
  return {
    backups: parsed.files.map(validBackupFile).filter(
      (file): file is DriveEncryptedBackup => file !== null,
    ),
    ...(typeof next === 'string' ? { nextPageToken: next } : {}),
  };
}

/**
 * Download ciphertext only. Caller must authenticate/decrypt with a separate
 * recovery key and show RestoreReview before a later, safely tested restore.
 */
export async function downloadEncryptedBackupFromDrive(input: {
  backupId: string;
  googleAccessToken: string;
  fetcher: BackupFetcher;
}): Promise<EncryptedBackupEnvelopeV1> {
  const response = await sendPrivateDriveRequest(
    getEncryptedAppDataBackup(input.backupId),
    input.googleAccessToken,
    input.fetcher,
  );
  const parsed = await readBoundedJson(response, MAX_DOWNLOAD_CHARS);
  return validateEncryptedBackupEnvelope(parsed);
}

/** Safe restore preview: NEVER writes or replaces local records. */
export async function reviewDriveBackupWithoutRestoring(input: {
  encryptedEnvelope: EncryptedBackupEnvelopeV1;
  existingPeople: MemoryPerson[];
  cipher: Aes256GcmBackupCipher;
}): Promise<RestoreReview> {
  return unsealBackupForReview(input.encryptedEnvelope, input.existingPeople, input.cipher);
}
