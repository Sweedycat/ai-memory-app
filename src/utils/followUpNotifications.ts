import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationCopy } from '../i18n/catalogs/notifications';
import type { Language } from '../i18n/language';
import {
  buildPrivateFollowUpContent,
  PRIVATE_FOLLOW_UP_CHANNEL_ID,
} from './reminderNotificationPrivacy';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensurePrivateFollowUpChannel(language: Language = 'en'): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(PRIVATE_FOLLOW_UP_CHANNEL_ID, {
      name: notificationCopy[language].channel,
      description: notificationCopy[language].description,
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      vibrationPattern: [0, 250, 150, 250],
    });
  }
}

async function ensureNotificationPermission(language: Language): Promise<boolean> {
  await ensurePrivateFollowUpChannel(language);

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleFollowUpNotification(args: {
  personId: string;
  personName: string;
  followUpId: string;
  text: string;
  reminderAt: string;
  language?: Language;
}): Promise<string | null> {
  const reminderDate = new Date(args.reminderAt);
  if (Number.isNaN(reminderDate.getTime()) || reminderDate.getTime() <= Date.now()) {
    return null;
  }

  try {
    const allowed = await ensureNotificationPermission(args.language ?? 'en');
    if (!allowed) return null;

    const trigger: Notifications.DateTriggerInput =
      Platform.OS === 'android'
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
            channelId: PRIVATE_FOLLOW_UP_CHANNEL_ID,
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
          };

    return await Notifications.scheduleNotificationAsync({
      content: buildPrivateFollowUpContent({
        personId: args.personId,
        followUpId: args.followUpId,
        language: args.language,
      }),
      trigger,
    });
  } catch {
    console.warn('follow-up-scheduling-unavailable');
    return null;
  }
}

export async function cancelFollowUpNotification(notificationId?: string): Promise<void> {
  if (!notificationId) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    console.warn('follow-up-cancellation-unavailable');
  }
}
