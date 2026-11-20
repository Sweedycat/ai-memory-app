import { useI18n } from '../i18n/LanguageProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MemoryPerson } from '../types';
import { buildDailyBriefing } from '../utils/dailyBriefing';

export function DailyBriefingCard({ people, onOpenPerson }: {
  people: readonly MemoryPerson[]; onOpenPerson: (id: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { copy: catalog, locale } = useI18n();
  const copy = catalog.ui.dailyBriefing;
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
      <Text style={styles.date}>{now.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
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
            ? new Date(entry.due).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : entry.reminderAt ? copy.needsReview : copy.dateMissing}</Text>
        </Pressable>
      ))}
      {ordered.length === 0 ? <Text style={styles.body}>{copy.empty}</Text>
        : <Text style={styles.caption}>{copy.showing(visible.length, ordered.length)}</Text>}
    </View>
  );
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  card: { padding: theme.metrics.cardPadding, gap: theme.spacing.sm, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  date: { color: theme.colors.accent, fontSize: theme.typography.meta.fontSize, fontWeight: '600' },
  title: { color: theme.colors.text, fontSize: theme.typography.section.fontSize, fontWeight: '800' },
  caption: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginVertical: theme.spacing.xs },
  stat: { flexGrow: 1, flexBasis: '40%', padding: theme.spacing.sm, backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radii.control },
  count: { color: theme.colors.text, fontWeight: '800', fontSize: theme.typography.title.fontSize },
  warning: { color: theme.colors.warning, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight },
  row: { minHeight: theme.metrics.controlMinHeight, paddingVertical: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: theme.spacing.xs },
  name: { color: theme.colors.accent, fontSize: theme.typography.body.fontSize, fontWeight: '700' },
  body: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.body.lineHeight },
});
