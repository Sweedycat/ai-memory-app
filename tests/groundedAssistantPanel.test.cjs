const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, imports = {}) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText)(
    name => { if (!(name in imports)) throw Error('Unexpected import ' + name); return imports[name]; }, module, module.exports);
  return module.exports;
}
const dates = load('src/utils/interactionDates.ts'), lifeModel = load('src/utils/lifeRecords.ts');
const assistant = load('src/utils/groundedAssistant.ts', { './interactionDates': dates, './lifeRecords': lifeModel });
const strings = load('src/strings/assistant.ts'), copy = strings.assistantEn;
const person = { id: 'synthetic-person', name: 'Synthetic Maya', role: 'Engineer', relationship: 'Synthetic context', notes: [],
  interactions: [{ id: 'synthetic-interaction', date: '2020-01-01T12:00:00.000Z', summary: 'Synthetic recorded interaction', source: 'manual' }],
  lastInteraction: 'Just now', followUp: { id: 'synthetic-follow', createdAt: '2020-01-01T12:00:00.000Z', reminderAt: '2020-01-02T12:00:00.000Z', text: 'Synthetic follow-up' } };
const responsibility = { id: 'synthetic-life', title: 'Synthetic inspection', dueDate: '2020-01-01', category: 'vehicle-inspection', notes: 'Synthetic life source', recurring: false, history: [] };

// Real answer engine/panel, mocked native elements/events and read-only hook.
function screen({ people = [], records = [], status = 'ready', locale = 'en' } = {}) {
  const slots = [], effects = [], listeners = new Set(), backs = new Set(), opened = [];
  let cursor = 0, dirty = false, scheduled = [], output, mounted = true, exits = 0, reloads = 0;
  const life = { records, status, busy: false, async reload() { reloads++; life.status = 'ready'; dirty = true; } };
  const react = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { assert.ok(mounted); slots[index] = typeof next === 'function' ? next(slots[index]) : next; dirty = true; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(callback, deps) { const index = cursor++, prior = effects[index]; if (!prior || deps.some((dep, i) => !Object.is(dep, prior.deps[i])))
      scheduled.push(() => { prior?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; }); },
  };
  const native = Object.fromEntries(['Pressable', 'SafeAreaView', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  native.StyleSheet = { create: value => value };
  native.AppState = { currentState: 'active', addEventListener: (_, callback) => { listeners.add(callback); return { remove() { listeners.delete(callback); } }; } };
  native.BackHandler = { addEventListener: (_, callback) => { backs.add(callback); return { remove() { backs.delete(callback); } }; } };
  const Panel = load('src/components/GroundedAssistantPanel.tsx', {
    react: { __esModule: true, default: react, ...react }, 'react-native': native,
    '../hooks/useLifeRecords': { useLifeRecords: () => life }, '../utils/groundedAssistant': assistant,
    '../strings/assistant': strings, '../utils/screenInsets': { SCREEN_TOP_PADDING: 24 },
  }).GroundedAssistantPanel;
  function render() { cursor = 0; dirty = false; output = Panel({ people, locale, onBack: () => { exits++; },
    onOpenPerson: id => opened.push(['person', id]), onOpenLife: id => opened.push(['life', id]) });
    const pending = scheduled; scheduled = []; pending.forEach(run => run()); }
  function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); if (!node || typeof node !== 'object') return []; return [node, ...nodes(node.props?.children)]; }
  render();
  const ui = {
    opened, get exits() { return exits; }, get reloads() { return reloads; }, get nodes() { return nodes(output); },
    text(value) { return nodes(output).some(node => node.type === 'Text' && node.props.children.flat().includes(value)); },
    find(type, label) { const node = nodes(output).find(node => node.type === type && node.props.accessibilityLabel === label); assert.ok(node, 'Missing ' + label); return node; },
    async flush() { for (let i = 0; i < 6; i++) { await new Promise(resolve => setImmediate(resolve)); if (mounted && dirty) render(); } },
    async press(label) { const node = ui.find('Pressable', label); assert.equal(node.props.disabled, false); node.props.onPress(); await ui.flush(); },
    async input(value) { ui.find('TextInput', strings.assistantCopy(locale).personQuery).props.onChangeText(value); await ui.flush(); },
    back() { [...backs].forEach(callback => callback()); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); mounted = false; },
  };
  return ui;
}

test('daily sources show exact saved text and navigate to the correct person/responsibility IDs', async t => {
  const ui = screen({ people: [person], records: [responsibility] }); t.after(ui.unmount); await ui.flush();
  assert.ok(ui.text(copy.scope)); assert.ok(ui.text(person.followUp.text)); assert.ok(ui.text(responsibility.notes));
  await ui.press(copy.openPerson); await ui.press(copy.openLife);
  assert.deepEqual(ui.opened, [['person', person.id], ['life', responsibility.id]]);
  ui.back(); assert.equal(ui.exits, 1);
});

test('failed responsibilities never become a false empty answer; people-only contact question remains usable', async t => {
  const ui = screen({ people: [person], status: 'error' }); t.after(ui.unmount); await ui.flush();
  assert.ok(ui.text(copy.statuses.unavailable)); assert.ok(ui.text(copy.notices['life-records-unavailable']));
  assert.equal(ui.text(copy.statuses.none), false);
  await ui.press(copy.questions.contact); assert.ok(ui.text(person.followUp.text));
  await ui.press(copy.questions.today); await ui.press(copy.reload); assert.equal(ui.reloads, 1); assert.ok(ui.text(person.followUp.text));
});

test('same-name ambiguity requires explicit selection and changing the query clears the previous person', async t => {
  const other = { ...person, id: 'synthetic-other', role: 'Designer', interactions: [] };
  const ui = screen({ people: [person, other] }); t.after(ui.unmount); await ui.flush();
  await ui.press(copy.questions['last-interaction']); await ui.input('maya');
  assert.ok(ui.text(copy.statuses.ambiguous)); assert.equal(ui.text(person.interactions[0].summary), false);
  await ui.press('Synthetic Maya · Engineer · Synthetic context (1)'); assert.ok(ui.text(person.interactions[0].summary));
  await ui.input('missing'); assert.ok(ui.text(copy.notices['person-not-found'])); assert.equal(ui.text(person.interactions[0].summary), false);
});

test('empty and undated results visibly distinguish unknown from a confirmed lack of matching records', async t => {
  const empty = screen(); t.after(empty.unmount); await empty.flush(); assert.ok(empty.text(copy.statuses.none));
  const ui = screen({ people: [{ ...person, followUp: { ...person.followUp, reminderAt: undefined },
    interactions: [{ ...person.interactions[0], date: 'Yesterday' }] }] }); t.after(ui.unmount); await ui.flush();
  assert.ok(ui.text(copy.statuses.unknown)); assert.ok(ui.text(copy.notices['follow-up-dates-missing']));
  await ui.press(copy.questions.commitments); assert.ok(ui.text(copy.notices['follow-ups-not-verified-promises']));
  await ui.press(copy.questions['last-interaction']); await ui.input('maya');
  assert.ok(ui.text(copy.statuses.unknown)); assert.ok(ui.text(copy.missingDate)); assert.ok(ui.text(person.interactions[0].summary));
});

test('sources reveal in bounded batches and Turkish question/notice catalogs cover the same keys', async t => {
  const people = Array.from({ length: 35 }, (_, i) => ({ ...person, id: 'synthetic-' + i }));
  const ui = screen({ people }); t.after(ui.unmount); await ui.flush();
  assert.equal(ui.nodes.filter(node => node.props.accessibilityLabel === copy.openPerson).length, 30);
  await ui.press(copy.showMore); assert.equal(ui.nodes.filter(node => node.props.accessibilityLabel === copy.openPerson).length, 35);
  assert.deepEqual(Object.keys(strings.assistantTr.notices), Object.keys(copy.notices));
  assert.deepEqual(Object.keys(strings.assistantTr.questions), Object.keys(copy.questions));
  const tr = screen({ locale: 'tr-TR' }); t.after(tr.unmount); await tr.flush();
  assert.ok(tr.text(strings.assistantTr.title)); await tr.press(strings.assistantTr.questions['last-interaction']);
  assert.ok(tr.text(strings.assistantTr.notices['person-query-required']));
});
