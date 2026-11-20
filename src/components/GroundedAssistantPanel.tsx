import { AppHeader } from './ui/AppHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageProvider';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MemoryPerson } from '../types';
import { useLifeRecords } from '../hooks/useLifeRecords';
import { answerSavedQuestion, type Question } from '../utils/groundedAssistant';
import { assistantCopy } from '../strings/assistant';

const QUESTIONS: Question[] = ['today', 'contact', 'last-interaction', 'commitments', 'overdue', 'upcoming'];

export function GroundedAssistantPanel({ people, onBack, onOpenPerson, onOpenLife,
  locale: suppliedLocale }: {
  people: readonly MemoryPerson[]; onBack: () => void; onOpenPerson: (id: string) => void;
  onOpenLife: (id: string) => void; locale?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const { locale: contextLocale } = useI18n();
  const locale = suppliedLocale ?? contextLocale;
  const life = useLifeRecords(), copy = assistantCopy(locale);
  const [question, setQuestion] = useState<Question>('today');
  const [personQuery, setPersonQuery] = useState('');
  const [personId, setPersonId] = useState<string | undefined>(undefined);
  const [now, setNow] = useState(() => new Date());
  const [visible, setVisible] = useState(30);
  const backAction = useRef(onBack); backAction.current = onBack;
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    function followState(state: string) {
      if (timer) { clearInterval(timer); timer = null; }
      if (state === 'active') { setNow(new Date()); timer = setInterval(() => setNow(new Date()), 60_000); }
    }
    followState(AppState.currentState);
    const appState = AppState.addEventListener('change', followState);
    const back = BackHandler.addEventListener('hardwareBackPress', () => { backAction.current(); return true; });
    return () => { if (timer) clearInterval(timer); appState.remove(); back.remove(); };
  }, []);
  const answer = answerSavedQuestion({ question, people, lifeRecords: life.records, lifeStatus: life.status, now, personQuery, personId });
  const shown = answer.sources.slice(0, visible);
  function button(label: string, action: () => void, selected = false, disabled = false) {
    return <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }}
      disabled={disabled} onPress={action} style={[styles.button, selected && styles.selected, disabled && styles.disabled]}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>;
  }
  return <SafeAreaView style={styles.safe}>
    <View style={styles.top}><AppHeader onBack={onBack} backLabel={copy.back} accessibilityLabel={copy.back} title={copy.title} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.caption}>{copy.scope}</Text>
      <Text style={styles.caption}>{now.toLocaleString(locale)}</Text>
      {QUESTIONS.map(key => button(copy.questions[key], () => { setQuestion(key); setPersonId(undefined); setVisible(30); }, key === question))}
      {question === 'last-interaction' && <TextInput accessibilityLabel={copy.personQuery} placeholder={copy.personQuery}
        placeholderTextColor={theme.colors.textSecondary} value={personQuery} onChangeText={value => { setPersonQuery(value); setPersonId(undefined); setVisible(30); }}
        maxLength={160} style={styles.input} />}
      {question === 'upcoming' && <Text style={styles.caption}>{copy.nextSeven}</Text>}
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{copy.statuses[answer.status]}</Text>
      {answer.notices.map(notice => <Text key={notice} style={styles.caption}>{copy.notices[notice]}</Text>)}
      {answer.status === 'unavailable' && button(copy.reload, () => { void life.reload(); }, false, life.busy)}
      {answer.candidates.map((candidate, index) => button(
        `${candidate.name} · ${[candidate.role, candidate.company, candidate.relationship].filter(Boolean).join(' · ')} (${index + 1})`,
        () => { setPersonId(candidate.id); setVisible(30); }))}
      {shown.map((source, index) => <View key={`${source.kind}-${source.personId ?? source.lifeId}-${source.id}-${index}`} style={styles.card}>
        <Text style={styles.caption}>{copy.sourceTypes[source.kind]}</Text><Text style={styles.title}>{source.title}</Text>
        <Text selectable style={styles.text}>{source.text}</Text>
        <Text style={styles.caption}>{source.dateKind === 'missing' || !source.date ? copy.missingDate
          : source.dateKind === 'calendar' ? `${copy.calendarDate}: ${source.date}` : `${copy.instantDate}: ${new Date(source.date).toLocaleString(locale)}`}</Text>
        {source.personId && button(copy.openPerson, () => onOpenPerson(source.personId!))}
        {source.lifeId && button(copy.openLife, () => onOpenLife(source.lifeId!))}
      </View>)}
      {answer.sources.length > 0 && <Text style={styles.caption}>{copy.showing(shown.length, answer.sources.length)}</Text>}
      {visible < answer.sources.length && button(copy.showMore, () => setVisible(value => value + 30))}
    </ScrollView>
  </SafeAreaView>;
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background }, top: { paddingHorizontal: theme.metrics.screenGutter, paddingTop: theme.spacing.md, gap: theme.spacing.sm },
  content: { padding: theme.metrics.screenGutter, gap: theme.spacing.md }, heading: { color: theme.colors.text, fontSize: theme.typography.title.fontSize, fontWeight: '800' },
  title: { color: theme.colors.text, fontSize: theme.typography.section.fontSize, fontWeight: '700' }, text: { color: theme.colors.text, fontSize: theme.typography.body.fontSize, lineHeight: theme.typography.body.lineHeight },
  caption: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight },
  button: { minHeight: theme.metrics.controlMinHeight, padding: theme.spacing.md, justifyContent: 'center', borderRadius: theme.radii.control, backgroundColor: theme.colors.surfaceRaised, borderWidth: 1, borderColor: theme.colors.controlBorder },
  selected: { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceRaised }, disabled: { opacity: 0.5 },
  input: { minHeight: theme.metrics.controlMinHeight, padding: theme.spacing.md, borderRadius: theme.radii.control, borderWidth: 1, borderColor: theme.colors.controlBorder, color: theme.colors.text, fontSize: theme.typography.body.fontSize },
  card: { padding: theme.metrics.cardPadding, gap: theme.spacing.sm, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
});
