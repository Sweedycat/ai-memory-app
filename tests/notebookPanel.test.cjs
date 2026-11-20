const { createPresentation, catalog } = require('./helpers/featurePresentation.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const h = require('./helpers/notebookRuntime.cjs');
const { createNotebookLifecycle } = h.load('notebookLifecycle');
const editorModule = h.load('notebookEditor');
const navigationModel = h.load('notebookNavigation');
function load(file, imports = {}) {
  const local = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText)(
    name => { if (!(name in imports)) throw Error('Unexpected import: ' + name); return imports[name]; }, local, local.exports);
  return local.exports;
}
const copy = load('src/strings/notebook.en.ts').notebookEn;
const navigation = catalog.en.navigation;

// Runs the real panel hooks/controllers with host SQLite/AES. Native elements,
// events and FlatList expansion are mocked; this is not a device rendering test.
function screen(lifecycle, { state = 'active', createId = async () => 'new-synthetic-note' } = {}) {
  const slots = [], effects = [];
  const appListeners = new Set(), backListeners = new Set();
  let cursor = 0, dirty = false, scheduled = [], output, mounted = true, backs = 0;
  const appState = { currentState: state, addEventListener: (_, callback) => {
    appListeners.add(callback); return { remove() { appListeners.delete(callback); } };
  } };
  const react = {
    createElement(type, props, ...children) { return typeof type === 'function' ? type({ ...props, children }) : { type, props: { ...props, children } }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => {
        assert.ok(mounted, 'No late panel state update');
        slots[index] = typeof next === 'function' ? next(slots[index]) : next; dirty = true;
      }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(callback, deps) {
      const index = cursor++, old = effects[index];
      if (!old || deps.some((dep, i) => !Object.is(dep, old.deps[i]))) scheduled.push(() => {
        old?.cleanup?.(); effects[index] = { deps, cleanup: callback() };
      });
    },
  };
  const native = Object.fromEntries(['FlatList', 'Pressable', 'SafeAreaView', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  native.AppState = appState; native.StyleSheet = { create: value => value };
  native.BackHandler = { addEventListener: (_, callback) => {
    backListeners.add(callback); return { remove() { backListeners.delete(callback); } };
  } };
  const presentation = createPresentation(load, react, native);
  const component = load('src/components/NotebookPanel.tsx', {
    ...presentation.imports,
    react: { __esModule: true, default: react, ...react }, 'react-native': native,
    '../utils/notebookEditor': editorModule, '../utils/personalNotebook': h.model,
    '../utils/notebookNavigation': navigationModel, '../utils/screenInsets': { SCREEN_TOP_PADDING: 24 },
    '../strings/notebook.en': { notebookEn: copy }, './PersonalNoteEditor': { __esModule: true, default: 'PersonalNoteEditor' },
  }).NotebookPanel;
  const props = { lifecycle, createId, now: () => '2026-11-18T12:00:00.000Z', onBack: () => { backs++; } };
  function render() {
    cursor = 0; dirty = false;
    output = component(props);
    const pending = scheduled; scheduled = []; pending.forEach(run => run());
  }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== 'object') return [];
    const extra = node.type === 'FlatList' ? node.props.data.length
      ? node.props.data.map((item, index) => node.props.renderItem({ item, index })) : [node.props.ListEmptyComponent] : [];
    return [node, ...nodes(node.props?.children), ...nodes(extra)];
  }
  render();
  return {
    get nodes() { return nodes(output); }, get backs() { return backs; },
    find(type, label) { const found = nodes(output).find(node => node.type === type && (!label || node.props.accessibilityLabel === label));
      assert.ok(found, 'Missing ' + (label || type)); return found; },
    has(label) { return nodes(output).some(node => node.props?.accessibilityLabel === label); },
    row(title) { const found = nodes(output).find(node => node.type === 'Pressable' && nodes(node.props.children)
      .some(child => child.type === 'Text' && child.props.children.includes(title)));
      assert.ok(found, 'Missing note row'); return found; },
    text(value) { return nodes(output).some(node => node.type === 'Text' && node.props.children.includes(value)); },
    async flush() { for (let i = 0; i < 12; i++) { await new Promise(resolve => setImmediate(resolve)); if (mounted && dirty) render(); } },
    background() { appState.currentState = 'background'; [...appListeners].forEach(callback => callback('background')); },
    foreground() { appState.currentState = 'active'; [...appListeners].forEach(callback => callback('active')); },
    back() { for (const callback of [...backListeners].reverse()) if (callback()) return true; return false; },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); mounted = false; },
  };
}

test('Notebook opens without data writes; searchable readable note details expose dates and full body without Edit', async t => {
  const f = await h.fixture(t), seed = await f.open();
  await seed.getSession().save(h.note, null);
  await seed.getSession().save({ ...h.note, id: 'other', title: 'Other synthetic note', body: 'Other content' }, null);
  seed.close(); const before = JSON.stringify(await f.database.read());
  const lifecycle = createNotebookLifecycle(f.open), ui = screen(lifecycle); await ui.flush();
  assert.equal(JSON.stringify(await f.database.read()), before);
  ui.find('TextInput', copy.search).props.onChangeText('TÜRKÇE'); await ui.flush();
  assert.equal(ui.find('FlatList').props.data.length, 1);
  ui.row(h.note.title).props.onPress(); await ui.flush();
  assert.ok(ui.text(h.note.body));
  assert.ok(ui.nodes.some(node => node.type === 'Text' && String(node.props.children).includes('Created:')));
  assert.equal(ui.find('Pressable', copy.edit).props.disabled, false);
  ui.back(); await ui.flush(); assert.equal(ui.backs, 0);
  ui.unmount();
});

test('new-note editor connects to encrypted checkpoint, recovery comparison and explicitly confirmed apply', async t => {
  const f = await h.fixture(t), lifecycle = createNotebookLifecycle(f.open), ui = screen(lifecycle); await ui.flush();
  ui.find('Pressable', copy.newNote).props.onPress(); await ui.flush();
  const child = ui.find('PersonalNoteEditor');
  child.props.editor.change({ title: h.note.title, body: h.note.body });
  await child.props.editor.checkpoint(); child.props.onClose(); await ui.flush();
  assert.equal(ui.find('Pressable', copy.newNote).props.disabled, true);
  assert.equal((await f.database.read()).active, null);
  ui.find('Pressable', copy.review).props.onPress(); await ui.flush();
  assert.ok(ui.text(copy.encryptedSource)); assert.ok(ui.text(h.note.body));
  ui.find('Pressable', copy.saveRecovery).props.onPress(); await ui.flush();
  assert.equal((await f.database.read()).active, null);
  ui.find('Pressable', copy.confirmSave).props.onPress(); await ui.flush();
  assert.equal(lifecycle.get().getSession().snapshot()[0].body, h.note.body);
  assert.equal(ui.find('Pressable', copy.newNote).props.disabled, false);
  ui.unmount();
});

test('deletion is confirmed, preserves unrelated notes and stale confirmation cannot delete a newer revision', async t => {
  const f = await h.fixture(t), seed = await f.open();
  await seed.getSession().save(h.note, null);
  await seed.getSession().save({ ...h.note, id: 'other', title: 'Other synthetic' }, null); seed.close();
  const lifecycle = createNotebookLifecycle(f.open), ui = screen(lifecycle); await ui.flush();
  ui.row(h.note.title).props.onPress(); await ui.flush();
  ui.find('Pressable', copy.delete).props.onPress(); await ui.flush();
  const newer = await f.open(); await newer.getSession().save({ ...h.note, body: 'Newer saved content' }, h.note); newer.close();
  const before = JSON.stringify(await f.database.read());
  ui.find('Pressable', copy.confirmDelete).props.onPress(); await ui.flush();
  assert.ok(ui.text(copy.unavailable)); assert.equal(JSON.stringify(await f.database.read()), before);
  ui.find('Pressable', copy.reopen).props.onPress(); await ui.flush();
  ui.find('Pressable', copy.review).props.onPress(); await ui.flush();
  assert.ok(ui.text(copy.conflict)); assert.equal(ui.has(copy.saveRecovery), false);
  ui.find('Pressable', copy.discardRecovery).props.onPress(); await ui.flush();
  assert.equal(JSON.stringify(await f.database.read()), before);
  ui.find('Pressable', copy.confirmDiscard).props.onPress(); await ui.flush();
  assert.equal(lifecycle.get().getSession().snapshot()[0].body, 'Newer saved content');
  assert.equal(lifecycle.get().getSession().snapshot().length, 2);
  ui.row(h.note.title).props.onPress(); await ui.flush();
  ui.find('Pressable', copy.delete).props.onPress(); await ui.flush();
  ui.find('Pressable', copy.confirmDelete).props.onPress(); await ui.flush();
  assert.deepEqual(lifecycle.get().getSession().snapshot().map(note => note.id), ['other']); ui.unmount();
});

test('interrupted delete is shown as a removal and never applied before recovery confirmation', async t => {
  const f = await h.fixture(t), seed = await f.open(); await seed.getSession().save(h.note, null);
  const replace = f.database.replace;
  f.database.replace = async (expected, next) => { if (next.draft === null) throw Error('Synthetic interruption'); return replace(expected, next); };
  await assert.rejects(seed.getSession().remove(h.note.id, h.note)); seed.close(); f.database.replace = replace;
  const lifecycle = createNotebookLifecycle(f.open), ui = screen(lifecycle); await ui.flush();
  ui.find('Pressable', copy.review).props.onPress(); await ui.flush();
  assert.ok(ui.text(h.note.title)); assert.ok(ui.text(copy.missing));
  assert.equal(lifecycle.get().getSession().snapshot().length, 1);
  ui.find('Pressable', copy.saveRecovery).props.onPress(); await ui.flush();
  ui.find('Pressable', copy.confirmSave).props.onPress(); await ui.flush();
  assert.equal(lifecycle.get().getSession().snapshot().length, 0); ui.unmount();
});

test('background clears notes/query/editor and requires explicit reopening; a late ID cannot create an editor', async t => {
  const f = await h.fixture(t), lifecycle = createNotebookLifecycle(f.open);
  let release;
  const ui = screen(lifecycle, { createId: () => new Promise(resolve => { release = resolve; }) }); await ui.flush();
  ui.find('Pressable', copy.newNote).props.onPress(); await ui.flush();
  ui.background(); await ui.flush();
  release('late-synthetic-note'); await ui.flush();
  assert.equal(ui.nodes.some(node => node.type === 'PersonalNoteEditor'), false);
  assert.equal(ui.has(copy.search), false); assert.throws(() => lifecycle.get());
  ui.foreground(); await ui.flush(); assert.equal(ui.has(copy.search), false);
  ui.find('Pressable', copy.reopen).props.onPress(); await ui.flush();
  assert.equal(ui.has(copy.search), true); ui.unmount();
});

test('background/unmount during opening never publishes late notes; initial background does not open', async t => {
  const f = await h.fixture(t); let release, opens = 0;
  const lifecycle = createNotebookLifecycle(async () => { opens++; await new Promise(resolve => { release = resolve; }); return f.open(); });
  const ui = screen(lifecycle); await ui.flush(); ui.unmount(); release(); await ui.flush();
  assert.throws(() => lifecycle.get());
  const inactive = screen(createNotebookLifecycle(async () => { opens++; return f.open(); }), { state: 'background' });
  await inactive.flush(); assert.equal(opens, 1); assert.equal(inactive.has(copy.search), false); inactive.unmount();
});

test('corrupt reads expose only recovery-safe error and never reset or overwrite original bytes', async t => {
  const f = await h.fixture(t); f.raw.prepare("UPDATE notebook_state SET active = 'invalid' WHERE id = 1").run();
  const before = fs.readFileSync(f.filename), ui = screen(createNotebookLifecycle(f.open)); await ui.flush();
  assert.ok(ui.text(copy.unavailable)); assert.equal(ui.has(copy.newNote), false);
  ui.find('Pressable', copy.reopen).props.onPress(); await ui.flush();
  assert.deepEqual(fs.readFileSync(f.filename), before); ui.unmount();
});

test('memory-only recovery cannot be lost through an unconfirmed panel Back action', async t => {
  const f = await h.fixture(t), w = await f.open(), replace = f.database.replace;
  f.database.replace = async () => { throw Error('Synthetic full disk before staging'); };
  await assert.rejects(w.getSession().save(h.note, null)); f.database.replace = replace;
  const ui = screen(createNotebookLifecycle(async () => w)); await ui.flush();
  ui.find('Pressable', copy.reopen).props.onPress(); await ui.flush();
  assert.equal(w.getRecovery().durable, false);
  ui.back(); await ui.flush(); assert.equal(ui.backs, 0); ui.find('Pressable', navigation.discard);
  ui.back(); await ui.flush(); assert.equal(ui.backs, 0);
  ui.back(); await ui.flush(); ui.find('Pressable', navigation.discard).props.onPress(); await ui.flush();
  assert.equal(ui.backs,0);ui.find('Pressable',copy.confirmDiscard).props.onPress();await ui.flush();
  assert.equal(ui.backs, 1);assert.equal(w.getRecovery().status,'none');ui.unmount();
});

test('failed deletion clears private UI but preserves exit confirmation and recoverable in-memory intent', async t => {
  const f = await h.fixture(t), seed = await f.open(); await seed.getSession().save(h.note, null); seed.close();
  const lifecycle = createNotebookLifecycle(f.open), ui = screen(lifecycle); await ui.flush();
  ui.row(h.note.title).props.onPress(); await ui.flush();
  ui.find('Pressable', copy.delete).props.onPress(); await ui.flush();
  const before = JSON.stringify(await f.database.read()), replace = f.database.replace;
  f.database.replace = async () => { throw Error('Synthetic full disk before staging'); };
  ui.find('Pressable', copy.confirmDelete).props.onPress(); await ui.flush();
  assert.ok(ui.text(copy.unavailable)); assert.equal(ui.has(copy.search), false);
  ui.back(); await ui.flush(); assert.equal(ui.backs, 0);
  assert.ok(ui.text(copy.uncertainCloseWarning)); ui.find('Pressable', navigation.discard);
  ui.find('Pressable', navigation.stay).props.onPress(); await ui.flush(); assert.equal(ui.backs, 0);
  f.database.replace = replace;
  ui.find('Pressable', copy.reopen).props.onPress(); await ui.flush();
  assert.equal(lifecycle.get().getRecovery().durable, false);
  assert.deepEqual(lifecycle.get().getRecovery().candidate, []);
  assert.equal(JSON.stringify(await f.database.read()), before);
  ui.back(); await ui.flush(); ui.find('Pressable', navigation.discard).props.onPress();await ui.flush();
  assert.equal(ui.backs,0);ui.find('Pressable',copy.confirmDiscard).props.onPress();await ui.flush();
  assert.equal(ui.backs, 1);assert.equal(JSON.stringify(await f.database.read()),before);ui.unmount();
});

test('production Notebook flag stays off and protects both route and entry point', () => {
  const app = fs.readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  const boundary = fs.readFileSync(path.join(__dirname, '../src/components/NotebookBoundary.tsx'), 'utf8');
  assert.match(boundary, /NOTEBOOK_PRODUCTION_ENABLED = false/);
  assert.match(app, /screen === 'notebook' && NOTEBOOK_PRODUCTION_ENABLED && notebookLifecycle/);
  assert.match(app, /NOTEBOOK_PRODUCTION_ENABLED && notebookLifecycle && <OutlineAction label=\{c.notebookTitle\}/);
});

test('memory-only save-and-exit waits for review, confirmation and persistence; failure retains recovery for retry',async t=>{
  const f=await h.fixture(t),w=await f.open(),replace=f.database.replace;
  f.database.replace=async()=>{throw Error('Synthetic staging failure');};await assert.rejects(w.getSession().save(h.note,null));f.database.replace=replace;
  const ui=screen(createNotebookLifecycle(async()=>w));await ui.flush();
  ui.find('Pressable',copy.reopen).props.onPress();await ui.flush();
  ui.back();await ui.flush();ui.find('Pressable',navigation.saveExit).props.onPress();await ui.flush();
  assert.ok(ui.text(copy.memorySource));assert.ok(ui.text(h.note.body));assert.equal(ui.backs,0);assert.equal((await f.database.read()).active,null);
  f.database.replace=async()=>{throw Error('Synthetic retry full disk');};
  const confirm=ui.find('Pressable',copy.confirmSave).props.onPress;confirm();confirm();await ui.flush();
  assert.equal(ui.backs,0);assert.ok(ui.text(copy.unavailable));assert.equal((await f.database.read()).active,null);
  f.database.replace=replace;ui.back();await ui.flush();ui.find('Pressable',navigation.saveExit).props.onPress();await ui.flush();
  assert.equal(ui.backs,0);ui.find('Pressable',copy.confirmSave).props.onPress();await ui.flush();
  assert.equal(ui.backs,1);assert.equal(w.getSession().snapshot()[0].body,h.note.body);assert.equal(w.getRecovery().status,'none');ui.unmount();
});

test('conflicting exit recovery never offers apply and explicit discard preserves the newer saved revision',async t=>{
  const f=await h.fixture(t),w=await f.open(),replace=f.database.replace;
  f.database.replace=async()=>{throw Error('Synthetic initial staging failure');};await assert.rejects(w.getSession().save(h.note,null));f.database.replace=replace;
  const other=await f.open();await other.getSession().save({...h.note,body:'Synthetic separately saved newer note'},null);other.close();
  const before=JSON.stringify(await f.database.read()),ui=screen(createNotebookLifecycle(async()=>w));await ui.flush();
  ui.find('Pressable',copy.reopen).props.onPress();await ui.flush();ui.back();await ui.flush();
  ui.find('Pressable',navigation.saveExit).props.onPress();await ui.flush();
  assert.ok(ui.text(copy.conflict));assert.equal(ui.has(copy.confirmSave),false);assert.equal(ui.backs,0);
  ui.find('Pressable',copy.discardRecovery).props.onPress();await ui.flush();ui.find('Pressable',copy.confirmDiscard).props.onPress();await ui.flush();
  assert.equal(ui.backs,1);assert.equal(JSON.stringify(await f.database.read()),before);ui.unmount();
});
