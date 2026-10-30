import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ReminderPermissionActions } from './ReminderPermissionActions';
import { PermissionOverview } from './PermissionOverview';

const SEEN_KEY = '@ai-memory/permission-transparency-setup/v2';

/**
 * Shows permission guidance once after a device owner profile exists, but
 * never blocks core memory features or forces a permission grant.
 * All controls are also reachable later from Settings.
 */
export function ReminderPermissionGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const seen = await AsyncStorage.getItem(SEEN_KEY);
        if (mounted) setShowSetup(Platform.OS === 'android' && seen !== 'seen');
      } catch {
        // Storage errors must never block access to existing memories.
        if (mounted) setShowSetup(false);
      } finally {
        if (mounted) setReady(true);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  async function continueToApp() {
    setShowSetup(false);
    try {
      await AsyncStorage.setItem(SEEN_KEY, 'seen');
    } catch {
      // Remain usable even if the onboarding preference could not be saved.
    }
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.center}>
          <Text style={styles.sub}>Preparing reminder setup…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!showSetup) return <>{children}</>;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.brand}>AI MEMORY · FIRST RUN</Text>
        <Text style={styles.title}>Your permissions. Your choice.</Text>
        <Text style={styles.sub}>
          Before you use reminders, here is what this beta asks from Android and
          why. Permissions are not granted automatically when you install the app.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>CHOOSE REMINDER ACCESS</Text>
          <ReminderPermissionActions />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>FULL PERMISSION DETAILS</Text>
          <PermissionOverview />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue to AI Memory without requiring permissions"
          style={styles.primary}
          onPress={() => void continueToApp()}
        >
          <Text style={styles.primaryText}>Continue to AI Memory</Text>
        </Pressable>
        <Text style={styles.note}>
          All these permissions are optional for saving local memories.
          You can manage them later in Settings.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0F14' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 27, paddingBottom: 25 },
  brand: { color: '#7DE2C3', fontSize: 12, fontWeight: '900', letterSpacing: 1.7, marginBottom: 13 },
  title: { color: '#F4F7FA', fontSize: 30, lineHeight: 37, fontWeight: '900' },
  sub: { color: '#98A3AF', fontSize: 14, lineHeight: 21, marginTop: 10 },
  sectionLabel: { color: '#7DE2C3', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  card: { backgroundColor: '#121820', borderRadius: 20, borderColor: '#202B36', borderWidth: 1, padding: 17, marginTop: 17 },
  footer: {
    backgroundColor: '#0B0F14', borderTopColor: '#202B36',
    borderTopWidth: 1, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12,
  },
  primary: { borderRadius: 15, backgroundColor: '#7DE2C3', paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#07100D', fontSize: 14, fontWeight: '900' },
  note: { color: '#8C98A4', fontSize: 11, lineHeight: 17, marginTop: 8, textAlign: 'center' },
});
