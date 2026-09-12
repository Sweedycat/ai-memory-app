import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LockDelaySeconds, usePrivacyControls } from './PrivacyGate';

type SettingsPanelProps = {
  displayName: string;
  role?: string;
  onClose: () => void;
  onEditProfile: () => void;
  onReportBug: () => void;
};

type DelayOption = {
  seconds: LockDelaySeconds;
  label: string;
};

const DELAY_OPTIONS: DelayOption[] = [
  { seconds: 0, label: 'Immediately' },
  { seconds: 30, label: '30 sec' },
  { seconds: 60, label: '1 min' },
  { seconds: 300, label: '5 min' },
];

export function SettingsPanel({
  displayName,
  role = '',
  onClose,
  onEditProfile,
  onReportBug,
}: SettingsPanelProps) {
  const {
    appLockEnabled,
    lockDelaySeconds,
    setAppLockEnabled,
    setLockDelaySeconds,
    lockNow,
  } = usePrivacyControls();
  const [changingLock, setChangingLock] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState('');

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'ME';

  async function toggleAppLock() {
    if (changingLock) return;

    setChangingLock(true);
    setPrivacyMessage('');

    const target = !appLockEnabled;
    const changed = await setAppLockEnabled(target);

    if (!changed) {
      setPrivacyMessage(
        target
          ? 'Could not enable the app lock. Please try again.'
          : 'App lock stayed on because owner authentication was cancelled or failed.',
      );
    } else {
      setPrivacyMessage(target ? 'App lock enabled.' : 'App lock disabled for this device.');
    }

    setChangingLock(false);
  }

  async function chooseDelay(seconds: LockDelaySeconds) {
    setPrivacyMessage('');

    try {
      await setLockDelaySeconds(seconds);
    } catch {
      setPrivacyMessage('Could not save the lock delay. Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={onClose}>
          <Text style={styles.back}>‹ AI Memory</Text>
        </Pressable>

        <Text style={styles.brand}>AI MEMORY</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.body}>Your profile, privacy controls and beta feedback live here.</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit owner profile"
          onPress={onEditProfile}
          style={styles.profileCard}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileMeta}>{role.trim() || 'Private owner profile'}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.label}>PRIVACY</Text>

          <View style={styles.statusRow}>
            <View style={styles.statusIconWrap}>
              <Text style={styles.statusIcon}>🔒</Text>
            </View>
            <View style={styles.flex}>
              <View style={styles.statusTop}>
                <View style={styles.flex}>
                  <Text style={styles.statusTitle}>App lock</Text>
                  <Text style={styles.statusText}>
                    {appLockEnabled
                      ? 'Protect AI Memory with your phone owner authentication.'
                      : 'AI Memory opens without its separate privacy lock.'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel="App lock"
                  accessibilityState={{ checked: appLockEnabled, disabled: changingLock }}
                  disabled={changingLock}
                  onPress={() => void toggleAppLock()}
                  style={[
                    styles.switchTrack,
                    appLockEnabled && styles.switchTrackOn,
                    changingLock && styles.switchDisabled,
                  ]}
                >
                  <View style={[styles.switchThumb, appLockEnabled && styles.switchThumbOn]} />
                </Pressable>
              </View>
            </View>
          </View>

          {appLockEnabled ? (
            <>
              <Divider />
              <View>
                <View style={styles.delayHeader}>
                  <View>
                    <Text style={styles.statusTitle}>Lock after leaving app</Text>
                    <Text style={styles.statusText}>Choose how quickly AI Memory locks in the background.</Text>
                  </View>
                </View>
                <View style={styles.delayOptions}>
                  {DELAY_OPTIONS.map((option) => {
                    const selected = lockDelaySeconds === option.seconds;
                    return (
                      <Pressable
                        key={option.seconds}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Lock ${option.label.toLowerCase()} after leaving app`}
                        onPress={() => void chooseDelay(option.seconds)}
                        style={[styles.delayChip, selected && styles.delayChipActive]}
                      >
                        <Text style={[styles.delayChipText, selected && styles.delayChipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Lock AI Memory now"
                  onPress={lockNow}
                  style={styles.lockNowButton}
                >
                  <Text style={styles.lockNowText}>Lock now</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          <Divider />
          <SettingStatus
            icon="◉"
            title="Memory storage"
            value="Local"
            text="Your owner profile, people and conversations stay on this device for now."
          />
          <Divider />
          <SettingStatus
            icon="◇"
            title="Bug report privacy"
            value="Protected"
            text="Saved people, notes and conversations are never attached automatically."
          />

          {privacyMessage ? <Text style={styles.privacyMessage}>{privacyMessage}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>SUPPORT & BETA</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report a bug"
            onPress={onReportBug}
            style={styles.actionRow}
          >
            <View style={styles.actionIconWrap}>
              <Text style={styles.actionIcon}>🐞</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.actionTitle}>Report a bug</Text>
              <Text style={styles.actionText}>Tell us what went wrong without exposing your memories.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.versionBox}>
          <Text style={styles.versionTitle}>AI Memory · Private Beta</Text>
          <Text style={styles.versionText}>Version 0.1.0 · Phone first, smart-glasses ready later.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingStatus({
  icon,
  title,
  value,
  text,
}: {
  icon: string;
  title: string;
  value: string;
  text: string;
}) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusIconWrap}>
        <Text style={styles.statusIcon}>{icon}</Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.statusTop}>
          <Text style={styles.statusTitle}>{title}</Text>
          <Text style={styles.statusValue}>{value}</Text>
        </View>
        <Text style={styles.statusText}>{text}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0F14' },
  container: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 44 },
  back: { color: '#7DE2C3', fontSize: 15, fontWeight: '800', paddingVertical: 8, marginBottom: 14 },
  brand: { color: '#7DE2C3', fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  title: { color: '#F4F7FA', fontSize: 34, lineHeight: 40, fontWeight: '900' },
  body: { color: '#98A3AF', fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  flex: { flex: 1 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121820',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#25313C',
    padding: 15,
    marginBottom: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17352D',
    borderWidth: 1,
    borderColor: '#315B4F',
    marginRight: 13,
  },
  avatarText: { color: '#7DE2C3', fontSize: 17, fontWeight: '900' },
  profileName: { color: '#F4F7FA', fontSize: 16, fontWeight: '900' },
  profileMeta: { color: '#7F8B97', fontSize: 12, marginTop: 4 },
  chevron: { color: '#66727E', fontSize: 27, marginLeft: 8 },
  card: {
    backgroundColor: '#121820',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#202B36',
    padding: 16,
    marginBottom: 12,
  },
  label: { color: '#7DE2C3', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  statusIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10251F',
    marginRight: 11,
  },
  statusIcon: { fontSize: 16, color: '#7DE2C3' },
  statusTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  statusTitle: { color: '#E7EDF2', fontSize: 14, fontWeight: '800' },
  statusValue: { color: '#7DE2C3', fontSize: 11, fontWeight: '900' },
  statusText: { color: '#7F8B97', fontSize: 12, lineHeight: 18, marginTop: 4 },
  divider: { height: 1, backgroundColor: '#202B36', marginVertical: 12, marginLeft: 49 },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#29333D',
    borderWidth: 1,
    borderColor: '#394651',
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: '#315B4F', borderColor: '#4B8877' },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#AAB5BE',
    alignSelf: 'flex-start',
  },
  switchThumbOn: { backgroundColor: '#7DE2C3', alignSelf: 'flex-end' },
  switchDisabled: { opacity: 0.55 },
  delayHeader: { marginLeft: 49 },
  delayOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11, marginLeft: 49 },
  delayChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#293541',
    backgroundColor: '#0E141B',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  delayChipActive: { borderColor: '#4B8877', backgroundColor: '#17352D' },
  delayChipText: { color: '#7F8B97', fontSize: 10, fontWeight: '800' },
  delayChipTextActive: { color: '#7DE2C3' },
  lockNowButton: {
    alignSelf: 'flex-start',
    marginLeft: 49,
    marginTop: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#355348',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lockNowText: { color: '#7DE2C3', fontSize: 11, fontWeight: '900' },
  privacyMessage: { color: '#9CC9BC', fontSize: 11, lineHeight: 17, marginTop: 13, marginLeft: 49 },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#201A12',
    borderWidth: 1,
    borderColor: '#66532F',
    marginRight: 11,
  },
  actionIcon: { fontSize: 18 },
  actionTitle: { color: '#F4F7FA', fontSize: 14, fontWeight: '900' },
  actionText: { color: '#7F8B97', fontSize: 12, lineHeight: 18, marginTop: 3 },
  versionBox: { paddingHorizontal: 6, paddingTop: 10 },
  versionTitle: { color: '#83909C', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  versionText: { color: '#596571', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 4 },
});
