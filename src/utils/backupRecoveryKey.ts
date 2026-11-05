/**
 * In-memory formatting and confirmation for a random 256-bit recovery key.
 * Never store a recovery key inside its encrypted backup, and never log it.
 */
export const RECOVERY_KEY_HEX_LENGTH = 64;

export function normalizeRecoveryKeyInput(input: string): string {
  if (typeof input !== 'string') throw new Error('Invalid recovery key');
  const normalized = input.replace(/[\t\r\n -]/g, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('Recovery key must be exactly 64 hexadecimal digits');
  }
  return normalized;
}

export function formatRecoveryKeyForOfflineStorage(input: string): string {
  const hex = normalizeRecoveryKeyInput(input);
  return hex.match(/.{8}/g)?.join('-').toUpperCase() ?? '';
}

/** UX confirmation only. Successful confirmation does not prove safe storage.
 * Real backup imports authenticate with AES-GCM before showing any data.
 */
export function recoveryKeyConfirmationMatches(original: string, typed: string): boolean {
  let left: string;
  let right: string;
  try {
    left = normalizeRecoveryKeyInput(original);
    right = normalizeRecoveryKeyInput(typed);
  } catch {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < RECOVERY_KEY_HEX_LENGTH; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}
