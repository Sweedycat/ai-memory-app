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
  const [failedStage, setFailedStage] = useState('');

  async function runCheck() {
    if (checking) return;
    setChecking(true);
    setResult('untested');
    setFailedStage('');
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
      <Text style={styles.label}>PRIVATE BACKUP · EXPERIMENTAL</Text>
      <Text style={styles.heading}>Encrypted Google Drive backup</Text>
      <Text style={styles.description}>
        Backup and restore are not yet available. Your real people and memories
        remain on this phone. When enabled, backups will be encrypted before
        leaving the device and require a separate recovery key.
      </Text>
      <Text style={styles.heading}>Backup setup preview</Text>
      <Text style={styles.description}>Google account: Not connected</Text>
      <Text style={styles.description}>Last backup: Never</Text>
      <Text style={styles.description}>Recovery key: Not configured</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
        setPractice(!practice); setEntered(''); setConfirmation('idle');
      }}>
        <Text style={styles.buttonText}>{practice ? 'Close recovery practice' : 'Practice recovery key setup'}</Text>
      </Pressable>
      {practice && <View>
        <Text style={styles.description}>TEST ONLY — public example key. Never enter a real recovery key here. Nothing is saved.</Text>
        <Text selectable style={styles.status}>{formatBackupRecoveryKey(fixture)}</Text>
        <TextInput accessibilityLabel="Example recovery key confirmation" value={entered}
          onChangeText={value => { setEntered(value); setConfirmation('idle'); }}
          autoCapitalize="none" autoCorrect={false} maxLength={71}
          style={styles.input} placeholder="Enter example key" placeholderTextColor="#8997A3" />
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
          setConfirmation(matchesRecoveryKeyConfirmation(fixture, entered) ? 'passed' : 'failed');
          setEntered('');
        }}>
          <Text style={styles.buttonText}>Confirm example key</Text>
        </Pressable>
        <Text style={styles.status}>{confirmation === 'passed' ? 'Example confirmation passed. Real recovery remains disabled.' : confirmation === 'failed' ? 'Example key did not match. Try again.' : 'Confirm the public example to practice recovery.'}</Text>
      </View>}
      <Text style={styles.description}>Preferences are saved on this device only. No account is connected and no backup is scheduled or uploaded.</Text>
      {saveError && <Text style={styles.status}>Preferences could not be loaded or saved. Backup remains disabled.</Text>}
      <Text style={styles.description}>Automatic backup frequency</Text>
      <View style={styles.options}>
        {(['Off', 'Daily', 'Weekly', 'Monthly'] as const).map((option) => (
          <Pressable key={option} accessibilityRole="radio"
            accessibilityState={{ selected: frequency === option }}
            disabled={!loaded}
            onPress={() => setFrequency(option)}
            style={[styles.option, frequency === option && styles.selected]}>
            <Text style={styles.buttonText}>{option}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.options}>
        <Text style={styles.description}>Wi-Fi only (preview)</Text>
        <Switch accessibilityLabel="Wi-Fi only preview" disabled={!loaded} value={wifiOnly} onValueChange={setWifiOnly} />
      </View>
      <Text style={styles.description}>Backup now and restore will become available after secure account and recovery setup.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Check synthetic backup encryption"
        disabled={checking}
        onPress={() => void runCheck()}
        style={[styles.button, checking && styles.disabled]}
      >
        <Text style={styles.buttonText}>
          {checking ? 'Checking encryption…' : 'Check encryption on this phone'}
        </Text>
      </Pressable>
      <Text style={styles.status}>
        {result === 'passed'
          ? 'Synthetic encryption, decryption, wrong-key and tamper checks passed. No personal data was used.'
          : result === 'failed'
            ? `Encryption check failed at ${failedStage}. Backup remains disabled; no personal data was touched.`
            : 'Optional diagnostic using synthetic data only. Does not create a backup.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#121820', borderRadius: 20, borderWidth: 1,
    borderColor: '#202B36', padding: 16, marginBottom: 12,
  },
  label: { color: '#7DE2C3', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 12 },
  heading: { color: '#F4F7FA', fontSize: 17, fontWeight: '800' },
  description: { color: '#8997A3', fontSize: 12, lineHeight: 19, marginTop: 8 },
  button: {
    marginTop: 15, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#315B4F', borderRadius: 12,
  },
  buttonText: { color: '#7DE2C3', fontSize: 12, fontWeight: '900' },
  options: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  option: { padding: 8, borderWidth: 1, borderColor: '#315B4F', borderRadius: 8 },
  selected: { backgroundColor: '#20483D' },
  disabled: { opacity: 0.5 },
  input: { color: '#F4F7FA', borderWidth: 1, borderColor: '#315B4F', borderRadius: 8, padding: 10, marginTop: 8 },
  status: { color: '#9BABB4', fontSize: 11, lineHeight: 17, marginTop: 10 },
});
