/**
 * Notification previews must not contain private contact metadata.
 * Keep routing identifiers in non-rendered data so the existing biometric
 * gate can protect the actual person and follow-up details after tapping.
 *
 * The channel name changes when Android immutable privacy defaults change.
 * Existing alarms keep their original channel until delivered or replaced.
 */
import { notificationCopy, notificationsEn } from '../i18n/catalogs/notifications';
import type { Language } from '../i18n/language';

export const PRIVATE_FOLLOW_UP_CHANNEL_ID = 'follow-ups-private-v1';

export const PRIVATE_FOLLOW_UP_TITLE = 'AI Memory';
export const PRIVATE_FOLLOW_UP_BODY = notificationsEn.body;

export function buildPrivateFollowUpContent(args: {
  personId: string;
  followUpId: string;
  language?: Language;
}) {
  return {
    title: PRIVATE_FOLLOW_UP_TITLE,
    body: notificationCopy[args.language ?? 'en'].body,
    sound: 'default' as const,
    data: {
      type: 'follow-up',
      personId: args.personId,
      followUpId: args.followUpId,
    },
  };
}
