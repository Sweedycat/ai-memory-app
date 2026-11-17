import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MemoryPerson } from '../types';
import { buildDailyBriefing } from '../utils/dailyBriefing';
import { dailyBriefingEn as copy } from '../strings/dailyBriefing.en';

export function DailyBriefingCard({ people, onOpenPerson }: {
  people: readonly MemoryPerson[]; onOpenPerson: (id: string) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    function followState(state: string) {
      if (timer) { clearInterval(timer); timer = null; }
      if (state === 'active') {
        setNow(new Date());
        timer = setInterval(() => setNow(new Date()), 60_000);
      }
    }
    followState(AppState.currentState);
    const listener = AppState.addEventListener('change', followState);
    return () => { if (timer) clearInterval(timer); listener.remove(); };
  }, []);
  const briefing = useMemo(() => buildDailyBriefing(people, now), [people, now]);
  const ordered = [...briefing.overdue, ...briefing.today, ...briefing.upcoming,
    ...briefing.needsReview, ...briefing.unscheduled, ...briefing.later];
  const visible = ordered.slice(0, 4);
  return (
    <View style={styles.card}>
      <Text style={styles.date}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
      <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
      <Text style={styles.caption}>{copy.source}</Text>
      <View style={styles.counts}>
        {(['overdue', 'today', 'upcoming', 'unscheduled'] as const).map(group => (
          <View key={group} style={styles.stat}>
            <Text style={[styles.count, group === 'overdue' && briefing.overdue.length > 0 && styles.warning]}>{briefing[group].length}</Text>
            <Text style={styles.caption}>{copy[group]}</Text>
          </View>
        ))}
      </View>
      {briefing.needsReview.length > 0 && <Text style={styles.warning}>{copy.reviewCount(briefing.needsReview.length)}</Text>}
      {visible.map((entry, index) => (
        <Pressable key={`${entry.personId}-${entry.followUpId}-${index}`} accessibilityRole="button"
          accessibilityHint={copy.open(entry.name)} onPress={() => onOpenPerson(entry.personId)} style={styles.row}>
          <Text style={styles.name}>{entry.name}</Text>
          <Text style={styles.body} numberOfLines={2}>{entry.text}</Text>
          <Text style={styles.caption}>{entry.due !== undefined
            ? new Date(entry.due).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : entry.reminderAt ? copy.needsReview : copy.dateMissing}</Text>
        </Pressable>
      ))}
      {ordered.length === 0 ? <Text style={styles.body}>{copy.empty}</Text>
        : <Text style={styles.caption}>{copy.showing(visible.length, ordered.length)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 8, borderRadius: 20, borderWidth: 1, borderColor: '#315B4F', backgroundColor: '#11211D' },
  date: { color: '#7DE2C3', fontSize: 13, fontWeight: '600' },
  title: { color: '#F4F7FA', fontSize: 22, fontWeight: '800' },
  caption: { color: '#A7B9B3', fontSize: 12, lineHeight: 18 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  stat: { flexGrow: 1, flexBasis: '40%', padding: 10, backgroundColor: '#182C25', borderRadius: 12 },
  count: { color: '#F4F7FA', fontWeight: '800', fontSize: 23 },
  warning: { color: '#FFD1A6', fontSize: 13, lineHeight: 19 },
  row: { minHeight: 48, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#2B4239', gap: 4 },
  name: { color: '#DBF6EB', fontSize: 15, fontWeight: '700' },
  body: { color: '#C4D8CE', fontSize: 14, lineHeight: 21 },
});
