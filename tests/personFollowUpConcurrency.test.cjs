const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, imports = {}) {
  const local = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } },
  ).outputText)(name => {
    if (!(name in imports)) throw Error('Unexpected import: ' + name);
    return imports[name];
  }, local, local.exports);
  return local.exports;
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const appCatalog = load('src/i18n/catalogs/app.ts');
const classicTheme = load('src/theme/tokens.ts').THEMES.classic;

for (const scheduleResult of [null, 'synthetic-new-alarm']) {
  test(`Turkish App passes notification language and preserves reminder safety on scheduling result ${scheduleResult}`, async t => {
    const ui = screen({ language: 'tr', scheduleResult }); t.after(ui.unmount); await ui.open();
    const c = appCatalog.appTr;
    await ui.press(c.edit); await ui.input(c.followUpLabel, 'Original synthetic draft stays unchanged');
    await ui.press(c.saveChanges);
    const scheduled = ui.calls.find(call => call[0] === 'schedule');
    assert.equal(scheduled[1].language, 'tr');
    assert.equal(scheduled[1].text, 'Original synthetic draft stays unchanged');
    if (scheduleResult === null) {
      assert.equal(ui.alerts.at(-1).title, c.reminderNotUpdated);
      assert.equal(ui.alerts.at(-1).message, c.previousNotCancelled);
      assert.equal(ui.person.followUp.text, person.followUp.text);
      assert.ok(ui.alarms.has('synthetic-old-alarm'));
      assert.ok(!ui.calls.some(call => call[0] === 'cancel'));
      assert.equal(ui.field(c.followUpLabel).props.value, 'Original synthetic draft stays unchanged');
    } else {
      assert.equal(ui.person.followUp.notificationId, scheduleResult);
      assert.ok(!ui.alarms.has('synthetic-old-alarm'));
      assert.ok(ui.alarms.has(scheduleResult));
    }
  });
}

const person = {
  id: 'synthetic-person', name: 'Synthetic Person', relationship: 'Contact', lastInteraction: 'Unknown',
  notes: ['Original synthetic note'], interactions: [], followUpHistory: [],
  followUp: { id: 'synthetic-follow-up', text: 'Original synthetic follow-up', createdAt: '2026-01-01T12:00:00.000Z',
    reminderAt: '2099-01-01T12:00:00.000Z', notificationId: 'synthetic-old-alarm' },
};
const other = { ...person, id: 'other-synthetic', name: 'Other Synthetic', followUp: undefined };

// Real App handlers, people hook, validation and save queue. React rendering,
// AsyncStorage and native notifications are simulated; no Android claim.
function screen({ cancelGate, scheduleGate, scheduleResult = 'synthetic-new-alarm', failWrites = false, language = 'en' } = {}) {
  const slots = [], effects = [], calls = [], alerts = [], alarms = new Set(['synthetic-old-alarm']);
  let cursor = 0, dirty = false, scheduled = [], mounted = true, output, peopleState, notificationHandler;
  let raw = JSON.stringify([person, other]), writes = 0, failing = failWrites;
  const react = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => {
        assert.ok(mounted, 'No state updates after App unmount');
        if (typeof next === 'function') {
          const first = next(slots[index]), replay = next(slots[index]);
          assert.deepEqual(first, replay, 'React updater replay has the same result');
          slots[index] = replay;
        } else slots[index] = next;
        dirty = true;
      }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(callback) { cursor++; return callback(); },
    useCallback(callback) { cursor++; return callback; },
    useEffect(callback, deps) {
      const index = cursor++, prior = effects[index];
      if (!prior || deps.some((dep, i) => !Object.is(dep, prior.deps[i]))) {
        scheduled.push(() => { prior?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  const hook = load('src/hooks/usePersistentPeople.ts', {
    react, '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async () => raw,
      setItem: async (_, value) => { writes++; if (failing) throw Error('Synthetic low storage'); raw = value; },
    } },
    '../utils/normalizeStoredPeople': load('src/utils/normalizeStoredPeople.ts'),
    '../utils/memorySaveQueue': load('src/utils/memorySaveQueue.ts'),
  }).usePersistentPeople;
  const noop = () => null;
  const native = Object.fromEntries(['Pressable', 'SafeAreaView', 'ScrollView', 'StatusBar', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  Object.assign(native, { Platform: { OS: 'android' }, StyleSheet: { create: value => value }, Linking: {},
    Alert: { alert(title, message, buttons) { alerts.push({ title, message, buttons }); } } });
  const App = load('App.tsx', {
    react: { __esModule: true, default: react, ...react }, 'react-native': native,
    '@react-native-community/datetimepicker': { __esModule: true, default: 'DateTimePicker' }, 'expo-intent-launcher': {},
    'expo-notifications': {
      addNotificationResponseReceivedListener(callback) { notificationHandler = callback; return { remove() {} }; },
      getLastNotificationResponseAsync: async () => null,
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 0 }) },
    './src/i18n/LanguageProvider': { useI18n: () => ({ language, locale: language === 'tr' ? 'tr-TR' : 'en-US',
      copy: { app: language === 'tr' ? appCatalog.appTr : appCatalog.appEn, lifeAdmin: { title: 'Life' }, assistant: { title: 'Assistant' } } }) },
    './src/theme/ThemeProvider': { useTheme: () => ({ theme: classicTheme }) },
    './src/components/ui/AppHeader': { AppHeader: noop },
    './src/components/OwnerProfileGate': { useOwnerControls: () => ({ openSettings: noop }) },
    './src/components/NotebookBoundary': { NOTEBOOK_PRODUCTION_ENABLED: false, useNotebookLifecycle: () => null },
    './src/components/MemorySaveNotice': { MemorySaveNotice: noop },
    './src/components/DailyBriefingCard': { DailyBriefingCard: noop },
    './src/components/LifeAdminPanel': { LifeAdminPanel: noop },
    './src/strings/lifeAdmin': { lifeAdminCopy: () => ({ title: 'Life' }) },
    './src/components/GroundedAssistantPanel': { GroundedAssistantPanel: noop },
    './src/strings/assistant': { assistantCopy: () => ({ title: 'Assistant' }) },
    './src/components/NotebookPanel': { NotebookPanel: noop },
    './src/components/PersonHistory': { PersonHistory: noop },
    './src/strings/personHistory.en': { personHistoryEn: {} },
    './src/utils/personHistory': { latestDatedInteraction: () => null, recentPersonMemory: () => null },
    './src/strings/notebook.en': { notebookEn: {} }, './src/data/mockPeople': { mockPeople: [person, other] },
    './src/hooks/usePersistentPeople': { usePersistentPeople(initial) { peopleState = hook(initial); return peopleState; } },
    './src/utils/buildMemoryBriefing': { buildMemoryBriefing: noop },
    './src/utils/interactionDates': { createInteractionTimestamp: () => '2026-11-19T12:00:00.000Z', formatInteractionDate: () => '' },
    './src/utils/reminderEditDecision': load('src/utils/reminderEditDecision.ts'),
    './src/utils/screenInsets': { SCREEN_TOP_PADDING: 24 },
    './src/utils/standardPhone': load('src/utils/standardPhone.ts'),
    './src/utils/followUpNotifications': {
      async scheduleFollowUpNotification(args) {
        calls.push(['schedule', args]);
        if (scheduleGate) await scheduleGate.promise;
        if (scheduleResult) alarms.add(scheduleResult);
        return scheduleResult;
      },
      async cancelFollowUpNotification(id) {
        calls.push(['cancel', id]);
        if (cancelGate) await cancelGate.promise;
        alarms.delete(id);
      },
    },
  }).default;
  function render() {
    cursor = 0; dirty = false; output = App();
    const pending = scheduled; scheduled = []; pending.forEach(run => run());
  }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children)];
  }
  function find(predicate) {
    const found = nodes(output).find(predicate); assert.ok(found, 'Expected UI control'); return found;
  }
  render();
  const ui = {
    calls, alerts, alarms,
    get person() { return peopleState[0].find(item => item.id === person.id); },
    get people() { return peopleState[0]; }, get status() { return peopleState[4].status; },
    get raw() { return raw; }, get writes() { return writes; }, get busy() { return output.props.busy; },
    async flush() { for (let i = 0; i < 12; i++) { await new Promise(resolve => setImmediate(resolve)); if (mounted && dirty) render(); } },
    control(label) { return find(node => node.props.label === label && node.props.onPress); },
    field(label) { return find(node => node.props.label === label && node.props.onChange); },
    complete() { return find(node => node.type === 'Pressable' && nodes(node).some(child => child.type === 'Text' && String(child.props.children).includes('Mark completed'))); },
    async press(label) { const node = ui.control(label); assert.ok(!node.props.disabled, label + ' enabled'); node.props.onPress(); await ui.flush(); },
    async input(label, value) { ui.field(label).props.onChange(value); await ui.flush(); },
    async open() { await ui.flush(); find(node => node.type === 'Pressable' && node.props.key === person.id).props.onPress(); await ui.flush(); },
    async notify(id = person.id) { notificationHandler({ notification: { request: { content: { data: { personId: id } } } } }); await ui.flush(); },
    async memory(value) { find(node => node.type === 'TextInput' && node.props.placeholder?.startsWith('Add another')).props.onChangeText(value); await ui.flush(); },
    replace(next) { peopleState[1](next); },
    async retry() { failing = false; peopleState[4].retry(); await ui.flush(); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); mounted = false; },
  };
  return ui;
}

for (const releaseBeforeStaleEdit of [false, true]) {
  test(`completion blocks a captured Edit callback, including after completion=${releaseBeforeStaleEdit}`, async t => {
    const gate = deferred(), ui = screen({ cancelGate: gate }); t.after(ui.unmount); await ui.open();
    const edit = ui.control('Edit').props.onPress, complete = ui.complete().props.onPress;
    complete(); edit(); await ui.flush();
    assert.equal(ui.control('Edit').props.disabled, true); assert.equal(ui.busy, true);
    // A callback from the same pre-busy render cannot start a stale editor.
    if (!releaseBeforeStaleEdit) edit();
    gate.resolve(); await ui.flush();
    assert.equal(ui.person.followUp, undefined); assert.equal(ui.person.followUpHistory.length, 1);
    if (releaseBeforeStaleEdit) { await ui.press('Edit'); assert.equal(ui.field('FOLLOW-UP').props.value, ''); await ui.press('Save changes'); }
    assert.equal(ui.person.followUp, undefined); assert.equal(ui.alarms.size, 0);
    assert.equal(ui.calls.filter(call => call[0] === 'schedule').length, 0);
  });
}

test('same-tick completion and delete callbacks issue one cancellation and one history entry', async t => {
  const gate = deferred(), ui = screen({ cancelGate: gate }); t.after(ui.unmount); await ui.open();
  await ui.press('Delete'); const confirm = ui.alerts.at(-1).buttons.find(button => button.text === 'Delete').onPress;
  const complete = ui.complete().props.onPress; complete(); complete(); confirm(); await ui.flush();
  assert.equal(ui.calls.length, 1); gate.resolve(); await ui.flush();
  assert.equal(ui.person.followUpHistory.length, 1); assert.equal(ui.people.length, 2);
});

test('pending edit cannot be completed, deleted or overwrite a note through notification navigation', async t => {
  const gate = deferred(), ui = screen({ scheduleGate: gate }); t.after(ui.unmount); await ui.open();
  const oldComplete = ui.complete().props.onPress;
  await ui.press('Edit'); await ui.input('FOLLOW-UP', 'Revised synthetic follow-up');
  const save = ui.control('Save changes').props.onPress; save(); save(); await ui.flush();
  await ui.notify(); await ui.memory('New synthetic note');
  assert.equal(ui.control('Add memory note').props.disabled, true);
  ui.control('Add memory note').props.onPress(); oldComplete(); ui.control('Delete').props.onPress(); await ui.flush();
  assert.equal(ui.calls.length, 1); assert.deepEqual(ui.person.notes, person.notes);
  await ui.notify(other.id); gate.resolve(); await ui.flush();
  assert.equal(ui.person.followUp.text, 'Revised synthetic follow-up'); assert.equal(ui.person.followUpHistory.length, 0);
  assert.equal(ui.calls.filter(call => call[0] === 'schedule').length, 1);
  assert.equal(ui.calls.filter(call => call[0] === 'cancel').length, 1);
  assert.deepEqual([...ui.alarms], ['synthetic-new-alarm']);
  // Success must not rebind or navigate to the original person.
  await ui.press('Edit'); assert.equal(ui.field('NAME *').props.value, other.name);
});

test('stale full edit base is rejected with draft intact before any native work', async t => {
  const ui = screen(); t.after(ui.unmount); await ui.open(); await ui.press('Edit');
  await ui.input('PRIMARY MEMORY', 'Unsaved synthetic draft');
  ui.replace(ui.people.map(item => item.id === person.id ? { ...item, notes: ['New synthetic note', ...item.notes] } : item)); await ui.flush();
  await ui.press('Save changes');
  assert.equal(ui.alerts.at(-1).title, 'Person changed'); assert.equal(ui.field('PRIMARY MEMORY').props.value, 'Unsaved synthetic draft');
  assert.deepEqual(ui.person.notes, ['New synthetic note', ...person.notes]); assert.equal(ui.calls.length, 0);
});

test('a revision changed while scheduling keeps current records and cancels only the unused new alarm', async t => {
  const gate = deferred(), ui = screen({ scheduleGate: gate }); t.after(ui.unmount); await ui.open(); await ui.press('Edit');
  await ui.input('FOLLOW-UP', 'Unsaved synthetic follow-up'); ui.control('Save changes').props.onPress(); await ui.flush();
  const current = { ...ui.person, notes: ['New synthetic revision'] };
  ui.replace([current, other]); await ui.flush(); gate.resolve(); await ui.flush();
  assert.deepEqual(ui.person.notes, current.notes); assert.equal(ui.person.followUp.text, person.followUp.text);
  assert.equal(ui.field('FOLLOW-UP').props.value, 'Unsaved synthetic follow-up');
  assert.deepEqual(ui.calls.filter(call => call[0] === 'cancel'), [['cancel', 'synthetic-new-alarm']]);
  assert.deepEqual([...ui.alarms], ['synthetic-old-alarm']); assert.equal(ui.alerts.at(-1).title, 'Person changed');
});

test('completion compares the whole follow-up snapshot even when its ID is unchanged', async t => {
  const gate = deferred(), ui = screen({ cancelGate: gate }); t.after(ui.unmount); await ui.open();
  ui.complete().props.onPress(); await ui.flush();
  const revised = { ...ui.person.followUp, text: 'Later synthetic revision', notificationId: 'synthetic-later-alarm' };
  ui.replace(ui.people.map(item => item.id === person.id ? { ...item, followUp: revised } : item)); await ui.flush();
  gate.resolve(); await ui.flush();
  assert.deepEqual(ui.person.followUp, revised); assert.equal(ui.person.followUpHistory.length, 0);
});

test('scheduling denial preserves the old reminder, record and draft and releases busy state', async t => {
  const ui = screen({ scheduleResult: null }); t.after(ui.unmount); await ui.open(); await ui.press('Edit');
  await ui.input('FOLLOW-UP', 'Denied synthetic revision'); const before = JSON.stringify(ui.person);
  await ui.press('Save changes'); assert.equal(JSON.stringify(ui.person), before);
  assert.equal(ui.field('FOLLOW-UP').props.value, 'Denied synthetic revision'); assert.equal(ui.busy, false);
  assert.equal(ui.alerts.at(-1).title, 'Reminder not updated'); assert.equal(ui.calls.filter(call => call[0] === 'cancel').length, 0);
  assert.deepEqual([...ui.alarms], ['synthetic-old-alarm']);
});

test('unchanged reminder reuses its alarm; disk failure retries bytes without repeating native work', async t => {
  const ui = screen({ failWrites: true }); t.after(ui.unmount); await ui.open(); await ui.press('Edit');
  await ui.input('PRIMARY MEMORY', 'Updated synthetic note'); await ui.press('Save changes');
  assert.equal(ui.person.followUp.notificationId, 'synthetic-old-alarm'); assert.equal(ui.calls.length, 0);
  assert.equal(ui.status, 'error'); assert.equal(JSON.parse(ui.raw)[0].notes[0], person.notes[0]);
  await ui.retry(); assert.equal(ui.status, 'idle'); assert.equal(JSON.parse(ui.raw)[0].notes[0], 'Updated synthetic note');
  assert.equal(ui.calls.length, 0);
});

test('unmount during scheduling cleans the unused alarm without late mutation, alert or navigation', async () => {
  const gate = deferred(), ui = screen({ scheduleGate: gate }); await ui.open(); await ui.press('Edit');
  await ui.input('FOLLOW-UP', 'Unmounted synthetic revision'); ui.control('Save changes').props.onPress(); await ui.flush();
  const before = JSON.stringify(ui.person); ui.unmount(); gate.resolve(); await ui.flush();
  assert.equal(JSON.stringify(ui.person), before); assert.equal(ui.alerts.length, 0);
  assert.deepEqual([...ui.alarms], ['synthetic-old-alarm']);
});

test('unmount during completion skips late people mutation and success UI', async () => {
  const gate = deferred(), ui = screen({ cancelGate: gate }); await ui.open();
  ui.complete().props.onPress(); await ui.flush(); const before = JSON.stringify(ui.person);
  ui.unmount(); gate.resolve(); await ui.flush();
  assert.equal(JSON.stringify(ui.person), before); assert.equal(ui.alerts.length, 0);
});

test('delete confirmation rejects a changed original record without cancelling its reminder', async t => {
  const ui = screen(); t.after(ui.unmount); await ui.open(); await ui.press('Delete');
  const confirm = ui.alerts.at(-1).buttons.find(button => button.text === 'Delete').onPress;
  ui.replace(ui.people.map(item => item.id === person.id ? { ...item, notes: ['Revised synthetic note'] } : item));
  await ui.flush(); confirm(); await ui.flush();
  assert.equal(ui.people.length, 2); assert.equal(ui.calls.length, 0); assert.equal(ui.alerts.at(-1).title, 'Person changed');
});
