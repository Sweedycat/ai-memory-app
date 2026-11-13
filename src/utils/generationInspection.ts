import type { GenerationCodec, KeyValueStore } from './generationStore';

/**
 * Read-only diagnostic for a known generation. Does not activate, delete,
 * recover or log personal data. IDs must come from trusted local metadata,
 * never from an untrusted cloud archive. A valid result is not a durable
 * checksum or cryptographic integrity proof; concurrent writers remain unsafe.
 */
export type GenerationInspection =
  | { status: 'valid'; generationId: string }
  | { status: 'missing'; generationId: string }
  | { status: 'invalid'; generationId: string };

const ROOT = '@ai-memory/generation-v1/';
const POINTER = ROOT + 'active';
const ID_PATTERN = /^[a-f0-9]{32}$/i;

function validId(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

/**
 * Explicitly separates "active" from "valid": a generation may be valid but
 * not active, and a missing active generation must never be silently replaced.
 */
export async function inspectKnownGeneration<T>(
  storage: KeyValueStore,
  codec: GenerationCodec<T>,
  generationId: string,
): Promise<GenerationInspection> {
  if (!validId(generationId)) throw new Error('Invalid generation identifier');
  const dataKey = ROOT + 'data/' + generationId;
  const raw = await storage.getItem(dataKey);
  if (raw === null) {
    return await storage.getItem(dataKey) === null
      ? { status: 'missing', generationId }
      : { status: 'invalid', generationId };
  }
  if (typeof raw !== 'string' || raw.length === 0) return { status: 'invalid', generationId };
  try {
    const decoded = codec.decode(raw);
    if (codec.encode(decoded) !== raw) return { status: 'invalid', generationId };
    if (await storage.getItem(dataKey) !== raw ||
        await storage.getItem(dataKey) !== raw) return { status: 'invalid', generationId };
    return { status: 'valid', generationId };
  } catch {
    return { status: 'invalid', generationId };
  }
}

export async function inspectActiveGeneration<T>(
  storage: KeyValueStore,
  codec: GenerationCodec<T>,
): Promise<
  | { status: 'uninitialized' }
  | { status: 'pointer-invalid' }
  | { status: 'pointer-changed' }
  | GenerationInspection
> {
  const before = await storage.getItem(POINTER);
  if (before === null) {
    // A writer may initialize the pointer between reads. Do not report an
    // empty store while an activation is underway.
    return await storage.getItem(POINTER) === null
      ? { status: 'uninitialized' }
      : { status: 'pointer-changed' };
  }
  if (!validId(before)) {
    return await storage.getItem(POINTER) === before
      ? { status: 'pointer-invalid' }
      : { status: 'pointer-changed' };
  }
  // A stable pointer is required both before and after data inspection.
  if (await storage.getItem(POINTER) !== before) {
    return { status: 'pointer-changed' };
  }
  const inspected = await inspectKnownGeneration(storage, codec, before);
  if (await storage.getItem(POINTER) !== before ||
      await storage.getItem(POINTER) !== before) {
    return { status: 'pointer-changed' };
  }
  return inspected;
}
