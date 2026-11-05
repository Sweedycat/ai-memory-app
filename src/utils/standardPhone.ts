/**
 * Private AI Memory address-book phone input, preserving the exact
 * user formatting (country codes, spaces and extensions).
 *
 * The number stays in the AI Memory person record (not the Android phone Contacts).
 * App Lock gates the UI; local AsyncStorage records are not separately
 * encrypted by the app. Per the owner's MVP choice, additional on-device
 * encryption is not a requirement. External backups remain AES-GCM encrypted.
 */
export function normalizeStandardPhone(raw: string): string | undefined {
  if (typeof raw !== 'string') throw new Error('Invalid phone input');
  const value = raw.trim();
  if (!value) return undefined;

  if (
    value.length > 64 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error('Phone number must be a single line, at most 64 characters');
  }
  const digits = value.match(/[0-9]/g)?.length ?? 0;
  if (digits < 3 || digits > 20) {
    throw new Error('Enter a valid phone number with 3 to 20 digits');
  }
  return value;
}
