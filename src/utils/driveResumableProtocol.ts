/**
 * Google Drive v3 resumable upload protocol for encrypted backup FILES.
 *
 * PURE transport descriptions only: no network I/O, no access tokens, no
 * user data, no reads and no file writes. The future caller must read each
 * byte range from an already locally encrypted file, not construct multi-GB
 * JSON strings in JavaScript memory.
 *
 * A Drive resumable session URL is bearer-equivalent. Never log, share or
 * send it to our backend. It expires; query the server on reconnection.
 */

export const DRIVE_RESUMABLE_START_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id%2Cname%2Csize%2CcreatedTime';
export const RESUMABLE_MIN_CHUNK_BYTES = 256 * 1024;
export const RESUMABLE_DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;

export type ResumableRequest = {
  method: 'POST' | 'PUT';
  url: string;
  headers: Record<string, string>;
  body?: string;
  fileOffset?: number;
  fileLength?: number;
};

export type ResumableReply =
  | { state: 'complete'; nextOffset: number }
  | { state: 'continue'; nextOffset: number }
  | { state: 'expired'; nextOffset: 0 }
  | { state: 'query-status'; nextOffset: null }
  | { state: 'failed'; nextOffset: null };

function validLength(n: number): boolean {
  return Number.isSafeInteger(n) && n > 0;
}

function encryptedBackupName(timestampUtc: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(timestampUtc) ||
    !Number.isFinite(Date.parse(timestampUtc))
  ) {
    throw new Error('Invalid UTC backup timestamp');
  }
  // No user name, organization or notes are included in Drive file names.
  return 'ai-memory-encrypted-v1-' + timestampUtc.replace(/[\-:.]/g, '') + '.ambak';
}

export function createResumableBackupStart(
  encryptedFileBytes: number,
  timestampUtc: string,
): ResumableRequest {
  if (!validLength(encryptedFileBytes)) {
    throw new Error('Encrypted backup size must be a positive safe integer');
  }
  const metadata = {
    name: encryptedBackupName(timestampUtc),
    mimeType: 'application/octet-stream',
    parents: ['appDataFolder'],
  };
  const body = JSON.stringify(metadata);
  return {
    method: 'POST',
    url: DRIVE_RESUMABLE_START_URL,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/octet-stream',
      'X-Upload-Content-Length': String(encryptedFileBytes),
    },
    body,
  };
}

/**
 * Restrict to a known Drive resumable endpoint; a malicious response must
 * never persuade us to upload encrypted bytes to an arbitrary host.
 */
export function validateDriveResumableSessionUri(uri: string): string {
  if (typeof uri !== 'string' || uri.length > 4096) {
    throw new Error('Invalid Drive upload session');
  }
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Invalid Drive upload session');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'www.googleapis.com' ||
    parsed.port !== '' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.hash !== '' ||
    parsed.pathname !== '/upload/drive/v3/files' ||
    parsed.searchParams.get('uploadType') !== 'resumable' ||
    !parsed.searchParams.get('upload_id') ||
    parsed.searchParams.getAll('upload_id').length !== 1
  ) {
    throw new Error('Untrusted Drive upload session URL');
  }
  return parsed.toString();
}

function validChunkSize(n: number): boolean {
  return Number.isSafeInteger(n) && n >= RESUMABLE_MIN_CHUNK_BYTES &&
    n % RESUMABLE_MIN_CHUNK_BYTES === 0;
}

/**
 * Describes exactly one byte range. The future uploader reads only this
 * slice from encrypted local storage, then PUTs it as binary request body.
 * Never concatenate or base64-encode an entire multi-GB archive in JS.
 */
export function createResumableBackupChunk(
  sessionUri: string,
  encryptedFileBytes: number,
  startOffset: number,
  chunkBytes: number = RESUMABLE_DEFAULT_CHUNK_BYTES,
): ResumableRequest {
  const safeUri = validateDriveResumableSessionUri(sessionUri);
  if (!validLength(encryptedFileBytes) || !validChunkSize(chunkBytes)) {
    throw new Error('Invalid encrypted backup or chunk size');
  }
  if (
    !Number.isSafeInteger(startOffset) ||
    startOffset < 0 ||
    startOffset >= encryptedFileBytes
  ) {
    throw new Error('Invalid upload offset');
  }
  const remaining = encryptedFileBytes - startOffset;
  const length = Math.min(remaining, chunkBytes);
  const end = startOffset + length - 1;
  return {
    method: 'PUT',
    url: safeUri,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(length),
      'Content-Range': 'bytes ' + startOffset + '-' + end + '/' + encryptedFileBytes,
    },
    fileOffset: startOffset,
    fileLength: length,
  };
}

/**
 * After an interrupted PUT or uncertain 5xx response, ask Drive which bytes
 * it has committed. Do NOT assume the previous client-side chunk succeeded.
 */
export function createResumableBackupStatusQuery(
  sessionUri: string,
  encryptedFileBytes: number,
): ResumableRequest {
  const safeUri = validateDriveResumableSessionUri(sessionUri);
  if (!validLength(encryptedFileBytes)) throw new Error('Invalid encrypted backup size');
  return {
    method: 'PUT',
    url: safeUri,
    headers: {
      'Content-Length': '0',
      'Content-Range': 'bytes */' + encryptedFileBytes,
    },
  };
}

/** Parse a verified response from the Drive upload session endpoint. */
export function interpretResumableBackupReply(
  httpStatus: number,
  rangeHeader: string | null | undefined,
  encryptedFileBytes: number,
): ResumableReply {
  if (!validLength(encryptedFileBytes)) throw new Error('Invalid encrypted backup size');
  if (httpStatus === 200 || httpStatus === 201) {
    return { state: 'complete', nextOffset: encryptedFileBytes };
  }
  if (httpStatus === 404 || httpStatus === 410) {
    return { state: 'expired', nextOffset: 0 };
  }
  if (httpStatus === 308) {
    if (rangeHeader == null || rangeHeader === '') {
      return { state: 'continue', nextOffset: 0 };
    }
    const match = /^bytes=0-(\d+)$/.exec(rangeHeader);
    if (!match || !match[1]) throw new Error('Unexpected Drive upload range');
    const end = Number(match[1]);
    if (!Number.isSafeInteger(end) || end >= encryptedFileBytes) {
      throw new Error('Out-of-range Drive upload acknowledgement');
    }
    return { state: 'continue', nextOffset: end + 1 };
  }
  if (httpStatus === 408 || httpStatus === 429 || (httpStatus >= 500 && httpStatus <= 599)) {
    return { state: 'query-status', nextOffset: null };
  }
  return { state: 'failed', nextOffset: null };
}
