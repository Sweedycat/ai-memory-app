import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type SettingsPanelProps = {
  displayName: string;
  role?: string;
  onClose: () => void;
  onEditProfile: () => void;
  onReportBug: () => void;
};

export function SettingsPanel({
  displayName,
  role = '',
  onClose,
  onEditProfile,
  onReportBug,
}: SettingsPanelProps) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'ME';

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
          <SettingStatus
            icon="🔒"
            title="App lock"
            value="On"
            text="AI Memory locks again whenever it leaves the foreground."
          />
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
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  statusTitle: { color: '#E7EDF2', fontSize: 14, fontWeight: '800' },
  statusValue: { color: '#7DE2C3', fontSize: 11, fontWeight: '900' },
  statusText: { color: '#7F8B97', fontSize: 12, lineHeight: 18, marginTop: 4 },
  divider: { height: 1, backgroundColor: '#202B36', marginVertical: 12, marginLeft: 49 },
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