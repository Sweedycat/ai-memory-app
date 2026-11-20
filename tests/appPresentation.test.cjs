const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const fixture = {
  id: 'synthetic-person', name: 'Synthetic Name', role: 'Original Role', company: 'Original Company',
  phone: '+1 202 555 0101', relationship: 'Original relationship', lastInteraction: 'Last week',
  notes: ['Original private note'], interactions: [
    { id: 'legacy', date: 'Last week', summary: 'Original conversation', source: 'manual' },
  ], followUp: { id: 'synthetic-follow-up', text: 'Original follow-up', createdAt: '2026-01-01T12:00:00Z' },
  followUpHistory: [],
};

// Presentation integration only: execute App, its actual local helper components,
// shared AppHeader, token palettes, catalogs, dates and local briefing generation.
// Native rendering and persistence are simulated. Handler concurrency/persistence
// failure evidence stays in personFollowUpConcurrency.test.cjs.
function presentation({ language = 'en', mode = 'classic', ready = true, loadError = null } = {}) {
  let selectedLanguage = language, selectedMode = mode, cursor = 0, output;
  const slots = [], alerts = [], intents = [], cache = new Map();
  const react = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(callback) { return callback(); }, useCallback(callback) { return callback; }, useEffect() {},
  };
  const native = Object.fromEntries(['Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  Object.assign(native, { Platform: { OS: 'android' }, StyleSheet: { create: value => value },
    Alert: { alert(title, message, buttons) { alerts.push({ title, message, buttons }); } },
    Linking: { openURL: async () => undefined },
  });
  const noop = () => null;
  const modules = {
    'src/i18n/LanguageProvider': { useI18n: () => ({ language: selectedLanguage,
      locale: selectedLanguage === 'tr' ? 'tr-TR' : 'en-US', copy: {
        app: load('src/i18n/catalogs/app')[selectedLanguage === 'tr' ? 'appTr' : 'appEn'],
        navigation: load('src/i18n/catalogs/navigation')[selectedLanguage === 'tr' ? 'navigationTr' : 'navigationEn'],
        timeEntry: load('src/i18n/catalogs/timeEntry')[selectedLanguage === 'tr' ? 'timeEntryTr' : 'timeEntryEn'],
        lifeAdmin: load('src/strings/lifeAdmin')[selectedLanguage === 'tr' ? 'lifeAdminTr' : 'lifeAdminEn'],
        assistant: load('src/strings/assistant')[selectedLanguage === 'tr' ? 'assistantTr' : 'assistantEn'],
      } }) },
    'src/theme/ThemeProvider': { useTheme: () => ({ theme: load('src/theme/tokens').THEMES[selectedMode] }) },
    'src/components/OwnerProfileGate': { useOwnerControls: () => ({ openSettings: noop }) },
    'src/components/NotebookBoundary': { NOTEBOOK_PRODUCTION_ENABLED: false, useNotebookLifecycle: () => null },
    'src/data/mockPeople': { mockPeople: [fixture] },
    'src/hooks/usePersistentPeople': { usePersistentPeople: () => [[fixture], () => {
      throw Error('Presentation checks must not write personal records');
    }, ready, loadError, { status: 'idle', getStatus: () => 'idle' }] },
    'src/utils/followUpNotifications': { cancelFollowUpNotification: noop, scheduleFollowUpNotification: noop },
  };
  for (const name of ['MemorySaveNotice', 'DailyBriefingCard', 'LifeAdminPanel', 'GroundedAssistantPanel', 'NotebookPanel', 'PersonHistory']) {
    modules[`src/components/${name}`] = { [name]: noop };
  }
  function load(relative) {
    const key = relative.replace(/\\/g, '/').replace(/\.(tsx?|jsx?)$/, '');
    if (modules[key]) return modules[key];
    if (cache.has(key)) return cache.get(key);
    const filename = ['.ts', '.tsx'].map(extension => path.join(root, key + extension)).find(fs.existsSync);
    assert.ok(filename, `Expected local source ${key}`);
    const local = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    }).outputText;
    new Function('require', 'module', 'exports', code)(name => {
      if (name === 'react') return { __esModule: true, default: react, ...react };
      if (name === 'react-native') return native;
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 31, bottom: 17 }) };
      if (name === '@react-native-community/datetimepicker') return { __esModule: true, default: 'DateTimePicker' };
      if (name === 'expo-intent-launcher') return { startActivityAsync: async (...args) => { intents.push(args); } };
      if (name === 'expo-notifications') return {};
      assert.ok(name.startsWith('.'), `Unexpected external module ${name}`);
      return load(path.relative(root, path.resolve(path.dirname(filename), name)));
    }, local, local.exports);
    cache.set(key, local.exports);
    return local.exports;
  }
  const App = load('App').default;
  function expand(node) {
    if (Array.isArray(node)) return node.flatMap(expand);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props.children) } };
  }
  function nodes(node = output) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    return node && typeof node === 'object' ? [node, ...nodes(node.props.children)] : [];
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join('');
    return node && typeof node === 'object' ? text(node.props.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
  }
  function render() { cursor = 0; output = expand(App()); }
  const ui = {
    render, nodes, text: () => text(output), alerts, intents,
    copy: () => load('src/i18n/catalogs/app')[selectedLanguage === 'tr' ? 'appTr' : 'appEn'],
    theme: () => load('src/theme/tokens').THEMES[selectedMode],
    language(value) { selectedLanguage = value; render(); },
    mode(value) { selectedMode = value; render(); },
    press(label) {
      const button = nodes().find(node => node.type === 'Pressable' && text(node).replace(/^‹\s*/, '') === label);
      assert.ok(button, `Expected actual rendered control ${label}`); button.props.onPress(); render();
    },
    openPerson() {
      const person = nodes().find(node => node.type === 'Pressable' && node.props.key === fixture.id);
      assert.ok(person); person.props.onPress(); render();
    },
  };
  render(); return ui;
}

for (const language of ['en', 'tr']) for (const mode of ['classic', 'modern', 'light', 'dark']) {
  test(`App renders ${language} home, detail and form using free ${mode} tokens inside the shared root viewport`, () => {
    const original = JSON.stringify(fixture), ui = presentation({ language, mode }), c = ui.copy(), theme = ui.theme();
    assert.ok(ui.text().includes(c.heroTitle));
    assert.ok(ui.nodes().some(node => node.props.accessibilityLabel === c.openSettings));
    assert.equal(ui.nodes()[0].props.style.backgroundColor, theme.colors.background);
    const scroll = ui.nodes().find(node => node.type === 'ScrollView');
    assert.equal(scroll.props.contentContainerStyle[0].paddingHorizontal, 20);
    assert.deepEqual(scroll.props.contentContainerStyle[1], { paddingTop: 12, paddingBottom: 24 });
    const search = ui.nodes().find(node => node.type === 'TextInput');
    assert.equal(search.props.placeholder, c.searchPlaceholder);
    assert.equal(search.props.placeholderTextColor, theme.colors.textMuted);
    ui.openPerson();
    assert.ok(ui.text().includes('Original private note'));
    assert.ok(ui.text().includes(c.noReminder));
    ui.press(c.generateBriefing);
    assert.ok(ui.text().includes(language === 'tr' ? 'Bağlam: Original relationship.' : 'Context: Original relationship.'));
    assert.ok(ui.text().includes('Original conversation'));
    const back = ui.nodes().find(node => node.props.accessibilityLabel === c.backPeople);
    assert.equal(back.props.style.minHeight, 48);
    assert.equal(back.props.style.alignSelf, 'flex-start');
    ui.press(c.edit);
    assert.ok(ui.text().includes(c.phoneScope));
    assert.ok(ui.nodes().some(node => node.type === 'TextInput' && node.props.accessibilityLabel === c.phoneLabel));
    assert.ok(ui.nodes().some(node => node.type === 'TextInput' && node.props.placeholder === c.enterField(c.nameLabel.toLocaleLowerCase(language).replace(' *', ''))));
    ui.press(c.pickDate);
    const picker = ui.nodes().find(node => node.type === 'DateTimePicker');
    assert.equal(picker.props.locale, language === 'tr' ? 'tr-TR' : 'en-US');
    assert.equal(picker.props.themeVariant, theme.isDark ? 'dark' : 'light');
    assert.equal(picker.props.accentColor, theme.colors.accent);
    assert.equal(JSON.stringify(fixture), original);
  });
}

test('App language and theme changes refresh actual helper controls and an already generated briefing', () => {
  const ui = presentation(); ui.openPerson(); ui.press(ui.copy().generateBriefing);
  assert.ok(ui.text().includes('Context: Original relationship.'));
  ui.language('tr'); ui.mode('light');
  assert.ok(ui.text().includes('Bağlam: Original relationship.'));
  assert.ok(!ui.text().includes('Context:'));
  assert.ok(ui.text().includes(ui.copy().editReminder));
  assert.equal(ui.nodes()[0].props.style.backgroundColor, ui.theme().colors.background);
  ui.press(ui.copy().edit);
  const originalPhone = ui.nodes().find(node => node.type === 'TextInput' && node.props.accessibilityLabel === ui.copy().phoneLabel);
  assert.equal(originalPhone.props.value, fixture.phone);
  ui.language('en');
  assert.ok(ui.text().includes(ui.copy().phoneScope));
  assert.equal(ui.nodes().find(node => node.type === 'TextInput' && node.props.accessibilityLabel === ui.copy().phoneLabel).props.value, fixture.phone);
});

test('both languages show an empty add-person form without reusing an existing person draft', () => {
  for (const language of ['en', 'tr']) {
    const ui = presentation({ language }); const c = ui.copy(); ui.press(c.addPersonButton);
    assert.ok(ui.text().includes(c.addPerson));
    assert.ok(ui.text().includes(c.firstMemory));
    const fields = ui.nodes().filter(node => node.type === 'TextInput');
    assert.ok(fields.length >= 7);
    assert.ok(fields.every(node => node.props.value === ''));
    assert.ok(ui.nodes().some(node => node.type === 'Pressable' && node.props.disabled === true));
  }
});

test('Turkish contact sharing keeps purpose-specific confirmation and original payload fields', async () => {
  const ui = presentation({ language: 'tr' }); ui.openPerson(); ui.press(ui.copy().saveContacts);
  assert.equal(ui.intents.length, 0, 'Consent precedes contact intent');
  const consent = ui.alerts.at(-1);
  assert.equal(consent.title, ui.copy().exportTitle);
  assert.equal(consent.message, ui.copy().exportConsent);
  assert.equal(consent.buttons[0].text, ui.copy().cancel);
  consent.buttons[1].onPress();
  assert.equal(ui.intents.length, 1);
  assert.deepEqual(ui.intents[0][1].extra, { name: 'Synthetic Name (AI Memory)', phone: fixture.phone,
    company: fixture.company, job_title: fixture.role });
  assert.ok(!('notes' in ui.intents[0][1].extra));
});

test('both languages preserve safe load failure and loading states without record writes', () => {
  for (const language of ['en', 'tr']) {
    const failure = presentation({ language, loadError: 'synthetic-invalid-storage' });
    assert.ok(failure.text().includes(failure.copy().loadError));
    assert.ok(failure.text().includes(failure.copy().loadErrorHelp));
    assert.ok(!failure.text().includes(fixture.notes[0]));
    const loading = presentation({ language, ready: false });
    assert.ok(loading.text().includes(loading.copy().loading));
    assert.ok(!loading.text().includes(fixture.name));
  }
});
