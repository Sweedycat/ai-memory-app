import { AppHeader } from './ui/AppHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageProvider';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import appConfig from '../../app.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
type BugDraft = { area: BugArea; description: string; steps: string; expected: string };
const draftSignature = (draft: BugDraft) => JSON.stringify([draft.area, draft.description.trim(), draft.steps.trim(), draft.expected.trim()]);

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
const APP_VERSION = appConfig.expo.version;
const AREAS: BugArea[] = ['App lock', 'Owner profile', 'People', 'Search', 'Other'];
let reportSequence = 0;
function validReport(value: unknown): value is BugReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ['id', 'createdAt', 'area', 'description', 'steps', 'expected', 'reporterName', 'appVersion']
    .every(key => typeof record[key] === 'string') && AREAS.includes(record.area as BugArea);
}

function buildShareText(report: BugReport, copy: ReturnType<typeof useI18n>['copy']['ui']['bug'], locale: string) {
  return [
    copy.reportTitle,
    `${copy.version}: ${report.appVersion}`,
    `${copy.area}: ${copy.areas[report.area]}`,
    `${copy.time}: ${new Date(report.createdAt).toLocaleString(locale)}`,
    report.reporterName ? `${copy.reporter}: ${report.reporterName}` : '',
    '',
    copy.reportHappened,
    report.description,
    '',
    copy.reportSteps,
    report.steps || copy.missing,
    '',
    copy.reportExpected,
    report.expected || copy.missing,
    '',
    copy.reportPrivacy,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function BugReportPanel({ onClose, reporterName = '' }: BugReportPanelProps) {
  const styles = useThemedStyles(createStyles);
  const { theme, isDark } = useTheme();
  const { copy: catalog, locale } = useI18n();
  const copy = catalog.ui.bug;
  const [area, setArea] = useState<BugArea>('Other');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'' | 'saved' | 'failed'>('');
  const emptySignature = JSON.stringify(['Other', '', '', '']);
  const liveDraft = useRef<BugDraft>({ area, description, steps, expected });
  const savedSignature = useRef(emptySignature);
  const alive = useRef(true), savingRef = useRef(false);
  const attempt = useRef<{ signature: string; report: BugReport } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function changeDraft(patch: Partial<BugDraft>) {
    if (savingRef.current) return;
    liveDraft.current = { ...liveDraft.current, ...patch };
    if (patch.area !== undefined) setArea(patch.area);
    if (patch.description !== undefined) setDescription(patch.description);
    if (patch.steps !== undefined) setSteps(patch.steps);
    if (patch.expected !== undefined) setExpected(patch.expected);
  }

  const canSubmit = useMemo(() => Boolean(description.trim()) && !saving, [description, saving]);

  async function saveReport(share: boolean): Promise<boolean> {
    if (!alive.current || !liveDraft.current.description.trim() || savingRef.current) return false;
    const input = liveDraft.current;
    const signature = draftSignature(input);

    const report: BugReport = attempt.current?.signature === signature ? attempt.current.report : {
      id: `bug-${Date.now()}-${++reportSequence}`,
      createdAt: new Date().toISOString(),
      area: input.area,
      description: input.description.trim(),
      steps: input.steps.trim(),
      expected: input.expected.trim(),
      reporterName: reporterName.trim(),
      appVersion: APP_VERSION,
    };
    attempt.current = { signature, report };

    savingRef.current = true; setSaving(true);
    setStatus('');

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw !== null && raw.length > 1_000_000) throw new Error('Report history too large');
      const parsed: unknown = raw === null ? [] : JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(validReport) || new Set(parsed.map(item => item.id)).size !== parsed.length)
        throw new Error('Invalid report history');
      const existing = parsed.find(item => item.id === report.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(report)) throw new Error('Report conflict');
      const next = existing ? parsed : [report, ...parsed];
      if (next.length > 1000) throw new Error('Report history full');
      const bytes = JSON.stringify(next);
      if (bytes.length > 1_000_000) throw new Error('Report candidate too large');
      if (!alive.current) return false;
      if (!existing) {
        if (await AsyncStorage.getItem(STORAGE_KEY) !== raw) throw new Error('Report history changed');
        if (!alive.current) return false;
        await AsyncStorage.setItem(STORAGE_KEY, bytes);
      }
      if (await AsyncStorage.getItem(STORAGE_KEY) !== bytes) throw new Error('Report save unconfirmed');
      if (!alive.current) return false;

      setStatus('saved');
      savedSignature.current = signature;
      if (share) await Share.share({
        title: copy.reportTitle,
        message: buildShareText(report, copy, locale),
      });
      return true;
    } catch {
      if (alive.current) setStatus('failed');
      return false;
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  }
  const exit = useUnsavedChanges({
    get dirty() { return draftSignature(liveDraft.current) !== savedSignature.current; },
    get revision() { return draftSignature(liveDraft.current); }, busy: saving,
    save: () => saveReport(false),
    discard: () => changeDraft({ area: 'Other', description: '', steps: '', expected: '' }),
    onBack: onClose,
  });

  return (
    <SafeAreaView edges={[]} style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppHeader onBack={() => exit.requestExit(onClose)} backLabel={copy.back} accessibilityLabel={copy.close} backDisabled={saving || exit.saving} />

          <Text style={styles.brand}>{copy.brand}</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          <View style={styles.privacyBox}>
            <Text style={styles.privacyTitle}>{copy.privacyTitle}</Text>
            <Text style={styles.privacyText}>{copy.privacyBody}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{copy.where}</Text>
            <View style={styles.chips}>
              {AREAS.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: area === item }}
                  disabled={saving}
                  onPress={() => changeDraft({ area: item })}
                  style={[styles.chip, area === item && styles.chipActive]}
                >
                  <Text style={[styles.chipText, area === item && styles.chipTextActive]}>{copy.areas[item]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>{copy.happened}</Text>
            <TextInput
              accessibilityLabel={copy.describe}
              value={description}
              editable={!saving}
              onChangeText={value => changeDraft({ description: value })}
              multiline
              placeholder={copy.descriptionPlaceholder}
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.input, styles.multiline]}
            />

            <Text style={styles.label}>{copy.repeat}</Text>
            <TextInput
              accessibilityLabel={copy.stepsLabel}
              value={steps}
              editable={!saving}
              onChangeText={value => changeDraft({ steps: value })}
              multiline
              placeholder={copy.stepsPlaceholder}
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.input, styles.multilineSmall]}
            />

            <Text style={styles.label}>{copy.expected}</Text>
            <TextInput
              accessibilityLabel={copy.expectedLabel}
              value={expected}
              editable={!saving}
              onChangeText={value => changeDraft({ expected: value })}
              multiline
              placeholder={copy.expectedPlaceholder}
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.input, styles.multilineSmall]}
            />

            {status ? <Text style={styles.status}>{copy[status]}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.saveLabel}
              disabled={!canSubmit}
              onPress={() => void saveReport(true)}
              style={[styles.primaryButton, !canSubmit && styles.disabled]}
            >
              <Text style={styles.primaryButtonText}>{saving ? copy.saving : copy.save}</Text>
            </Pressable>
          </View>

          <Text style={styles.caption}>{copy.caption}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { flexGrow: 1, paddingHorizontal: theme.metrics.screenGutter, paddingTop: theme.spacing.md, paddingBottom: 42 },
  back: { color: theme.colors.accent, fontSize: theme.typography.body.fontSize, fontWeight: '800', paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.md },
  brand: { color: theme.colors.accent, fontSize: theme.typography.meta.fontSize, fontWeight: '900', letterSpacing: 2, marginBottom: theme.spacing.sm },
  title: { color: theme.colors.text, fontSize: theme.typography.hero.fontSize, lineHeight: theme.typography.hero.lineHeight, fontWeight: '900' },
  body: { color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize, lineHeight: theme.typography.body.lineHeight, marginTop: theme.spacing.sm },
  privacyBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginTop: theme.metrics.cardPadding,
  },
  privacyTitle: { color: theme.colors.text, fontSize: theme.typography.meta.fontSize, fontWeight: '900' },
  privacyText: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: 5 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.metrics.cardPadding,
    marginTop: theme.spacing.md,
  },
  label: { color: theme.colors.accent, fontSize: theme.typography.meta.fontSize, fontWeight: '900', letterSpacing: 1.1, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', backgroundColor: theme.colors.input, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 11, paddingVertical: theme.spacing.sm },
  chipActive: { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.controlBorder },
  chipText: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, fontWeight: '800' },
  chipTextActive: { color: theme.colors.accent },
  input: {
    minHeight: theme.metrics.controlMinHeight,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: theme.typography.meta.fontSize,
    lineHeight: theme.typography.meta.lineHeight,
    paddingHorizontal: 13,
    paddingVertical: theme.spacing.md,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  multilineSmall: { minHeight: 82, textAlignVertical: 'top' },
  status: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: theme.spacing.md },
  primaryButton: { backgroundColor: theme.colors.accent, borderRadius: theme.radii.control, alignItems: 'center', paddingVertical: theme.spacing.md, marginTop: theme.metrics.cardPadding },
  primaryButtonText: { color: theme.colors.onAccent, fontSize: theme.typography.meta.fontSize, fontWeight: '900' },
  disabled: { opacity: 0.35 },
  caption: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, textAlign: 'center', marginTop: theme.spacing.md, paddingHorizontal: theme.spacing.sm },
});
