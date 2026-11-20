const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { loadPure, presentationImports } = require('./helpers/presentation.cjs');
const { catalog } = loadPure('src/i18n/catalog.ts');

function gate() {
  let language = 'en', mode = 'classic', cursor = 0, pending = [], dirty = false, output, nextTimer = 0;
  let response = { success: false, error: 'user_cancel' }, failWrite = false;
  const slots = [], effects = [], timers = new Map(), listeners = new Set(), prompts = [], writes = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'Fragment',
    createContext: value => ({ value, Provider: 'PrivacyProvider' }), useContext: context => context.value,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; dirty = true; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(callback, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((d, j) => !Object.is(d, prior.deps[j]))) slots[i] = { deps, value: callback() }; return slots[i].value; },
    useEffect(callback, deps) { const i = cursor++, prior = effects[i];
      if (!prior || deps.some((d, j) => !Object.is(d, prior.deps[j]))) pending.push(() => { prior?.cleanup?.(); effects[i] = { deps, cleanup: callback() }; }); },
  };
  react.useCallback = (callback, deps) => react.useMemo(() => callback, deps);
  const contexts = new Proxy({}, { get(_target, name) { return presentationImports(language, mode)[name]; } });
  const native = Object.fromEntries(['Pressable', 'Text', 'View'].map(name => [name, name]));
  native.StyleSheet = { create: x => x };
  native.AppState = { currentState: 'active', addEventListener(_name, callback) { listeners.add(callback); return { remove: () => listeners.delete(callback) }; } };
  const imports = {
    react: { __esModule: true, default: react, ...react }, 'react-native': native,
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      async getItem() { return JSON.stringify({ appLockEnabled: true, lockDelaySeconds: 0 }); },
      async setItem(key, bytes) { if (failWrite) throw Error('Synthetic full disk'); writes.push({ key, bytes }); },
    } },
    'expo-local-authentication': { async authenticateAsync(options) { prompts.push(options); return response; } },
    '../utils/privacySettingsPersistence': loadPure('src/utils/privacySettingsPersistence.ts'),
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
  async function flush() { for (let i = 0; i < 8; i++) { await new Promise(resolve => setImmediate(resolve)); if (dirty) render(); } }
  render();
  return {
    prompts, writes, get controls() { return output.props.value; },
    get privateVisible() { return nodes(output).some(n => n.type === 'SyntheticPrivateMemory'); },
    text() { return JSON.stringify(output); }, flush,
    response(value) { response = value; }, failWrite(value) { failWrite = value; },
    async change(lang, theme) { language = lang; mode = theme; render(); await flush(); },
    async runTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); await flush(); },
    async unlock() { const button = nodes(output).find(n => n.type === 'Pressable'); assert.ok(button); await button.props.onPress(); await flush(); },
    async background() { native.AppState.currentState = 'background'; for (const callback of listeners) callback('background'); await flush(); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
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
test('localized owner cancellation and failed privacy persistence keep App Lock enabled', async t => {
  const ui = gate(); t.after(ui.unmount); await ui.flush(); await ui.runTimers(); await ui.change('tr', 'dark');
  assert.equal(await ui.controls.setAppLockEnabled(false), false); await ui.flush();
  assert.equal(ui.prompts.at(-1).promptMessage, catalog.tr.ui.gates.disableLock);
  assert.equal(ui.controls.appLockEnabled, true); assert.equal(ui.privateVisible, false); assert.deepEqual(ui.writes, []);
  ui.response({ success: true }); ui.failWrite(true);
  assert.equal(await ui.controls.setAppLockEnabled(false), false); await ui.flush();
  assert.equal(ui.controls.appLockEnabled, true); assert.equal(ui.privateVisible, false); assert.deepEqual(ui.writes, []);
});
