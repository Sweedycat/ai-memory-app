export type LockDelaySeconds = 0 | 30 | 60 | 300;

export type PrivacySettings = {
  appLockEnabled: boolean;
  lockDelaySeconds: LockDelaySeconds;
};

export const DEFAULT_PRIVACY_SETTINGS: Readonly<PrivacySettings> = Object.freeze({
  appLockEnabled: true,
  lockDelaySeconds: 0,
});

export type PrivacySettingsLoadResult =
  | { ok: true; settings: PrivacySettings }
  | { ok: false };

/** Only confirmed absence or the complete, supported record establishes policy. */
export function parsePrivacySettings(raw: string | null): PrivacySettings | null {
  if (raw === null) return { ...DEFAULT_PRIVACY_SETTINGS };
  if (typeof raw !== 'string' || raw.length > 256) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as Record<string, unknown>;
    const keys = Object.keys(candidate);
    if (keys.length !== 2 || !keys.includes('appLockEnabled') || !keys.includes('lockDelaySeconds')) return null;
    if (typeof candidate.appLockEnabled !== 'boolean' ||
        ![0, 30, 60, 300].includes(candidate.lockDelaySeconds as number)) return null;

    // An admitted record has exactly two string tokens (the property names).
    // Counting them after primitive/shape validation also rejects duplicate
    // members, including escaped aliases and overwritten nested/string values.
    if (raw.match(/"(?:[^"\\]|\\.)*"/g)?.length !== 2) return null;
    return {
      appLockEnabled: candidate.appLockEnabled,
      lockDelaySeconds: candidate.lockDelaySeconds as LockDelaySeconds,
    };
  } catch {
    return null;
  }
}

/** Read-only: failure never synthesizes absence or repairs saved bytes. */
export async function loadPrivacySettings(
  read: () => Promise<string | null>,
): Promise<PrivacySettingsLoadResult> {
  try {
    const settings = parsePrivacySettings(await read());
    return settings ? { ok: true, settings } : { ok: false };
  } catch {
    return { ok: false };
  }
}
