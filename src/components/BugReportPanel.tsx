import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type BugReportPanelProps = {
  onClose: () => void;
  reporterName?: string;
};

type BugArea = 'App lock' | 'Owner profile' | 'People' | 'Search' | 'Other';

type BugReport = {
  id: string;
  createdAt: string;
  area: BugArea;
  description: string;
  steps: string;
  expected: string;
  reporterName: string;
  appVersion: string;
};

const STORAGE_KEY = '@ai-memory/bug-reports/v1';
const APP_VERSION = '0.1.0';
const AREAS: BugArea[] = ['App lock', 'Owner profile', 'People', 'Search', 'Other'];

function buildShareText(report: BugReport) {
  return [
    'AI Memory bug report',
    `Version: ${report.appVersion}`,
    `Area: ${report.area}`,
    `Time: ${report.createdAt}`,
    report.reporterName ? `Reporter: ${report.reporterName}` : '',
    '',
    'What happened:',
    report.description,
    '',
    'Steps to reproduce:',
    report.steps || 'Not provided',
    '',
    'Expected result:',
    report.expected || 'Not provided',
    '',
    'Privacy note: no saved people, memory notes, or conversations were attached automatically.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function BugReportPanel({ onClose, reporterName = '' }: BugReportPanelProps) {
  const [area, setArea] = useState<BugArea>('Other');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const canSubmit = useMemo(() => Boolean(description.trim()) && !saving, [description, saving]);

  async function saveAndShare() {
    if (!canSubmit) return;

    const report: BugReport = {
      id: `bug-${Date.now()}`,
      createdAt: new Date().toISOString(),
      area,
      description: description.trim(),
      steps: steps.trim(),
      expected: expected.trim(),
      reporterName: reporterName.trim(),
      appVersion: APP_VERSION,
    };

    setSaving(true);
    setStatus('');

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const current = Array.isArray(parsed) ? parsed : [];
      const next = [report, ...current].slice(0, 50);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

      setStatus('Saved privately on this device. Choose where you want to send it.');
      await Share.share({
        title: 'AI Memory bug report',
        message: buildShareText(report),
      });
    } catch {
      setStatus('Could not save or open the share sheet. Your memories were not exposed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Close bug report" onPress={onClose}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>

          <Text style={styles.brand}>AI MEMORY · BETA</Text>
          <Text style={styles.title}>Found something weird?</Text>
          <Text style={styles.body}>
            Tell us what broke. The report is saved locally first, then you choose where to share it.
          </Text>

          <View style={styles.privacyBox}>
            <Text style={styles.privacyTitle}>🔒 No memory data attached</Text>
            <Text style={styles.privacyText}>
              People, notes and conversations are never added to a bug report automatically.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>WHERE DID IT HAPPEN?</Text>
            <View style={styles.chips}>
              {AREAS.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: area === item }}
                  onPress={() => setArea(item)}
                  style={[styles.chip, area === item && styles.chipActive]}
                >
                  <Text style={[styles.chipText, area === item && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>WHAT HAPPENED? *</Text>
            <TextInput
              accessibilityLabel="Describe the bug"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Example: the app asked for fingerprint twice after I came back from another app."
              placeholderTextColor="#727D89"
              style={[styles.input, styles.multiline]}
            />

            <Text style={styles.label}>HOW CAN WE REPEAT IT?</Text>
            <TextInput
              accessibilityLabel="Steps to reproduce the bug"
              value={steps}
              onChangeText={setSteps}
              multiline
              placeholder="1. Open AI Memory\n2. Go to...\n3. Tap..."
              placeholderTextColor="#727D89"
              style={[styles.input, styles.multilineSmall]}
            />

            <Text style={styles.label}>WHAT SHOULD HAVE HAPPENED?</Text>
            <TextInput
              accessibilityLabel="Expected result"
              value={expected}
              onChangeText={setExpected}
              multiline
              placeholder="Describe the result you expected."
              placeholderTextColor="#727D89"
              style={[styles.input, styles.multilineSmall]}
            />

            {status ? <Text style={styles.status}>{status}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save and share bug report"
              disabled={!canSubmit}
              onPress={() => void saveAndShare()}
              style={[styles.primaryButton, !canSubmit && styles.disabled]}
            >
              <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save & share report'}</Text>
            </Pressable>
          </View>

          <Text style={styles.caption}>
            Bug rewards can be connected later when public beta and user accounts are ready.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0F14' },
  container: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 42 },
  back: { color: '#7DE2C3', fontSize: 15, fontWeight: '800', paddingVertical: 8, marginBottom: 12 },
  brand: { color: '#7DE2C3', fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  title: { color: '#F4F7FA', fontSize: 31, lineHeight: 37, fontWeight: '900' },
  body: { color: '#98A3AF', fontSize: 15, lineHeight: 22, marginTop: 10 },
  privacyBox: {
    backgroundColor: '#10251F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#315B4F',
    padding: 14,
    marginTop: 18,
  },
  privacyTitle: { color: '#D9F5EC', fontSize: 13, fontWeight: '900' },
  privacyText: { color: '#8FB4A9', fontSize: 12, lineHeight: 18, marginTop: 5 },
  card: {
    backgroundColor: '#121820',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#202B36',
    padding: 17,
    marginTop: 14,
  },
  label: { color: '#7DE2C3', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 12, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#0E141B', borderRadius: 999, borderWidth: 1, borderColor: '#293541', paddingHorizontal: 11, paddingVertical: 8 },
  chipActive: { backgroundColor: '#17352D', borderColor: '#4B8877' },
  chipText: { color: '#8995A1', fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#7DE2C3' },
  input: {
    backgroundColor: '#0E141B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#293541',
    color: '#F4F7FA',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  multilineSmall: { minHeight: 82, textAlignVertical: 'top' },
  status: { color: '#9CC9BC', fontSize: 12, lineHeight: 18, marginTop: 14 },
  primaryButton: { backgroundColor: '#7DE2C3', borderRadius: 15, alignItems: 'center', paddingVertical: 14, marginTop: 18 },
  primaryButtonText: { color: '#07100D', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.35 },
  caption: { color: '#66727E', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 14, paddingHorizontal: 10 },
});
