import { useI18n } from '../i18n/LanguageProvider';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View, Switch, TextInput } from 'react-native';

import { formatBackupRecoveryKey, matchesRecoveryKeyConfirmation } from '../utils/backupRecoveryKeyPolicy';

import { BackupCryptoSelfTestError, runSyntheticBackupCryptoSelfTest } from '../utils/backupNativeSelfTest';

/**
 * Backup QA preflight only. There is deliberately NO user-data export or
 * restore action until on-device AES verification, OAuth, recovery-key UX and
 * crash-safe restore have passed the release gate.
 */
export function BackupSafetyDiagnostics() {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const { copy: catalog } = useI18n();
  const copy = catalog.ui.backup;
  const [frequency, setFrequency] = useState<'Off' | 'Daily' | 'Weekly' | 'Monthly'>('Off');
  const [wifiOnly, setWifiOnly] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem('ai-memory.backup.preferences.v1').then(value => {
      if (!active) return;
      if (value) {
        const parsed = JSON.parse(value);
        if (['Off', 'Daily', 'Weekly', 'Monthly'].includes(parsed.frequency) &&
            typeof parsed.wifiOnly === 'boolean') {
          setFrequency(parsed.frequency);
          setWifiOnly(parsed.wifiOnly);
        } else { setSaveError(true); return; }
      }
      setLoaded(true);
    }).catch(() => { if (active) setSaveError(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    void AsyncStorage.setItem('ai-memory.backup.preferences.v1',
      JSON.stringify({ frequency, wifiOnly })).catch(() => setSaveError(true));
  }, [loaded, frequency, wifiOnly]);
  // Public fixture only; never use for encryption.
  const fixture = '0123456789abcdef'.repeat(4);
  const [practice, setPractice] = useState(false);
  const [entered, setEntered] = useState('');
  const [confirmation, setConfirmation] = useState<'idle' | 'passed' | 'failed'>('idle');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<'untested' | 'passed' | 'failed'>('untested');
  const [failedStage, setFailedStage] = useState<keyof typeof copy.stages>('unknown');

  async function runCheck() {
    if (checking) return;
    setChecking(true);
    setResult('untested');
    setFailedStage('unknown');
    try {
      await runSyntheticBackupCryptoSelfTest();
      setResult('passed');
    } catch (error) {
      setFailedStage(error instanceof BackupCryptoSelfTestError ? error.stage : 'unknown');
      setResult('failed');
    } finally {
      setChecking(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{copy.label}</Text>
      <Text style={styles.heading}>{copy.title}</Text>
      <Text style={styles.description}>{copy.description}</Text>
      <Text style={styles.heading}>{copy.setup}</Text>
      <Text style={styles.description}>{copy.account}</Text>
      <Text style={styles.description}>{copy.last}</Text>
      <Text style={styles.description}>{copy.key}</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
        setPractice(!practice); setEntered(''); setConfirmation('idle');
      }}>
        <Text style={styles.buttonText}>{practice ? copy.closePractice : copy.practice}</Text>
      </Pressable>
      {practice && <View>
        <Text style={styles.description}>{copy.exampleNotice}</Text>
        <Text selectable style={styles.status}>{formatBackupRecoveryKey(fixture)}</Text>
        <TextInput accessibilityLabel={copy.exampleLabel} value={entered}
          onChangeText={value => { setEntered(value); setConfirmation('idle'); }}
          autoCapitalize="none" autoCorrect={false} maxLength={71}
          style={styles.input} placeholder={copy.examplePlaceholder} placeholderTextColor={theme.colors.textSecondary} />
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
          setConfirmation(matchesRecoveryKeyConfirmation(fixture, entered) ? 'passed' : 'failed');
          setEntered('');
        }}>
          <Text style={styles.buttonText}>{copy.confirm}</Text>
        </Pressable>
        <Text style={styles.status}>{confirmation === 'passed' ? copy.confirmationPassed : confirmation === 'failed' ? copy.confirmationFailed : copy.confirmationIdle}</Text>
      </View>}
      <Text style={styles.description}>{copy.preferences}</Text>
      {saveError && <Text style={styles.status}>{copy.saveError}</Text>}
      <Text style={styles.description}>{copy.frequency}</Text>
      <View style={styles.options}>
        {(['Off', 'Daily', 'Weekly', 'Monthly'] as const).map((option) => (
          <Pressable key={option} accessibilityRole="radio"
            accessibilityState={{ selected: frequency === option }}
            disabled={!loaded}
            onPress={() => setFrequency(option)}
            style={[styles.option, frequency === option && styles.selected]}>
            <Text style={styles.buttonText}>{copy.frequencies[option]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.options}>
        <Text style={styles.description}>{copy.wifi}</Text>
        <Switch accessibilityLabel={copy.wifiLabel} disabled={!loaded} value={wifiOnly} onValueChange={setWifiOnly} />
      </View>
      <Text style={styles.description}>{copy.future}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.checkLabel}
        disabled={checking}
        onPress={() => void runCheck()}
        style={[styles.button, checking && styles.disabled]}
      >
        <Text style={styles.buttonText}>
          {checking ? copy.checking : copy.check}
        </Text>
      </Pressable>
      <Text style={styles.status}>
        {result === 'passed'
          ? copy.passed
          : result === 'failed'
            ? copy.failed(copy.stages[failedStage])
            : copy.untested}
      </Text>
    </View>
  );
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, borderWidth: 1,
    borderColor: theme.colors.border, padding: theme.metrics.cardPadding, marginBottom: theme.spacing.md,
  },
  label: { color: theme.colors.accent, fontSize: theme.typography.meta.fontSize, fontWeight: '900', letterSpacing: 1.2, marginBottom: theme.spacing.md },
  heading: { color: theme.colors.text, fontSize: theme.typography.section.fontSize, fontWeight: '800' },
  description: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: theme.spacing.sm },
  button: {
    minHeight: theme.metrics.controlMinHeight,
    justifyContent: 'center',
    marginTop: theme.spacing.md, paddingVertical: theme.spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.control,
  },
  buttonText: { color: theme.colors.accent, fontSize: theme.typography.meta.fontSize, fontWeight: '900' },
  options: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  option: { minHeight: theme.metrics.controlMinHeight, minWidth: theme.metrics.controlMinHeight, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.control },
  selected: { backgroundColor: theme.colors.surfaceRaised },
  disabled: { opacity: 0.5 },
  input: { color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.control, padding: theme.spacing.sm, marginTop: theme.spacing.sm },
  status: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: theme.spacing.sm },
});
