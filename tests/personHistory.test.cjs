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
const dates = load('src/utils/interactionDates.ts');
const history = load('src/utils/personHistory.ts', { './interactionDates': dates });
const copy = load('src/strings/personHistory.en.ts').personHistoryEn;
const interaction = (id, date, summary = 'Synthetic ' + id) => ({ id, date, summary, source: 'manual' });

test('history sorts actual instants newest first, retains equal/unknown order and never mutates source', () => {
  const items = [interaction('legacy1', 'Just now'), interaction('old', '2026-01-01T09:00:00Z'),
    interaction('new', '2026-11-18T12:00:00+03:00'), interaction('same', '2026-11-18T09:00:00Z'), interaction('legacy2', 'Today')];
  const before = JSON.stringify(items), result = history.personHistory(items, []);
  assert.deepEqual(result.interactions.map(x => x.id), ['new', 'same', 'old', 'legacy1', 'legacy2']);
  result.interactions[0].summary = 'Changed copy';
  assert.equal(JSON.stringify(items), before);
});
test('completed history uses only actual completion timestamps, never creation or reminder time', () => {
  const completed = [{ id: 'missing', text: 'Synthetic', createdAt: '2099-01-01T00:00:00Z', reminderAt: '2099-01-02T00:00:00Z' },
    { id: 'done', text: 'Synthetic', createdAt: '2020-01-01T00:00:00Z', completedAt: '2026-11-18T10:00:00Z' },
    { id: 'invalid', text: 'Synthetic', createdAt: '2020-01-01T00:00:00Z', completedAt: 'Yesterday' }];
  assert.deepEqual(history.personHistory([], completed).completed.map(x => x.id), ['done', 'missing', 'invalid']);
  assert.equal(dates.interactionInstant(completed[0].completedAt), null);
});
test('Unicode title/text/source/date search is local and preserves every original field', () => {
  const items = [interaction('cafe', 'Today', 'Cafe\u0301 Türkçe'), interaction('other', '2026-01-01T00:00:00Z')];
  assert.deepEqual(history.personHistory(items, [], 'CAFÉ').interactions.map(x => x.id), ['cafe']);
  assert.equal(history.personHistory(items, [], 'TÜRKÇE').interactions.length, 1);
  assert.equal(history.personHistory(items, [], 'manual').interactions.length, 2);
  assert.equal(history.personHistory(items, [], '2026-01').interactions[0].id, 'other');
  assert.equal(history.personHistory(items, [], 'missing').interactions.length, 0);
  assert.equal(items[0].summary, 'Cafe\u0301 Türkçe');
});
test('invalid/rollover/relative dates are never converted into factual timestamps', () => {
  for (const value of ['2026-02-30T10:00:00Z', '2025-02-29T10:00:00Z', '1900-02-29T10:00:00Z',
    '2026-11-18T24:00:00Z', '2026-11-18T12:60:00Z', '2026-11-18T12:00:60Z',
    '2026-11-18T12:00:00', 'Today', '', 'x'.repeat(100)]) {
    assert.equal(dates.interactionInstant(value), null);
    assert.equal(dates.formatInteractionDate(value), 'Date not recorded');
  }
  assert.ok(Number.isFinite(dates.interactionInstant('2000-02-29T10:00:00Z')));
  assert.ok(Number.isFinite(dates.interactionInstant('2024-02-29T10:00:00.123456Z')));
});
test('latest dated interaction and global recent memory use dates rather than person/array order', () => {
  const old = interaction('old', '2026-01-01T00:00:00Z'), newest = interaction('new', '2026-11-18T10:00:00Z');
  const people = [{ id: 'first', interactions: [old] }, { id: 'second', interactions: [interaction('legacy', 'Today'), newest] }];
  assert.equal(history.latestDatedInteraction(people[1].interactions).id, 'new');
  const recent = history.recentPersonMemory(people);
  assert.equal(recent.person.id, 'second'); assert.equal(recent.interaction.id, 'new'); assert.equal(recent.dated, true);
  const unknown = history.recentPersonMemory([{ id: 'unknown', interactions: [interaction('legacy', 'Just now')] }]);
  assert.equal(unknown.dated, false); assert.equal(history.latestDatedInteraction([unknown.interaction]), null);
  assert.equal(history.recentPersonMemory([]), null);
});

function renderHistory(interactions, completed) {
  const slots = []; let cursor = 0, output;
  const react = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useMemo(callback) { cursor++; return callback(); },
  };
  const native = Object.fromEntries(['Pressable', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  native.StyleSheet = { create: value => value };
  const component = load('src/components/PersonHistory.tsx', {
    react: { __esModule: true, default: react, ...react }, 'react-native': native,
    '../utils/personHistory': history, '../utils/interactionDates': dates, '../strings/personHistory.en': { personHistoryEn: copy },
  }).PersonHistory;
  function render() { cursor = 0; output = component({ interactions, completed }); }
  function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes);
    return node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []; }
  render();
  return { render, get nodes() { return nodes(output); },
    text(value) { return nodes(output).some(node => node.type === 'Text' && node.props.children.includes(value)); },
    find(label) { const node = nodes(output).find(node => node.props?.accessibilityLabel === label); assert.ok(node, label); return node; } };
}
test('component exposes all older interactions and completed follow-ups in bounded increments without edit or data writes', () => {
  const items = Array.from({ length: 8 }, (_, i) => interaction('i' + i, '2026-11-18T10:00:00Z'));
  const completed = Array.from({ length: 7 }, (_, i) => ({ id: 'c' + i, text: 'Completed synthetic ' + i, createdAt: '', completedAt: 'Today' }));
  const original = JSON.stringify({ items, completed }), ui = renderHistory(items, completed);
  assert.equal(ui.text('Synthetic i7'), false); assert.equal(ui.text('Completed synthetic 6'), false);
  ui.find(copy.moreInteractions).props.onPress(); ui.render();
  ui.find(copy.moreCompleted).props.onPress(); ui.render();
  assert.ok(ui.text('Synthetic i7')); assert.ok(ui.text('Completed synthetic 6'));
  assert.ok(ui.text('Date not recorded')); assert.ok(ui.text('Original date label: Today'));
  assert.equal(JSON.stringify({ items, completed }), original);
});
test('component history search resets paging and exposes matching original content plus honest empty states', () => {
  const ui = renderHistory([interaction('first', 'Just now'), interaction('second', 'Today')], []);
  ui.find(copy.search).props.onChangeText('second'); ui.render();
  assert.equal(ui.text('Synthetic first'), false); assert.ok(ui.text('Synthetic second'));
  ui.find(copy.search).props.onChangeText('absent'); ui.render(); assert.ok(ui.text(copy.noMatches));
  const empty = renderHistory([], []); assert.ok(empty.text(copy.noInteractions)); assert.ok(empty.text(copy.noCompleted));
});
