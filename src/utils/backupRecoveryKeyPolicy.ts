/**
 * Recovery keys are 32 random bytes encoded as 64 hexadecimal characters.
 * No passwords, entropy estimation, logging, storage or network access here.
 * Format validation is not proof of random generation or backup ownership.
 */
export function normalizeBackupRecoveryKey(input: string): string {
  const trimmed = input.trim();
  if (!/^(?:[a-fA-F0-9]{64}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{8}){7})$/.test(trimmed)) {
    throw new Error('Invalid recovery key format');
  }
  return trimmed.replace(/-/g, '').toLowerCase();
}

export function formatBackupRecoveryKey(input: string): string {
  const key = normalizeBackupRecoveryKey(input);
  return key.match(/.{8}/g)!.join('-');
}

/** Local confirmation only; never use this comparison for authentication. */
export function matchesRecoveryKeyConfirmation(expected: string, entered: string): boolean {
  try {
    return normalizeBackupRecoveryKey(expected) === normalizeBackupRecoveryKey(entered);
  } catch {
    return false;
  }
}
