import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchPersonalNotebook, type PersonalNote } from '../utils/personalNotebook';

// Synthetic preview only. No personal input, storage, AI or network integration.
// Intentionally not mounted in the production navigation yet.
const examples: PersonalNote[] = [
  { id: 'demo-1', title: 'Vehicle inspection', body: 'Example reminder for March.',
    createdAt: '2026-11-16T09:00:00.000Z', updatedAt: '2026-11-16T09:00:00.000Z' },
  { id: 'demo-2', title: 'Project ideas', body: 'Example project planning note.',
    createdAt: '2026-11-15T09:00:00.000Z', updatedAt: '2026-11-15T09:00:00.000Z' },
];

export default function PersonalNotebookPreview({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = examples.find(note => note.id === selectedId);
  const visible = searchPersonalNotebook(examples, query);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={selected ? () => setSelectedId(null) : onBack}
        style={styles.button}><Text style={styles.link}>Back</Text></Pressable>
      <Text accessibilityRole="header" style={styles.heading}>Personal notebook</Text>
      <Text style={styles.notice}>Preview only. Example notes. Private storage is not enabled.</Text>
      {selected ? (
        <View style={styles.note}>
          <Text style={styles.title}>{selected.title}</Text>
          <Text style={styles.body}>{selected.body}</Text>
          <Text style={styles.meta}>Updated: {new Date(selected.updatedAt).toLocaleDateString()}</Text>
        </View>
      ) : (
        <>
          <TextInput accessibilityLabel="Search example notes" placeholder="Search example notes"
            placeholderTextColor="#9ca3af" style={styles.input} value={query}
            onChangeText={setQuery} maxLength={100} autoCorrect={false} />
          <Text style={styles.meta}>{visible.length} example notes</Text>
          {visible.length === 0 && <Text style={styles.body}>No matching notes.</Text>}
          {visible.map(note => (
            <Pressable accessibilityRole="button" key={note.id} onPress={() => setSelectedId(note.id)} style={styles.note}>
              <Text style={styles.title}>{note.title}</Text>
              <Text style={styles.body} numberOfLines={2}>{note.body}</Text>
              <Text style={styles.meta}>{new Date(note.updatedAt).toLocaleDateString()}</Text>
            </Pressable>
          ))}
          <Text style={styles.notice}>Creating and editing real notes will be available after secure storage is verified.</Text>
        </>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#10151e' },
  content: { padding: 20, gap: 14 },
  heading: { fontSize: 26, fontWeight: '700', color: '#f8fafc' },
  notice: { color: '#cbd5e1', fontSize: 14, lineHeight: 21 },
  button: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
  link: { color: '#7dd3fc', fontSize: 16 },
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#64748b', borderRadius: 12, color: '#f8fafc' },
  note: { padding: 16, gap: 8, borderRadius: 14, backgroundColor: '#1e293b' },
  title: { fontWeight: '600', color: '#f8fafc', fontSize: 18 },
  body: { fontSize: 16, color: '#e2e8f0', lineHeight: 24 },
  meta: { color: '#cbd5e1', fontSize: 13 },
});
