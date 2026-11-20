const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createPresentation, pureSource, catalog, THEMES } = require('./helpers/featurePresentation.cjs');
const root = path.resolve(__dirname, '..');

function load(file, imports = {}) {
  const local = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText)(name => {
    if (!(name in imports)) throw Error('Unexpected component import: ' + name);
    return imports[name];
  }, local, local.exports);
  return local.exports;
}

// Real component handlers/effects and pure catalog/model code. Native widgets,
// OS APIs and storage transport are fabricated; no Android acceptance is implied.
function mount(name, props = {}, imports = {}, options = {}) {
  const slots = [], effects = [], listeners = new Set();
  let cursor = 0, dirty = false, pendingEffects = [], output, mounted = true;
  const react = {
    createElement(type, props, ...children) {
      return typeof type === 'function' ? type({ ...props, children }) : { type, props: { ...props, children } };
    },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { assert.ok(mounted, 'No update after unmount'); slots[i] = typeof value === 'function' ? value(slots[i]) : value; dirty = true; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(callback) { cursor++; return callback(); },
    useCallback(callback) { cursor++; return callback; },
    useEffect(callback, deps) { const i = cursor++, old = effects[i];
      if (!old || deps.some((dep, j) => !Object.is(dep, old.deps[j]))) pendingEffects.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: callback() }; }); },
  };
  const native = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'Switch', 'StatusBar', 'KeyboardAvoidingView'].map(name => [name, name]));
  native.StyleSheet = { create: value => value };
  native.Platform = { OS: 'android', Version: 36 };
  native.AppState = { currentState: 'active', addEventListener: (_, callback) => { listeners.add(callback); return { remove() { listeners.delete(callback); } }; } };
  native.BackHandler = { addEventListener: () => ({ remove() {} }) };
  if (options.native) Object.assign(native, options.native);
  const presentation = createPresentation(load, react, native, options);
  const module = load('src/components/' + name + '.tsx', {
    react: { __esModule: true, default: react, ...react }, 'react-native': native, ...presentation.imports, ...imports,
  });
  const Component = module[name] ?? module.default;
  function render() { cursor = 0; dirty = false; output = Component(props); const pending = pendingEffects; pendingEffects = []; pending.forEach(run => run()); }
  function nodes(node) { return Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []; }
  function text(node) { return Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : node == null || typeof node === 'boolean' ? '' : String(node); }
  render();
  const ui = {
    get alerts() { return presentation.navigation.alerts; },
    get nodes() { return nodes(output); }, get text() { return text(output); },
    find(type, label) { const found = nodes(output).find(node => node.type === type && (!label || node.props.accessibilityLabel === label || text(node) === label));
      assert.ok(found, 'Missing ' + type + ': ' + label); return found; },
    async flush() { for (let i = 0; i < 8; i++) { await new Promise(resolve => setImmediate(resolve)); if (mounted && dirty) render(); } },
    async press(label) { const node = ui.find('Pressable', label); assert.ok(!node.props.disabled, 'Enabled: ' + label); node.props.onPress(); await ui.flush(); },
    async input(label, value) { ui.find('TextInput', label).props.onChangeText(value); await ui.flush(); },
    async back() { for (const callback of [...presentation.navigation.backs].reverse()) if (callback()) break; await ui.flush(); },
    async choose(label) { const button = ui.alerts.at(-1)?.buttons?.find(item => item.text === label); assert.ok(button, label); button.onPress(); await ui.flush(); },
    async language(language) { presentation.state.language = language; render(); await ui.flush(); },
    async theme(mode) { presentation.state.mode = mode; render(); await ui.flush(); },
    update(next) { Object.assign(props, next); render(); },
    background() { native.AppState.currentState = 'background'; for (const listener of listeners) listener('background'); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); mounted = false; },
  };
  return ui;
}

test('save failure stays actionable and switches language/theme without losing the retry handler', async t => {
  let retries = 0;
  const ui = mount('MemorySaveNotice', { status: 'error', retry: () => { retries++; } }, {}, { language: 'tr' }); t.after(ui.unmount);
  assert.ok(ui.text.includes(catalog.tr.ui.memorySave.explanation));
  assert.ok(ui.nodes.some(node => node.props.accessibilityRole === 'alert'));
  await ui.press(catalog.tr.ui.memorySave.retry); assert.equal(retries, 1);
  await ui.language('en'); assert.ok(ui.text.includes(catalog.en.ui.memorySave.explanation));
  for (const mode of ['classic', 'modern', 'light', 'dark']) {
    await ui.theme(mode); assert.equal(ui.find('View').props.style.borderColor, THEMES[mode].colors.warning);
  }
  ui.update({ status: 'idle' }); assert.equal(ui.text, '');
});

test('daily overview formats with selected locale and preserves source text and navigation IDs', async t => {
  const person = { id: 'synthetic-daily', name: 'Synthetic Name', notes: [], interactions: [], relationship: '', lastInteraction: '',
    followUp: { id: 'synthetic-follow', text: 'Saved English text stays unchanged', createdAt: '2020-01-01T00:00:00Z', reminderAt: '2099-03-15T12:30:00Z' } };
  const opened = [], before = JSON.stringify(person);
  const ui = mount('DailyBriefingCard', { people: [person], onOpenPerson: id => opened.push(id) }, {
    '../utils/dailyBriefing': pureSource('src/utils/dailyBriefing.ts'),
  }, { language: 'tr' }); t.after(ui.unmount);
  assert.ok(ui.text.includes(catalog.tr.ui.dailyBriefing.title)); assert.ok(ui.text.includes(person.followUp.text));
  const dateOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  assert.ok(ui.text.includes(new Date(person.followUp.reminderAt).toLocaleString('tr-TR', dateOptions)));
  const row = ui.nodes.find(node => node.type === 'Pressable' && node.props.accessibilityHint === catalog.tr.ui.dailyBriefing.open(person.name));
  assert.ok(row); row.props.onPress(); assert.deepEqual(opened, [person.id]);
  await ui.language('en'); assert.ok(ui.text.includes(catalog.en.ui.dailyBriefing.title));
  assert.ok(ui.text.includes(new Date(person.followUp.reminderAt).toLocaleString('en-US', dateOptions)));
  assert.equal(JSON.stringify(person), before);
});

test('Turkish history translates source labels and preserves saved legacy labels verbatim', async t => {
  const records = [{ id: 'synthetic-history', date: 'Today', summary: 'Original saved English summary', source: 'manual' }];
  const before = JSON.stringify(records);
  const ui = mount('PersonHistory', { interactions: records, completed: [] }, {
    '../utils/personHistory': pureSource('src/utils/personHistory.ts'), '../utils/interactionDates': pureSource('src/utils/interactionDates.ts'),
  }, { language: 'tr', mode: 'light' }); t.after(ui.unmount);
  assert.ok(ui.text.includes(catalog.tr.ui.personHistory.original('Today')));
  assert.ok(ui.text.includes(catalog.tr.ui.personHistory.source(catalog.tr.ui.personHistory.sourceNames.manual)));
  assert.ok(ui.text.includes(records[0].summary)); assert.ok(ui.text.includes('Tarih kaydedilmedi'));
  await ui.language('en'); assert.ok(ui.text.includes(catalog.en.ui.personHistory.original('Today')));
  assert.equal(JSON.stringify(records), before);
});

test('permission overview translates every current/future disclosure without requesting access', async t => {
  const disclosures = pureSource('src/utils/permissionDisclosures.ts');
  const ui = mount('PermissionOverview', {}, { '../utils/permissionDisclosures': disclosures }, { language: 'tr' }); t.after(ui.unmount);
  for (const item of disclosures.CURRENT_PERMISSIONS) {
    assert.ok(ui.text.includes(catalog.tr.ui.permissions.current[item.id].name));
    assert.ok(ui.text.includes(catalog.tr.ui.permissions.current[item.id].purpose));
    assert.ok(ui.text.includes(catalog.tr.ui.permissions.current[item.id].howGranted));
  }
  for (const item of disclosures.FUTURE_PERMISSIONS) {
    assert.ok(ui.text.includes(catalog.tr.ui.permissions.future[item.id].name));
    assert.ok(ui.text.includes(catalog.tr.ui.permissions.future[item.id].context));
  }
  assert.ok(ui.text.includes(catalog.tr.ui.permissions.privacy)); assert.equal(ui.nodes.some(node => node.type === 'Pressable'), false);
  await ui.language('en'); assert.ok(ui.text.includes(disclosures.PERMISSION_PRIVACY_NOTE));
});

test('notification denial/settings and exact-alarm guidance stay explicit and retranslate after language change', async t => {
  let granted = false, canAskAgain = true, asks = 0, settings = 0, alarms = 0;
  const calls = [];
  const ui = mount('ReminderPermissionActions', {}, {
    'expo-application': { applicationId: 'synthetic.package' },
    'expo-intent-launcher': { ActivityAction: { REQUEST_SCHEDULE_EXACT_ALARM: 'synthetic-alarm' }, async startActivityAsync(action, data) { alarms++; assert.equal(data.data, 'package:synthetic.package'); } },
    'expo-notifications': { async getPermissionsAsync() { return { granted, canAskAgain }; }, async requestPermissionsAsync() { calls.push('request'); asks++; return { granted: false }; } },
    '../utils/followUpNotifications': { async ensurePrivateFollowUpChannel(language) { calls.push(['channel', language]); } },
  }, { language: 'tr', native: { Linking: { async openSettings() { settings++; } } } }); t.after(ui.unmount);
  await ui.flush(); assert.equal(asks, 0); assert.equal(settings, 0);
  await ui.press(catalog.tr.ui.reminder.allowLabel);
  assert.deepEqual(calls, [['channel', 'tr'], 'request']); assert.ok(ui.text.includes(catalog.tr.ui.reminder.deniedMessage));
  await ui.language('en'); assert.ok(ui.text.includes(catalog.en.ui.reminder.deniedMessage)); assert.equal(asks, 1);
  canAskAgain = false; await ui.press(catalog.en.ui.reminder.allowLabel); assert.equal(settings, 1); assert.equal(asks, 1);
  assert.ok(ui.text.includes(catalog.en.ui.reminder.enableMessage));
  await ui.press(catalog.en.ui.reminder.alarmLabel); assert.equal(alarms, 1);
  assert.ok(ui.text.includes(catalog.en.ui.reminder.reviewMessage));
  granted = true; await ui.press(catalog.en.ui.reminder.allowLabel); assert.equal(settings, 2); assert.equal(asks, 1);
});

test('reminder onboarding remains optional and a failed seen-state read never blocks existing memories', async t => {
  const writes = [];
  const imports = { './ReminderPermissionActions': { ReminderPermissionActions: 'ReminderPermissionActions' },
    './PermissionOverview': { PermissionOverview: 'PermissionOverview' } };
  const storage = { async getItem() { return null; }, async setItem(key, value) { writes.push([key, value]); } };
  const ui = mount('ReminderPermissionGate', { children: 'Synthetic existing memories' }, {
    ...imports, '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
  }, { language: 'tr' }); t.after(ui.unmount); await ui.flush();
  assert.ok(ui.text.includes(catalog.tr.ui.reminder.optional)); await ui.press(catalog.tr.ui.reminder.continueLabel);
  assert.ok(ui.text.includes('Synthetic existing memories')); assert.deepEqual(writes, [['@ai-memory/permission-transparency-setup/v2', 'seen']]);
  const failed = mount('ReminderPermissionGate', { children: 'Synthetic existing memories' }, {
    ...imports, '@react-native-async-storage/async-storage': { __esModule: true, default: { ...storage, async getItem() { throw Error('Synthetic read failure'); } } },
  }); t.after(failed.unmount); await failed.flush(); assert.ok(failed.text.includes('Synthetic existing memories')); assert.equal(writes.length, 1);
});

test('backup corruption prevents preference overwrite; explicit synthetic diagnostics show only translated safe stage', async t => {
  const writes = [];
  class SyntheticCryptoError extends Error { constructor(stage) { super('Synthetic native error must not be displayed'); this.stage = stage; } }
  let checks = 0;
  const ui = mount('BackupSafetyDiagnostics', {}, {
    '@react-native-async-storage/async-storage': { __esModule: true, default: { async getItem() { return '{corrupt synthetic preference'; }, async setItem(...args) { writes.push(args); } } },
    '../utils/backupRecoveryKeyPolicy': pureSource('src/utils/backupRecoveryKeyPolicy.ts'),
    '../utils/backupNativeSelfTest': { BackupCryptoSelfTestError: SyntheticCryptoError, async runSyntheticBackupCryptoSelfTest() { checks++; throw new SyntheticCryptoError('wrong-key'); } },
  }, { language: 'tr' }); t.after(ui.unmount); await ui.flush();
  assert.ok(ui.text.includes(catalog.tr.ui.backup.saveError)); assert.equal(writes.length, 0); assert.equal(checks, 0);
  assert.equal(ui.find('Pressable', catalog.tr.ui.backup.frequencies.Daily).props.disabled, true);
  await ui.press(catalog.tr.ui.backup.checkLabel); assert.equal(checks, 1);
  assert.ok(ui.text.includes(catalog.tr.ui.backup.failed(catalog.tr.ui.backup.stages['wrong-key'])));
  assert.equal(ui.text.includes('Synthetic native error'), false);
  await ui.language('en'); assert.ok(ui.text.includes(catalog.en.ui.backup.failed(catalog.en.ui.backup.stages['wrong-key'])));
  await ui.press(catalog.en.ui.backup.practice); await ui.input(catalog.en.ui.backup.exampleLabel, 'public mismatch');
  await ui.press(catalog.en.ui.backup.confirm); assert.ok(ui.text.includes(catalog.en.ui.backup.confirmationFailed));
  assert.equal(writes.length, 0);
});

test('bug report localizes display/share copy while persisting stable English area values and configured version', async t => {
  const writes = [], shares = [], config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  let raw = '[]';
  const ui = mount('BugReportPanel', { onClose() {}, reporterName: 'Synthetic reporter' }, {
    '../../app.json': config,
    '@react-native-async-storage/async-storage': { __esModule: true, default: { async getItem() { return raw; }, async setItem(key, value) { writes.push([key, JSON.parse(value)]); raw = value; } } },
  }, { language: 'tr', mode: 'light', native: { Share: { async share(payload) { shares.push(payload); } } } }); t.after(ui.unmount);
  await ui.press(catalog.tr.ui.bug.areas['App lock']); await ui.input(catalog.tr.ui.bug.describe, 'Synthetic description in English');
  await ui.press(catalog.tr.ui.bug.saveLabel);
  assert.equal(writes.length, 1); assert.equal(writes[0][1][0].area, 'App lock'); assert.equal(writes[0][1][0].appVersion, config.expo.version);
  assert.equal(writes[0][1][0].description, 'Synthetic description in English'); assert.equal(shares.length, 1);
  assert.ok(shares[0].message.includes(catalog.tr.ui.bug.areas['App lock']));
  assert.ok(shares[0].message.includes(catalog.tr.ui.bug.reportPrivacy)); assert.ok(shares[0].message.includes('Synthetic description in English'));
  assert.ok(ui.text.includes(catalog.tr.ui.bug.saved)); await ui.language('en'); assert.ok(ui.text.includes(catalog.en.ui.bug.saved));
  assert.equal(writes.length, 1); assert.equal(shares.length, 1);
});

test('Life uses context language by default and retranslates validation without losing an unsaved draft', async t => {
  const store = { records: [], status: 'ready', busy: false, error: null, async save() { assert.fail('Invalid draft must not save'); } };
  const ui = mount('LifeAdminPanel', { onBack() {}, createId: async () => 'synthetic-context-life' }, {
    '../hooks/useLifeRecords': { useLifeRecords: () => store }, '../utils/lifeRecords': pureSource('src/utils/lifeRecords.ts'),
    '../strings/lifeAdmin': pureSource('src/strings/lifeAdmin.ts'),
  }, { language: 'tr' }); t.after(ui.unmount);
  await ui.press(catalog.tr.lifeAdmin.add); await ui.input(catalog.tr.lifeAdmin.name, 'Saved English stays unchanged');
  await ui.press(catalog.tr.lifeAdmin.save); assert.ok(ui.text.includes(catalog.tr.lifeAdmin.invalid));
  await ui.language('en'); assert.ok(ui.text.includes(catalog.en.lifeAdmin.invalid));
  assert.equal(ui.find('TextInput', catalog.en.lifeAdmin.name).props.value, 'Saved English stays unchanged');
  assert.equal(ui.find('TextInput', catalog.en.lifeAdmin.date).props.value, '');
});

test('saved assistant follows context language without resetting the selected question or query', async t => {
  const person = { id: 'synthetic-assistant-context', name: 'Synthetic Context', notes: [], relationship: '', lastInteraction: '',
    interactions: [{ id: 'synthetic-original', date: '2020-01-01T00:00:00Z', source: 'manual', summary: 'Original source English' }] };
  const ui = mount('GroundedAssistantPanel', { people: [person], onBack() {}, onOpenPerson() {}, onOpenLife() {} }, {
    '../hooks/useLifeRecords': { useLifeRecords: () => ({ records: [], status: 'ready', busy: false }) },
    '../utils/groundedAssistant': pureSource('src/utils/groundedAssistant.ts'), '../strings/assistant': pureSource('src/strings/assistant.ts'),
  }, { language: 'tr' }); t.after(ui.unmount);
  await ui.press(catalog.tr.assistant.questions['last-interaction']); await ui.input(catalog.tr.assistant.personQuery, 'Synthetic Context');
  assert.ok(ui.text.includes(person.interactions[0].summary)); await ui.language('en');
  assert.equal(ui.find('TextInput', catalog.en.assistant.personQuery).props.value, 'Synthetic Context');
  assert.ok(ui.text.includes(person.interactions[0].summary)); assert.ok(ui.text.includes(catalog.en.assistant.sourceTypes.interaction));
});

test('synthetic notebook preview localizes examples and preserves separate list/back navigation', async t => {
  let backs = 0;
  const ui = mount('PersonalNotebookPreview', { onBack() { backs++; } }, {
    '../utils/personalNotebook': pureSource('src/utils/personalNotebook.ts'),
  }, { language: 'tr' }); t.after(ui.unmount);
  assert.ok(ui.text.includes(catalog.tr.ui.notebookPreview.notice)); assert.ok(ui.text.includes(catalog.tr.ui.notebookPreview.inspection));
  const row = ui.nodes.find(node => node.type === 'Pressable' && node.props.key === 'demo-1');
  assert.ok(row); row.props.onPress(); await ui.flush(); assert.ok(ui.text.includes(catalog.tr.ui.notebookPreview.updated(new Date('2026-11-16T09:00:00.000Z').toLocaleDateString('tr-TR'))));
  await ui.language('en'); assert.ok(ui.text.includes(catalog.en.ui.notebookPreview.inspectionBody));
  await ui.press(catalog.en.ui.notebookPreview.back); assert.equal(backs, 0);
  await ui.press(catalog.en.ui.notebookPreview.back); assert.equal(backs, 1);
});

function syntheticReport(id) {
  return { id, createdAt: '2026-01-01T12:00:00Z', area: 'Other', description: 'Synthetic retained report',
    steps: '', expected: '', reporterName: 'Synthetic reporter', appVersion: '0.2.0' };
}
function bugFixture(raw = '[]', { language = 'en' } = {}) {
  const state = { raw, writes: 0, reads: 0, shares: [], closed: 0, failRead: false };
  const storage = {
    async getItem(key) { assert.equal(key, '@ai-memory/bug-reports/v1'); state.reads++; if (state.failRead) throw Error('Synthetic read failure'); return state.raw; },
    async setItem(key, value) { assert.equal(key, '@ai-memory/bug-reports/v1'); state.writes++; state.raw = value; },
    async clear() { assert.fail('Never clear reports'); }, async removeItem() { assert.fail('Never delete reports'); },
  };
  const ui = mount('BugReportPanel', { onClose() { state.closed++; }, reporterName: 'Synthetic reporter' }, {
    '../../app.json': require('../app.json'),
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
  }, { language, native: { Share: { async share(payload) { state.shares.push(payload); } } } });
  return { state, storage, ui };
}

test('bug input followed by captured close before rendering saves the latest input without Share', async t => {
  const { state, ui } = bugFixture(); t.after(ui.unmount); const c = catalog.en.ui.bug;
  const close = ui.find('Pressable', c.close).props.onPress;
  ui.find('TextInput', c.describe).props.onChangeText('Synthetic immediate report');
  close();
  assert.equal(ui.alerts.at(-1).title, catalog.en.navigation.title);
  await ui.choose(catalog.en.navigation.saveExit);
  assert.equal(state.closed, 1); assert.equal(state.writes, 1); assert.equal(state.shares.length, 0);
  assert.equal(JSON.parse(state.raw)[0].description, 'Synthetic immediate report');
});

test('oversized bug candidate preserves near-limit history and input without writing or sharing', async t => {
  const retained = syntheticReport('synthetic-near-limit'); retained.description = 'x'.repeat(999000);
  const original = JSON.stringify([retained]); assert.ok(original.length < 1000000);
  const { state, ui } = bugFixture(original); t.after(ui.unmount); const c = catalog.en.ui.bug;
  const draft = 'Synthetic oversized report '.repeat(100);
  await ui.input(c.describe, draft); await ui.press(c.saveLabel);
  assert.equal(state.raw, original); assert.equal(state.writes, 0); assert.equal(state.shares.length, 0);
  assert.equal(ui.find('TextInput', c.describe).props.value, draft); assert.ok(ui.text.includes(c.failed));
});

for (const language of ['en', 'tr']) test(`bug Back offers all localized choices and Save and exit never opens Share in ${language}`, async t => {
  const { state, ui } = bugFixture('[]', { language }); t.after(ui.unmount);
  const c = catalog[language].ui.bug, nav = catalog[language].navigation;
  await ui.input(c.describe, 'Synthetic bug draft'); await ui.back();
  assert.equal(ui.alerts.at(-1).title, nav.title);
  assert.deepEqual(ui.alerts.at(-1).buttons.map(item => item.text), [nav.stay, nav.discard, nav.saveExit]);
  await ui.choose(nav.stay); assert.equal(ui.find('TextInput', c.describe).props.value, 'Synthetic bug draft');
  await ui.press(c.close); await ui.choose(nav.saveExit);
  assert.equal(state.closed, 1); assert.equal(state.writes, 1); assert.equal(state.shares.length, 0);
  assert.equal(JSON.parse(state.raw)[0].description, 'Synthetic bug draft');
});

test('bug discard requires explicit selection and leaves original bytes untouched', async t => {
  const { state, ui } = bugFixture(); t.after(ui.unmount); const c = catalog.en.ui.bug;
  await ui.input(c.describe, 'Synthetic discarded draft'); await ui.back();
  assert.equal(state.closed, 0); await ui.choose(catalog.en.navigation.discard);
  assert.equal(state.closed, 1); assert.equal(state.raw, '[]'); assert.equal(state.writes, 0); assert.equal(state.shares.length, 0);
});

test('bug invalid/non-array/malformed/read-failed histories retain all original bytes and typed input', async () => {
  const originals = ['{invalid', '{}', 'null', '42', '[null]', JSON.stringify([{ ...syntheticReport('synthetic-bad'), description: 42 }]),
    JSON.stringify([syntheticReport('synthetic-duplicate'), syntheticReport('synthetic-duplicate')]), '[]'];
  for (const original of originals) {
    const { state, ui } = bugFixture(original); if (original === '[]') state.failRead = true;
    await ui.input(catalog.en.ui.bug.describe, 'Synthetic retained draft'); await ui.press(catalog.en.ui.bug.saveLabel);
    assert.equal(state.raw, original); assert.equal(state.writes, 0); assert.equal(state.shares.length, 0);
    assert.equal(ui.find('TextInput', catalog.en.ui.bug.describe).props.value, 'Synthetic retained draft');
    assert.ok(ui.text.includes(catalog.en.ui.bug.failed)); ui.unmount();
  }
});

test('bug second-read conflict preserves external history without save or Share', async t => {
  const { state, storage, ui } = bugFixture(); t.after(ui.unmount);
  const external = JSON.stringify([syntheticReport('synthetic-external')]);
  storage.getItem = async () => { if (++state.reads === 2) state.raw = external; return state.raw; };
  await ui.input(catalog.en.ui.bug.describe, 'Synthetic conflict draft'); await ui.press(catalog.en.ui.bug.saveLabel);
  assert.equal(state.raw, external); assert.equal(state.writes, 0); assert.equal(state.shares.length, 0);
  assert.equal(ui.find('TextInput', catalog.en.ui.bug.describe).props.value, 'Synthetic conflict draft');
});

for (const failure of ['lost-ack', 'readback']) test(`bug ${failure} retry reconciles the same report ID and shares only after verified success`, async t => {
  const { state, storage, ui } = bugFixture(); t.after(ui.unmount); const c = catalog.en.ui.bug;
  const read = storage.getItem; let failReadback = false;
  storage.getItem = async key => { if (failReadback) { failReadback = false; throw Error('Synthetic unconfirmed readback'); } return read(key); };
  storage.setItem = async (_key, value) => {
    state.writes++; state.raw = value;
    if (failure === 'lost-ack') throw Error('Synthetic lost write ACK');
    failReadback = true;
  };
  await ui.input(c.describe, 'Synthetic retry report'); await ui.press(c.saveLabel);
  const id = JSON.parse(state.raw)[0].id;
  assert.equal(state.writes, 1); assert.equal(state.shares.length, 0); assert.ok(ui.text.includes(c.failed));
  await ui.press(c.saveLabel);
  assert.equal(state.writes, 1); assert.equal(JSON.parse(state.raw).length, 1); assert.equal(JSON.parse(state.raw)[0].id, id);
  assert.equal(state.shares.length, 1); assert.ok(ui.text.includes(c.saved));
});

test('bug history retains more than fifty entries and rejects capacity exhaustion without deletion', async () => {
  for (const count of [55, 1000]) {
    const reports = Array.from({ length: count }, (_, i) => syntheticReport('synthetic-retained-' + i));
    const original = JSON.stringify(reports), { state, ui } = bugFixture(original);
    await ui.input(catalog.en.ui.bug.describe, 'Synthetic newest report'); await ui.press(catalog.en.ui.bug.saveLabel);
    if (count === 55) {
      const saved = JSON.parse(state.raw); assert.equal(saved.length, 56); assert.deepEqual(saved.slice(1), reports);
    } else { assert.equal(state.raw, original); assert.equal(state.writes, 0); assert.equal(state.shares.length, 0); }
    ui.unmount();
  }
});

test('pending bug write fences duplicate submit/input and unmount suppresses late state and sharing', async () => {
  const { state, storage, ui } = bugFixture(); const c = catalog.en.ui.bug;
  await ui.input(c.describe, 'Synthetic pending report'); let release;
  storage.setItem = async (_key, value) => { state.writes++; await new Promise(resolve => { release = resolve; }); state.raw = value; };
  const save = ui.find('Pressable', c.saveLabel).props.onPress, input = ui.find('TextInput', c.describe).props.onChangeText;
  save(); save(); input('Must not replace pending report'); await ui.flush();
  assert.equal(state.writes, 1); assert.equal(ui.find('TextInput', c.describe).props.value, 'Synthetic pending report');
  ui.unmount(); release(); await ui.flush(); assert.equal(state.shares.length, 0); assert.equal(state.closed, 0);
  assert.equal(JSON.parse(state.raw).length, 1);
});
