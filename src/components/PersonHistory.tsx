import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MemoryFollowUp, MemoryInteraction } from '../types';
import { personHistory } from '../utils/personHistory';
import { formatInteractionDate, interactionInstant } from '../utils/interactionDates';
import { personHistoryEn as copy } from '../strings/personHistory.en';

export function PersonHistory({ interactions, completed }: {
  interactions: readonly MemoryInteraction[]; completed: readonly MemoryFollowUp[];
}) {
  const [query, setQuery] = useState(''), [interactionCount, setInteractionCount] = useState(5), [completedCount, setCompletedCount] = useState(5);
  const history = useMemo(() => personHistory(interactions, completed, query), [interactions, completed, query]);
  const visibleInteractions = history.interactions.slice(0, interactionCount), visibleCompleted = history.completed.slice(0, completedCount);
  function date(value?: string) {
    return <>
      <Text style={styles.date}>{formatInteractionDate(value)}</Text>
      {value && interactionInstant(value) === null && <Text style={styles.meta}>{copy.original(value)}</Text>}
    </>;
  }
  return <View style={styles.root}>
    <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
    <Text style={styles.meta}>{copy.order}</Text>
    <TextInput accessibilityLabel={copy.search} placeholder={copy.search} placeholderTextColor="#9BA7B3"
      value={query} onChangeText={value => { setQuery(value); setInteractionCount(5); setCompletedCount(5); }} style={styles.input} maxLength={200} />
    <Text style={styles.meta}>{copy.count(visibleInteractions.length, history.interactions.length, interactions.length)}</Text>
    {visibleInteractions.map((item, index) => <View key={`${item.id}-${index}`} style={styles.card}>
      {date(item.date)}<Text selectable style={styles.body}>{item.summary}</Text>
      <Text style={styles.meta}>{copy.source(item.source)}</Text>
    </View>)}
    {visibleInteractions.length === 0 && <Text style={styles.body}>{query.trim() ? copy.noMatches : copy.noInteractions}</Text>}
    {interactionCount < history.interactions.length && <Pressable accessibilityRole="button" accessibilityLabel={copy.moreInteractions}
      style={styles.button} onPress={() => setInteractionCount(value => value + 5)}><Text style={styles.body}>{copy.moreInteractions}</Text></Pressable>}
    <Text accessibilityRole="header" style={styles.title}>{copy.completed}</Text>
    <Text style={styles.meta}>{copy.count(visibleCompleted.length, history.completed.length, completed.length)}</Text>
    {visibleCompleted.map((item, index) => <View key={`${item.id}-${index}`} style={styles.card}>
      {date(item.completedAt)}<Text selectable style={styles.body}>{item.text}</Text>
    </View>)}
    {visibleCompleted.length === 0 && <Text style={styles.body}>{query.trim() ? copy.noMatches : copy.noCompleted}</Text>}
    {completedCount < history.completed.length && <Pressable accessibilityRole="button" accessibilityLabel={copy.moreCompleted}
      style={styles.button} onPress={() => setCompletedCount(value => value + 5)}><Text style={styles.body}>{copy.moreCompleted}</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  root: { gap: 10, marginTop: 12 }, title: { color: '#F4F7FA', fontSize: 22, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#435469', padding: 12, borderRadius: 12, color: '#F4F7FA', fontSize: 15 },
  card: { backgroundColor: '#121820', borderRadius: 16, padding: 15, gap: 8, borderWidth: 1, borderColor: '#293541' },
  date: { color: '#7DE2C3', fontSize: 13, lineHeight: 19 }, meta: { color: '#9BA7B3', fontSize: 12, lineHeight: 18 },
  body: { color: '#E2E8F0', fontSize: 15, lineHeight: 23 }, button: { minHeight: 48, justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: '#243447' },
});
