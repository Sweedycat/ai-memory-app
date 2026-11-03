/**
 * A privacy preference change only becomes active after it is saved.
 *
 * In particular, a failed write must never disable the currently enabled
 * biometric gate just for the running process. The caller handles the error.
 */
export async function persistPrivacySettingBeforeApplying<T>(
  next: T,
  writeSerialized: (serialized: string) => Promise<void>,
  apply: (saved: T) => void,
): Promise<void> {
  await writeSerialized(JSON.stringify(next));
  apply(next);
}
