const { createPresentation, catalog } = require('./helpers/featurePresentation.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const h = require('./helpers/notebookRuntime.cjs');
const { createNotebookEditor: create } = h.load('notebookEditor');
function load(file, imports = {}) {
  const local = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText)(
    name => { if (!(name in imports)) throw Error('Unexpected import'); return imports[name]; }, local, local.exports);
  return local.exports;
}
const copy = load('src/strings/notebookEditor.en.ts').notebookEditorEn;
const navigation = catalog.en.navigation;
const target = { kind: 'create', id: h.note.id, createdAt: h.note.createdAt };
function renderEditor(editor, initialState = 'active', language = 'en') {
  const slots = [], effects = [];
  let cursor = 0, dirty = false, output, mounted = true, closed = 0, saved = 0, listener, back;
  const state = { currentState: initialState, addEventListener: (_, callback) => {
    listener = callback; return { remove() { listener = undefined; } };
  } };
  const react = {
    createElement(type, props, ...children) { return typeof type === 'function' ? type({ ...props, children }) : { type, props: { ...props, children } }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => {
        assert.ok(mounted, 'No state update after unmount');
        slots[index] = typeof next === 'function' ? next(slots[index]) : next; dirty = true;
      }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(callback) { const index = cursor++; if (!effects[index]) effects[index] = { callback }; },
  };
  const native = Object.fromEntries(['Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  native.AppState = state; native.StyleSheet = { create: value => value };
  native.BackHandler = { addEventListener: (_, callback) => { back = callback; return { remove() { back = undefined; } }; } };
  const presentation = createPresentation(load, react, native, { language });
  const component = load('src/components/PersonalNoteEditor.tsx', {
    ...presentation.imports,
    react: { __esModule: true, default: react, ...react }, 'react-native': native,
    '../utils/personalNotebook': h.model, '../strings/notebookEditor.en': { notebookEditorEn: copy },
  }).default;
  function render() {
    cursor = 0; dirty = false;
    output = component({ editor, onClose: () => { closed++; }, onSaved: () => { saved++; } });
    effects.forEach(effect => { if (effect.callback) { effect.cleanup = effect.callback(); effect.callback = null; } });
  }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    return node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
  }
  render();
  return {
    get nodes() { return nodes(output); }, get closed() { return closed; }, get saved() { return saved; },
    find(type, label) { const node = nodes(output).find(x => x.type === type && x.props.accessibilityLabel === label);
      assert.ok(node, 'Missing ' + label); return node; },
    async flush() { for (let i = 0; i < 8; i++) { await new Promise(resolve => setImmediate(resolve)); if (dirty && mounted) render(); } },
    background() { state.currentState = 'background'; listener?.('background'); },
    back() { return back?.(); },
    unmount() { effects.forEach(effect => effect.cleanup?.()); mounted = false; },
  };
}

test('real editor checkpoints, closes keeping ciphertext and reopens for explicit confirmed discard', async t => {
  const f = await h.fixture(t), w = await f.open();
  const editor = create(w, target, () => h.note.updatedAt), ui = renderEditor(editor);
  ui.find('TextInput', copy.titleLabel).props.onChangeText(h.note.title);
  ui.find('TextInput', copy.bodyLabel).props.onChangeText(h.note.body);
  await ui.flush();
  assert.equal(ui.find('TextInput', copy.titleLabel).props.value, h.note.title);
  ui.find('Pressable', copy.checkpoint).props.onPress(); await ui.flush();
  assert.equal(ui.find('TextInput', copy.bodyLabel).props.editable, false);
  assert.equal(ui.saved, 0); assert.equal((await f.database.read()).active, null);
  ui.find('Pressable', copy.protectedClose).props.onPress(); assert.equal(ui.closed, 1); ui.unmount();
  const restored = renderEditor(create(w, target, () => h.note.updatedAt));
  assert.equal(restored.find('TextInput', copy.bodyLabel).props.value, h.note.body);
  restored.find('Pressable', copy.discard).props.onPress(); await restored.flush();
  assert.ok((await f.database.read()).draft);
  restored.find('Pressable', copy.confirmDiscard).props.onPress(); await restored.flush();
  assert.equal((await f.database.read()).draft, null); assert.equal((await f.database.read()).active, null);
  assert.equal(restored.saved, 0); restored.unmount(); w.close();
});
test('uncheckpointed close requires confirmation and background immediately hides all private fields', async t => {
  const f = await h.fixture(t), w = await f.open();
  const ui = renderEditor(create(w, target, () => h.note.updatedAt));
  ui.find('TextInput', copy.bodyLabel).props.onChangeText(h.note.body); await ui.flush();
  ui.find('Pressable', copy.close).props.onPress(); await ui.flush(); assert.equal(ui.closed, 0);
  ui.find('Pressable', navigation.stay).props.onPress(); await ui.flush();
  ui.background(); await ui.flush();
  assert.equal(ui.nodes.filter(node => node.type === 'TextInput').length, 0);
  assert.ok(!JSON.stringify(ui.nodes).includes(h.note.body));
  assert.equal((await f.database.read()).active, null); assert.equal((await f.database.read()).draft, null);
  ui.unmount();
});
test('a late save completion after unmount cannot invoke onSaved or update React state', async t => {
  const f = await h.fixture(t), w = await f.open(), replace = f.database.replace;
  const ui = renderEditor(create(w, target, () => h.note.updatedAt));
  ui.find('TextInput', copy.bodyLabel).props.onChangeText(h.note.body); await ui.flush();
  let release;
  f.database.replace = async (expected, next) => {
    await new Promise(resolve => { release = resolve; }); return replace(expected, next);
  };
  ui.find('Pressable', copy.save).props.onPress(); await ui.flush();
  ui.unmount();
  // Release each stage without allowing an old screen to receive success.
  f.database.replace = replace;
  release(); await w.whenIdle(); await ui.flush();
  assert.equal(ui.saved, 0); w.close();
});
test('initial background mounting does not render private draft fields', async t => {
  const f = await h.fixture(t), w = await f.open(), editor = create(w, target, () => h.note.updatedAt);
  editor.change({ body: h.note.body });
  const ui = renderEditor(editor, 'background'); await ui.flush();
  assert.equal(ui.nodes.filter(node => node.type === 'TextInput').length, 0);
  assert.equal(editor.getView().body, ''); ui.unmount();
});

test('uncertain and unpersisted recovery close require confirmation and never promise durable retention', async t => {
  const f = await h.fixture(t), w = await f.open(), replace = f.database.replace;
  const editor = create(w, target, () => h.note.updatedAt), ui = renderEditor(editor);
  ui.find('TextInput', copy.bodyLabel).props.onChangeText(h.note.body); await ui.flush();
  f.database.replace = async () => { throw Error('Synthetic full disk'); };
  ui.find('Pressable', copy.save).props.onPress(); await ui.flush();
  assert.equal(editor.getView().mode, 'uncertain');
  ui.find('Pressable', copy.close).props.onPress(); await ui.flush();
  assert.equal(ui.closed, 0); ui.find('Pressable', navigation.stay).props.onPress(); await ui.flush();
  f.database.replace = replace;
  ui.find('Pressable', copy.review).props.onPress(); await ui.flush();
  assert.equal(editor.getView().mode, 'recoverable'); assert.equal(editor.getView().checkpointed, false);
  assert.equal(ui.nodes.some(node => node.props?.accessibilityLabel === copy.protectedClose), false);
  ui.find('Pressable', copy.close).props.onPress(); await ui.flush();
  assert.equal(ui.closed, 0);
  ui.find('Pressable', navigation.discard).props.onPress(); await ui.flush(); assert.equal(ui.closed, 1);
  assert.equal((await f.database.read()).draft, null); ui.unmount(); w.close();
});

test('failed checkpoint with hidden fields still protects dirty in-memory text on close', async t => {
  const f = await h.fixture(t), w = await f.open(), replace = f.database.replace;
  const editor = create(w, target, () => h.note.updatedAt), ui = renderEditor(editor);
  ui.find('TextInput', copy.bodyLabel).props.onChangeText(h.note.body); await ui.flush();
  f.database.replace = async () => { throw Error('Synthetic staging failure'); };
  ui.find('Pressable', copy.checkpoint).props.onPress(); await ui.flush();
  assert.equal(editor.getView().mode, 'unavailable'); assert.equal(editor.getView().dirty, true);
  ui.find('Pressable', copy.close).props.onPress(); await ui.flush();
  assert.equal(ui.closed, 0);
  ui.find('Pressable', navigation.stay).props.onPress(); await ui.flush();
  f.database.replace = replace;
  ui.find('Pressable', copy.review).props.onPress(); await ui.flush();
  assert.equal(editor.getView().body, h.note.body); ui.unmount(); w.close();
});

test('Android hardware Back asks about dirty text; repeated Back cancels instead of confirming loss', async t => {
  const f = await h.fixture(t), w = await f.open();
  const ui = renderEditor(create(w, target, () => h.note.updatedAt));
  ui.find('TextInput', copy.bodyLabel).props.onChangeText(h.note.body); await ui.flush();
  assert.equal(ui.back(), true); await ui.flush();
  ui.find('Pressable', navigation.discard); assert.equal(ui.closed, 0);
  ui.back(); await ui.flush(); assert.equal(ui.closed, 0);
  assert.equal(ui.nodes.some(node => node.props?.accessibilityLabel === navigation.discard), false);
  ui.back(); await ui.flush(); ui.find('Pressable', navigation.discard).props.onPress(); await ui.flush();
  assert.equal(ui.closed, 1); ui.unmount(); w.close();
});

test('unchanged new and existing Notebook editors close directly without storage writes',async t=>{
  const f=await h.fixture(t),w=await f.open();
  const empty=renderEditor(create(w,target,()=>h.note.updatedAt));empty.find('Pressable',copy.close).props.onPress();
  assert.equal(empty.closed,1);assert.equal((await f.database.read()).draft,null);empty.unmount();
  await w.getSession().save(h.note,null);const before=JSON.stringify(await f.database.read());
  const existing=renderEditor(create(w,{kind:'edit',id:h.note.id},()=>h.note.updatedAt));existing.back();await existing.flush();
  assert.equal(existing.closed,1);assert.equal(JSON.stringify(await f.database.read()),before);existing.unmount();w.close();
});

for(const language of ['en','tr'])test('localized three-way editor exit saves exactly once before success callback: '+language,async t=>{
  const f=await h.fixture(t),w=await f.open(),editor=create(w,target,()=>h.note.updatedAt);
  const ui=renderEditor(editor,'active',language),c=catalog[language].ui.notebookEditor,n=catalog[language].navigation;
  ui.find('TextInput',c.bodyLabel).props.onChangeText(h.note.body);await ui.flush();ui.back();await ui.flush();
  ui.find('Pressable',n.stay).props.onPress();await ui.flush();assert.equal(ui.find('TextInput',c.bodyLabel).props.value,h.note.body);
  ui.back();await ui.flush();ui.find('Pressable',n.discard);
  const save=ui.find('Pressable',n.saveExit).props.onPress,discard=ui.find('Pressable',n.discard).props.onPress;save();discard();save();await ui.flush();
  assert.equal(ui.saved,1);assert.equal(ui.closed,0);assert.equal(w.getSession().snapshot()[0].body,h.note.body);
  assert.equal((await f.database.read()).draft,null);ui.unmount();w.close();
});

test('failed save-and-exit and failed authenticated journal discard retain the recovery until retry succeeds',async t=>{
  const f=await h.fixture(t),w=await f.open(),replace=f.database.replace;
  const editor=create(w,target,()=>h.note.updatedAt),ui=renderEditor(editor);
  ui.find('TextInput',copy.bodyLabel).props.onChangeText(h.note.body);await ui.flush();ui.back();await ui.flush();
  f.database.replace=async(expected,next)=>{if(next.draft===null)throw Error('Synthetic full disk clearing journal');return replace(expected,next);};
  ui.find('Pressable',navigation.saveExit).props.onPress();await ui.flush();
  assert.equal(ui.saved,0);assert.equal(ui.closed,0);assert.ok((await f.database.read()).draft);
  assert.ok(ui.nodes.some(n=>n.type==='Text'&&n.props.children.includes(navigation.failedBody)));
  ui.find('Pressable',navigation.discard).props.onPress();await ui.flush();
  assert.equal(ui.closed,0);assert.ok((await f.database.read()).draft);
  f.database.replace=replace;ui.find('Pressable',navigation.discard).props.onPress();await ui.flush();
  assert.equal(ui.closed,1);assert.equal(ui.saved,0);assert.equal((await f.database.read()).draft,null);assert.equal((await f.database.read()).active,null);
  ui.unmount();w.close();
});

test('save-and-exit cannot overwrite an externally changed Notebook revision',async t=>{
  const f=await h.fixture(t),w=await f.open();await w.getSession().save(h.note,null);
  const editor=create(w,{kind:'edit',id:h.note.id},()=>h.note.updatedAt),ui=renderEditor(editor);
  ui.find('TextInput',copy.bodyLabel).props.onChangeText('Synthetic unsaved older edit');await ui.flush();
  const newer=await f.open();await newer.getSession().save({...h.note,body:'Synthetic newer saved revision'},h.note);newer.close();
  const before=JSON.stringify(await f.database.read());ui.back();await ui.flush();ui.find('Pressable',navigation.saveExit).props.onPress();await ui.flush();
  assert.equal(ui.saved,0);assert.equal(ui.closed,0);assert.equal(JSON.stringify(await f.database.read()),before);
  ui.find('Pressable',copy.review).props.onPress();await ui.flush();assert.equal(editor.getView().mode,'conflict');
  assert.equal(ui.find('Pressable',navigation.saveExit).props.disabled,true);
  assert.equal(editor.getView().body,'Synthetic unsaved older edit');ui.unmount();w.close();
});
