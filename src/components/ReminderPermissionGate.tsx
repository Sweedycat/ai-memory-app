import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageProvider';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
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
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { copy: catalog } = useI18n();
  const copy = catalog.ui.reminder;
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
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.center}>
          <Text style={styles.sub}>{copy.preparing}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!showSetup) return <>{children}</>;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.brand}>{copy.brand}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.sub}>{copy.intro}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{copy.access}</Text>
          <ReminderPermissionActions />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{copy.details}</Text>
          <PermissionOverview />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.continueLabel}
          style={styles.primary}
          onPress={() => void continueToApp()}
        >
          <Text style={styles.primaryText}>{copy.continue}</Text>
        </Pressable>
        <Text style={styles.note}>{copy.optional}</Text>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1, paddingHorizontal: theme.metrics.screenGutter, paddingTop: theme.spacing.md, paddingBottom: 25 },
  brand: { color: theme.colors.accent, fontSize: theme.typography.meta.fontSize, fontWeight: '900', letterSpacing: 1.7, marginBottom: 13 },
  title: { color: theme.colors.text, fontSize: theme.typography.hero.fontSize, lineHeight: theme.typography.hero.lineHeight, fontWeight: '900' },
  sub: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.body.lineHeight, marginTop: theme.spacing.sm },
  sectionLabel: { color: theme.colors.accent, fontSize: theme.typography.meta.fontSize, fontWeight: '900', letterSpacing: 0.7 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, borderColor: theme.colors.border, borderWidth: 1, padding: theme.metrics.cardPadding, marginTop: theme.metrics.cardPadding },
  footer: {
    backgroundColor: theme.colors.background, borderTopColor: theme.colors.border,
    borderTopWidth: 1, paddingHorizontal: theme.metrics.screenGutter, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.md,
  },
  primary: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', borderRadius: theme.radii.control, backgroundColor: theme.colors.accent, paddingVertical: theme.spacing.md, alignItems: 'center' },
  primaryText: { color: theme.colors.onAccent, fontSize: theme.typography.meta.fontSize, fontWeight: '900' },
  note: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: theme.spacing.sm, textAlign: 'center' },
});
