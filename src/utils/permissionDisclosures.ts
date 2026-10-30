/**
 * Clear permission disclosures for the current phone-first MVP.
 * These entries are documentation, not proof that Android granted access.
 * Update this catalogue whenever native capabilities are added.
 */
export type CurrentPermission = {
  id: 'notifications' | 'exact-alarms' | 'biometrics' | 'reboot';
  name: string;
  purpose: string;
  howGranted: string;
  whenUsed: string;
  optional: boolean;
};

export type FuturePermission = {
  id: 'camera' | 'microphone' | 'location' | 'contacts' | 'files';
  name: string;
  context: string;
};

export const CURRENT_PERMISSIONS: readonly CurrentPermission[] = [
  {
    id: 'notifications',
    name: 'Notifications',
    purpose: 'Show follow-up reminders. A reminder may display the person\'s name and your follow-up text on the lock screen.',
    howGranted: 'Android asks only after you choose Allow notifications or schedule a reminder.',
    whenUsed: 'Only when using timed follow-ups.',
    optional: true,
  },
  {
    id: 'exact-alarms',
    name: 'Alarms & reminders',
    purpose: 'Helps Android deliver scheduled follow-ups closer to the selected time. Android can still delay some reminders.',
    howGranted: 'On Android 12+, you enable separate special access in the system settings.',
    whenUsed: 'When scheduling reminders at a specific time.',
    optional: true,
  },
  {
    id: 'biometrics',
    name: 'Fingerprint / device unlock',
    purpose: 'Protect access to your private AI Memory content with Android\'s own authentication screen.',
    howGranted: 'Android displays a fingerprint or device-lock prompt when you unlock. No separate install-time permission pop-up.',
    whenUsed: 'When App Lock is enabled.',
    optional: true,
  },
  {
    id: 'reboot',
    name: 'Restore reminders after restart',
    purpose: 'Android lets the notification library restore scheduled reminders after the phone restarts.',
    howGranted: 'A standard app capability declared by the notification library; no user approval screen.',
    whenUsed: 'When the phone restarts and a reminder is scheduled.',
    optional: true,
  },
];

export const FUTURE_PERMISSIONS: readonly FuturePermission[] = [
  { id: 'camera', name: 'Camera', context: 'Only for a future camera or smart-glasses capture feature.' },
  { id: 'microphone', name: 'Microphone', context: 'Only for a future opt-in voice recording or assistant feature.' },
  { id: 'location', name: 'Location', context: 'Only for a future optional route or nearby context assistant.' },
  { id: 'contacts', name: 'Phone contacts', context: 'Only if a future contact-import feature is offered and you explicitly choose it.' },
  { id: 'files', name: 'Photos & files', context: 'For future user-selected bug report attachments. No broad gallery access is requested now.' },
];

export const PERMISSION_PRIVACY_NOTE =
  'Your saved people, notes and conversations are not automatically attached to bug reports or sent to a cloud account by this local MVP. Local storage is not a promise of encryption. You choose what to share.';
