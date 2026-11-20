const { createPresentation } = require('./helpers/featurePresentation.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, imports = {}) {
  const local = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText)(
    name => { if (!(name in imports)) throw Error('Unexpected import: ' + name); return imports[name]; }, local, local.exports);
  return local.exports;
}
const model = load('src/utils/lifeRecords.ts');
const strings = load('src/strings/lifeAdmin.ts');
const copy = strings.lifeAdminEn;
const record = { id: 'synthetic-life', title: 'Synthetic insurance', category: 'insurance', dueDate: '2026-02-14',
  notes: 'Synthetic policy note', recurring: true, history: [] };

// Real panel handlers and date model; native elements/lifecycle and persistence
// adapter are mocked. These tests make no Android rendering/durability claim.
function screen({ records = [], createId = async () => 'new-synthetic', locale = 'en', saveResult = true, initialRecordId } = {}) {
  const slots = [], effects = [], backs = new Set(), listeners = new Set(), calls = [];
  let cursor = 0, dirty = false, mounted = true, scheduled = [], output, exits = 0;
  const store = { records, status: 'ready', busy: false, error: null,
    async save(next, base) { calls.push(['save', next, base]); if (!saveResult) { store.status = 'error'; store.error = 'save'; dirty = true; return false; }
      store.records = [...store.records.filter(item => item.id !== next.id), next]; dirty = true; return true; },
    async remove(base) { calls.push(['remove', base]); store.records = store.records.filter(item => item.id !== base.id); dirty = true; return true; },
    async complete(base, nextDate) { calls.push(['complete', base, nextDate]); return true; },
    async reload() { calls.push(['reload']); store.status = 'ready'; store.error = null; dirty = true; },
  };
  const react = {
    createElement(type, props, ...children) { return typeof type === 'function' ? type({ ...props, children }) : { type, props: { ...props, children } }; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { assert.ok(mounted, 'No late panel state update'); slots[index] = typeof next === 'function' ? next(slots[index]) : next; dirty = true; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(callback, deps) { const index = cursor++, old = effects[index];
      if (!old || deps.some((dep, i) => !Object.is(dep, old.deps[i]))) scheduled.push(() => { old?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; }); },
  };
  const native = Object.fromEntries(['Pressable', 'SafeAreaView', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  native.StyleSheet = { create: value => value };
  native.AppState = { currentState: 'active', addEventListener: (_, callback) => { listeners.add(callback); return { remove() { listeners.delete(callback); } }; } };
  native.BackHandler = { addEventListener: (_, callback) => { backs.add(callback); return { remove() { backs.delete(callback); } }; } };
  const presentation = createPresentation(load, react, native);
  const Component = load('src/components/LifeAdminPanel.tsx', {
    ...presentation.imports,
    react: { __esModule: true, default: react, ...react }, 'react-native': native,
    '../hooks/useLifeRecords': { useLifeRecords: () => store }, '../utils/lifeRecords': model,
    '../strings/lifeAdmin': strings, '../utils/screenInsets': { SCREEN_TOP_PADDING: 24 },
  }).LifeAdminPanel;
  function render() { cursor = 0; dirty = false; output = Component({ onBack: () => { exits++; }, createId, locale, initialRecordId });
    const pending = scheduled; scheduled = []; pending.forEach(run => run()); }
  function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children)]; }
  render();
  const ui = {
    store, calls, get exits() { return exits; }, get nodes() { return nodes(output); },
    has(label) { return nodes(output).some(node => node.props.accessibilityLabel === label); },
    text(value) { return nodes(output).some(node => node.type === 'Text' && node.props.children.flat().includes(value)); },
    find(type, label) { const found = nodes(output).find(node => node.type === type && node.props.accessibilityLabel === label);
      assert.ok(found, 'Missing ' + type + ': ' + label); return found; },
    async flush() { for (let i = 0; i < 8; i++) { await new Promise(resolve => setImmediate(resolve)); if (mounted && dirty) render(); } },
    async press(label) { const node = ui.find('Pressable', label); assert.ok(!node.props.disabled, 'Enabled: ' + label); node.props.onPress(); await ui.flush(); },
    async input(label, value) { ui.find('TextInput', label).props.onChangeText(value); await ui.flush(); },
    async back() { [...backs].forEach(callback => callback()); await ui.flush(); },
    invalidate() { dirty = true; },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); mounted = false; },
  };
  return ui;
}

test('new record needs explicit valid date; save retains exact user fields and never invents a date', async t => {
  const ui = screen(); t.after(ui.unmount);
  assert.equal(ui.calls.length, 0); assert.ok(ui.text(copy.scope));
  await ui.press(copy.add);
  assert.equal(ui.find('TextInput', copy.date).props.value, '');
  await ui.input(copy.name, 'Synthetic vehicle inspection'); await ui.input(copy.date, '2027-02-30');
  await ui.press(copy.save); assert.equal(ui.calls.length, 0); assert.ok(ui.text(copy.invalid));
  await ui.input(copy.date, '2027-02-28'); await ui.input(copy.notes, 'Fabricated inspection details');
  await ui.press(copy.categories['vehicle-inspection']); await ui.press(copy.save);
  assert.equal(ui.calls.length, 1); const [, next, base] = ui.calls[0]; assert.equal(base, null);
  assert.equal(next.category, 'vehicle-inspection'); assert.equal(next.dueDate, '2027-02-28');
  assert.equal(next.notes, 'Fabricated inspection details'); assert.deepEqual(next.history, []); assert.ok(ui.text(copy.saved));
});

test('agenda search, readable detail and completion history use real stored records', async t => {
  const ui = screen({ records: [record, { ...record, id: 'other', title: 'Other synthetic', notes: 'Different' }] }); t.after(ui.unmount);
  await ui.input(copy.search, 'policy'); await ui.press(`${copy.overdue} (1)`);
  assert.equal(ui.nodes.filter(node => node.type === 'Pressable' && node.props.accessibilityLabel?.includes(', 2026-')).length, 1);
  await ui.press(`${record.title}, ${record.dueDate}`);
  assert.ok(ui.text(record.notes)); assert.ok(ui.text(copy.noHistory));
  assert.equal(ui.calls.length, 0);
});

test('recurrence only uses an explicitly confirmed future date or explicit completion without renewal', async t => {
  const ui = screen({ records: [record] }); t.after(ui.unmount);
  await ui.press(`${copy.overdue} (1)`); await ui.press(`${record.title}, ${record.dueDate}`); await ui.press(copy.finish);
  assert.equal(ui.find('TextInput', copy.nextDate).props.value, ''); assert.equal(ui.calls.length, 0);
  await ui.input(copy.nextDate, '2026-02-15'); await ui.press(copy.renew);
  assert.ok(ui.text(copy.invalidNext)); assert.equal(ui.calls.length, 0);
  await ui.input(copy.nextDate, '2099-03-01'); await ui.press(copy.renew);
  assert.equal(ui.calls[0][0], 'complete'); assert.equal(ui.calls[0][2], '2099-03-01');
  await ui.press(`${record.title}, ${record.dueDate}`); await ui.press(copy.finish); await ui.press(copy.finishOnly);
  assert.equal(ui.calls[1][2], null);
});

test('delete waits for confirmation, second Back cancels it, and deletion targets the original revision', async t => {
  const ui = screen({ records: [record] }); t.after(ui.unmount);
  await ui.press(`${copy.overdue} (1)`); await ui.press(`${record.title}, ${record.dueDate}`); await ui.press(copy.remove);
  assert.equal(ui.calls.length, 0); await ui.back(); assert.equal(ui.has(copy.confirmDelete), false);
  await ui.press(copy.remove); await ui.press(copy.confirmDelete);
  assert.deepEqual(ui.calls, [['remove', record]]); assert.deepEqual(ui.store.records, []);
});

test('an old delete confirmation cannot follow completion into a newly created unrelated record', async t => {
  const ui = screen({ records: [record] }); t.after(ui.unmount);
  await ui.press(`${copy.overdue} (1)`); await ui.press(`${record.title}, ${record.dueDate}`);
  await ui.press(copy.remove); assert.ok(ui.has(copy.confirmDelete));
  await ui.press(copy.finish); assert.equal(ui.has(copy.confirmDelete), false);
  await ui.press(copy.finishOnly); assert.equal(ui.has(copy.confirmDelete), false);
  await ui.press(copy.add); await ui.input(copy.name, 'Unrelated synthetic responsibility'); await ui.input(copy.date, '2099-04-01');
  await ui.press(copy.save); assert.equal(ui.has(copy.confirmDelete), false);
  assert.equal(ui.calls.some(call => call[0] === 'remove'), false);
  assert.equal(ui.store.records.some(item => item.title === 'Unrelated synthetic responsibility'), true);
  await ui.press(copy.remove); await ui.press(copy.edit); assert.equal(ui.has(copy.confirmDelete), false);
});

test('search matches visible English and Turkish category labels', async t => {
  for (const [locale, label] of [['en', 'Insurance renewal'], ['tr-TR', 'sigorta']]) {
    const ui = screen({ records: [{ ...record, title: 'Synthetic category check', notes: '' }], locale }); t.after(ui.unmount);
    const localized = strings.lifeAdminCopy(locale);
    await ui.input(localized.search, label); await ui.press(`${localized.overdue} (1)`);
    assert.ok(ui.has(`Synthetic category check, ${record.dueDate}`));
  }
});

test('failed save and reload preserve unsaved draft; replacing draft with saved content requires confirmation', async t => {
  const ui = screen({ records: [record], saveResult: false }); t.after(ui.unmount);
  await ui.press(`${copy.overdue} (1)`); await ui.press(`${record.title}, ${record.dueDate}`); await ui.press(copy.edit);
  await ui.input(copy.notes, 'Unsaved synthetic changes'); await ui.press(copy.save);
  assert.ok(ui.text(copy.saveError)); assert.equal(ui.find('TextInput', copy.notes).props.value, 'Unsaved synthetic changes');
  assert.ok(ui.find('Pressable', copy.save).props.disabled);
  ui.store.records = [{ ...record, notes: 'Different saved content' }];
  await ui.press(copy.reload); assert.equal(ui.find('TextInput', copy.notes).props.value, 'Unsaved synthetic changes');
  await ui.press(copy.review); assert.ok(ui.text(copy.reviewWarning));
  await ui.press(copy.stay); assert.equal(ui.find('TextInput', copy.notes).props.value, 'Unsaved synthetic changes');
  await ui.press(copy.review); await ui.press(copy.discard); assert.ok(ui.text('Different saved content'));
});

test('dirty form Back requires discard; staying preserves text and no write occurs', async t => {
  const ui = screen(); t.after(ui.unmount); await ui.press(copy.add); await ui.input(copy.name, 'Synthetic draft');
  await ui.back(); assert.ok(ui.text(copy.discardWarning)); await ui.back(); assert.equal(ui.has(copy.discard), false);
  assert.equal(ui.find('TextInput', copy.name).props.value, 'Synthetic draft');
  await ui.back(); await ui.press(copy.discard); assert.equal(ui.has(copy.save), false); assert.equal(ui.calls.length, 0);
  await ui.back(); assert.equal(ui.exits, 1);
});

test('late ID generation after unmount cannot create an editor; load failures block mutation but permit read retry', async () => {
  let release; const ui = screen({ createId: () => new Promise(resolve => { release = resolve; }) });
  await ui.press(copy.add); ui.unmount(); release('late-synthetic'); await ui.flush(); assert.equal(ui.calls.length, 0);
  const blocked = screen(); try {
    blocked.store.status = 'error'; blocked.store.error = 'load'; blocked.invalidate(); await blocked.flush();
    assert.ok(blocked.text(copy.loadError)); assert.ok(blocked.find('Pressable', copy.add).props.disabled);
    await blocked.press(copy.reload); assert.deepEqual(blocked.calls, [['reload']]);
  } finally { blocked.unmount(); }
});

test('Turkish catalog covers the same workflow and category keys; unsupported locales use English', async t => {
  assert.deepEqual(Object.keys(strings.lifeAdminTr), Object.keys(copy));
  assert.deepEqual(Object.keys(strings.lifeAdminTr.categories), [...model.CATEGORIES]);
  assert.equal(strings.lifeAdminCopy('fr-FR'), copy);
  const ui = screen({ locale: 'tr-TR' }); t.after(ui.unmount);
  assert.ok(ui.text(strings.lifeAdminTr.title)); await ui.press(strings.lifeAdminTr.add);
  assert.equal(ui.find('TextInput', strings.lifeAdminTr.date).props.value, '');
});

test('assistant source navigation opens only the requested saved responsibility and missing IDs invent nothing', async t => {
  const ui = screen({ records: [record], initialRecordId: record.id }); t.after(ui.unmount); await ui.flush();
  assert.ok(ui.text(record.notes)); assert.ok(ui.has(copy.edit)); assert.equal(ui.calls.length, 0);
  const missing = screen({ records: [record], initialRecordId: 'missing-synthetic' }); t.after(missing.unmount); await missing.flush();
  assert.ok(missing.text(copy.missing)); assert.equal(missing.has(copy.edit), false); assert.equal(missing.calls.length, 0);
});
