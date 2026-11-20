const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { loadPure } = require('./helpers/presentation.cjs');
const appearance = loadPure('src/theme/appearanceStore.ts');
const tokens = loadPure('src/theme/tokens.ts');
const language = loadPure('src/i18n/languageStore.ts');

function memory(initial = {}) {
  const bytes = new Map(Object.entries(initial));
  return { bytes, writes: [], failRead: false, failWrite: false,
    async getItem(key) { if (this.failRead) throw Error('Synthetic read failure'); return bytes.get(key) ?? null; },
    async setItem(key, value) { if (this.failWrite) throw Error('Synthetic write failure'); this.writes.push(key); bytes.set(key, value); },
  };
}
test('all five free appearances round-trip independently of language and personal storage', async () => {
  const storage = memory({ '@ai-memory/people-v1': 'synthetic untouched bytes' });
  const store = appearance.createAppearancePreferenceStore(storage);
  assert.equal(storage.writes.length, 0);
  await store.reload(); assert.equal(store.getState().preference, 'classic');
  for (const preference of tokens.THEME_MODES) {
    const base = store.getState(); assert.equal(await store.save(preference, base), true);
    const reopened = appearance.createAppearancePreferenceStore(storage); await reopened.reload();
    assert.equal(reopened.getState().preference, preference);
  }
  assert.equal(storage.bytes.get('@ai-memory/people-v1'), 'synthetic untouched bytes');
  assert.ok(storage.writes.every(key => key === appearance.APPEARANCE_PREFERENCE_KEY));
  const languageStore = language.createLanguagePreferenceStore(storage); await languageStore.reload();
  assert.equal(languageStore.getState().preference, 'system');
});
test('corrupt/unsupported appearance bytes and read failure cannot become empty defaults or be overwritten', async () => {
  for (const raw of ['{', 'null', '{}', JSON.stringify({ version: 1, revision: 0, preference: 'premium' }),
    JSON.stringify({ version: 2, revision: 0, preference: 'classic' })]) {
    const storage = memory({ [appearance.APPEARANCE_PREFERENCE_KEY]: raw });
    const store = appearance.createAppearancePreferenceStore(storage); await store.reload();
    assert.equal(store.getState().status, 'error');
    assert.equal(await store.save('light', { preference: 'classic', revision: 0 }), false);
    assert.equal(storage.bytes.get(appearance.APPEARANCE_PREFERENCE_KEY), raw); assert.deepEqual(storage.writes, []);
  }
  const storage = memory(); storage.failRead = true;
  const store = appearance.createAppearancePreferenceStore(storage); await store.reload();
  assert.equal(store.getState().status, 'error'); assert.deepEqual(storage.writes, []);
});
test('failed save retains confirmed appearance, external conflict and background interruption require reload', async () => {
  const storage = memory(); const store = appearance.createAppearancePreferenceStore(storage); await store.reload();
  storage.failWrite = true;
  assert.equal(await store.save('light', store.getState()), false);
  assert.equal(store.getState().preference, 'classic'); assert.equal(store.getState().status, 'error');
  storage.failWrite = false; await store.reload();
  storage.bytes.set(appearance.APPEARANCE_PREFERENCE_KEY, JSON.stringify({ version: 1, revision: 8, preference: 'modern' }));
  assert.equal(await store.save('dark', store.getState()), false); assert.equal(store.getState().error, 'conflict');
  await store.reload(); assert.equal(store.getState().preference, 'modern');
  let finish; const set = storage.setItem.bind(storage);
  storage.setItem = async (key, value) => { await new Promise(resolve => { finish = resolve; }); await set(key, value); };
  const saving = store.save('light', store.getState());
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  store.invalidate(); finish(); assert.equal(await saving, false);
  assert.equal(store.getState().preference, 'modern');
  await store.reload(); assert.equal(store.getState().preference, 'light');
});

// Executes real providers with injected persistence; only React/native delivery
// is simulated. This is not proof of Android key/storage or system-bar behavior.
function provider(kind, storage) {
  const slots = [], effects = [], appListeners = new Set(), appearanceListeners = new Set();
  let cursor = 0, pending = [], dirty = false, output, locale = 'en-US', device = 'light', override = 'unspecified';
  const backgrounds = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    createContext: value => ({ value, Provider: 'ContextProvider' }), useContext: context => context.value,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; dirty = true; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(callback, deps) { const i = cursor++, prior = slots[i];
      if (!prior || deps.some((d, j) => !Object.is(d, prior.deps[j]))) slots[i] = { deps, value: callback() }; return slots[i].value; },
    useEffect(callback, deps) { const i = cursor++, prior = effects[i];
      if (!prior || deps.some((d, j) => !Object.is(d, prior.deps[j]))) pending.push(() => { prior?.cleanup?.(); effects[i] = { deps, cleanup: callback() }; }); },
  };
  const native = {
    AppState: { addEventListener: (_name, callback) => { appListeners.add(callback); return { remove: () => appListeners.delete(callback) }; } },
    Appearance: {
      getColorScheme: () => override === 'unspecified' ? device : override,
      setColorScheme(value) { override = value; for (const callback of appearanceListeners) callback({ colorScheme: this.getColorScheme() }); },
      addChangeListener(callback) { appearanceListeners.add(callback); return { remove: () => appearanceListeners.delete(callback) }; },
    },
  };
  const file = kind === 'theme' ? 'src/theme/ThemeProvider.tsx' : 'src/i18n/LanguageProvider.tsx';
  const imports = { react: { __esModule: true, default: react, ...react }, 'react-native': native,
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    'expo-system-ui': { setBackgroundColorAsync: async color => { backgrounds.push(color); } },
    './tokens': tokens, './appearanceStore': appearance, './languageStore': language,
    './language': loadPure('src/i18n/language.ts'), './catalog': loadPure('src/i18n/catalog.ts') };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText)(name => { if (!(name in imports)) throw Error('Unexpected ' + name); return imports[name]; }, module, module.exports);
  const Component = module.exports[kind === 'theme' ? 'ThemeProvider' : 'LanguageProvider'];
  function render() { cursor = 0; dirty = false; output = Component({ storage, locale, children: 'Synthetic child' });
    const run = pending; pending = []; run.forEach(callback => callback()); }
  render();
  return {
    get value() { return output.props.value; }, get override() { return override; }, backgrounds,
    async flush() { for (let i = 0; i < 12; i++) { await new Promise(resolve => setImmediate(resolve)); if (dirty) render(); } },
    device(value) { device = value; if (override === 'unspecified') for (const callback of appearanceListeners) callback({ colorScheme: value }); },
    locale(value) { locale = value; render(); },
    app(value) { for (const callback of appListeners) callback(value); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
  };
}
test('real theme provider applies confirmed choices, follows system and preserves choice on reload failure', async t => {
  const storage = memory(); const ui = provider('theme', storage); t.after(ui.unmount); await ui.flush();
  assert.equal(ui.value.mode, 'classic'); assert.equal(ui.value.resolvedMode, 'classic'); assert.equal(ui.override, 'dark');
  assert.equal(await ui.value.changeMode('modern'), true); await ui.flush();
  assert.equal(ui.value.theme, tokens.THEMES.modern);
  ui.device('light'); await ui.flush(); assert.equal(ui.value.resolvedMode, 'modern');
  assert.equal(await ui.value.changeMode('system'), true); await ui.flush(); assert.equal(ui.override, 'unspecified');
  assert.equal(ui.value.resolvedMode, 'light'); ui.device('dark'); await ui.flush(); assert.equal(ui.value.resolvedMode, 'dark');
  assert.ok(ui.backgrounds.includes(tokens.THEMES.light.colors.background));
  storage.failRead = true; const before = storage.writes.length;
  ui.app('background'); ui.app('active'); await ui.flush();
  assert.equal(ui.value.status, 'error'); assert.equal(ui.value.mode, 'system');
  assert.equal(await ui.value.changeMode('light'), false); assert.equal(storage.writes.length, before);
  storage.failRead = false; await ui.value.reload(); await ui.flush(); assert.equal(ui.value.status, 'ready');
});
test('real language provider switches complete catalogs without rewriting records or hiding failed saves', async t => {
  const storage = memory({ '@ai-memory/people-v1': 'Synthetic unchanged text' });
  const ui = provider('language', storage); t.after(ui.unmount); await ui.flush();
  assert.equal(ui.value.preference, 'system'); ui.locale('tr-TR'); await ui.flush(); assert.equal(ui.value.language, 'tr');
  assert.equal(ui.value.copy.ui.settings.title, 'Ayarlar');
  assert.equal(await ui.value.changeLanguage('en'), true); await ui.flush();
  assert.equal(ui.value.language, 'en'); ui.locale('tr-TR'); await ui.flush(); assert.equal(ui.value.language, 'en');
  storage.failWrite = true; assert.equal(await ui.value.changeLanguage('tr'), false); await ui.flush();
  assert.equal(ui.value.language, 'en'); assert.equal(ui.value.status, 'error');
  assert.equal(storage.bytes.get('@ai-memory/people-v1'), 'Synthetic unchanged text');
  assert.ok(storage.writes.every(key => key === language.LANGUAGE_PREFERENCE_KEY));
});

function luminance(hex) { const c = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
  .map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
function contrast(a, b) { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); }
test('all palettes retain readable text and controls without paid gates', () => {
  for (const theme of Object.values(tokens.THEMES)) {
    for (const surface of ['background', 'surface', 'input', 'surfaceRaised']) {
      for (const foreground of ['text', 'textSecondary', 'textMuted']) assert.ok(contrast(theme.colors[foreground], theme.colors[surface]) >= 4.5, theme.id + ' ' + foreground + '/' + surface);
    }
    assert.ok(contrast(theme.colors.onAccent, theme.colors.accent) >= 4.5);
    assert.ok(contrast(theme.colors.controlBorder, theme.colors.surface) >= 3);
    assert.ok(theme.metrics.controlMinHeight >= 48);
  }
  assert.deepEqual(tokens.THEME_MODES, ['classic', 'modern', 'light', 'dark', 'system']);
});
