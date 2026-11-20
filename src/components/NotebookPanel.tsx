import { AppHeader } from './ui/AppHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageProvider';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { createNotebookLifecycle } from '../utils/notebookLifecycle';
import type { PersistentNotebook } from '../utils/persistentNotebook';
import { createNotebookEditor, type NotebookEditor } from '../utils/notebookEditor';
import { searchPersonalNotebook, type PersonalNote } from '../utils/personalNotebook';
import { notebookRecoveryChanges } from '../utils/notebookNavigation';
import PersonalNoteEditor from './PersonalNoteEditor';

type Snapshot = { notes: PersonalNote[]; recovery: ReturnType<PersistentNotebook['getRecovery']> };
type Props = { lifecycle: ReturnType<typeof createNotebookLifecycle>; onBack: () => void;
  createId: () => Promise<string>; now?: () => string };
const clock = () => new Date().toISOString();

// Production navigation is separately gated in App. No automatic background open,
// storage reset or recovery application. A new mount owns one lifecycle consumer.
export function NotebookPanel({ lifecycle, onBack, createId, now = clock }: Props) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const { copy: catalog, locale } = useI18n();
  const copy = catalog.ui.notebook;
  const navigation = catalog.navigation;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(''), [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<NotebookEditor | null>(null);
  const [review, setReview] = useState(false);
  const [exitRisk, setExitRisk] = useState(false);
  const [confirmation, setConfirmation] = useState<'delete' | 'commit' | 'discard' | 'close' | null>(null);
  const [exitAfterRecovery, setExitAfterRecovery] = useState(false);
  const workspace = useRef<PersistentNotebook | null>(null), editorRef = useRef<NotebookEditor | null>(null);
  const mounted = useRef(true), pending = useRef(false), generation = useRef(0), exited = useRef(false);

  function clearPrivate() {
    editorRef.current?.dispose(); editorRef.current = null;
    setEditor(null); setSnapshot(null); setSelectedId(null); setQuery(''); setReview(false); setConfirmation(null); setExitAfterRecovery(false);
  }
  function publish(w: PersistentNotebook) {
    const notes = w.getSession().snapshot(), recovery = w.getRecovery();
    setSnapshot({ notes, recovery }); setFailed(false);
    setExitRisk(Boolean(recovery.candidate && !recovery.durable && recovery.status !== 'already-saved'));
    setSelectedId(id => notes.some(note => note.id === id) ? id : null);
    if (!recovery.candidate) setReview(false);
  }
  async function open() {
    if (pending.current || AppState.currentState !== 'active') return;
    pending.current = true;
    const token = generation.current;
    setBusy(true); clearPrivate();
    try {
      let w = workspace.current;
      if (w) await w.reopen(); else w = await lifecycle.unlock();
      if (!mounted.current || token !== generation.current) { w.close(); return; }
      workspace.current = w; publish(w);
    } catch {
      if (mounted.current && token === generation.current) {
        clearPrivate(); setExitRisk(workspace.current !== null); setFailed(true);
      }
    } finally {
      pending.current = false;
      if (mounted.current && token === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void open();
    const listener = AppState.addEventListener('change', state => {
      if (!mounted.current) return;
      if (state !== 'active') {
        generation.current++; lifecycle.lock(); workspace.current = null;
        clearPrivate(); setExitRisk(false); setBusy(false); setFailed(false);
      }
    });
    return () => {
      mounted.current = false; generation.current++; editorRef.current?.dispose();
      lifecycle.lock(); workspace.current = null; listener.remove();
    };
  }, [lifecycle]);

  function exitPanel() {
    if (!mounted.current || exited.current || AppState.currentState !== 'active') return;
    exited.current = true; onBack();
  }
  function back() {
    if (pending.current || busy || editorRef.current) return;
    if (confirmation) { setConfirmation(null); setExitAfterRecovery(false); return; }
    if (review) { setReview(false); setExitAfterRecovery(false); return; }
    if (selectedId) { setSelectedId(null); return; }
    if (exitRisk) {
      setConfirmation('close'); return;
    }
    exitPanel();
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editorRef.current) return false; // Editor owns dirty-close confirmation.
      back(); return true;
    });
    return () => subscription.remove();
  }, [busy, confirmation, review, selectedId, exitRisk]);

  async function operate(action: (w: PersistentNotebook) => Promise<void>, exitOnSuccess = false) {
    const w = workspace.current;
    if (!w || pending.current || AppState.currentState !== 'active') return;
    pending.current = true; setBusy(true);
    const token = generation.current;
    try {
      await action(w);
      if (mounted.current && token === generation.current) {
        publish(w); setConfirmation(null); setExitAfterRecovery(false);
        if (exitOnSuccess && w.getRecovery().status === 'none' && !w.getRecovery().candidate) exitPanel();
      }
    } catch {
      if (mounted.current && token === generation.current) { clearPrivate(); setExitRisk(true); setFailed(true); }
    } finally {
      pending.current = false;
      if (mounted.current && token === generation.current) setBusy(false);
    }
  }
  async function reviewBeforeExit(choice: 'retry' | 'discard') {
    if (pending.current || busy) return;
    const token = generation.current;
    // Failed/uncertain writes require authenticated reopening before any recovery decision.
    if (!snapshot) await open();
    if (!mounted.current || token !== generation.current || AppState.currentState !== 'active') return;
    const w = workspace.current;
    if (!w) return;
    try {
      const recovery = w.getRecovery();
      if (!recovery.candidate) { if (recovery.status === 'none') exitPanel(); return; }
      const changes = notebookRecoveryChanges(w.getSession().snapshot(), recovery.candidate);
      setReview(true); setExitAfterRecovery(true);
      // Keep comparison and the existing second confirmation. Never retry conflicts or multi-note intents.
      setConfirmation(choice === 'discard' ? 'discard'
        : recovery.status !== 'conflict' && changes.length <= 1 ? 'commit' : null);
    } catch { clearPrivate(); setExitRisk(true); setFailed(true); }
  }
  function finishEditor() {
    editorRef.current?.dispose(); editorRef.current = null; setEditor(null);
    try { if (workspace.current) publish(workspace.current); }
    catch { clearPrivate(); setExitRisk(true); setFailed(true); }
  }
  function edit(note: PersonalNote) {
    const w = workspace.current;
    if (!w || pending.current || snapshot?.recovery.status !== 'none') return;
    try {
      const controller = createNotebookEditor(w, { kind: 'edit', id: note.id }, now);
      editorRef.current = controller; setEditor(controller);
    } catch { clearPrivate(); setExitRisk(true); setFailed(true); }
  }
  async function create() {
    if (snapshot?.recovery.status !== 'none') return;
    await operate(async w => {
      const token = generation.current, id = await createId();
      if (!mounted.current || token !== generation.current) return;
      const controller = createNotebookEditor(w, { kind: 'create', id, createdAt: now() }, now);
      editorRef.current = controller; setEditor(controller);
    });
  }
  function button(label: string, action: () => void, disabled = busy) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
      accessibilityState={{ disabled }} onPress={() => { if (!disabled && !pending.current && !exited.current) action(); }} style={styles.button}><Text style={styles.text}>{label}</Text></Pressable>;
  }
  function noteContent(note: PersonalNote | null) {
    return note ? <View style={styles.note}>
      <Text accessibilityRole="header" style={styles.title}>{note.title || copy.untitled}</Text>
      <Text selectable style={styles.text}>{note.body}</Text>
      <Text style={styles.meta}>{copy.created(new Date(note.createdAt).toLocaleString(locale))}</Text>
      <Text style={styles.meta}>{copy.updated(new Date(note.updatedAt).toLocaleString(locale))}</Text>
    </View> : <Text style={styles.text}>{copy.missing}</Text>;
  }
  if (editor) return <SafeAreaView edges={[]} style={styles.root}><PersonalNoteEditor editor={editor} onClose={finishEditor} onSaved={finishEditor} /></SafeAreaView>;
  const selected = snapshot?.notes.find(note => note.id === selectedId) ?? null;
  const visible = snapshot ? searchPersonalNotebook(snapshot.notes, query) : [];
  const recovery = snapshot?.recovery;
  const changes = snapshot && recovery?.candidate ? notebookRecoveryChanges(snapshot.notes, recovery.candidate) : [];
  return (
    <SafeAreaView edges={[]} style={styles.root}>
      <View style={styles.header}><AppHeader onBack={back} backLabel={selected || review ? copy.backToList : copy.back}
        accessibilityLabel={selected || review ? copy.backToList : copy.back} title={copy.title} backDisabled={busy} /></View>
      {confirmation === 'close' ? <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{navigation.title}</Text>
        <Text style={styles.text}>{navigation.body}</Text>
        <Text accessibilityRole="alert" style={styles.text}>{snapshot ? copy.closeWarning : copy.uncertainCloseWarning}</Text>
        {button(navigation.saveExit, () => { void reviewBeforeExit('retry'); })}
        {button(navigation.discard, () => { void reviewBeforeExit('discard'); })}
        {button(navigation.stay, () => setConfirmation(null))}
      </ScrollView> : !snapshot ? <View style={styles.content}>
        <Text accessibilityRole={failed ? 'alert' : undefined} style={styles.text}>{busy ? copy.loading : failed ? copy.unavailable : copy.locked}</Text>
        {!busy && button(copy.reopen, () => { void open(); })}
      </View> : review && recovery?.candidate ? <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.text}>{recovery.durable ? copy.encryptedSource : copy.memorySource}</Text>
        <Text style={styles.meta}>{copy.changes(changes.length)}</Text>
        {recovery.status === 'conflict' && <Text accessibilityRole="alert" style={styles.text}>{copy.conflict}</Text>}
        {changes.map(change => <View key={change.id} style={styles.note}>
          <Text style={styles.meta}>{copy.current}</Text>{noteContent(change.current)}
          <Text style={styles.meta}>{copy.candidate}</Text>{noteContent(change.candidate)}
        </View>)}
        {changes.length > 1 && <Text style={styles.text}>{copy.multiple}</Text>}
        {recovery.status !== 'conflict' && changes.length <= 1 && button(copy.saveRecovery, () => setConfirmation('commit'))}
        {button(copy.discardRecovery, () => setConfirmation('discard'))}
        {confirmation === 'commit' && <>
          <Text accessibilityRole="alert" style={styles.text}>{copy.saveWarning}</Text>
          {button(copy.confirmSave, () => { void operate(w => w.resolveRecovery('retry'), exitAfterRecovery); })}
          {button(copy.cancel, () => { setConfirmation(null); setExitAfterRecovery(false); })}
        </>}
        {confirmation === 'discard' && <>
          <Text accessibilityRole="alert" style={styles.text}>{copy.discardWarning}</Text>
          {button(copy.confirmDiscard, () => { void operate(w => w.resolveRecovery('discard'), exitAfterRecovery); })}
          {button(copy.keep, () => { setConfirmation(null); setExitAfterRecovery(false); })}
        </>}
      </ScrollView> : selected ? <ScrollView contentContainerStyle={styles.content}>
        {noteContent(selected)}
        {button(copy.edit, () => edit(selected), busy || recovery?.status !== 'none')}
        {button(copy.delete, () => setConfirmation('delete'), busy || recovery?.status !== 'none')}
        {confirmation === 'delete' && <>
          <Text accessibilityRole="alert" style={styles.text}>{copy.deleteWarning}</Text>
          {button(copy.confirmDelete, () => { void operate(w => w.getSession().remove(selected.id, selected)); })}
          {button(copy.cancel, () => setConfirmation(null))}
        </>}
      </ScrollView> : <View style={styles.list}>
        <TextInput accessibilityLabel={copy.search} placeholder={copy.search} placeholderTextColor={theme.colors.textSecondary}
          value={query} onChangeText={setQuery} editable={!busy} maxLength={100} style={styles.input} />
        {recovery?.status !== 'none' && <View style={styles.note}>
          <Text style={styles.text}>{copy.draft}</Text>
          {button(copy.review, () => { setReview(true); setConfirmation(null); })}
        </View>}
        {button(copy.newNote, () => { void create(); }, busy || recovery?.status !== 'none')}
        <Text style={styles.meta}>{copy.count(visible.length, snapshot.notes.length)}</Text>
        <FlatList data={visible} keyExtractor={note => note.id} keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.text}>{query.trim() ? copy.noMatches : copy.empty}</Text>}
          renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => setSelectedId(item.id)} style={styles.note}>
            <Text style={styles.title}>{item.title || copy.untitled}</Text>
            <Text style={styles.text} numberOfLines={2}>{item.body}</Text>
            <Text style={styles.meta}>{copy.updated(new Date(item.updatedAt).toLocaleString(locale))}</Text>
          </Pressable>} />
      </View>}
    </SafeAreaView>
  );
}
const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background }, header: { paddingHorizontal: theme.metrics.screenGutter, paddingTop: theme.spacing.md, gap: theme.spacing.sm },
  heading: { color: theme.colors.text, fontSize: theme.typography.title.fontSize, fontWeight: '700' },
  content: { padding: theme.metrics.screenGutter, gap: theme.spacing.md }, list: { flex: 1, padding: theme.metrics.screenGutter, gap: theme.spacing.sm },
  note: { padding: theme.spacing.md, gap: theme.spacing.sm, borderRadius: theme.radii.control, backgroundColor: theme.colors.surfaceRaised, marginBottom: theme.spacing.sm },
  title: { color: theme.colors.text, fontSize: theme.typography.section.fontSize, fontWeight: '600' }, text: { color: theme.colors.text, fontSize: theme.typography.body.fontSize, lineHeight: theme.typography.body.lineHeight },
  meta: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight },
  input: { borderWidth: 1, borderColor: theme.colors.controlBorder, borderRadius: theme.radii.control, minHeight: theme.metrics.controlMinHeight, padding: theme.spacing.md, color: theme.colors.text },
  button: { minHeight: theme.metrics.controlMinHeight, padding: theme.spacing.sm, justifyContent: 'center', backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radii.control },
});
