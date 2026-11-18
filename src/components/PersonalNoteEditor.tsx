import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_NOTE_TITLE, MAX_NOTE_BODY } from '../utils/personalNotebook';
import type { NotebookEditor } from '../utils/notebookEditor';
import { notebookEditorEn as copy } from '../strings/notebookEditor.en';

// Unmounted in production. Parent supplies one controller per authenticated
// workspace/target; background permanently revokes this editor and its workspace.
export default function PersonalNoteEditor({ editor, onClose, onSaved }: {
  editor: NotebookEditor; onClose: () => void; onSaved: () => void;
}) {
  const [, render] = useState(0);
  const [confirmation, setConfirmation] = useState<'close' | 'discard' | null>(null);
  const mounted = useRef(true);
  const notified = useRef(false);
  const hardwareBack = useRef<() => void>(() => undefined);
  const view = AppState.currentState === 'active' ? editor.getView()
    : { mode: 'unavailable' as const, title: '', body: '', busy: false, current: null, dirty: false, checkpointed: false };
  const refresh = () => { if (mounted.current) render(value => value + 1); };
  useEffect(() => {
    mounted.current = true;
    notified.current = false;
    if (AppState.currentState !== 'active') { editor.lock(); refresh(); }
    const listener = AppState.addEventListener('change', state => {
      if (!mounted.current) return;
      if (state !== 'active') { editor.lock(); setConfirmation(null); refresh(); }
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => { hardwareBack.current(); return true; });
    return () => { mounted.current = false; listener.remove(); back.remove(); editor.dispose(); };
  }, [editor]);

  async function act(action: () => Promise<void>) {
    const pending = action();
    refresh();
    try { await pending; } finally {
      if (mounted.current) {
        refresh();
        if (editor.getView().mode === 'saved' && !notified.current) {
          notified.current = true; onSaved();
        }
      }
    }
  }
  function close() {
    if (view.busy) return;
    if (view.dirty && !view.checkpointed && view.mode !== 'saved' && confirmation !== 'close') {
      setConfirmation('close'); return;
    }
    editor.dispose(); onClose();
  }
  hardwareBack.current = () => { if (confirmation) setConfirmation(null); else close(); };
  const editable = view.mode === 'editing' && !view.busy;
  const valid = Boolean(view.title.trim() || view.body.trim()) &&
    view.title.length <= MAX_NOTE_TITLE && view.body.length <= MAX_NOTE_BODY;
  function button(text: string, action: () => void, disabled = view.busy) {
    return <Pressable accessibilityRole="button" accessibilityLabel={text}
      accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={styles.button}>
      <Text style={styles.text}>{text}</Text>
    </Pressable>;
  }
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.heading}>{copy.heading}</Text>
      {view.busy && <Text accessibilityLiveRegion="polite" style={styles.text}>{copy.busy}</Text>}
      {view.mode === 'unavailable' ? !view.busy && <Text accessibilityRole="alert" style={styles.text}>{copy.unavailable}</Text> : <>
        <Text style={styles.text}>{copy.title}</Text>
        <TextInput accessibilityLabel={copy.titleLabel} style={styles.input} value={view.title}
          onChangeText={title => { editor.change({ title }); setConfirmation(null); refresh(); }}
          maxLength={MAX_NOTE_TITLE} editable={editable} />
        <Text style={styles.text}>{copy.body}</Text>
        <TextInput accessibilityLabel={copy.bodyLabel} style={[styles.input, styles.body]} value={view.body}
          onChangeText={body => { editor.change({ body }); setConfirmation(null); refresh(); }}
          maxLength={MAX_NOTE_BODY} multiline editable={editable} />
      </>}
      {view.mode === 'editing' && <>
        {button(copy.save, () => { void act(editor.save); }, view.busy || !valid)}
        {button(copy.checkpoint, () => { void act(editor.checkpoint); }, view.busy || !valid || !view.dirty)}
      </>}
      {view.mode === 'recoverable' && <>
        <Text accessibilityRole="alert" style={styles.text}>{view.checkpointed ? copy.recoverable : copy.memoryOnly}</Text>
        {button(copy.commit, () => { void act(editor.commitRecovery); })}
      </>}
      {view.mode === 'conflict' && <View style={styles.comparison}>
        <Text accessibilityRole="alert" style={styles.text}>{copy.conflict}</Text>
        <Text style={styles.text}>{copy.current}</Text>
        <Text style={styles.text}>{view.current ? view.current.title + '\n' + view.current.body : copy.missing}</Text>
      </View>}
      {(view.mode === 'recoverable' || view.mode === 'conflict') &&
        button(copy.discard, () => setConfirmation('discard'))}
      {(view.mode === 'uncertain' || view.mode === 'unavailable') && <>
        {view.mode === 'uncertain' && <Text accessibilityRole="alert" style={styles.text}>{copy.uncertain}</Text>}
        {button(copy.review, () => { void act(editor.review); })}
      </>}
      {view.mode === 'saved' && <Text accessibilityLiveRegion="polite" style={styles.text}>{copy.saved}</Text>}
      {confirmation === 'discard' && <View>
        <Text accessibilityRole="alert" style={styles.text}>{copy.discardWarning}</Text>
        {button(copy.confirmDiscard, () => { setConfirmation(null); void act(editor.discardRecovery); })}
        {button(copy.keep, () => setConfirmation(null))}
      </View>}
      {confirmation === 'close' ? <View>
        <Text accessibilityRole="alert" style={styles.text}>{copy.unsaved}</Text>
        {button(copy.confirmClose, close)}
        {button(copy.stay, () => setConfirmation(null))}
      </View> : button(view.checkpointed ? copy.protectedClose : copy.close, close)}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, backgroundColor: '#10151e', flexGrow: 1 },
  heading: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  text: { fontSize: 16, color: '#e2e8f0', lineHeight: 23 },
  input: { borderWidth: 1, borderColor: '#64748b', borderRadius: 12, padding: 12, color: '#f8fafc', minHeight: 48 },
  body: { minHeight: 180, textAlignVertical: 'top' },
  comparison: { padding: 12, gap: 8, borderWidth: 1, borderColor: '#8B6E45', borderRadius: 12 },
  button: { minHeight: 48, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, justifyContent: 'center', alignItems: 'center' },
});
