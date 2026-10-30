import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const supportsExactAlarms =
  Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 31;

/**
 * Permissions are user-controlled. Never infer that opening the exact-alarm
 * settings screen means the user granted special access: Expo SDK 57 does not
 * provide AlarmManager.canScheduleExactAlarms() to JavaScript.
 */
export function ReminderPermissionActions() {
  const [notificationGranted, setNotificationGranted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      setNotificationGranted(permissions.granted);
    } catch {
      setNotificationGranted(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  async function allowNotifications() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const status = await Notifications.getPermissionsAsync();
      if (status.granted) {
        await Linking.openSettings();
        setMessage('You can manage AI Memory notification settings here.');
      } else if (!status.canAskAgain) {
        await Linking.openSettings();
        setMessage('Enable notifications for AI Memory in the phone settings.');
      } else {
        const response = await Notifications.requestPermissionsAsync();
        setNotificationGranted(response.granted);
        setMessage(
          response.granted
            ? 'Notifications are allowed. You can now schedule a test reminder.'
            : 'Notifications remain off. You can enable them in your phone settings.',
        );
      }
    } catch {
      setMessage('Could not open notification permissions. Open Settings > Apps > AI Memory > Notifications.');
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  async function openExactAlarmAccess() {
    if (busy || !supportsExactAlarms) return;
    setBusy(true);
    setMessage('');
    try {
      const id = Application.applicationId;
      if (!id) {
        setMessage('Could not identify this installation. Open phone Settings > Apps > Special access > Alarms & reminders.');
        return;
      }
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM,
        { data: `package:${id}` },
      );
      setMessage(
        'Review the Alarms & reminders switch in Android settings. Returning here does not confirm that access was granted.',
      );
    } catch {
      setMessage('Open phone Settings > Apps > Special access > Alarms & reminders and enable AI Memory.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.heading}>1. Notifications</Text>
          <Text style={styles.body}>
            {notificationGranted === true
              ? 'Allowed: Android can display reminder notifications.'
              : notificationGranted === false
                ? 'Not allowed: reminders may not appear.'
                : 'Checking your notification permission…'}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Allow or manage notifications"
        disabled={busy}
        onPress={() => void allowNotifications()}
        style={[styles.button, busy && styles.disabled]}
      >
        <Text style={styles.buttonText}>
          {notificationGranted ? 'Manage notification settings' : 'Allow notifications'}
        </Text>
      </Pressable>

      {supportsExactAlarms ? (
        <>
          <View style={styles.separator} />
          <Text style={styles.heading}>2. Precise alarms and reminders</Text>
          <Text style={styles.body}>
            For more timely reminders, Android needs separate Alarms & reminders access.
            Switch it on in the system screen. This is not the same as notification permission.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Android alarms and reminders special access"
            disabled={busy}
            onPress={() => void openExactAlarmAccess()}
            style={[styles.button, busy && styles.disabled]}
          >
            <Text style={styles.buttonText}>Open Alarms & reminders access</Text>
          </Pressable>
          <Text style={styles.note}>
            Android controls this permission. AI Memory cannot enable it for you
            or confirm its current state here. Reminders may still be delayed by the system.
          </Text>
        </>
      ) : null}

      {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  heading: { color: '#F4F7FA', fontSize: 14, fontWeight: '900', marginBottom: 6 },
  body: { color: '#98A3AF', fontSize: 12, lineHeight: 19 },
  button: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#4B8877',
    backgroundColor: '#17352D',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 11,
  },
  buttonText: { color: '#7DE2C3', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  separator: { height: 1, backgroundColor: '#293541', marginVertical: 17 },
  note: { color: '#8C98A4', fontSize: 11, lineHeight: 17, marginTop: 10 },
  message: { color: '#E5C98F', fontSize: 12, lineHeight: 18, marginTop: 13 },
});
