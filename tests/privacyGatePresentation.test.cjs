const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { loadPure, presentationImports } = require('./helpers/presentation.cjs');
const { catalog } = loadPure('src/i18n/catalog.ts');

function gate({ reads: initialReads = [], initialState = 'active' } = {}) {
  let language = 'en', mode = 'classic', cursor = 0, pending = [], dirty = false, output, nextTimer = 0;
  let response = { success: false, error: 'user_cancel' }, failWrite = false;
  let mounted = true, lateUpdates = 0, writeBarrier;
  const reads = [...initialReads], readCalls = [];
  const slots = [], effects = [], timers = new Map(), listeners = new Set(), prompts = [], writes = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'Fragment',
    createContext: value => ({ value, Provider: 'PrivacyProvider' }), useContext: context => context.value,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => { if (!mounted) lateUpdates++; slots[i] = typeof next === 'function' ? next(slots[i]) : next; dirty = true; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(callback, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((d, j) => !Object.is(d, prior.deps[j]))) slots[i] = { deps, value: callback() }; return slots[i].value; },
    useEffect(callback, deps) { const i = cursor++, prior = effects[i];
      if (!prior || deps.some((d, j) => !Object.is(d, prior.deps[j]))) pending.push(() => { prior?.cleanup?.(); effects[i] = { deps, callback, cleanup: callback() }; }); },
  };
  react.useCallback = (callback, deps) => react.useMemo(() => callback, deps);
  const contexts = new Proxy({}, { get(_target, name) { return presentationImports(language, mode)[name]; } });
  const native = Object.fromEntries(['Pressable', 'Text', 'View'].map(name => [name, name]));
  native.StyleSheet = { create: x => x };
  native.AppState = { currentState: initialState, addEventListener(_name, callback) { listeners.add(callback); return { remove: () => listeners.delete(callback) }; } };
  const imports = {
    react: { __esModule: true, default: react, ...react }, 'react-native': native,
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      async getItem(key) { readCalls.push(key); const next = reads.length ? reads.shift() : JSON.stringify({ appLockEnabled: true, lockDelaySeconds: 0 });
        if (next instanceof Error) throw next; return await next; },
      async setItem(key, bytes) { if (failWrite) throw Error('Synthetic full disk'); writes.push({ key, bytes }); await writeBarrier; },
    } },
    'expo-local-authentication': { async authenticateAsync(options) { prompts.push(options); return response; } },
    '../utils/privacySettingsPersistence': loadPure('src/utils/privacySettingsPersistence.ts'),
    '../utils/privacySettingsLoad': loadPure('src/utils/privacySettingsLoad.ts'),
  };
  for (const name of Object.keys(presentationImports())) imports[name] = new Proxy({}, { get(_target, key) { return contexts[name][key]; } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, '../src/components/PrivacyGate.tsx'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    }).outputText)(name => { if (!(name in imports)) throw Error('Unexpected ' + name); return imports[name]; }, module, module.exports,
    callback => { const id = ++nextTimer; timers.set(id, callback); return id; }, id => timers.delete(id));
  const privateChild = { type: 'SyntheticPrivateMemory', props: {} };
  function render() { cursor = 0; dirty = false; output = module.exports.PrivacyGate({ children: privateChild });
    const run = pending; pending = []; run.forEach(callback => callback()); }
  function nodes(n) { return Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(n.props?.children)] : []; }
  async function flush() { for (let i = 0; i < 8; i++) { await new Promise(resolve => setImmediate(resolve)); if (dirty && mounted) render(); } }
  render();
  return {
    prompts, writes, readCalls, get controls() { return output.props.value; },
    get lateUpdates() { return lateUpdates; },
    get retry() { return nodes(output).find(n => n.type === 'Pressable' && n.props.accessibilityLabel === catalog[language].ui.gates.retryPrivacyLoad)?.props.onPress; },
    get privateVisible() { return nodes(output).some(n => n.type === 'SyntheticPrivateMemory'); },
    text() { return JSON.stringify(output); }, flush,
    response(value) { response = value; }, failWrite(value) { failWrite = value; }, holdWrite(value) { writeBarrier = value; },
    replayEffects() { effects.forEach(effect => effect?.cleanup?.()); effects.forEach(effect => { if (effect) effect.cleanup = effect.callback(); }); },
    async change(lang, theme) { language = lang; mode = theme; render(); await flush(); },
    async runTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); await flush(); },
    async unlock() { const button = nodes(output).find(n => n.type === 'Pressable'); assert.ok(button); await button.props.onPress(); await flush(); },
    async state(value) { native.AppState.currentState = value; for (const callback of listeners) callback(value); await flush(); },
    async background() { await this.state('background'); },
    unmount() { if (!mounted) return; mounted = false; effects.forEach(effect => effect?.cleanup?.()); },
  };
}
test('language/theme changes cannot unlock private content or restart authentication; stable prompt reads current locale', async t => {
  const ui = gate(); t.after(ui.unmount); await ui.flush(); await ui.runTimers();
  assert.equal(ui.prompts.length, 1); assert.equal(ui.privateVisible, false);
  await ui.change('tr', 'light'); await ui.runTimers();
  assert.equal(ui.prompts.length, 1); assert.equal(ui.privateVisible, false);
  ui.response({ success: false, error: 'authentication_failed' }); await ui.unlock();
  assert.equal(ui.prompts.at(-1).promptMessage, catalog.tr.ui.gates.unlock);
  assert.equal(ui.prompts.at(-1).disableDeviceFallback, false);
  assert.ok(ui.text().includes(catalog.tr.ui.gates.authFailed)); assert.equal(ui.privateVisible, false);
  await ui.change('en', 'modern'); assert.ok(ui.text().includes(catalog.en.ui.gates.authFailed));
  assert.ok(!ui.text().includes(catalog.tr.ui.gates.authFailed));
  ui.response({ success: true }); await ui.unlock(); assert.equal(ui.privateVisible, true);
  await ui.background(); assert.equal(ui.privateVisible, false); assert.deepEqual(ui.writes, []);
});

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
const saved = (appLockEnabled, lockDelaySeconds = 0) => JSON.stringify({ appLockEnabled, lockDelaySeconds });

test('read failure then failed retry then valid retry blocks children, controls and authentication without writes', async t => {
  const ui = gate({ reads: [new Error('Synthetic unreadable'), '{', saved(true)] }); t.after(ui.unmount);
  const capturedControls = ui.controls;
  await ui.flush();
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal(ui.controls.settingsReady, false); assert.equal(ui.privateVisible, false);
    assert.ok(ui.text().includes(catalog.en.ui.gates.privacyLoadExplanation));
    assert.equal(await capturedControls.setAppLockEnabled(false), false);
    await capturedControls.setLockDelaySeconds(300); capturedControls.lockNow();
    await ui.runTimers(); assert.deepEqual(ui.prompts, []); assert.deepEqual(ui.writes, []);
    await ui.retry(); await ui.flush();
  }
  assert.equal(ui.controls.settingsReady, true); assert.equal(ui.privateVisible, false);
  await ui.runTimers(); assert.equal(ui.prompts.length, 1);
  ui.response({ success: true }); await ui.unlock(); assert.equal(ui.privateVisible, true);
  assert.equal(ui.readCalls.length, 3); assert.deepEqual(ui.writes, []);
});

test('invalid disabled policy is blocked through every locale/theme rerender and cannot authenticate', async t => {
  const invalid = ['', '{}', '[]', 'null', 'false', '0', '"policy"', '{',
    '{"appLockEnabled":false}', saved(false, '0'), saved(false, 31),
    '{"appLockEnabled":false,"lockDelaySeconds":0,"unknown":true}',
    '{"appLockEnabled":true,"appLockEnabled":false,"lockDelaySeconds":0}',
    '{"appLockEnabled":{},"appLockEnabled":false,"lockDelaySeconds":0}'];
  for (const raw of invalid) {
    const ui = gate({ reads: [raw] }); t.after(ui.unmount); await ui.flush();
    ui.response({ success: true });
    for (const [lang, theme] of [['en', 'classic'], ['tr', 'modern'], ['en', 'light'], ['tr', 'dark']]) {
      await ui.change(lang, theme); await ui.runTimers();
      assert.equal(ui.controls.settingsReady, false, raw); assert.equal(ui.privateVisible, false, raw);
      assert.ok(ui.text().includes(catalog[lang].ui.gates.privacyLoadTitle));
      assert.ok(ui.text().includes(catalog[lang].ui.gates.retryPrivacyLoad));
    }
    assert.deepEqual(ui.prompts, []); assert.deepEqual(ui.writes, []);
    assert.equal(ui.readCalls.length, 1);
  }
});

test('confirmed null defaults to enabled lock; complete enabled/disabled records retain policy and delay', async t => {
  for (const [raw, enabled, delay] of [[null, true, 0], [saved(true, 60), true, 60], [saved(false, 300), false, 300]]) {
    const ui = gate({ reads: [raw] }); t.after(ui.unmount); await ui.flush();
    assert.equal(ui.controls.settingsReady, true); assert.equal(ui.controls.appLockEnabled, enabled);
    assert.equal(ui.controls.lockDelaySeconds, delay); assert.equal(ui.privateVisible, !enabled);
    await ui.runTimers(); assert.equal(ui.prompts.length, enabled ? 1 : 0);
    assert.deepEqual(ui.writes, []);
    if (!enabled) { await ui.background(); assert.equal(ui.privateVisible, true); }
  }
});

test('captured retry is single flight and cannot reload or overwrite a successful policy', async t => {
  const pending = deferred();
  const ui = gate({ reads: ['{', pending.promise] }); t.after(ui.unmount); await ui.flush();
  const retry = ui.retry, captured = ui.controls;
  retry(); retry(); retry();
  assert.equal(ui.readCalls.length, 2);
  assert.equal(await captured.setAppLockEnabled(false), false);
  await captured.setLockDelaySeconds(30); await ui.state('background'); await ui.runTimers();
  assert.equal(ui.privateVisible, false); assert.deepEqual(ui.writes, []); assert.deepEqual(ui.prompts, []);
  pending.resolve(saved(false, 30)); await ui.flush();
  assert.equal(ui.controls.settingsReady, true); assert.equal(ui.privateVisible, true);
  retry(); await ui.flush(); assert.equal(ui.readCalls.length, 2); assert.deepEqual(ui.writes, []);
});

test('late initial/retry read completion and captured controls do nothing after unmount', async () => {
  for (const retrying of [false, true]) {
    const pending = deferred();
    const ui = gate({ reads: retrying ? ['{', pending.promise] : [pending.promise] });
    if (retrying) { await ui.flush(); ui.retry(); }
    const captured = ui.controls;
    ui.unmount(); pending.resolve(saved(false)); await ui.flush();
    assert.equal(ui.lateUpdates, 0); assert.equal(ui.privateVisible, false);
    assert.equal(await captured.setAppLockEnabled(false), false); await captured.setLockDelaySeconds(300); captured.lockNow();
    assert.equal(ui.lateUpdates, 0); assert.deepEqual(ui.writes, []); assert.deepEqual(ui.prompts, []);
  }
});

test('successful retry while backgrounded remains locked and prompts only after foreground', async t => {
  const pending = deferred(); const ui = gate({ reads: ['{', pending.promise] }); t.after(ui.unmount);
  await ui.flush(); ui.retry(); await ui.background();
  pending.resolve(saved(true)); await ui.flush(); await ui.runTimers();
  assert.equal(ui.controls.settingsReady, true); assert.equal(ui.privateVisible, false); assert.deepEqual(ui.prompts, []);
  await ui.state('active'); await ui.runTimers(); assert.equal(ui.prompts.length, 1);
  assert.equal(ui.privateVisible, false); assert.deepEqual(ui.writes, []);
});

test('effect replay fences an older read even when it finishes after a newer valid policy', async t => {
  const old = deferred(); const ui = gate({ reads: [old.promise, saved(true, 60)] }); t.after(ui.unmount);
  ui.replayEffects(); await ui.flush();
  assert.equal(ui.readCalls.length, 2); assert.equal(ui.controls.settingsReady, true);
  old.resolve(saved(false)); await ui.flush();
  assert.equal(ui.controls.appLockEnabled, true); assert.equal(ui.controls.lockDelaySeconds, 60);
  assert.equal(ui.privateVisible, false); assert.deepEqual(ui.writes, []);
});

test('a privacy save still applies only after persistence and cannot update an unmounted gate', async () => {
  const pending = deferred(); const ui = gate({ reads: [saved(false)] }); await ui.flush();
  ui.holdWrite(pending.promise);
  const saving = ui.controls.setAppLockEnabled(true); await ui.flush();
  assert.equal(ui.controls.appLockEnabled, false); assert.equal(ui.writes.length, 1);
  ui.unmount(); pending.resolve(); assert.equal(await saving, false); await ui.flush();
  assert.equal(ui.lateUpdates, 0); assert.deepEqual(ui.prompts, []);
});

test('pending authentication cannot unlock after background or unmount; foreground preserves device fallback', async t => {
  for (const unmount of [false, true]) {
    const pending = deferred(); const ui = gate(); t.after(ui.unmount); await ui.flush();
    ui.response(pending.promise); await ui.unlock();
    assert.equal(ui.prompts.length, 1); assert.equal(ui.prompts[0].disableDeviceFallback, false);
    if (unmount) ui.unmount(); else await ui.background();
    pending.resolve({ success: true }); await ui.flush();
    assert.equal(ui.privateVisible, false); assert.equal(ui.lateUpdates, 0); assert.deepEqual(ui.writes, []);
    if (!unmount) {
      assert.equal(await ui.controls.setAppLockEnabled(false), false); assert.equal(ui.prompts.length, 1);
      ui.response({ success: true }); await ui.state('active'); await ui.runTimers();
      assert.equal(ui.privateVisible, true); assert.equal(ui.prompts.length, 2);
    }
  }
});
test('localized owner cancellation and failed privacy persistence keep App Lock enabled', async t => {
  const ui = gate(); t.after(ui.unmount); await ui.flush(); await ui.runTimers(); await ui.change('tr', 'dark');
  assert.equal(await ui.controls.setAppLockEnabled(false), false); await ui.flush();
  assert.equal(ui.prompts.at(-1).promptMessage, catalog.tr.ui.gates.disableLock);
  assert.equal(ui.controls.appLockEnabled, true); assert.equal(ui.privateVisible, false); assert.deepEqual(ui.writes, []);
  ui.response({ success: true }); ui.failWrite(true);
  assert.equal(await ui.controls.setAppLockEnabled(false), false); await ui.flush();
  assert.equal(ui.controls.appLockEnabled, true); assert.equal(ui.privateVisible, false); assert.deepEqual(ui.writes, []);
});
