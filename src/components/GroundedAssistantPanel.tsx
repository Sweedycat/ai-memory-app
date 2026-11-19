import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MemoryPerson } from '../types';
import { useLifeRecords } from '../hooks/useLifeRecords';
import { answerSavedQuestion, type Question } from '../utils/groundedAssistant';
import { assistantCopy } from '../strings/assistant';
import { SCREEN_TOP_PADDING } from '../utils/screenInsets';

const QUESTIONS: Question[] = ['today', 'contact', 'last-interaction', 'commitments', 'overdue', 'upcoming'];

export function GroundedAssistantPanel({ people, onBack, onOpenPerson, onOpenLife,
  locale = Intl.DateTimeFormat().resolvedOptions().locale }: {
  people: readonly MemoryPerson[]; onBack: () => void; onOpenPerson: (id: string) => void;
  onOpenLife: (id: string) => void; locale?: string;
}) {
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
    <View style={styles.top}>{button(copy.back, onBack)}<Text accessibilityRole="header" style={styles.heading}>{copy.title}</Text></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.caption}>{copy.scope}</Text>
      <Text style={styles.caption}>{now.toLocaleString(locale)}</Text>
      {QUESTIONS.map(key => button(copy.questions[key], () => { setQuestion(key); setPersonId(undefined); setVisible(30); }, key === question))}
      {question === 'last-interaction' && <TextInput accessibilityLabel={copy.personQuery} placeholder={copy.personQuery}
        placeholderTextColor="#9CAAB9" value={personQuery} onChangeText={value => { setPersonQuery(value); setPersonId(undefined); setVisible(30); }}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0C1118', paddingTop: SCREEN_TOP_PADDING }, top: { paddingHorizontal: 20, gap: 8 },
  content: { padding: 20, gap: 12 }, heading: { color: '#F4F7FA', fontSize: 25, fontWeight: '800' },
  title: { color: '#F4F7FA', fontSize: 18, fontWeight: '700' }, text: { color: '#E1E8EF', fontSize: 15, lineHeight: 23 },
  caption: { color: '#B2C1CC', fontSize: 13, lineHeight: 20 },
  button: { minHeight: 48, padding: 12, justifyContent: 'center', borderRadius: 12, backgroundColor: '#203343', borderWidth: 1, borderColor: '#526577' },
  selected: { borderColor: '#7DE2C3', backgroundColor: '#194436' }, disabled: { opacity: 0.5 },
  input: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#526577', color: '#F4F7FA', fontSize: 16 },
  card: { padding: 16, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: '#3F5669', backgroundColor: '#121E29' },
});
