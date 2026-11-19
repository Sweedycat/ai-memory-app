import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLifeRecords } from '../hooks/useLifeRecords';
import { CATEGORIES, LIFE_LIMITS, lifeAgenda, localLifeDate, validLifeDate, type LifeRecord } from '../utils/lifeRecords';
import { lifeAdminCopy } from '../strings/lifeAdmin';
import { SCREEN_TOP_PADDING } from '../utils/screenInsets';

type Group = 'overdue' | 'today' | 'upcoming' | 'completed';
type Mode = 'list' | 'detail' | 'edit' | 'complete';
type Confirmation = { kind: 'delete' | 'discard' | 'review'; target: LifeRecord | null } | null;

// Uses the existing outer owner/privacy gates. No native reminder, export or
// account permission is requested. Date-only records never pass through UTC.
export function LifeAdminPanel({ onBack, createId, initialRecordId, locale = Intl.DateTimeFormat().resolvedOptions().locale }: {
  onBack: () => void; createId: () => Promise<string>; initialRecordId?: string; locale?: string;
}) {
  const store = useLifeRecords();
  const copy = lifeAdminCopy(locale);
  const [mode, setMode] = useState<Mode>('list');
  const [base, setBase] = useState<LifeRecord | null>(null);
  const [draft, setDraft] = useState<LifeRecord | null>(null);
  const [group, setGroup] = useState<Group>('today');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(30);
  const [now, setNow] = useState(() => new Date());
  const [nextDate, setNextDate] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const mounted = useRef(true), pending = useRef(false), hardwareBack = useRef<() => void>(() => undefined);
  const initialTargetUsed = useRef(false);
  const canWrite = store.status === 'ready' && !store.busy && !working;
  const dirty = mode === 'edit' && JSON.stringify(draft) !== JSON.stringify(base);
  const agenda = lifeAgenda(store.records, now, query, copy.categories);
  const entries = agenda[group];
  const current = draft ? store.records.find(record => record.id === draft.id) : undefined;
  const stale = draft && (base ? JSON.stringify(current) !== JSON.stringify(base) : Boolean(current));

  useEffect(() => {
    if (!initialRecordId || initialTargetUsed.current || store.status !== 'ready') return;
    initialTargetUsed.current = true;
    const record = store.records.find(item => item.id === initialRecordId);
    if (record) open(record); else setMessage(copy.missing);
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

  function leave() {
    if (pending.current || store.busy) return;
    if (confirmation) { setConfirmation(null); return; }
    if (dirty) { setConfirmation({ kind: 'discard', target: null }); return; }
    if (mode === 'list') onBack();
    else { setMode('list'); setDraft(null); setBase(null); setMessage(''); }
  }
  hardwareBack.current = leave;

  async function act(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setWorking(true); setMessage('');
    try { await action(); }
    catch { if (mounted.current) setMessage(copy.saveError); }
    finally { pending.current = false; if (mounted.current) setWorking(false); }
  }
  function open(record: LifeRecord) { setBase(record); setDraft(record); setMode('detail'); setConfirmation(null); setMessage(''); }
  function changed(patch: Partial<LifeRecord>) { if (draft) setDraft({ ...draft, ...patch }); setMessage(''); }
  function button(label: string, action: () => void, disabled = !canWrite, selected = false) {
    return <Pressable key={label} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled, selected }} disabled={disabled} onPress={action}
      style={[styles.button, selected && styles.selected, disabled && styles.disabled]}><Text style={styles.text}>{label}</Text></Pressable>;
  }
  function field(label: string, value: string, change: (value: string) => void, maxLength: number, multiline = false) {
    return <View style={styles.field}><Text style={styles.caption}>{label}</Text><TextInput
      accessibilityLabel={label} value={value} onChangeText={change} maxLength={maxLength} multiline={multiline}
      editable={canWrite} autoCapitalize={multiline ? 'sentences' : 'none'} style={[styles.input, multiline && styles.notes]} /></View>;
  }
  async function save() {
    if (!draft || !draft.title.trim() || !validLifeDate(draft.dueDate)) { setMessage(copy.invalid); return; }
    const candidate = { ...draft, title: draft.title.trim() };
    if (await store.save(candidate, base) && mounted.current) { setConfirmation(null); setBase(candidate); setDraft(candidate); setMode('detail'); setMessage(copy.saved); }
  }
  async function finish(renew: boolean) {
    if (!base) return;
    if (renew && (!validLifeDate(nextDate) || nextDate <= base.dueDate || nextDate <= localLifeDate(new Date()))) {
      setMessage(copy.invalidNext); return;
    }
    if (await store.complete(base, renew ? nextDate : null) && mounted.current) {
      setConfirmation(null); setMode('list'); setBase(null); setDraft(null); setMessage(copy.saved);
    }
  }
  const errorText = store.error === 'load' ? copy.loadError : store.error === 'save' ? copy.saveError : store.error === 'conflict' ? copy.conflict : '';
  return <SafeAreaView style={styles.safe}>
    <View style={styles.top}>{button(copy.back, leave, working || store.busy)}<Text accessibilityRole="header" style={styles.heading}>{copy.title}</Text></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.caption}>{copy.scope}</Text>
      {store.status === 'loading' && <Text style={styles.text}>{copy.loading}</Text>}
      {store.status !== 'loading' && <>
        {mode === 'list' ? <>
          {button(copy.add, () => { void act(async () => {
            const id = await createId(); if (!mounted.current) return;
            setConfirmation(null); setBase(null); setDraft({ id, title: '', category: 'other', dueDate: '', notes: '', recurring: false, history: [] }); setMode('edit');
          }); })}
          <TextInput accessibilityLabel={copy.search} placeholder={copy.search} placeholderTextColor="#9CAAB9" value={query}
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
            {button(draft.recurring ? copy.recurring : copy.once, () => changed({ recurring: !draft.recurring }), !canWrite, draft.recurring)}
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
                {field(copy.nextDate, nextDate, setNextDate, 10)}
                {button(copy.renew, () => { void act(() => finish(true)); })}</>}
              {button(copy.finishOnly, () => { void act(() => finish(false)); })}
              {button(copy.cancel, () => { setConfirmation(null); setMode('detail'); }, working || store.busy)}
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
        <Text accessibilityRole="alert" style={styles.text}>{confirmation.kind === 'delete' ? copy.deleteWarning : confirmation.kind === 'review' ? copy.reviewWarning : copy.discardWarning}</Text>
        {confirmation.target && <Text style={styles.text}>{confirmation.target.title} · {confirmation.target.dueDate}</Text>}
        {confirmation.kind === 'delete' ? button(copy.confirmDelete, () => { const target = confirmation.target; void act(async () => {
          if (target && await store.remove(target) && mounted.current) { setConfirmation(null); setBase(null); setDraft(null); setMode('list'); setMessage(copy.saved); }
        }); }) : button(copy.discard, () => {
          if (confirmation.kind === 'review' && confirmation.target) open(confirmation.target);
          else { setConfirmation(null); setMode('list'); setBase(null); setDraft(null); setMessage(''); }
        }, working || store.busy)}
        {button(copy.stay, () => setConfirmation(null), working || store.busy)}
      </View>}
    </ScrollView>
    {(message || errorText || working || store.busy) && <View style={styles.notice}>
      <Text accessibilityRole={errorText ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.text}>{errorText || message || copy.busy}</Text>
      {errorText && button(copy.reload, () => { void act(store.reload); }, working || store.busy)}
    </View>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0C1118', paddingTop: SCREEN_TOP_PADDING },
  top: { paddingHorizontal: 20, paddingBottom: 8, gap: 8 }, content: { padding: 20, gap: 14 },
  heading: { color: '#F4F7FA', fontSize: 25, fontWeight: '800' }, title: { color: '#F4F7FA', fontSize: 18, fontWeight: '700' },
  text: { color: '#E1E8EF', fontSize: 15, lineHeight: 23 }, caption: { color: '#B2C1CC', fontSize: 13, lineHeight: 20 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, field: { gap: 6 },
  input: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#526577', color: '#F4F7FA', fontSize: 16, backgroundColor: '#151E29' },
  notes: { minHeight: 120, textAlignVertical: 'top' },
  button: { minHeight: 48, justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: '#203343', borderWidth: 1, borderColor: '#526577' },
  selected: { borderColor: '#7DE2C3', backgroundColor: '#194436' }, disabled: { opacity: 0.5 },
  card: { padding: 16, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: '#3F5669', backgroundColor: '#121E29' },
  notice: { padding: 12, gap: 8, backgroundColor: '#27303D', borderTopWidth: 1, borderColor: '#526577' },
});
