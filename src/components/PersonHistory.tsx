import { useI18n } from '../i18n/LanguageProvider';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MemoryFollowUp, MemoryInteraction } from '../types';
import { personHistory } from '../utils/personHistory';
import { formatInteractionDate, interactionInstant } from '../utils/interactionDates';

export function PersonHistory({ interactions, completed }: {
  interactions: readonly MemoryInteraction[]; completed: readonly MemoryFollowUp[];
}) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const { copy: catalog, locale } = useI18n();
  const copy = catalog.ui.personHistory;
  const [query, setQuery] = useState(''), [interactionCount, setInteractionCount] = useState(5), [completedCount, setCompletedCount] = useState(5);
  const history = useMemo(() => personHistory(interactions, completed, query), [interactions, completed, query]);
  const visibleInteractions = history.interactions.slice(0, interactionCount), visibleCompleted = history.completed.slice(0, completedCount);
  function date(value?: string) {
    return <>
      <Text style={styles.date}>{formatInteractionDate(value, locale)}</Text>
      {value && interactionInstant(value) === null && <Text style={styles.meta}>{copy.original(value)}</Text>}
    </>;
  }
  return <View style={styles.root}>
    <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
    <Text style={styles.meta}>{copy.order}</Text>
    <TextInput accessibilityLabel={copy.search} placeholder={copy.search} placeholderTextColor={theme.colors.textSecondary}
      value={query} onChangeText={value => { setQuery(value); setInteractionCount(5); setCompletedCount(5); }} style={styles.input} maxLength={200} />
    <Text style={styles.meta}>{copy.count(visibleInteractions.length, history.interactions.length, interactions.length)}</Text>
    {visibleInteractions.map((item, index) => <View key={`${item.id}-${index}`} style={styles.card}>
      {date(item.date)}<Text selectable style={styles.body}>{item.summary}</Text>
      <Text style={styles.meta}>{copy.source(copy.sourceNames[item.source])}</Text>
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
const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  root: { gap: theme.spacing.sm, marginTop: theme.spacing.md }, title: { color: theme.colors.text, fontSize: theme.typography.section.fontSize, fontWeight: '700' },
  input: { minHeight: theme.metrics.controlMinHeight, borderWidth: 1, borderColor: theme.colors.controlBorder, padding: theme.spacing.md, borderRadius: theme.radii.control, color: theme.colors.text, fontSize: theme.typography.body.fontSize },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, padding: theme.spacing.md, gap: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  date: { color: theme.colors.accent, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight }, meta: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight },
  body: { color: theme.colors.text, fontSize: theme.typography.body.fontSize, lineHeight: theme.typography.body.lineHeight }, button: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', padding: theme.spacing.md, borderRadius: theme.radii.control, backgroundColor: theme.colors.surfaceRaised },
});
