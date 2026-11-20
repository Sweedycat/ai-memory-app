const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { catalog } = require('./helpers/featurePresentation.cjs');
const { bindNavigation } = require('./helpers/navigation.cjs');

// Real hook with synthetic React lifetime and native events; the import allowlist
// also prevents accidental draft storage or native authentication in this guard.
function guard(initial = {}, language = 'en') {
  const slots = [], effects = []; let cursor = 0, scheduled = [], dirty = false, alive = true, output;
  const counts = { saves: 0, discarded: 0, navigated: 0, back: 0 };
  const options = { dirty: true, revision: 'synthetic-v1',
    save: async () => { counts.saves++; return true; }, discard: () => { counts.discarded++; },
    onBack: () => { counts.back++; }, ...initial };
  const react = {
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value;
      return [slots[i], next => { assert.ok(alive, 'No state updates after unmount'); slots[i] = next; dirty = true; }]; },
    useCallback(callback) { cursor++; return callback; },
    useEffect(callback, deps) { const i = cursor++, prior = effects[i];
      if (!prior || deps.some((d, j) => !Object.is(d, prior.deps[j]))) scheduled.push(() => { prior?.cleanup?.(); effects[i] = { deps, cleanup: callback() }; }); },
  };
  function load(file, imports) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', code)(name => { assert.ok(name in imports, 'No storage/draft imports: ' + name); return imports[name]; }, module, module.exports);
    return module.exports;
  }
  const navigation = bindNavigation(load, react, {}, { useI18n: () => ({ copy: catalog[language] }) });
  function render() { cursor = 0; dirty = false; output = navigation.module.useUnsavedChanges(options); const run = scheduled; scheduled = []; run.forEach(callback => callback()); }
  render();
  const ui = {
    counts, alerts: navigation.alerts, c: catalog[language].navigation,
    exit() { output.requestExit(() => { counts.navigated++; }); },
    choose(label) { const button = navigation.alerts.at(-1).buttons.find(item => item.text === label); assert.ok(button); button.onPress(); },
    back() { return [...navigation.backs].reverse().some(callback => callback()); },
    update(next) { Object.assign(options, next); render(); },
    async flush() { for (let i = 0; i < 5; i++) { await new Promise(resolve => setImmediate(resolve)); if (alive && dirty) render(); } },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); alive = false; },
  };
  return ui;
}

for (const language of ['en', 'tr']) test(`exit dialog deduplicates, dismisses safely and requires explicit discard in ${language}`, async t => {
  const ui = guard({}, language); t.after(ui.unmount);
  ui.exit(); ui.exit(); assert.equal(ui.alerts.length, 1); assert.equal(ui.counts.navigated, 0);
  assert.equal(ui.alerts[0].title, ui.c.title); ui.alerts[0].options.onDismiss();
  ui.exit(); assert.equal(ui.alerts.length, 2); ui.choose(ui.c.stay); assert.equal(ui.counts.navigated, 0);
  ui.exit(); const discard = ui.alerts.at(-1).buttons.find(item => item.text === ui.c.discard).onPress;
  discard(); discard(); assert.equal(ui.counts.discarded, 1); assert.equal(ui.counts.navigated, 1); assert.equal(ui.counts.saves, 0);
});

for (const throws of [false, true]) test(`failed or thrown save retains editing and never navigates; throws=${throws}`, async t => {
  const ui = guard({ save: async () => { if (throws) throw Error('Synthetic save failure'); return false; } }); t.after(ui.unmount);
  ui.exit(); ui.choose(ui.c.saveExit); await ui.flush();
  assert.equal(ui.counts.navigated, 0); assert.equal(ui.counts.discarded, 0); assert.equal(ui.alerts.at(-1).title, ui.c.failedTitle);
  ui.update({ save: async () => true }); ui.exit(); ui.choose(ui.c.saveExit); await ui.flush(); assert.equal(ui.counts.navigated, 1);
});

test('changed revision during delayed save rejects stale navigation and duplicate Save callbacks', async t => {
  let resolve, saves = 0; const ui = guard({ save: () => { saves++; return new Promise(done => { resolve = done; }); } }); t.after(ui.unmount);
  ui.exit(); const save = ui.alerts.at(-1).buttons.find(item => item.text === ui.c.saveExit).onPress;
  save(); save(); ui.exit(); assert.equal(saves, 1); assert.equal(ui.alerts.length, 1);
  ui.update({ revision: 'synthetic-v2' }); resolve(true); await ui.flush();
  assert.equal(ui.counts.navigated, 0); assert.equal(ui.alerts.at(-1).title, ui.c.failedTitle);
});

test('unmount invalidates pending dialog and save callbacks without navigation or state updates', async () => {
  let resolve; const ui = guard({ save: () => new Promise(done => { resolve = done; }) });
  ui.exit(); const buttons = ui.alerts.at(-1).buttons; ui.choose(ui.c.saveExit); ui.unmount();
  for (const button of buttons) button.onPress(); resolve(true); await ui.flush();
  assert.equal(ui.counts.navigated, 0); assert.equal(ui.counts.discarded, 0);
});

test('clean form exits without warning and disabled hardware routes fall through', async t => {
  const ui = guard({ dirty: false }); t.after(ui.unmount); ui.exit(); assert.equal(ui.counts.navigated, 1); assert.equal(ui.alerts.length, 0);
  assert.equal(ui.back(), true); assert.equal(ui.counts.back, 1);
  ui.update({ enabled: false }); assert.equal(ui.back(), false);
});
