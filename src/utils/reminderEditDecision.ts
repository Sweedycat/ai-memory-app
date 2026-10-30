export type ReminderEditDecision = 'clear' | 'no-reminder' | 'invalid' | 'expired' | 'reuse' | 'schedule';

type ExistingReminder = {
  text: string;
  reminderAt?: string;
  notificationId?: string;
};

export function planReminderEdit(input: {
  current?: ExistingReminder;
  nextText: string;
  nextReminderAt?: string;
  personNameChanged: boolean;
  nowMs: number;
}): ReminderEditDecision {
  const nextText = input.nextText.trim();

  if (!nextText) return 'clear';
  if (!input.nextReminderAt) return 'no-reminder';

  const reminderTime = Date.parse(input.nextReminderAt);
  if (!Number.isFinite(reminderTime)) return 'invalid';

  // A reminder that already fired must be given a fresh future time.
  // Saving unrelated edits must not silently pretend to re-arm it.
  if (reminderTime <= input.nowMs) {
    return input.nextReminderAt === input.current?.reminderAt ? 'expired' : 'invalid';
  }

  // Preserve the current scheduled notification when nothing relevant changed.
  if (
    input.current?.notificationId &&
    input.current.reminderAt === input.nextReminderAt &&
    input.current.text === nextText &&
    !input.personNameChanged
  ) {
    return 'reuse';
  }

  // Different time, follow-up text or person name (or missing notification ID)
  // requires a new notification before the old one is cancelled.
  return 'schedule';
}
