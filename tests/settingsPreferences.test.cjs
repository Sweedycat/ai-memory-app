const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { loadPure } = require('./helpers/presentation.cjs');
const { catalog } = loadPure('src/i18n/catalog.ts');
const { THEMES } = loadPure('src/theme/tokens.ts');
const appearanceModel = loadPure('src/theme/appearanceStore.ts');
const languageModel = loadPure('src/i18n/languageStore.ts');

async function screen(initialLanguage = 'en') {
  const raw = new Map(), writes = [];
  let fail = false, dirty = false, cursor = 0, pending = [], output, backHandler, closeCount = 0, authenticationCount = 0;
  const slots = [], effects = [];
  const storage = { async getItem(key) { return raw.get(key) ?? null; },
    async setItem(key, value) { if (fail) throw Error('Synthetic full disk'); raw.set(key, value); writes.push(key); } };
  const appearance = appearanceModel.createAppearancePreferenceStore(storage), language = languageModel.createLanguagePreferenceStore(storage);
  appearance.subscribe(() => { dirty = true; }); language.subscribe(() => { dirty = true; });
  await appearance.reload(); await language.reload();
  if (initialLanguage === 'tr') await language.save('tr', language.getState());
  const selectedLanguage = () => language.getState().preference === 'tr' ? 'tr' : 'en';
  const selectedTheme = () => THEMES[appearance.getState().preference === 'system' ? 'light' : appearance.getState().preference ?? 'classic'];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'Fragment',
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; dirty = true; }]; },
    useEffect(callback, deps) { const i = cursor++, prior = effects[i];
      if (!prior || deps.some((d, j) => !Object.is(d, prior.deps[j]))) pending.push(() => { prior?.cleanup?.(); effects[i] = { deps, cleanup: callback() }; }); },
  };
  const i18n = { useI18n: () => ({ ...language.getState(), preference: language.getState().preference ?? 'system',
    copy: catalog[selectedLanguage()], language: selectedLanguage(), locale: selectedLanguage() === 'tr' ? 'tr-TR' : 'en-US',
    changeLanguage: next => language.save(next, language.getState()), reload: language.reload }) };
  const themes = { useTheme: () => ({ ...appearance.getState(), theme: selectedTheme(), mode: appearance.getState().preference ?? 'classic',
    changeMode: next => appearance.save(next, appearance.getState()), reload: appearance.reload }) };
  const styles = { useThemedStyles: create => create(selectedTheme()) };
  const native = Object.fromEntries(['Pressable', 'ScrollView', 'Text', 'View'].map(name => [name, name]));
  native.StyleSheet = { create: x => x }; native.BackHandler = { addEventListener(_name, callback) { backHandler = callback; return { remove() { backHandler = null; } }; } };
  function load(file, imports) {
    const module = { exports: {} };
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    }).outputText)(name => { if (!(name in imports)) throw Error('Unexpected ' + name); return imports[name]; }, module, module.exports);
    return module.exports;
  }
  const shared = { react: { __esModule: true, default: react, ...react }, 'react-native': native };
  const header = load('src/components/ui/AppHeader.tsx', { ...shared, '../../theme/useThemedStyles': styles });
  const boundary = load('src/components/ui/Screen.tsx', { ...shared,
    'react-native-safe-area-context': { SafeAreaView: 'NativeSafeArea' }, '../../theme/ThemeProvider': themes });
  const privacy = { appLockEnabled: true, lockDelaySeconds: 0, settingsReady: true,
    async setAppLockEnabled() { authenticationCount++; return false; }, async setLockDelaySeconds(value) { privacy.lockDelaySeconds = value; }, lockNow() {} };
  const Settings = load('src/components/SettingsPanel.tsx', { ...shared, './ui/AppHeader': header, './ui/Screen': boundary,
    '../i18n/LanguageProvider': i18n, '../theme/ThemeProvider': themes, '../theme/useThemedStyles': styles,
    '../theme/tokens': loadPure('src/theme/tokens.ts'), '../../app.json': { __esModule: true, default: require('../app.json') },
    './PrivacyGate': { usePrivacyControls: () => privacy }, './BackupSafetyDiagnostics': { BackupSafetyDiagnostics: 'SyntheticBackupChild' },
    './PermissionOverview': { PermissionOverview: 'SyntheticPermissionChild' }, './ReminderPermissionActions': { ReminderPermissionActions: 'SyntheticReminderChild' },
  }).SettingsPanel;
  const props = { displayName: 'Synthetic Owner', role: 'Synthetic role', onClose: () => { closeCount++; }, onEditProfile() {}, onReportBug() {} };
  function expand(node) {
    if (Array.isArray(node)) return node.flatMap(expand);
    if (!node || typeof node !== 'object') return [];
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return [node, ...expand(node.props.children)];
  }
  function render() { cursor = 0; dirty = false; output = Settings(props); const run = pending; pending = []; run.forEach(callback => callback()); }
  async function flush() { for (let i = 0; i < 10; i++) { await new Promise(resolve => setImmediate(resolve)); if (dirty) render(); } }
  render(); await flush();
  return {
    get nodes() { return expand(output); }, get copy() { return catalog[selectedLanguage()]; }, appearance, language, writes, raw,
    get closes() { return closeCount; }, get authentications() { return authenticationCount; },
    fail(value) { fail = value; }, async flush() { await flush(); },
    async press(label) { const node = expand(output).find(n => n.props.accessibilityLabel === label && n.type === 'Pressable');
      assert.ok(node, 'Missing ' + label); assert.notEqual(node.props.disabled, true, 'Disabled ' + label); await node.props.onPress(); await flush(); },
    async back() { assert.equal(backHandler(), true); await flush(); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
  };
}
for (const lang of ['en', 'tr']) test('functional Settings language/appearance hierarchy, free previews and verified persistence in ' + lang, async t => {
  const ui = await screen(lang); t.after(ui.unmount); let c = ui.copy.ui.settings;
  await ui.press(c.appearance); await ui.press(c.theme);
  assert.equal(ui.nodes.filter(n => n.props.accessibilityRole === 'radio').length, 5);
  for (const mode of ['classic', 'modern', 'light', 'dark', 'system']) {
    c = ui.copy.ui.settings;
    const label = c[mode] + '. ' + c[mode + 'Description'];
    await ui.press(label); assert.equal(ui.appearance.getState().preference, mode);
    assert.ok(ui.nodes.find(n => n.props.accessibilityLabel === label).props.accessibilityState.selected);
  }
  assert.ok(ui.writes.every(key => key === languageModel.LANGUAGE_PREFERENCE_KEY || key === appearanceModel.APPEARANCE_PREFERENCE_KEY));
  await ui.back(); await ui.back(); await ui.press(c.language);
  await ui.press(ui.copy.common[lang === 'en' ? 'tr' : 'en']);
  assert.equal(ui.copy.ui.settings.title, lang === 'en' ? 'Ayarlar' : 'Settings');
  await ui.back(); await ui.back(); assert.equal(ui.closes, 1);
});
test('Settings keeps confirmed theme on failed storage, exposes reload and does not bypass owner cancellation', async t => {
  const ui = await screen(); t.after(ui.unmount); const c = ui.copy.ui.settings;
  await ui.press(c.appearance); await ui.press(c.theme); ui.fail(true);
  await ui.press(c.modern + '. ' + c.modernDescription);
  assert.equal(ui.appearance.getState().preference, 'classic'); assert.equal(ui.appearance.getState().status, 'error');
  assert.ok(ui.nodes.find(n => n.props.accessibilityRole === 'alert'));
  assert.ok(ui.nodes.filter(n => n.props.accessibilityRole === 'radio').every(n => n.props.disabled));
  ui.fail(false); await ui.press(c.reload); assert.equal(ui.appearance.getState().status, 'ready');
  await ui.back(); await ui.back(); await ui.press(c.security); await ui.press(c.appLock);
  assert.equal(ui.authentications, 1); assert.ok(ui.nodes.find(n => n.props.accessibilityLabel === c.appLock).props.accessibilityState.checked);
});
