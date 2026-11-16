import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { MAX_NOTE_TITLE, MAX_NOTE_BODY } from '../utils/personalNotebook';

type Props = {
  initialTitle: string;
  initialBody: string;
  onSave: (draft: { title: string; body: string }) => Promise<void>;
  onCancel: () => void;
};
// Mount only after authenticated storage and app-lock integration are verified.
// Parent must provide a durable save callback and unmount on successful save.
export default function PersonalNoteEditor({ initialTitle, initialBody, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = React.useRef(false);
  const valid = (title.trim().length > 0 || body.trim().length > 0) &&
    title.length <= MAX_NOTE_TITLE && body.length <= MAX_NOTE_BODY;
  async function save() {
    if (!valid || pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailed(false);
    try { await onSave({ title, body }); }
    catch { setFailed(true); }
    finally { pending.current = false; setBusy(false); }
  }
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Edit note</Text>
      <Text style={styles.label}>Title</Text>
      <TextInput accessibilityLabel="Note title" style={styles.input} value={title}
        onChangeText={setTitle} maxLength={MAX_NOTE_TITLE} editable={!busy} />
      <Text style={styles.label}>Note</Text>
      <TextInput accessibilityLabel="Note body" style={[styles.input, styles.body]} value={body}
        onChangeText={setBody} maxLength={MAX_NOTE_BODY} multiline editable={!busy} />
      {failed && <Text accessibilityRole="alert" style={styles.label}>Save could not be confirmed. Your draft is still here.</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{disabled:!valid || busy}}
        disabled={!valid || busy} onPress={() => { void save(); }} style={styles.button}>
        <Text style={styles.label}>{busy ? 'Saving…' : 'Save note'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { if (!pending.current) onCancel(); }} style={styles.button}>
        <Text style={styles.label}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, backgroundColor: '#10151e', flexGrow: 1 },
  heading: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  label: { fontSize: 16, color: '#e2e8f0' },
  input: { borderWidth: 1, borderColor: '#64748b', borderRadius: 12, padding: 12, color: '#f8fafc', minHeight: 48 },
  body: { minHeight: 180, textAlignVertical: 'top' },
  button: { minHeight: 48, backgroundColor: '#1e293b', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
