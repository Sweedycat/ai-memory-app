import {
  createEncryptedAppDataUpload,
  getEncryptedAppDataBackup,
  listEncryptedAppDataBackups,
  type DriveRequestDescriptor,
} from './driveBackupProtocol';
import {
  validateEncryptedBackupEnvelope,
  MAX_ENCRYPTED_BACKUP_CHARACTERS,
  type EncryptedBackupEnvelopeV1,
} from './encryptedBackupEnvelope';

/**
 * Network transport for already-encrypted, small Google Drive appDataFolder backups.
 * NOT yet connected to the app. The caller must obtain a Google OAuth drive.appdata
 * access token with explicit user consent and securely manage its expiry.
 *
 * All requests remain limited to Drive's Google API origins; no HTTP redirects to
 * untrusted endpoints, no plaintext snapshots or recovery keys, no telemetry.
 * Large archives must use the separate resumable protocol + bounded file reader.
 */
type HttpResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

export type DriveFetch = (
  url: string,
  options: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
    redirect: 'error';
  },
) => Promise<HttpResponse>;

type DriveUploadedBackup = { id: string; name: string };
export type DriveBackupEntry = {
  id: string;
  name: string;
  sizeBytes: number;
  createdTime: string;
};

function accessTokenOrThrow(accessToken: string): string {
  if (typeof accessToken !== 'string' ||
    accessToken.length < 12 || accessToken.length > 8192 ||
    !/^[A-Za-z0-9._~-]+$/.test(accessToken)) {
    throw new Error('Google authorization is required');
  }
  return accessToken;
}

function safeDriveId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{10,256}$/.test(id);
}

function ensureDriveUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.googleapis.com' ||
    parsed.port || parsed.username || parsed.password || parsed.hash ||
    !(parsed.pathname.startsWith('/drive/v3/files') ||
      parsed.pathname === '/upload/drive/v3/files')) {
    throw new Error('Unsupported backup transport endpoint');
  }
}

async function authorizedDriveRequest(
  descriptor: DriveRequestDescriptor,
  accessToken: string,
  fetchImpl: DriveFetch,
  maxResponseCharacters: number,
): Promise<string> {
  ensureDriveUrl(descriptor.url);
  const token = accessTokenOrThrow(accessToken);
  let result: HttpResponse;
  try {
    result = await fetchImpl(descriptor.url, {
      method: descriptor.method,
      headers: {
        ...descriptor.headers,
        Authorization: 'Bearer ' + token,
      },
      ...(descriptor.body === undefined ? {} : { body: descriptor.body }),
      redirect: 'error',
    });
  } catch {
    // Do not expose token, session URL, raw response or request body to logs.
    throw new Error('Google Drive connection failed; local data was not changed');
  }

  if (!result.ok) {
    if (result.status === 401 || result.status === 403) {
      throw new Error('Google Drive authorization or permission failed');
    }
    if (result.status === 429 || result.status === 507) {
      throw new Error('Google Drive quota or rate limit reached');
    }
    throw new Error('Google Drive request failed; local data was not changed');
  }

  const contentLength = result.headers.get('Content-Length');
  if (contentLength) {
    const length = Number(contentLength);
    if (!Number.isFinite(length) || length < 0 || length > maxResponseCharacters * 4) {
      throw new Error('Google Drive response is too large');
    }
  }

  let text: string;
  try {
    text = await result.text();
  } catch {
    throw new Error('Google Drive response could not be read');
  }
  if (text.length > maxResponseCharacters) {
    throw new Error('Google Drive response is too large');
  }
  return text;
}

function parseJson(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Google Drive returned an invalid response');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Google Drive returned an invalid response');
  }
  return parsed as Record<string, unknown>;
}

/**
 * Upload accepts only a validated ENCRYPTED envelope, never a plaintext
 * snapshot. The access token must have Drive appDataFolder permission.
 *
 * A successful response must be confirmed from Google before claiming upload.
 * The caller must retain the recovery key OFF Drive and independently verify
 * a downloadable archive before marking the backup healthy.
 */
export async function uploadSmallEncryptedBackup(
  input: {
    envelope: EncryptedBackupEnvelopeV1;
    createdAt: string;
    accessToken: string;
    boundary: string;
  },
  fetchImpl: DriveFetch,
): Promise<DriveUploadedBackup> {
  const encrypted = validateEncryptedBackupEnvelope(input.envelope);
  const request = createEncryptedAppDataUpload(encrypted, input.createdAt, input.boundary);
  const responseText = await authorizedDriveRequest(request, input.accessToken, fetchImpl, 4096);
  const response = parseJson(responseText);
  if (!safeDriveId(response.id) ||
      typeof response.name !== 'string' ||
      !/^ai-memory-encrypted-v1-\d{8}T\d{6}\d*Z\.json$/.test(response.name)) {
    throw new Error('Google Drive did not confirm a valid backup');
  }
  return { id: response.id, name: response.name };
}

export async function listSmallEncryptedBackups(
  accessToken: string,
  fetchImpl: DriveFetch,
  pageToken?: string,
): Promise<{ entries: DriveBackupEntry[]; nextPageToken?: string }> {
  const request = listEncryptedAppDataBackups(pageToken);
  const response = parseJson(await authorizedDriveRequest(request, accessToken, fetchImpl, 200_000));
  if (!Array.isArray(response.files) || response.files.length > 100) {
    throw new Error('Google Drive returned an invalid backup list');
  }
  if (response.nextPageToken !== undefined &&
    (typeof response.nextPageToken !== 'string' ||
      response.nextPageToken.length > 2048)) {
    throw new Error('Google Drive returned an invalid page token');
  }

  const entries: DriveBackupEntry[] = [];
  for (const file of response.files) {
    if (!file || typeof file !== 'object' || Array.isArray(file)) continue;
    const item = file as Record<string, unknown>;
    if (!safeDriveId(item.id) ||
      typeof item.name !== 'string' ||
      !/^ai-memory-encrypted-v1-\d{8}T\d{6}\d*Z\.json$/.test(item.name) ||
      item.mimeType !== 'application/json' ||
      typeof item.size !== 'string' ||
      !/^\d+$/.test(item.size) ||
      typeof item.createdTime !== 'string' ||
      !Number.isFinite(Date.parse(item.createdTime))) continue;
    const size = Number(item.size);
    if (!Number.isSafeInteger(size) || size < 1) continue;
    entries.push({ id: item.id, name: item.name, sizeBytes: size, createdTime: item.createdTime });
  }
  return { entries, ...(response.nextPageToken ? { nextPageToken: response.nextPageToken as string } : {}) };
}

/**
 * Fetch encrypted data for REVIEW ONLY. Never writes to AsyncStorage.
 * Production enablement requires bounded streaming reads and mobile testing,
 * not a single large response.text() allocation.
 */
export async function downloadSmallEncryptedBackupForReview(
  accessToken: string,
  fileId: string,
  fetchImpl: DriveFetch,
): Promise<EncryptedBackupEnvelopeV1> {
  const request = getEncryptedAppDataBackup(fileId);
  const text = await authorizedDriveRequest(
    request, accessToken, fetchImpl, MAX_ENCRYPTED_BACKUP_CHARACTERS,
  );
  return validateEncryptedBackupEnvelope(parseJson(text));
}
