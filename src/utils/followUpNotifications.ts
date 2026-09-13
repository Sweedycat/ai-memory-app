import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'follow-ups';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Follow-up reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      sound: 'default',
    });
  }

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
}): Promise<string | null> {
  const reminderDate = new Date(args.reminderAt);
  if (Number.isNaN(reminderDate.getTime()) || reminderDate.getTime() <= Date.now()) {
    return null;
  }

  try {
    const allowed = await ensureNotificationPermission();
    if (!allowed) return null;

    const trigger =
      Platform.OS === 'android'
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
            channelId: CHANNEL_ID,
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
          };

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: args.personName,
        body: args.text,
        sound: 'default',
        data: {
          type: 'follow-up',
          personId: args.personId,
          followUpId: args.followUpId,
        },
      },
      trigger,
    });
  } catch (error) {
    console.warn('Could not schedule follow-up notification', error);
    return null;
  }
}

export async function cancelFollowUpNotification(notificationId?: string): Promise<void> {
  if (!notificationId) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn('Could not cancel follow-up notification', error);
  }
}
