import { useI18n } from '../i18n/LanguageProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { ensurePrivateFollowUpChannel } from '../utils/followUpNotifications';
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
  const styles = useThemedStyles(createStyles);
  const { copy: catalog, language } = useI18n();
  const copy = catalog.ui.reminder;
  const [notificationGranted, setNotificationGranted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<'' | 'manageMessage' | 'enableMessage' | 'allowedMessage' | 'deniedMessage' | 'failedMessage' | 'identifyMessage' | 'reviewMessage' | 'alarmFailedMessage'>('');

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
      // Android 13+ requires a notification channel before requesting permission.
      // Use the same follow-up channel as the actual reminder scheduler.
      await ensurePrivateFollowUpChannel(language);
      const status = await Notifications.getPermissionsAsync();
      if (status.granted) {
        await Linking.openSettings();
        setMessage('manageMessage');
      } else if (!status.canAskAgain) {
        await Linking.openSettings();
        setMessage('enableMessage');
      } else {
        const response = await Notifications.requestPermissionsAsync();
        setNotificationGranted(response.granted);
        setMessage(
          response.granted
            ? 'allowedMessage'
            : 'deniedMessage',
        );
      }
    } catch {
      setMessage('failedMessage');
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
        setMessage('identifyMessage');
        return;
      }
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM,
        { data: `package:${id}` },
      );
      setMessage(
        'reviewMessage',
      );
    } catch {
      setMessage('alarmFailedMessage');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.heading}>{copy.heading}</Text>
          <Text style={styles.body}>
            {notificationGranted === true
              ? copy.allowed
              : notificationGranted === false
                ? copy.denied
                : copy.checking}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.allowLabel}
        disabled={busy}
        onPress={() => void allowNotifications()}
        style={[styles.button, busy && styles.disabled]}
      >
        <Text style={styles.buttonText}>
          {notificationGranted ? copy.manage : copy.allow}
        </Text>
      </Pressable>

      {supportsExactAlarms ? (
        <>
          <View style={styles.separator} />
          <Text style={styles.heading}>{copy.alarmHeading}</Text>
          <Text style={styles.body}>{copy.alarmBody}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.alarmLabel}
            disabled={busy}
            onPress={() => void openExactAlarmAccess()}
            style={[styles.button, busy && styles.disabled]}
          >
            <Text style={styles.buttonText}>{copy.alarmOpen}</Text>
          </Pressable>
          <Text style={styles.note}>{copy.alarmNote}</Text>
        </>
      ) : null}

      {message ? <Text accessibilityRole="alert" style={styles.message}>{copy[message]}</Text> : null}
    </View>
  );
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  wrap: { marginTop: theme.spacing.md },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
  heading: { color: theme.colors.text, fontSize: theme.typography.meta.fontSize, fontWeight: '900', marginBottom: theme.spacing.sm },
  body: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight },
  button: {
    minHeight: theme.metrics.controlMinHeight,
    justifyContent: 'center',
    borderRadius: theme.radii.control,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    backgroundColor: theme.colors.surfaceRaised,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    marginTop: 11,
  },
  buttonText: { color: theme.colors.accent, fontSize: theme.typography.meta.fontSize, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  separator: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.metrics.cardPadding },
  note: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: theme.spacing.sm },
  message: { color: theme.colors.warning, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: 13 },
});
