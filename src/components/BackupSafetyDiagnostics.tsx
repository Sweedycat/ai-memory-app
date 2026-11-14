import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, Switch } from 'react-native';

import { BackupCryptoSelfTestError, runSyntheticBackupCryptoSelfTest } from '../utils/backupNativeSelfTest';

/**
 * Backup QA preflight only. There is deliberately NO user-data export or
 * restore action until on-device AES verification, OAuth, recovery-key UX and
 * crash-safe restore have passed the release gate.
 */
export function BackupSafetyDiagnostics() {
  const [frequency, setFrequency] = useState<'Off' | 'Daily' | 'Weekly' | 'Monthly'>('Off');
  const [wifiOnly, setWifiOnly] = useState(true);
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
      <Text style={styles.description}>These preview settings are temporary. No account is connected and no backup is scheduled or uploaded.</Text>
      <Text style={styles.description}>Automatic backup frequency</Text>
      <View style={styles.options}>
        {(['Off', 'Daily', 'Weekly', 'Monthly'] as const).map((option) => (
          <Pressable key={option} accessibilityRole="radio"
            accessibilityState={{ selected: frequency === option }}
            onPress={() => setFrequency(option)}
            style={[styles.option, frequency === option && styles.selected]}>
            <Text style={styles.buttonText}>{option}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.options}>
        <Text style={styles.description}>Wi-Fi only (preview)</Text>
        <Switch accessibilityLabel="Wi-Fi only preview" value={wifiOnly} onValueChange={setWifiOnly} />
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
  status: { color: '#9BABB4', fontSize: 11, lineHeight: 17, marginTop: 10 },
});
