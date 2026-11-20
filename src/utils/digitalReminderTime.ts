export type DigitalTimeResult =
  | { ok: true; date: Date }
  | { ok: false; reason: 'invalidDate' | 'invalidHour' | 'invalidMinute' | 'unavailableTime' };

/** ASCII digits only: do not trim, truncate, clamp or normalize invalid input. */
function numericField(value: string, maximum: number): number | null {
  if (!/^[0-9]{1,2}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed <= maximum ? parsed : null;
}

export function digitalReminderFields(value: Date): { hour: string; minute: string } {
  if (!Number.isFinite(value.getTime())) return { hour: '', minute: '' };
  return { hour: String(value.getHours()).padStart(2, '0'), minute: String(value.getMinutes()).padStart(2, '0') };
}

/** Apply wall-clock fields to the caller's local calendar day; never change the original Date. */
export function applyDigitalReminderTime(value: Date, hour: string, minute: string): DigitalTimeResult {
  if (!Number.isFinite(value.getTime())) return { ok: false, reason: 'invalidDate' };
  const hours = numericField(hour, 23);
  if (hours === null) return { ok: false, reason: 'invalidHour' };
  const minutes = numericField(minute, 59);
  if (minutes === null) return { ok: false, reason: 'invalidMinute' };
  // Retain the exact instant (including the second fall-back occurrence) when unchanged.
  if (hours === value.getHours() && minutes === value.getMinutes()) return { ok: true, date: new Date(value.getTime()) };
  const next = new Date(value.getTime());
  next.setHours(hours, minutes, 0, 0);
  // Date.setHours silently advances non-existent spring-forward times. Reject those shifts.
  if (!Number.isFinite(next.getTime()) || next.getFullYear() !== value.getFullYear()
    || next.getMonth() !== value.getMonth() || next.getDate() !== value.getDate()
    || next.getHours() !== hours || next.getMinutes() !== minutes) return { ok: false, reason: 'unavailableTime' };
  return { ok: true, date: next };
}
