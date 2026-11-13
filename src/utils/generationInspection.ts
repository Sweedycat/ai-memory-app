import type { GenerationCodec, KeyValueStore } from './generationStore';

/**
 * Read-only diagnostic for a known generation. Does not activate, delete,
 * recover or log personal data. IDs must come from trusted local metadata,
 * never from an untrusted cloud archive.
 */
export type GenerationInspection =
  | { status: 'valid'; generationId: string }
  | { status: 'missing'; generationId: string }
  | { status: 'invalid'; generationId: string };

const ROOT = '@ai-memory/generation-v1/';
const POINTER = ROOT + 'active';
const ID_PATTERN = /^[a-f0-9]{32}$/i;

function validId(id: string): boolean {
  return ID_PATTERN.test(id);
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
  const raw = await storage.getItem(ROOT + 'data/' + generationId);
  if (raw === null) return { status: 'missing', generationId };
  if (typeof raw !== 'string' || raw.length === 0) return { status: 'invalid', generationId };
  try {
    codec.decode(raw);
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
  const inspected = await inspectKnownGeneration(storage, codec, before);
  if (await storage.getItem(POINTER) !== before) {
    return { status: 'pointer-changed' };
  }
  return inspected;
}
