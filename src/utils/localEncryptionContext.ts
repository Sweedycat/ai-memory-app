/** Pure trusted-context binding only; no keys, storage, envelope or migration. */
export const LOCAL_ENCRYPTION_DOMAINS = Object.freeze([
  'people', 'life', 'owner', 'privacy', 'bug-reports', 'notebook',
] as const);
export type LocalEncryptionDomain = typeof LOCAL_ENCRYPTION_DOMAINS[number];
export type LocalEncryptionContext = {
  version: 1;
  domain: LocalEncryptionDomain;
  schemaVersion: 1;
  vaultId: string;
  keyId: string;
  generationId: string;
};

/**
 * Supply expected values from the future trusted authority, never exclusively
 * from an unverified archive. AAD is not authentication of an external account
 * and does not stop replay of an older blob under its original valid context.
 */
export function localEncryptionContextAAD(input: unknown): string {
  try {
    const fields = ['version', 'domain', 'schemaVersion', 'vaultId', 'keyId', 'generationId'];
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
    const own = Reflect.ownKeys(input);
    if (own.length !== fields.length || !fields.every(field => own.includes(field))) throw new Error();
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(input, field);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new Error();
      values[field] = descriptor.value;
    }
    if (values.version !== 1 || values.schemaVersion !== 1 ||
        !LOCAL_ENCRYPTION_DOMAINS.includes(values.domain as LocalEncryptionDomain)) throw new Error();
    for (const field of ['vaultId', 'keyId', 'generationId']) {
      if (typeof values[field] !== 'string' || !/^[a-f0-9]{32}$/.test(values[field])) throw new Error();
    }
    return JSON.stringify(['ai-memory-local-vault', 1, values.domain, 1,
      values.vaultId, values.keyId, values.generationId]);
  } catch {
    throw new Error('Invalid local encryption context');
  }
}
