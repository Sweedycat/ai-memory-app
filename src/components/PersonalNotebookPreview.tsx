import { AppHeader } from './ui/AppHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchPersonalNotebook, type PersonalNote } from '../utils/personalNotebook';

// Synthetic preview only. No personal input, storage, AI or network integration.
// Intentionally not mounted in the production navigation yet.
export default function PersonalNotebookPreview({ onBack }: { onBack: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const { copy: catalog, locale } = useI18n();
  const copy = catalog.ui.notebookPreview;
  const examples: PersonalNote[] = [
    { id: 'demo-1', title: copy.inspection, body: copy.inspectionBody,
      createdAt: '2026-11-16T09:00:00.000Z', updatedAt: '2026-11-16T09:00:00.000Z' },
    { id: 'demo-2', title: copy.project, body: copy.projectBody,
      createdAt: '2026-11-15T09:00:00.000Z', updatedAt: '2026-11-15T09:00:00.000Z' },
  ];
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = examples.find(note => note.id === selectedId);
  const visible = searchPersonalNotebook(examples, query);
  return <SafeAreaView style={styles.root}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppHeader onBack={selected ? () => setSelectedId(null) : onBack} backLabel={copy.back} accessibilityLabel={copy.back} />
      <Text accessibilityRole="header" style={styles.heading}>{copy.title}</Text>
      <Text style={styles.notice}>{copy.notice}</Text>
      {selected ? <View style={styles.note}>
        <Text style={styles.title}>{selected.title}</Text>
        <Text style={styles.body}>{selected.body}</Text>
        <Text style={styles.meta}>{copy.updated(new Date(selected.updatedAt).toLocaleDateString(locale))}</Text>
      </View> : <>
        <TextInput accessibilityLabel={copy.search} placeholder={copy.search}
          placeholderTextColor={theme.colors.textMuted} style={styles.input} value={query}
          onChangeText={setQuery} maxLength={100} autoCorrect={false} />
        <Text style={styles.meta}>{copy.count(visible.length)}</Text>
        {visible.length === 0 && <Text style={styles.body}>{copy.empty}</Text>}
        {visible.map(note => <Pressable accessibilityRole="button" key={note.id} onPress={() => setSelectedId(note.id)} style={styles.note}>
          <Text style={styles.title}>{note.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{note.body}</Text>
          <Text style={styles.meta}>{new Date(note.updatedAt).toLocaleDateString(locale)}</Text>
        </Pressable>)}
        <Text style={styles.notice}>{copy.future}</Text>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.metrics.screenGutter, paddingTop: theme.spacing.md, gap: theme.spacing.md },
  heading: { ...theme.typography.title, fontWeight: '700', color: theme.colors.text },
  notice: { ...theme.typography.meta, color: theme.colors.textSecondary },
  input: { minHeight: theme.metrics.controlMinHeight, padding: theme.spacing.md, borderWidth: 1,
    borderColor: theme.colors.controlBorder, borderRadius: theme.radii.control, color: theme.colors.text },
  note: { minHeight: theme.metrics.controlMinHeight, padding: theme.metrics.cardPadding, gap: theme.spacing.sm,
    borderRadius: theme.radii.card, backgroundColor: theme.colors.surface },
  title: { ...theme.typography.section, fontWeight: '600', color: theme.colors.text },
  body: { ...theme.typography.body, color: theme.colors.text },
  meta: { ...theme.typography.meta, color: theme.colors.textSecondary },
});
