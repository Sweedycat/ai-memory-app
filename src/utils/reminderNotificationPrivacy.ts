/**
 * Notification previews must not contain private contact metadata.
 * Keep routing identifiers in non-rendered data so the existing biometric
 * gate can protect the actual person and follow-up details after tapping.
 *
 * The channel name changes when Android immutable privacy defaults change.
 * Existing alarms keep their original channel until delivered or replaced.
 */
export const PRIVATE_FOLLOW_UP_CHANNEL_ID = 'follow-ups-private-v1';

export const PRIVATE_FOLLOW_UP_TITLE = 'AI Memory';
export const PRIVATE_FOLLOW_UP_BODY =
  'You have a reminder. Unlock AI Memory to see the details.';

export function buildPrivateFollowUpContent(args: {
  personId: string;
  followUpId: string;
}) {
  return {
    title: PRIVATE_FOLLOW_UP_TITLE,
    body: PRIVATE_FOLLOW_UP_BODY,
    sound: 'default' as const,
    data: {
      type: 'follow-up',
      personId: args.personId,
      followUpId: args.followUpId,
    },
  };
}
