/**
 * Plaintext, in-memory preservation ONLY. Never persist, export or log this
 * value before an approved encrypted recovery path exists. This module does
 * not read storage, admit a migration, authenticate data or implement recovery.
 * null means confirmed absence; a caller must never substitute it for failed IO.
 */
export const LEGACY_STORAGE_MANIFEST_KIND = 'ai-memory-legacy-storage-manifest';
export const LEGACY_STORAGE_MANIFEST_VERSION = 1;
export const MAX_LEGACY_RAW_CODE_UNITS = 8 * 1024 * 1024;
export const MAX_LEGACY_MANIFEST_UTF8_BYTES = 32 * 1024 * 1024;
export const LEGACY_STORAGE_KEYS = Object.freeze([
  '@ai-memory/people-v1',
  '@ai-memory/life-records-v1',
  '@ai-memory/owner-profile/v1',
  '@ai-memory/privacy-settings/v1',
  '@ai-memory/language-preference-v1',
  '@ai-memory/appearance-preference-v1',
  '@ai-memory/bug-reports/v1',
  'ai-memory.backup.preferences.v1',
  '@ai-memory/permission-transparency-setup/v2',
] as const);
export type LegacyStorageKey = typeof LEGACY_STORAGE_KEYS[number];
export type LegacyStorageEntry = { key: LegacyStorageKey; raw: string | null };
export type LegacyStorageManifest = {
  kind: typeof LEGACY_STORAGE_MANIFEST_KIND;
  version: typeof LEGACY_STORAGE_MANIFEST_VERSION;
  entries: LegacyStorageEntry[];
};
const ERROR = 'Invalid or unsupported legacy storage manifest';
const CHUNK_CODE_UNITS = 16_384;
function reject(): never { throw new Error(ERROR); }
function guarded<T>(operation: () => T): T {
  try { return operation(); } catch { return reject(); }
}

// Accept only own data fields; never invoke a supplied getter or toJSON hook.
function fields(value: unknown, names: string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) reject();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length || !names.every(name => keys.includes(name))) reject();
  const result: Record<string, unknown> = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) reject();
    result[name] = descriptor.value;
  }
  return result;
}
function encoder(): TextEncoder {
  if (typeof TextEncoder === 'undefined') reject();
  return new TextEncoder();
}
function high(code: number): boolean { return code >= 0xD800 && code <= 0xDBFF; }
function low(code: number): boolean { return code >= 0xDC00 && code <= 0xDFFF; }

// No full-size secondary byte buffer; preserve pairs crossing chunk boundaries.
function utf8Size(value: string, encoding: TextEncoder): number {
  let size = 0;
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + CHUNK_CODE_UNITS, value.length);
    if (end < value.length && high(value.charCodeAt(end - 1)) && low(value.charCodeAt(end))) end--;
    size += encoding.encode(value.slice(start, end)).byteLength;
    if (size > MAX_LEGACY_MANIFEST_UTF8_BYTES) reject();
    start = end;
  }
  return size;
}

// Exact JSON.stringify string-token size, including quotes and well-formed JSON
// escaping of lone UTF-16 surrogates. Never change the preserved JS string.
function jsonStringSize(value: string, encoding: TextEncoder): number {
  let size = 2;
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + CHUNK_CODE_UNITS, value.length);
    if (end < value.length && high(value.charCodeAt(end - 1)) && low(value.charCodeAt(end))) end--;
    // Standard JSON escaping on bounded chunks avoids a full escaped copy.
    // Remove each chunk's quotes; the two enclosing quotes are counted once.
    size += encoding.encode(JSON.stringify(value.slice(start, end))).byteLength - 2;
    if (size > MAX_LEGACY_MANIFEST_UTF8_BYTES) reject();
    start = end;
  }
  return size;
}

function validate(input: unknown): LegacyStorageManifest {
  const encoding = encoder();
  const top = fields(input, ['kind', 'version', 'entries']);
  if (top.kind !== LEGACY_STORAGE_MANIFEST_KIND || top.version !== LEGACY_STORAGE_MANIFEST_VERSION ||
      !Array.isArray(top.entries) || top.entries.length !== LEGACY_STORAGE_KEYS.length ||
      Reflect.ownKeys(top.entries).length !== LEGACY_STORAGE_KEYS.length + 1) reject();
  const byKey = new Map<LegacyStorageKey, string | null>();
  for (let index = 0; index < LEGACY_STORAGE_KEYS.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(top.entries, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) reject();
    const entry = fields(descriptor.value, ['key', 'raw']);
    if (typeof entry.key !== 'string' || !LEGACY_STORAGE_KEYS.includes(entry.key as LegacyStorageKey) ||
        byKey.has(entry.key as LegacyStorageKey) ||
        (entry.raw !== null && (typeof entry.raw !== 'string' || entry.raw.length > MAX_LEGACY_RAW_CODE_UNITS))) reject();
    byKey.set(entry.key as LegacyStorageKey, entry.raw as string | null);
  }
  const entries = LEGACY_STORAGE_KEYS.map(key => ({ key, raw: byKey.get(key)! }));
  const result: LegacyStorageManifest = {
    kind: LEGACY_STORAGE_MANIFEST_KIND, version: LEGACY_STORAGE_MANIFEST_VERSION, entries,
  };
  // Serialize only a tiny all-null skeleton before checking full JSON size.
  let size = utf8Size(JSON.stringify({ ...result, entries: entries.map(({ key }) => ({ key, raw: null })) }), encoding) - entries.length * 4;
  for (const { raw } of entries) {
    size += raw === null ? 4 : jsonStringSize(raw, encoding);
    if (size > MAX_LEGACY_MANIFEST_UTF8_BYTES) reject();
  }
  return result;
}

/** Copies all nine entries into canonical key order without parsing raw values. */
export function buildLegacyStorageManifest(entries: unknown): LegacyStorageManifest {
  return guarded(() => validate({ kind: LEGACY_STORAGE_MANIFEST_KIND, version: LEGACY_STORAGE_MANIFEST_VERSION, entries }));
}
export function validateLegacyStorageManifest(input: unknown): LegacyStorageManifest {
  return guarded(() => validate(input));
}
/** The returned plaintext string must remain in memory until approved encryption. */
export function encodeLegacyStorageManifest(input: unknown): string {
  return guarded(() => JSON.stringify(validate(input)));
}
/** Accept only encoder output, rejecting duplicate JSON members and aliases. */
export function decodeLegacyStorageManifest(raw: unknown): LegacyStorageManifest {
  return guarded(() => {
    if (typeof raw !== 'string' || raw.length > MAX_LEGACY_MANIFEST_UTF8_BYTES) reject();
    utf8Size(raw, encoder()); // Bound untrusted serialized bytes before JSON.parse.
    const canonical = validate(JSON.parse(raw) as unknown);
    // JSON.parse alone silently takes the last duplicate member. Exact canonical
    // representation also rejects alternate escapes/order/whitespace, without
    // inspecting or normalizing any JSON-like content inside the raw strings.
    if (JSON.stringify(canonical) !== raw) reject();
    return canonical;
  });
}
