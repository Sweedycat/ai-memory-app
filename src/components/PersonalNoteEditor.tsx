import { useI18n } from '../i18n/LanguageProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_NOTE_TITLE, MAX_NOTE_BODY } from '../utils/personalNotebook';
import type { NotebookEditor } from '../utils/notebookEditor';

// Unmounted in production. Parent supplies one controller per authenticated
// workspace/target; background permanently revokes this editor and its workspace.
export default function PersonalNoteEditor({ editor, onClose, onSaved }: {
  editor: NotebookEditor; onClose: () => void; onSaved: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { copy: catalog } = useI18n();
  const copy = catalog.ui.notebookEditor;
  const navigation = catalog.navigation;
  const [, render] = useState(0);
  const [confirmation, setConfirmation] = useState<'close' | 'discard' | null>(null);
  const [exitFailed, setExitFailed] = useState(false);
  const mounted = useRef(true);
  const pending = useRef(false);
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
      if (state !== 'active') { editor.lock(); setConfirmation(null); setExitFailed(false); refresh(); }
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => { hardwareBack.current(); return true; });
    return () => { mounted.current = false; listener.remove(); back.remove(); editor.dispose(); };
  }, [editor]);

  async function act(action: () => Promise<void>) {
    if (pending.current || editor.getView().busy) return;
    pending.current = true; setExitFailed(false);
    try { const operation = action(); refresh(); await operation; }
    catch { if (mounted.current) setExitFailed(true); }
    finally {
      pending.current = false;
      if (mounted.current) {
        refresh();
        if (editor.getView().mode === 'saved' && !notified.current) {
          notified.current = true; onSaved();
        }
      }
    }
  }
  function close() {
    const latest = editor.getView();
    if (pending.current || latest.busy || notified.current) return;
    if (latest.dirty && !latest.checkpointed && latest.mode !== 'saved') {
      setConfirmation('close'); return;
    }
    notified.current = true; editor.dispose(); onClose();
  }
  function saveAndExit() {
    void act(async () => {
      const latest = editor.getView();
      if (latest.mode === 'editing') await editor.save();
      else if (latest.mode === 'recoverable') await editor.commitRecovery();
      // An uncertain or conflicting result needs explicit authenticated review.
      if (mounted.current && editor.getView().mode !== 'saved') setExitFailed(true);
    });
  }
  function discardAndExit() {
    void act(async () => {
      let latest = editor.getView();
      if (latest.mode === 'uncertain' || latest.mode === 'unavailable') {
        await editor.review(); latest = editor.getView();
      }
      if (latest.mode === 'recoverable' || latest.mode === 'conflict') {
        await editor.discardRecovery(); latest = editor.getView();
      }
      if (!mounted.current || AppState.currentState !== 'active') return;
      if (latest.mode === 'saved') return; // act notifies onSaved exactly once.
      if (latest.mode !== 'editing' || latest.busy) { setExitFailed(true); return; }
      // No unresolved journal remains. Only explicit discard may drop the in-memory draft.
      notified.current = true; editor.dispose(); onClose();
    });
  }
  hardwareBack.current = () => {
    if (pending.current || editor.getView().busy) return;
    if (confirmation) setConfirmation(null); else close();
  };
  const editable = view.mode === 'editing' && !view.busy;
  const valid = Boolean(view.title.trim() || view.body.trim()) &&
    view.title.length <= MAX_NOTE_TITLE && view.body.length <= MAX_NOTE_BODY;
  function button(text: string, action: () => void, disabled = view.busy) {
    return <Pressable accessibilityRole="button" accessibilityLabel={text}
      accessibilityState={{ disabled }} disabled={disabled}
      onPress={() => { if (!disabled && !pending.current && !editor.getView().busy && !notified.current) action(); }} style={styles.button}>
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
      {exitFailed && <View>
        <Text accessibilityRole="alert" style={styles.text}>{navigation.failedTitle}</Text>
        <Text style={styles.text}>{navigation.failedBody}</Text>
      </View>}
      {confirmation === 'close' ? <View>
        <Text accessibilityRole="header" style={styles.heading}>{navigation.title}</Text>
        <Text accessibilityRole="alert" style={styles.text}>{navigation.body}</Text>
        {button(navigation.saveExit, saveAndExit, view.busy || !valid || (view.mode !== 'editing' && view.mode !== 'recoverable'))}
        {button(navigation.discard, discardAndExit)}
        {button(navigation.stay, () => setConfirmation(null))}
      </View> : button(view.checkpointed ? copy.protectedClose : copy.close, close)}
    </ScrollView>
  );
}
const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  content: { padding: theme.metrics.screenGutter, gap: theme.spacing.md, backgroundColor: theme.colors.background, flexGrow: 1 },
  heading: { fontSize: theme.typography.title.fontSize, fontWeight: '700', color: theme.colors.text },
  text: { fontSize: theme.typography.body.fontSize, color: theme.colors.text, lineHeight: theme.typography.body.lineHeight },
  input: { borderWidth: 1, borderColor: theme.colors.controlBorder, borderRadius: theme.radii.control, padding: theme.spacing.md, color: theme.colors.text, minHeight: theme.metrics.controlMinHeight },
  body: { minHeight: 180, textAlignVertical: 'top' },
  comparison: { padding: theme.spacing.md, gap: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.warning, borderRadius: theme.radii.control },
  button: { minHeight: theme.metrics.controlMinHeight, backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radii.control, padding: theme.spacing.md, justifyContent: 'center', alignItems: 'center' },
});
