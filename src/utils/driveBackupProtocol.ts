import {
  validateEncryptedBackupEnvelope,
  type EncryptedBackupEnvelopeV1,
} from './encryptedBackupEnvelope';

/**
 * Google Drive appDataFolder HTTP request descriptions.
 *
 * PURE helpers only. No OAuth tokens, file writes, network calls or user data
 * are accessed here. A future, reviewed upload adapter must only call these
 * after successful local AES-GCM sealing and explicit user consent.
 */
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const DRIVE_APPDATA_SPACE = 'appDataFolder';
export const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime';
export const MAX_MULTIPART_BACKUP_BYTES = 5_000_000;

export type DriveRequestDescriptor = {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: string;
};

function validateBackupDate(iso: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(iso) ||
    !Number.isFinite(Date.parse(iso))
  ) {
    throw new Error('Backup time must be an ISO UTC date');
  }
}

function safeBackupName(iso: string): string {
  validateBackupDate(iso);
  // File names contain no owner/person name. Each backup gets a timestamp.
  return 'ai-memory-encrypted-v1-' + iso.replace(/[\-:.]/g, '') + '.json';
}

/**
 * Prepare a small encrypted archive for an OAuth-authorized Drive API call.
 * The caller supplies a fresh multipart boundary; it is validated to avoid
 * header injection. A backup larger than 5 MB must use a separate resumable
 * upload implementation — never silently truncate a snapshot.
 *
 * IMPORTANT: shape validation alone is not a cryptographic proof. This
 * function must accept only the result of sealBackupInMemory in real app flow.
 */
export function createEncryptedAppDataUpload(
  encryptedEnvelope: EncryptedBackupEnvelopeV1,
  backupTimeUtc: string,
  multipartBoundary: string,
): DriveRequestDescriptor {
  const envelope = validateEncryptedBackupEnvelope(encryptedEnvelope);
  if (!/^[A-Za-z0-9_]{24,80}$/.test(multipartBoundary)) {
    throw new Error('Invalid multipart boundary');
  }

  const metadata = {
    name: safeBackupName(backupTimeUtc),
    mimeType: 'application/json',
    parents: [DRIVE_APPDATA_SPACE],
  };

  const body =
    '--' + multipartBoundary + '\r\n' +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    '--' + multipartBoundary + '\r\n' +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(envelope) + '\r\n' +
    '--' + multipartBoundary + '--\r\n';

  const byteLength = new TextEncoder().encode(body).byteLength;
  if (byteLength > MAX_MULTIPART_BACKUP_BYTES) {
    throw new Error('Encrypted backup requires resumable upload');
  }

  return {
    method: 'POST',
    url: DRIVE_UPLOAD_URL,
    headers: {
      'Content-Type': 'multipart/related; boundary=' + multipartBoundary,
      'Content-Length': String(byteLength),
    },
    body,
  };
}

/** List only files in the app's isolated Google Drive appDataFolder. */
export function listEncryptedAppDataBackups(pageToken?: string): DriveRequestDescriptor {
  if (pageToken !== undefined && (!pageToken || pageToken.length > 2048)) {
    throw new Error('Invalid Drive page token');
  }
  const params = [
    'spaces=appDataFolder',
    'pageSize=100',
    'fields=nextPageToken%2Cfiles%28id%2Cname%2CmimeType%2Csize%2CcreatedTime%29',
  ];
  if (pageToken !== undefined) params.push('pageToken=' + encodeURIComponent(pageToken));
  return {
    method: 'GET',
    url: DRIVE_API_BASE + '?' + params.join('&'),
    headers: { Accept: 'application/json' },
  };
}

/** Download the named backup; ciphertext must be authenticated before review. */
export function getEncryptedAppDataBackup(fileId: string): DriveRequestDescriptor {
  if (!/^[A-Za-z0-9_-]{10,256}$/.test(fileId)) throw new Error('Invalid backup file ID');
  return {
    method: 'GET',
    url: DRIVE_API_BASE + '/' + encodeURIComponent(fileId) + '?alt=media',
    headers: { Accept: 'application/json' },
  };
}
