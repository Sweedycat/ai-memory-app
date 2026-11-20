import { AppHeader } from './ui/AppHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageProvider';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLifeRecords } from '../hooks/useLifeRecords';
import { CATEGORIES, LIFE_LIMITS, lifeAgenda, localLifeDate, validLifeDate, type LifeRecord } from '../utils/lifeRecords';
import { lifeAdminCopy } from '../strings/lifeAdmin';

type Group = 'overdue' | 'today' | 'upcoming' | 'completed';
type Mode = 'list' | 'detail' | 'edit' | 'complete';
type Confirmation = { kind: 'delete' | 'discard' | 'review'; target: LifeRecord | null; destination?: 'list' | 'detail' } | null;
const editableFields = (record: LifeRecord | null) => JSON.stringify({
  title: record?.title.trim() ?? '', category: record?.category ?? 'other', dueDate: record?.dueDate ?? '',
  notes: record?.notes ?? '', recurring: record?.recurring ?? false,
});

// Native input and Back/Save callbacks can run before React commits the next render.
// Keep only in-memory live values; rendered state is never the authority for an exit or write.
function useLiveFormState<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const live = useRef(initial);
  function update(next: T) { live.current = next; setValue(next); }
  return [value, update, live] as const;
}

// Uses the existing outer owner/privacy gates. No native reminder, export or
// account permission is requested. Date-only records never pass through UTC.
export function LifeAdminPanel({ onBack, createId, initialRecordId, locale: suppliedLocale }: {
  onBack: () => void; createId: () => Promise<string>; initialRecordId?: string; locale?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const { locale: contextLocale, copy: catalog } = useI18n();
  const navigation = catalog.navigation;
  const locale = suppliedLocale ?? contextLocale;
  const store = useLifeRecords();
  const storeRef = useRef(store); storeRef.current = store;
  const copy = lifeAdminCopy(locale);
  const [mode, setMode, modeRef] = useLiveFormState<Mode>('list');
  const [base, setBase, baseRef] = useLiveFormState<LifeRecord | null>(null);
  const [draft, setDraft, draftRef] = useLiveFormState<LifeRecord | null>(null);
  const [group, setGroup] = useState<Group>('today');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(30);
  const [now, setNow] = useState(() => new Date());
  const [nextDate, setNextDate, nextDateRef] = useLiveFormState('');
  const [confirmation, setConfirmation, confirmationRef] = useLiveFormState<Confirmation>(null);
  const [message, setMessage] = useState<'' | 'missing' | 'saveError' | 'invalid' | 'saved' | 'invalidNext'>('');
  const [working, setWorking] = useState(false);
  const [exitFailed, setExitFailed] = useState(false);
  const mounted = useRef(true), pending = useRef(false), hardwareBack = useRef<() => void>(() => undefined);
  const initialTargetUsed = useRef(false);
  const canWrite = store.status === 'ready' && !store.busy && !working;
  const agenda = lifeAgenda(store.records, now, query, copy.categories);
  const entries = agenda[group];
  const current = draft ? store.records.find(record => record.id === draft.id) : undefined;
  const stale = draft && (base ? JSON.stringify(current) !== JSON.stringify(base) : Boolean(current));

  useEffect(() => {
    if (!initialRecordId || initialTargetUsed.current || store.status !== 'ready') return;
    initialTargetUsed.current = true;
    const record = store.records.find(item => item.id === initialRecordId);
    if (record) open(record); else setMessage('missing');
  }, [initialRecordId, store.status, store.records]);

  useEffect(() => {
    mounted.current = true;
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
    const back = BackHandler.addEventListener('hardwareBackPress', () => { hardwareBack.current(); return true; });
    return () => { mounted.current = false; if (timer) clearInterval(timer); listener.remove(); back.remove(); };
  }, []);

  function exitForm(destination: 'list' | 'detail') {
    setConfirmation(null); setMessage(''); setNextDate(''); setExitFailed(false);
    if (destination === 'detail') setMode('detail');
    else { setMode('list'); setDraft(null); setBase(null); }
  }
  function leave() {
    if (pending.current || storeRef.current.busy) return;
    if (confirmationRef.current) { setConfirmation(null); return; }
    const mode = modeRef.current;
    const dirty = mode === 'edit' ? editableFields(draftRef.current) !== editableFields(baseRef.current)
      : mode === 'complete' && nextDateRef.current !== '';
    const destination = mode === 'complete' ? 'detail' : 'list';
    if (dirty) { setConfirmation({ kind: 'discard', target: null, destination }); return; }
    if (mode === 'list') onBack();
    else exitForm(destination);
  }
  hardwareBack.current = leave;

  async function act(action: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true; setWorking(true); setMessage('');
    try { await action(); }
    catch { if (mounted.current) setMessage('saveError'); }
    finally { pending.current = false; if (mounted.current) setWorking(false); }
  }
  function open(record: LifeRecord) { setBase(record); setDraft(record); setMode('detail'); setConfirmation(null); setMessage(''); }
  function changed(patch: Partial<LifeRecord>) {
    if (pending.current || storeRef.current.busy) return;
    const draft = draftRef.current;
    if (draft) setDraft({ ...draft, ...patch }); setConfirmation(null); setMessage(''); setExitFailed(false);
  }
  function button(label: string, action: () => void, disabled = !canWrite, selected = false) {
    return <Pressable key={label} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled, selected }} disabled={disabled} onPress={() => { if (!disabled && !pending.current && !storeRef.current.busy) action(); }}
      style={[styles.button, selected && styles.selected, disabled && styles.disabled]}><Text style={styles.text}>{label}</Text></Pressable>;
  }
  function field(label: string, value: string, change: (value: string) => void, maxLength: number, multiline = false) {
    return <View style={styles.field}><Text style={styles.caption}>{label}</Text><TextInput
      accessibilityLabel={label} value={value} onChangeText={change} maxLength={maxLength} multiline={multiline}
      editable={canWrite} autoCapitalize={multiline ? 'sentences' : 'none'} style={[styles.input, multiline && styles.notes]} /></View>;
  }
  async function save(): Promise<boolean> {
    const store = storeRef.current, draft = draftRef.current, base = baseRef.current;
    if (store.status !== 'ready' || store.busy) return false;
    if (!draft || !draft.title.trim() || !validLifeDate(draft.dueDate)) { setMessage('invalid'); return false; }
    const latest = store.records.find(record => record.id === draft.id);
    if (base ? JSON.stringify(latest) !== JSON.stringify(base) : Boolean(latest)) { setMessage('saveError'); return false; }
    const candidate = { ...draft, title: draft.title.trim() };
    if (await store.save(candidate, base) && mounted.current) {
      setConfirmation(null); setBase(candidate); setDraft(candidate); setMode('detail'); setMessage('saved'); return true;
    }
    if (mounted.current) setMessage('saveError');
    return false;
  }
  async function finish(renew: boolean): Promise<boolean> {
    const store = storeRef.current, base = baseRef.current, nextDate = nextDateRef.current;
    if (!base || store.status !== 'ready' || store.busy) return false;
    const latest = store.records.find(record => record.id === base.id);
    if (JSON.stringify(latest) !== JSON.stringify(base)) { setMessage('saveError'); return false; }
    if (renew && (!validLifeDate(nextDate) || nextDate <= base.dueDate || nextDate <= localLifeDate(new Date()))) {
      setMessage('invalidNext'); return false;
    }
    if (await store.complete(base, renew ? nextDate : null) && mounted.current) {
      setConfirmation(null); setMode('list'); setBase(null); setDraft(null); setMessage('saved'); return true;
    }
    if (mounted.current) setMessage('saveError');
    return false;
  }
  const errorText = store.error === 'load' ? copy.loadError : store.error === 'save' ? copy.saveError : store.error === 'conflict' ? copy.conflict : '';
  return <SafeAreaView edges={[]} style={styles.safe}>
    <View style={styles.top}><AppHeader onBack={leave} backLabel={copy.back} accessibilityLabel={copy.back} title={copy.title} backDisabled={working || store.busy} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.caption}>{copy.scope}</Text>
      {store.status === 'loading' && <Text style={styles.text}>{copy.loading}</Text>}
      {store.status !== 'loading' && <>
        {mode === 'list' ? <>
          {button(copy.add, () => { void act(async () => {
            const id = await createId(); if (!mounted.current) return;
            setConfirmation(null); setBase(null); setDraft({ id, title: '', category: 'other', dueDate: '', notes: '', recurring: false, history: [] }); setMode('edit');
          }); })}
          <TextInput accessibilityLabel={copy.search} placeholder={copy.search} placeholderTextColor={theme.colors.textSecondary} value={query}
            onChangeText={value => { setQuery(value); setVisible(30); }} style={styles.input} />
          <View style={styles.wrap}>{(['overdue', 'today', 'upcoming', 'completed'] as const).map(key =>
            button(`${copy[key]} (${agenda[key].length})`, () => { setGroup(key); setVisible(30); }, working || store.busy, group === key))}</View>
          {entries.slice(0, visible).map(record => <Pressable key={record.id} accessibilityRole="button"
            accessibilityLabel={`${record.title}, ${record.dueDate}`} onPress={() => open(record)} style={styles.card}>
            <Text style={styles.title}>{record.title}</Text><Text style={styles.caption}>{copy.categories[record.category]}</Text>
            <Text style={styles.text}>{copy.due}: {record.dueDate}</Text>
          </Pressable>)}
          {entries.length === 0 && <Text style={styles.text}>{copy.empty}</Text>}
          {entries.length > 0 && <Text style={styles.caption}>{copy.showing(Math.min(visible, entries.length), entries.length)}</Text>}
          {visible < entries.length && button(copy.showMore, () => setVisible(value => value + 30), false)}
        </> : draft && <>
          {mode === 'edit' ? <>
            <Text style={styles.caption}>{copy.memoryOnly}</Text>
            {field(copy.name, draft.title, title => changed({ title }), LIFE_LIMITS.title)}
            <Text style={styles.caption}>{copy.category}</Text><View style={styles.wrap}>{CATEGORIES.map(category =>
              button(copy.categories[category], () => changed({ category }), !canWrite, draft.category === category))}</View>
            {field(copy.date, draft.dueDate, dueDate => changed({ dueDate }), 10)}
            <Text style={styles.caption}>{copy.dateHelp}</Text>
            {field(copy.notes, draft.notes, notes => changed({ notes }), LIFE_LIMITS.notes, true)}
            {button(draft.recurring ? copy.recurring : copy.once, () => changed({ recurring: !draftRef.current?.recurring }), !canWrite, draft.recurring)}
            {button(copy.save, () => { void act(save); })}
            {button(copy.cancel, leave, working || store.busy)}
            {(store.error || stale) && <View style={styles.card}>
              <Text style={styles.caption}>{copy.review}</Text>
              <Text style={styles.text}>{current ? `${current.title}\n${current.dueDate}\n${current.notes}` : copy.missing}</Text>
              {current && button(copy.review, () => setConfirmation({ kind: 'review', target: current }), working || store.busy)}
            </View>}
          </> : <>
            <Text accessibilityRole="header" style={styles.title}>{draft.title}</Text>
            <Text style={styles.caption}>{copy.categories[draft.category]}</Text>
            <Text style={styles.text}>{copy.due}: {draft.dueDate}</Text>
            <Text style={styles.text}>{draft.recurring ? copy.recurring : copy.once}</Text>
            <Text style={styles.text} selectable>{draft.notes}</Text>
            {draft.completedAt && <Text style={styles.text}>{copy.completedOn}: {new Date(draft.completedAt).toLocaleString(locale)}</Text>}
            {mode === 'complete' ? <>
              {draft.recurring && <><Text style={styles.caption}>{copy.renewalHelp}</Text>
                {field(copy.nextDate, nextDate, value => { if (!pending.current && !storeRef.current.busy) { setNextDate(value); setConfirmation(null); setMessage(''); } }, 10)}
                {button(copy.renew, () => { void act(() => finish(true)); })}</>}
              {button(copy.finishOnly, () => { void act(() => finish(false)); })}
              {button(copy.cancel, leave, working || store.busy)}
            </> : <>
              {button(copy.edit, () => { setConfirmation(null); setMode('edit'); setMessage(''); })}
              {!draft.completedAt && button(copy.finish, () => { setConfirmation(null); setMode('complete'); setNextDate(''); setMessage(''); })}
              {button(copy.remove, () => setConfirmation({ kind: 'delete', target: base }))}
              <Text accessibilityRole="header" style={styles.title}>{copy.history}</Text>
              {draft.history.length === 0 && <Text style={styles.caption}>{copy.noHistory}</Text>}
              {[...draft.history].reverse().map((event, index) => <Text key={index} style={styles.text}>
                {copy.due}: {event.dueDate} · {copy.completedOn}: {new Date(event.completedAt).toLocaleString(locale)}
              </Text>)}
            </>}
          </>}
        </>}
      </>}
      {confirmation && <View style={styles.card}>
        {confirmation.kind === 'discard' && <Text accessibilityRole="header" style={styles.title}>{navigation.title}</Text>}
        <Text accessibilityRole="alert" style={styles.text}>{confirmation.kind === 'delete' ? copy.deleteWarning : confirmation.kind === 'review' ? copy.reviewWarning : navigation.body}</Text>
        {confirmation.target && <Text style={styles.text}>{confirmation.target.title} · {confirmation.target.dueDate}</Text>}
        {confirmation.kind === 'delete' ? button(copy.confirmDelete, () => { const target = confirmation.target; void act(async () => {
          if (target && await store.remove(target) && mounted.current) { setConfirmation(null); setBase(null); setDraft(null); setMode('list'); setMessage('saved'); }
        }); }) : button(confirmation.kind === 'discard' ? navigation.discard : copy.discard, () => {
          if (confirmation.kind === 'review' && confirmation.target) open(confirmation.target);
          else exitForm(confirmation.destination ?? 'list');
        }, working || store.busy)}
        {confirmation.kind === 'discard' && button(navigation.saveExit, () => {
          const destination = confirmation.destination ?? 'list';
          void act(async () => {
            const exitingMode = modeRef.current;
            let saved = false;
            try {
              // Save-and-exit from renewal entry is explicit renewal, never implicit completion.
              saved = exitingMode === 'complete' ? await finish(true) : await save();
              if (saved && mounted.current && exitingMode !== 'complete') exitForm(destination);
            } finally { if (mounted.current && !saved) setExitFailed(true); }
          });
        })}
        {button(confirmation.kind === 'discard' ? navigation.stay : copy.stay, () => setConfirmation(null), working || store.busy)}
      </View>}
    {(message || errorText || working || store.busy || exitFailed) && <View style={styles.notice}>
      {exitFailed && <><Text accessibilityRole="alert" style={styles.text}>{navigation.failedTitle}</Text><Text style={styles.text}>{navigation.failedBody}</Text></>}
      <Text accessibilityRole={errorText ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.text}>{errorText || (message ? copy[message] : copy.busy)}</Text>
      {errorText && button(copy.reload, () => { void act(store.reload); }, working || store.busy)}
    </View>}
    </ScrollView>
  </SafeAreaView>;
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  top: { paddingHorizontal: theme.metrics.screenGutter, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm, gap: theme.spacing.sm }, content: { padding: theme.metrics.screenGutter, gap: theme.spacing.md },
  heading: { color: theme.colors.text, fontSize: theme.typography.title.fontSize, fontWeight: '800' }, title: { color: theme.colors.text, fontSize: theme.typography.section.fontSize, fontWeight: '700' },
  text: { color: theme.colors.text, fontSize: theme.typography.body.fontSize, lineHeight: theme.typography.body.lineHeight }, caption: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }, field: { gap: theme.spacing.sm },
  input: { minHeight: theme.metrics.controlMinHeight, padding: theme.spacing.md, borderRadius: theme.radii.control, borderWidth: 1, borderColor: theme.colors.controlBorder, color: theme.colors.text, fontSize: theme.typography.body.fontSize, backgroundColor: theme.colors.input },
  notes: { minHeight: 120, textAlignVertical: 'top' },
  button: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', padding: theme.spacing.md, borderRadius: theme.radii.control, backgroundColor: theme.colors.surfaceRaised, borderWidth: 1, borderColor: theme.colors.controlBorder },
  selected: { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceRaised }, disabled: { opacity: 0.5 },
  card: { padding: theme.metrics.cardPadding, gap: theme.spacing.sm, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  notice: { padding: theme.spacing.md, gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceRaised, borderTopWidth: 1, borderColor: theme.colors.controlBorder },
});
