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
const navigationCatalog = load('src/i18n/catalogs/navigation.ts');
const timeCatalog = load('src/i18n/catalogs/timeEntry.ts');
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
function screen({ cancelGate, scheduleGate, writeGate, scheduleResult = 'synthetic-new-alarm', failWrites = false,
  lostAcknowledgement = false, language = 'en', platform = 'android' } = {}) {
  const slots = [], effects = [], calls = [], alerts = [], alarms = new Set(['synthetic-old-alarm']);
  let cursor = 0, dirty = false, scheduled = [], mounted = true, output, peopleState, notificationHandler, hardwareBack;
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
      setItem: async (_, value) => {
        writes++;
        if (writeGate) await writeGate.promise;
        if (lostAcknowledgement) raw = value;
        if (failing) throw Error('Synthetic storage failure');
        raw = value;
      },
    } },
    '../utils/normalizeStoredPeople': load('src/utils/normalizeStoredPeople.ts'),
    '../utils/memorySaveQueue': load('src/utils/memorySaveQueue.ts'),
  }).usePersistentPeople;
  const noop = () => null;
  const native = Object.fromEntries(['Pressable', 'SafeAreaView', 'ScrollView', 'StatusBar', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  Object.assign(native, { Platform: { OS: platform }, StyleSheet: { create: value => value }, Linking: {},
    BackHandler: { addEventListener(_, callback) { hardwareBack = callback; return { remove() { if (hardwareBack === callback) hardwareBack = null; } }; } },
    Alert: { alert(title, message, buttons) { alerts.push({ title, message, buttons }); } } });
  const i18n = { useI18n: () => ({ language, locale: language === 'tr' ? 'tr-TR' : 'en-US', copy: {
    app: language === 'tr' ? appCatalog.appTr : appCatalog.appEn,
    navigation: language === 'tr' ? navigationCatalog.navigationTr : navigationCatalog.navigationEn,
    timeEntry: language === 'tr' ? timeCatalog.timeEntryTr : timeCatalog.timeEntryEn,
    lifeAdmin: { title: 'Life' }, assistant: { title: 'Assistant' },
  } }) };
  const unsaved = load('src/hooks/useUnsavedChanges.ts', {
    react, 'react-native': native, '../i18n/LanguageProvider': i18n,
  });
  const App = load('App.tsx', {
    react: { __esModule: true, default: react, ...react }, 'react-native': native,
    '@react-native-community/datetimepicker': { __esModule: true, default: 'DateTimePicker' }, 'expo-intent-launcher': {},
    'expo-notifications': {
      addNotificationResponseReceivedListener(callback) { notificationHandler = callback; return { remove() {} }; },
      getLastNotificationResponseAsync: async () => null,
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 0 }) },
    './src/i18n/LanguageProvider': i18n,
    './src/hooks/useUnsavedChanges': unsaved,
    './src/components/ui/DigitalTimeInput': { DigitalTimeInput: 'DigitalTimeInput' },
    './src/utils/digitalReminderTime': load('src/utils/digitalReminderTime.ts'),
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
    async back() { assert.equal(hardwareBack(), true); await ui.flush(); },
    async choose(text) { const button = alerts.at(-1).buttons.find(item => item.text === text); assert.ok(button, text); button.onPress(); await ui.flush(); },
    get output() { return output; },
    renderNow: render,
    digital() { return find(node => node.type === 'DigitalTimeInput'); },
    date() { return find(node => node.type === 'DateTimePicker'); },
    async appBack() { find(node => node.type?.name === 'Back').props.onPress(); await ui.flush(); },
    async add() { find(node => node.type === 'Pressable' && nodes(node).some(child => child.type === 'Text' && child.props.children.includes(appCatalog.appEn.addPersonButton))).props.onPress(); await ui.flush(); },
    async memory(value) { find(node => node.type === 'TextInput' && node.props.placeholder?.startsWith('Add another')).props.onChangeText(value); await ui.flush(); },
    async interaction(value) { find(node => node.type === 'TextInput' && node.props.placeholder?.startsWith('What happened')).props.onChangeText(value); await ui.flush(); },
    draft(kind) { return find(node => node.type === 'TextInput' && node.props.placeholder?.startsWith(kind === 'note' ? 'Add another' : 'What happened')).props; },
    replace(next) { peopleState[1](next); },
    async retry() { failing = false; peopleState[4].retry(); await ui.flush(); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); mounted = false; },
    async remount() {
      slots.length = 0; effects.length = 0; scheduled = []; mounted = true;
      render(); await ui.flush();
    },
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

test('pending edit blocks notification navigation and stale completion/delete callbacks', async t => {
  const gate = deferred(), ui = screen({ scheduleGate: gate }); t.after(ui.unmount); await ui.open();
  const oldComplete = ui.complete().props.onPress;
  const oldDelete = ui.control('Delete').props.onPress;
  await ui.press('Edit'); await ui.input('FOLLOW-UP', 'Revised synthetic follow-up');
  const save = ui.control('Save changes').props.onPress; save(); save(); await ui.flush();
  await ui.notify();
  assert.equal(ui.field('FOLLOW-UP').props.value, 'Revised synthetic follow-up');
  oldComplete(); oldDelete(); await ui.flush();
  assert.equal(ui.calls.length, 1); assert.deepEqual(ui.person.notes, person.notes);
  await ui.notify(other.id); gate.resolve(); await ui.flush();
  assert.equal(ui.person.followUp.text, 'Revised synthetic follow-up'); assert.equal(ui.person.followUpHistory.length, 0);
  assert.equal(ui.calls.filter(call => call[0] === 'schedule').length, 1);
  assert.equal(ui.calls.filter(call => call[0] === 'cancel').length, 1);
  assert.deepEqual([...ui.alarms], ['synthetic-new-alarm']);
  // Busy notification navigation was blocked; success stays with this person.
  await ui.press('Edit'); assert.equal(ui.field('NAME *').props.value, person.name);
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
  const ui = screen(); t.after(ui.unmount); await ui.open();
  const capturedComplete = ui.complete().props.onPress;
  const revised = { ...ui.person.followUp, text: 'Later synthetic revision', notificationId: 'synthetic-later-alarm' };
  ui.replace(ui.people.map(item => item.id === person.id ? { ...item, followUp: revised } : item)); await ui.flush();
  capturedComplete(); await ui.flush();
  assert.deepEqual(ui.person.followUp, revised); assert.equal(ui.person.followUpHistory.length, 0);
  assert.equal(ui.calls.length, 0);
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

for (const language of ['en', 'tr']) {
  test(`editor baseline, continue, discard and save-and-exit preserve input in ${language}`, async t => {
    const ui = screen({ language }); t.after(ui.unmount); const c = language === 'tr' ? appCatalog.appTr : appCatalog.appEn;
    const nav = language === 'tr' ? navigationCatalog.navigationTr : navigationCatalog.navigationEn;
    await ui.open(); await ui.press(c.edit); await ui.input(c.nameLabel, `  ${person.name}  `);
    await ui.appBack(); assert.equal(ui.alerts.length, 0, 'Whitespace-only baseline changes are clean');
    await ui.press(c.edit); await ui.input(c.nameLabel, 'Changed synthetic name');
    await ui.back(); assert.equal(ui.alerts.at(-1).title, nav.title);
    await ui.choose(nav.stay); assert.equal(ui.field(c.nameLabel).props.value, 'Changed synthetic name');
    await ui.appBack(); await ui.choose(nav.discard); assert.equal(ui.writes, 0); assert.equal(ui.person.name, person.name);
    await ui.press(c.edit); await ui.input(c.nameLabel, 'Saved synthetic name');
    await ui.back(); await ui.choose(nav.saveExit);
    assert.equal(JSON.parse(ui.raw)[0].name, 'Saved synthetic name'); assert.equal(ui.output.props.key, 'detail');
  });
}

for (const lostAcknowledgement of [false, true]) {
  test(`Save and exit waits for explicit retry after failure; lost ACK=${lostAcknowledgement}`, async t => {
    const ui = screen({ failWrites: true, lostAcknowledgement }); t.after(ui.unmount); await ui.open(); await ui.press('Edit');
    await ui.input('FOLLOW-UP', 'Synthetic pending reminder'); await ui.notify(other.id);
    await ui.choose(navigationCatalog.navigationEn.saveExit);
    assert.equal(ui.output.props.key, 'edit'); assert.equal(ui.field('FOLLOW-UP').props.value, 'Synthetic pending reminder');
    assert.equal(ui.status, 'error'); assert.equal(ui.busy, true);
    assert.equal(ui.calls.filter(item => item[0] === 'schedule').length, 1);
    assert.equal(ui.calls.filter(item => item[0] === 'cancel').length, 0, 'Old reminder remains until ACK');
    await ui.back(); assert.equal(ui.output.props.key, 'edit');
    await ui.retry(); assert.equal(ui.status, 'idle'); assert.equal(ui.output.props.key, 'detail');
    assert.equal(ui.calls.filter(item => item[0] === 'schedule').length, 1);
    assert.deepEqual([...ui.alarms], ['synthetic-new-alarm']);
    await ui.press('Edit'); assert.equal(ui.field('NAME *').props.value, other.name, 'Requested notification destination follows acknowledged save');
  });
}

test('new-person disk failure retains the form and retries one final record without duplicate IDs', async t => {
  const ui = screen({ failWrites: true }); t.after(ui.unmount); await ui.flush(); await ui.add();
  await ui.input('NAME *', 'New synthetic person'); await ui.press('Save person');
  assert.equal(ui.output.props.key, 'add'); assert.equal(ui.field('NAME *').props.value, 'New synthetic person');
  assert.equal(ui.people.length, 3); const id = ui.people[0].id;
  await ui.retry(); assert.equal(ui.people.length, 3); assert.equal(ui.people[0].id, id);
  assert.equal(JSON.parse(ui.raw).length, 3); assert.equal(ui.output.props.key, 'detail');
});

test('note and interaction Save and exit persist both before clearing and navigating', async t => {
  const ui = screen({ failWrites: true }); t.after(ui.unmount); await ui.open();
  await ui.memory('Synthetic note draft'); await ui.interaction('Synthetic interaction draft');
  await ui.back(); await ui.choose(navigationCatalog.navigationEn.saveExit);
  assert.equal(ui.output.props.key, 'detail'); assert.equal(ui.draft('note').value, 'Synthetic note draft');
  assert.equal(ui.draft('interaction').value, 'Synthetic interaction draft');
  assert.equal(ui.draft('note').editable, false);
  await ui.retry();
  const stored = JSON.parse(ui.raw)[0];
  assert.equal(stored.notes.filter(item => item === 'Synthetic note draft').length, 1);
  assert.equal(stored.interactions.filter(item => item.summary === 'Synthetic interaction draft').length, 1);
  assert.equal(ui.output.props.key, 'home', 'Returns home only after both records are acknowledged');
});

for (const operation of ['complete', 'delete']) {
  test(`${operation} preserves the old scheduled reminder until disk acknowledgement`, async t => {
    const ui = screen({ failWrites: true }); t.after(ui.unmount); await ui.open();
    if (operation === 'complete') { ui.complete().props.onPress(); await ui.flush(); }
    else { await ui.press('Delete'); await ui.choose('Delete'); }
    assert.equal(ui.status, 'error'); assert.ok(ui.alarms.has('synthetic-old-alarm')); assert.equal(ui.calls.length, 0);
    await ui.retry(); assert.ok(!ui.alarms.has('synthetic-old-alarm'));
    assert.equal(ui.calls.filter(item => item[0] === 'cancel').length, 1);
  });
}

test('captured form and detail callbacks cannot replace input during an acknowledged save', async t => {
  const gate = deferred(), ui = screen({ scheduleGate: gate }); t.after(ui.unmount); await ui.open();
  const capturedNote = ui.draft('note').onChangeText, capturedInteraction = ui.draft('interaction').onChangeText;
  await ui.press('Edit'); await ui.input('FOLLOW-UP', 'Synthetic fenced save');
  const capturedForm = ui.field('FOLLOW-UP').props.onChange;
  ui.control('Save changes').props.onPress();
  capturedForm('Must not replace save'); capturedNote('Must not leak into detail'); capturedInteraction('Must not leak into detail');
  await ui.flush(); assert.equal(ui.field('FOLLOW-UP').props.value, 'Synthetic fenced save');
  gate.resolve(); await ui.flush();
  assert.equal(ui.draft('note').value, ''); assert.equal(ui.draft('interaction').value, '');
  assert.equal(ui.person.followUp.text, 'Synthetic fenced save');
});

test('digital confirmation persists the exact minute and selected local date only after confirmation', async t => {
  const ui = screen(); t.after(ui.unmount); await ui.open(); await ui.press('Edit'); await ui.press(appCatalog.appEn.pickDate);
  const original = new Date(person.followUp.reminderAt), picked = new Date(original); picked.setDate(picked.getDate() + 3);
  ui.date().props.onChange({ type: 'set' }, picked); await ui.flush();
  const exact = new Date(ui.digital().props.value); exact.setHours(23, 7, 0, 0);
  assert.equal(ui.person.followUp.reminderAt, original.toISOString());
  ui.digital().props.onConfirm(exact); await ui.flush(); await ui.press('Save changes');
  assert.equal(ui.person.followUp.reminderAt, exact.toISOString());
  assert.equal(ui.calls.find(item => item[0] === 'schedule')[1].reminderAt, exact.toISOString());
});

test('cancelling a new reminder leaves its originally empty value unchanged', async t => {
  const ui = screen(); t.after(ui.unmount); await ui.flush(); await ui.add();
  await ui.input('NAME *', 'Synthetic without reminder'); await ui.input('FOLLOW-UP', 'Synthetic follow-up');
  await ui.press(appCatalog.appEn.pickDate);
  ui.date().props.onChange({ type: 'set' }, new Date('2099-02-02T14:35:00Z')); await ui.flush();
  ui.digital().props.onCancel(); await ui.flush(); await ui.press('Save person');
  assert.equal(ui.people[0].followUp.reminderAt, undefined); assert.equal(ui.calls.length, 0);
});

test('App Lock style unmount during a final write detaches UI while acknowledged reminder cleanup completes', async () => {
  const gate = deferred(), ui = screen({ writeGate: gate }); await ui.open(); await ui.press('Edit');
  await ui.input('FOLLOW-UP', 'Synthetic acknowledged after lock'); await ui.press('Save changes');
  assert.equal(ui.status, 'saving'); assert.equal(ui.calls.filter(item => item[0] === 'cancel').length, 0);
  ui.unmount(); gate.resolve(); await ui.flush();
  assert.equal(JSON.parse(ui.raw)[0].followUp.text, 'Synthetic acknowledged after lock');
  assert.deepEqual([...ui.alarms], ['synthetic-new-alarm']);
});

test('failed final intent survives App Lock; new edit/add/complete/delete wait for Retry ACK', async t => {
  const ui = screen({ failWrites: true }); t.after(ui.unmount); await ui.open(); await ui.press('Edit');
  await ui.input('FOLLOW-UP', 'Synthetic first final intent'); await ui.press('Save changes');
  assert.equal(ui.status, 'error'); const firstIntent = JSON.stringify(ui.people), writes = ui.writes;
  ui.unmount(); await ui.remount();
  assert.equal(ui.status, 'error'); assert.equal(JSON.stringify(ui.people), firstIntent);
  await ui.add(); assert.equal(ui.output.props.key, 'home', 'Add cannot supersede pending intent');
  await ui.open();
  const edit = ui.control('Edit'), remove = ui.control('Delete'), complete = ui.complete();
  assert.equal(edit.props.disabled, true); assert.equal(remove.props.disabled, true); assert.equal(complete.props.disabled, true);
  // Invoke captured callbacks directly as well as checking the disabled UI.
  edit.props.onPress(); remove.props.onPress(); complete.props.onPress(); await ui.flush();
  assert.equal(ui.output.props.key, 'detail'); assert.equal(JSON.stringify(ui.people), firstIntent);
  assert.equal(ui.writes, writes); assert.equal(ui.alerts.filter(item => item.title === appCatalog.appEn.deleteTitle).length, 0);
  assert.deepEqual([...ui.alarms], ['synthetic-old-alarm', 'synthetic-new-alarm']);
  await ui.retry(); assert.equal(ui.status, 'idle'); assert.equal(JSON.stringify(JSON.parse(ui.raw)), firstIntent);
  assert.deepEqual([...ui.alarms], ['synthetic-new-alarm'], 'Original reminder cleanup survives remount and cannot be superseded');
  await ui.press('Edit'); await ui.input('PRIMARY MEMORY', 'Synthetic second acknowledged intent'); await ui.press('Save changes');
  assert.equal(JSON.parse(ui.raw)[0].notes[0], 'Synthetic second acknowledged intent');
  assert.equal(ui.calls.filter(item => item[0] === 'schedule').length, 1);
  await ui.appBack(); await ui.add(); assert.equal(ui.output.props.key, 'add', 'New work resumes after ACK');
});

test('captured mutation callbacks consult writer immediately before status can rerender', async t => {
  const gate = deferred(), ui = screen({ writeGate: gate }); t.after(ui.unmount); await ui.open();
  const edit = ui.control('Edit').props.onPress, remove = ui.control('Delete').props.onPress, complete = ui.complete().props.onPress;
  const external = ui.people.map(item => ({ ...item, notes: ['Synthetic earlier final bytes'] }));
  ui.replace(external); ui.renderNow();
  assert.equal(ui.status, 'idle', 'React status snapshot intentionally lags queued write');
  edit(); remove(); complete();
  assert.equal(ui.output.props.key, 'detail'); assert.equal(ui.calls.length, 0); assert.equal(ui.alerts.length, 0);
  await ui.flush(); assert.equal(ui.status, 'saving'); assert.deepEqual(ui.people, external);
  gate.resolve(); await ui.flush();
  await ui.press('Edit'); assert.equal(ui.field('PRIMARY MEMORY').props.value, 'Synthetic earlier final bytes');
});

for (const platform of ['android', 'ios']) {
  test(`custom reminder stages date and digital time with cancellation on ${platform}`, async t => {
    const ui = screen({ platform }); t.after(ui.unmount); await ui.open(); await ui.press('Edit'); await ui.press(appCatalog.appEn.pickDate);
    const original = new Date(person.followUp.reminderAt), chosen = new Date(original); chosen.setDate(chosen.getDate() + 2);
    assert.equal(ui.date().props.mode, 'date');
    ui.date().props.onChange({ type: 'set' }, chosen); await ui.flush();
    if (platform === 'ios') {
      // Date spinner changes remain staged until Done, and Cancel discards them.
      const wrapper = ui.date(); assert.equal(wrapper.props.value.getDate(), chosen.getDate());
      // iOS Done is a native Pressable, not an Action helper.
      const walk = node => Array.isArray(node) ? node.flatMap(walk) : node && typeof node === 'object' ? [node, ...walk(node.props.children)] : [];
      const done = walk(ui.output).find(node => node.type === 'Pressable' && walk(node).some(child => child.type === 'Text' && child.props.children.includes('Done')));
      done.props.onPress(); await ui.flush();
    }
    const digital = ui.digital(); assert.equal(digital.props.value.getDate(), chosen.getDate());
    assert.equal(digital.props.value.getHours(), original.getHours());
    digital.props.onCancel(); await ui.flush(); await ui.press(appCatalog.appEn.pickDate);
    assert.equal(ui.date().props.value.toISOString(), original.toISOString(), 'Cancel never changes the saved form reminder');
    ui.date().props.onChange({ type: 'dismissed' }); await ui.flush();
    await ui.press('Save changes'); assert.equal(ui.person.followUp.reminderAt, original.toISOString());
    assert.equal(ui.calls.filter(item => item[0] === 'schedule').length, 0);
  });
}

test('opening an unchanged reminder picker does not warn or invent an unsaved reminder', async t => {
  const ui = screen(); t.after(ui.unmount); await ui.open(); await ui.press('Edit'); await ui.press(appCatalog.appEn.pickDate);
  await ui.appBack(); assert.equal(ui.output.props.key, 'detail'); assert.equal(ui.alerts.length, 0); assert.equal(ui.writes, 0);
});

test('staged reminder date and raw time participate in all three Back choices without changing the stored reminder', async t => {
  const ui = screen(); t.after(ui.unmount); await ui.open(); await ui.press('Edit'); await ui.press(appCatalog.appEn.pickDate);
  const date = new Date(person.followUp.reminderAt); date.setDate(date.getDate() + 2);
  ui.date().props.onChange({ type: 'set' }, date); await ui.flush();
  ui.digital().props.onFieldsChange({ hour: '23', minute: '07' }); await ui.flush();
  await ui.back(); assert.equal(ui.alerts.at(-1).title, navigationCatalog.navigationEn.title);
  await ui.choose(navigationCatalog.navigationEn.stay);
  assert.deepEqual(ui.digital().props.fields, { hour: '23', minute: '07' }); assert.equal(ui.digital().props.value.getDate(), date.getDate());
  assert.equal(ui.person.followUp.reminderAt, person.followUp.reminderAt);
  await ui.appBack(); await ui.choose(navigationCatalog.navigationEn.discard);
  assert.equal(ui.output.props.key, 'detail'); assert.equal(ui.writes, 0); assert.equal(ui.person.followUp.reminderAt, person.followUp.reminderAt);
});

for (const route of ['Save and exit', 'normal Save']) test(`${route} persists a validated staged reminder snapshot without requiring digital Confirm`, async t => {
  const ui = screen(); t.after(ui.unmount); await ui.open(); await ui.press('Edit'); await ui.press(appCatalog.appEn.pickDate);
  const date = new Date(person.followUp.reminderAt); date.setDate(date.getDate() + 4);
  ui.date().props.onChange({ type: 'set' }, date); await ui.flush();
  ui.digital().props.onFieldsChange({ hour: '23', minute: '07' }); await ui.flush();
  const exact = new Date(date); exact.setHours(23, 7, 0, 0);
  if (route === 'Save and exit') { await ui.notify(other.id); await ui.choose(navigationCatalog.navigationEn.saveExit); }
  else await ui.press('Save changes');
  assert.equal(JSON.parse(ui.raw)[0].followUp.reminderAt, exact.toISOString());
  assert.equal(ui.calls.find(item => item[0] === 'schedule')[1].reminderAt, exact.toISOString());
  assert.equal(ui.output.props.key, 'detail');
  if (route === 'Save and exit') { await ui.press('Edit'); assert.equal(ui.field('NAME *').props.value, other.name); }
});

test('invalid staged HH/MM blocks Save and exit, retains input, and explicit Cancel discards only the candidate', async t => {
  const ui = screen(); t.after(ui.unmount); await ui.open(); await ui.press('Edit'); await ui.press(appCatalog.appEn.pickDate);
  ui.date().props.onChange({ type: 'set' }, new Date(person.followUp.reminderAt)); await ui.flush();
  ui.digital().props.onFieldsChange({ hour: '24', minute: '' }); await ui.flush();
  await ui.back(); await ui.choose(navigationCatalog.navigationEn.saveExit);
  assert.equal(ui.output.props.key, 'edit'); assert.deepEqual(ui.digital().props.fields, { hour: '24', minute: '' });
  assert.equal(ui.writes, 0); assert.equal(ui.calls.length, 0); assert.equal(ui.person.followUp.reminderAt, person.followUp.reminderAt);
  assert.ok(ui.alerts.some(item => item.message === timeCatalog.timeEntryEn.invalidHour));
  ui.digital().props.onCancel(); await ui.flush(); const prompts = ui.alerts.length;
  await ui.appBack(); assert.equal(ui.output.props.key, 'detail'); assert.equal(ui.alerts.length, prompts);
});

test('choosing a quick reminder replaces an open invalid digital candidate explicitly', async t => {
  const ui = screen(); t.after(ui.unmount); await ui.open(); await ui.press('Edit'); await ui.press(appCatalog.appEn.pickDate);
  ui.date().props.onChange({ type: 'set' }, new Date(person.followUp.reminderAt)); await ui.flush();
  ui.digital().props.onFieldsChange({ hour: '99', minute: '' }); await ui.flush();
  await ui.press(appCatalog.appEn.tenMinutes); await ui.press('Save changes');
  const remaining = new Date(JSON.parse(ui.raw)[0].followUp.reminderAt).getTime() - Date.now();
  assert.ok(remaining > 9 * 60_000 && remaining <= 10 * 60_000);
});

test('staged reminder Retry retains raw input and fences a captured Cancel while final ACK is pending', async t => {
  const ui = screen({ failWrites: true }); t.after(ui.unmount); await ui.open(); await ui.press('Edit'); await ui.press(appCatalog.appEn.pickDate);
  ui.date().props.onChange({ type: 'set' }, new Date(person.followUp.reminderAt)); await ui.flush();
  const digital = ui.digital(); digital.props.onFieldsChange({ hour: '23', minute: '07' });
  // Save directly from the same render: formForSave must use the synchronous raw snapshot.
  ui.control('Save changes').props.onPress(); await ui.flush();
  assert.equal(ui.status, 'error'); digital.props.onCancel(); await ui.flush();
  assert.deepEqual(ui.digital().props.fields, { hour: '23', minute: '07' });
  assert.equal(ui.calls.filter(item => item[0] === 'schedule').length, 1);
  await ui.retry(); const stored = new Date(JSON.parse(ui.raw)[0].followUp.reminderAt);
  assert.equal(stored.getHours(), 23); assert.equal(stored.getMinutes(), 7);
  assert.equal(ui.calls.filter(item => item[0] === 'schedule').length, 1);
});

for (const route of ['hardware', 'app']) test(`raw time input followed by captured ${route} Back before render still prompts`, async t => {
  const ui = screen(); t.after(ui.unmount); await ui.open(); await ui.press('Edit'); await ui.press(appCatalog.appEn.pickDate);
  ui.date().props.onChange({ type: 'set' }, new Date(person.followUp.reminderAt)); await ui.flush();
  // Deliberately omit flush between the native input and Back delivery.
  ui.digital().props.onFieldsChange({ hour: '23', minute: '07' });
  if (route === 'hardware') await ui.back(); else await ui.appBack();
  assert.equal(ui.output.props.key, 'edit'); assert.equal(ui.alerts.at(-1).title, navigationCatalog.navigationEn.title);
  await ui.choose(navigationCatalog.navigationEn.stay); assert.deepEqual(ui.digital().props.fields, { hour: '23', minute: '07' });
});

test('form and note native input followed immediately by Back retain their synchronous draft baseline', async t => {
  const ui = screen(); t.after(ui.unmount); await ui.open();
  ui.draft('note').onChangeText('Synthetic note before render'); await ui.back();
  assert.equal(ui.alerts.at(-1).title, navigationCatalog.navigationEn.title); await ui.choose(navigationCatalog.navigationEn.discard);
  await ui.open(); await ui.press('Edit'); ui.field('NAME *').props.onChange('Synthetic form before render'); await ui.appBack();
  assert.equal(ui.alerts.at(-1).title, navigationCatalog.navigationEn.title);
  await ui.choose(navigationCatalog.navigationEn.stay); assert.equal(ui.field('NAME *').props.value, 'Synthetic form before render');
});

if (process.env.AI_MEMORY_APP_DST_CHILD === '1') {
  test('App DST preserves requested clock on selected gap day', async t => {
    const ui = screen(); t.after(ui.unmount); await ui.flush();
    const gap = new Date(2099, 2, 1, 12, 0);
    while (gap.getDay() !== 0) gap.setDate(gap.getDate() + 1);
    gap.setDate(gap.getDate() + 7);
    const original = new Date(gap); original.setDate(original.getDate() - 1); original.setHours(2, 30, 0, 0);
    assert.equal(new Date(gap.getFullYear(), gap.getMonth(), gap.getDate(), 2, 30).getHours(), 3, 'Real New York spring gap');
    ui.replace(ui.people.map(item => item.id === person.id ? { ...item, followUp: { ...item.followUp, reminderAt: original.toISOString() } } : item));
    await ui.flush(); const writes = ui.writes;
    await ui.open(); await ui.press('Edit'); await ui.press(appCatalog.appEn.pickDate);
    ui.date().props.onChange({ type: 'set' }, gap); await ui.flush();
    assert.deepEqual(ui.digital().props.fields, { hour: '02', minute: '30' });
    await ui.press('Save changes');
    assert.equal(ui.writes, writes); assert.equal(ui.person.followUp.reminderAt, original.toISOString());
    assert.ok(ui.alerts.some(item => item.message === timeCatalog.timeEntryEn.unavailableTime));
    await ui.back(); await ui.choose(navigationCatalog.navigationEn.saveExit);
    assert.equal(ui.output.props.key, 'edit'); assert.equal(ui.writes, writes); assert.equal(ui.calls.length, 0);
  });
} else {
  test('App selected-date integration rejects a DST-gap clock in an actual time-zone subprocess', () => {
    const result = require('node:child_process').spawnSync(process.execPath,
      ['--test', '--test-name-pattern', '^App DST preserves requested clock on selected gap day$', __filename],
      { cwd: path.resolve(__dirname, '..'), env: { ...process.env, TZ: 'America/New_York', AI_MEMORY_APP_DST_CHILD: '1' }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}
