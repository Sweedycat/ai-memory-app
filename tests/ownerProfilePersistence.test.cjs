const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { presentationImports } = require('./helpers/presentation.cjs');

function load(file, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const local = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
  } }).outputText)(name => {
    if (!(name in imports)) throw Error('Unexpected import: ' + name);
    return imports[name];
  }, local, local.exports);
  return local.exports;
}

const KEY = '@ai-memory/owner-profile/v1';
const privateChild = { type: 'PrivateApp', props: {} };
const profile = { name: 'Synthetic Owner', preferredName: 'Synthetic', role: 'Test role' };
const copy = load('src/strings/ownerProfile.en.ts').ownerProfileEn;

// Executes the real component and its hook callbacks. Native elements and child
// gates are represented as nodes; this is not an Android rendering/lifecycle test.
function harness(storage) {
  const slots = [], effects = [];
  let cursor = 0, scheduled = [], dirty = false, output, mounted = true;
  const react = {
    createElement(type, props, ...children) {
      return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
    },
    createContext(value) { return { Provider: 'OwnerProvider', value }; },
    useContext(context) { return context.value; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        if (!mounted) throw Error('State applied after unmount');
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
        dirty = true;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useMemo(callback) { cursor++; return callback(); },
    useEffect(callback, deps) {
      const index = cursor++;
      const prior = effects[index];
      if (!prior || deps.some((dep, i) => !Object.is(dep, prior.deps[i]))) {
        scheduled.push(() => {
          prior?.cleanup?.();
          effects[index] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const native = Object.fromEntries(['KeyboardAvoidingView', 'Pressable', 'SafeAreaView',
    'ScrollView', 'StatusBar', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  native.Platform = { OS: 'android' };
  native.StyleSheet = { create: styles => styles };
  const { OwnerProfileGate: component } = load('src/components/OwnerProfileGate.tsx', {
    ...presentationImports(),
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    react: { __esModule: true, default: react, ...react },
    'react-native': native,
    './BugReportPanel': { BugReportPanel: 'BugReportPanel' },
    './ReminderPermissionGate': { ReminderPermissionGate: 'ReminderPermissionGate' },
    './SettingsPanel': { SettingsPanel: 'SettingsPanel' },
    '../strings/ownerProfile.en': { ownerProfileEn: copy },
  });
  function render() {
    cursor = 0;
    dirty = false;
    output = component({ children: privateChild });
    const pending = scheduled;
    scheduled = [];
    pending.forEach(run => run());
  }
  render();
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children)];
  }
  return {
    get nodes() { return nodes(output); },
    find(type, label) {
      const found = nodes(output).find(node => node.type === type &&
        (label === undefined || node.props.accessibilityLabel === label));
      assert.ok(found, 'Expected ' + type + (label ? ': ' + label : ''));
      return found;
    },
    async flush() {
      for (let i = 0; i < 8; i++) {
        await new Promise(resolve => setImmediate(resolve));
        if (mounted && dirty) render();
      }
    },
    unmount() { mounted = false; effects.forEach(effect => effect?.cleanup?.()); },
  };
}

function storageFixture(raw, { failRead = false, failWrite = false } = {}) {
  return {
    raw, failRead, failWrite, reads: 0, writes: 0,
    async getItem(key) {
      assert.equal(key, KEY);
      this.reads++;
      if (this.failRead) throw Error('Synthetic storage read failure');
      return this.raw;
    },
    async setItem(key, value) {
      assert.equal(key, KEY);
      this.writes++;
      if (this.failWrite) throw Error('Synthetic storage write failure');
      this.raw = value;
    },
    async removeItem() { assert.fail('Profile recovery must never delete bytes'); },
    async clear() { assert.fail('Profile recovery must never clear storage'); },
  };
}

function assertClosed(h, { failed = false } = {}) {
  for (const type of ['PrivateApp', 'OwnerProvider', 'ReminderPermissionGate', 'SettingsPanel',
    'BugReportPanel', 'TextInput']) {
    assert.equal(h.nodes.some(node => node.type === type), false, 'Gate exposed ' + type);
  }
  const buttons = h.nodes.filter(node => node.type === 'Pressable');
  assert.equal(buttons.length, failed ? 1 : 0);
  if (failed) {
    assert.equal(buttons[0].props.accessibilityLabel, copy.retryLoad);
    const alert = h.nodes.find(node => node.props.accessibilityRole === 'alert');
    assert.equal(alert?.props.children, copy.loadExplanation);
  }
}

test('read failures and all non-null invalid profiles preserve bytes and block onboarding/private content', async () => {
  const invalid = ['', ' ', '{malformed', 'null', '[]', '42', '"invalid"', '{}',
    '{"name":""}', '{"name":"   "}', '{"name":5}',
    JSON.stringify({ ...profile, preferredName: null }),
    JSON.stringify({ ...profile, role: 42 })];
  for (const source of [{ raw: JSON.stringify(profile), failRead: true }, ...invalid.map(raw => ({ raw }))]) {
    const storage = storageFixture(source.raw, source);
    const h = harness(storage);
    assertClosed(h);
    await h.flush();
    assertClosed(h, { failed: true });
    assert.equal(storage.raw, source.raw);
    assert.equal(storage.reads, 1);
    assert.equal(storage.writes, 0);
    await h.flush();
    assert.equal(storage.reads, 1, 'Failure must not start automatic retries');
    h.unmount();
  }
});

test('retry reads only, rejects repeated invalid data, then opens a valid profile without writing', async () => {
  const original = '{synthetic-corruption';
  const storage = storageFixture(original);
  const h = harness(storage);
  await h.flush();
  const retry = h.find('Pressable', copy.retryLoad).props.onPress;
  retry();
  retry();
  await h.flush();
  assertClosed(h, { failed: true });
  assert.equal(storage.reads, 2);
  assert.equal(storage.writes, 0);
  assert.equal(storage.raw, original);
  storage.raw = JSON.stringify(profile);
  h.find('Pressable', copy.retryLoad).props.onPress();
  await h.flush();
  assert.equal(storage.reads, 3);
  assert.equal(storage.writes, 0);
  assert.ok(h.nodes.includes(privateChild));
  assert.equal(h.find('OwnerProvider').props.value.displayName, profile.preferredName);
  h.unmount();
});

test('retry to a confirmed missing profile opens onboarding; creation publishes only after persistence', async () => {
  const storage = storageFixture(JSON.stringify(profile), { failRead: true });
  const h = harness(storage);
  await h.flush();
  storage.failRead = false;
  storage.raw = null;
  let release;
  storage.setItem = (key, value) => {
    assert.equal(key, KEY);
    storage.writes++;
    return new Promise(resolve => { release = () => { storage.raw = value; resolve(); }; });
  };
  h.find('Pressable', copy.retryLoad).props.onPress();
  await h.flush();
  assert.equal(storage.reads, 2);
  assert.equal(storage.writes, 0);
  assert.equal(h.nodes.some(node => node.type === 'PrivateApp'), false);
  h.find('TextInput', 'Your full name').props.onChangeText(' Synthetic New Owner ');
  await h.flush();
  h.find('Pressable', 'Create private owner profile').props.onPress();
  await h.flush();
  assert.equal(storage.writes, 1);
  assert.equal(storage.raw, null);
  assert.equal(h.nodes.some(node => node.type === 'PrivateApp'), false);
  release();
  await h.flush();
  assert.deepEqual(JSON.parse(storage.raw), { name: 'Synthetic New Owner', preferredName: '', role: '' });
  assert.ok(h.nodes.includes(privateChild));
  h.unmount();
});

test('valid and name-only legacy profiles open without writes and preserve settings/edit/cancel navigation', async () => {
  for (const stored of [profile, { name: '  Synthetic Legacy Owner  ' }]) {
    const original = JSON.stringify(stored);
    const storage = storageFixture(original);
    const h = harness(storage);
    await h.flush();
    assert.ok(h.nodes.includes(privateChild));
    const controls = h.find('OwnerProvider').props.value;
    assert.equal(controls.displayName, stored.preferredName || stored.name.trim());
    controls.openSettings();
    await h.flush();
    const settings = h.find('SettingsPanel');
    assert.equal(settings.props.role, stored.role || '');
    settings.props.onEditProfile();
    await h.flush();
    assert.equal(h.find('TextInput', 'Your full name').props.value, stored.name.trim());
    h.find('TextInput', 'Your full name').props.onChangeText('Unsaved synthetic edit');
    await h.flush();
    h.find('Pressable', 'Cancel editing owner profile').props.onPress();
    await h.flush();
    h.find('SettingsPanel').props.onClose();
    await h.flush();
    assert.ok(h.nodes.includes(privateChild));
    assert.equal(storage.raw, original);
    assert.equal(storage.writes, 0);
    h.unmount();
  }
});

test('editing an existing profile persists before applying and returns to settings after success', async () => {
  const original = JSON.stringify(profile);
  const storage = storageFixture(original);
  const h = harness(storage);
  await h.flush();
  h.find('OwnerProvider').props.value.openSettings();
  await h.flush();
  h.find('SettingsPanel').props.onEditProfile();
  await h.flush();
  h.find('TextInput', 'Preferred name or nickname').props.onChangeText(' Revised Synthetic ');
  await h.flush();
  let release;
  storage.setItem = (key, value) => {
    assert.equal(key, KEY);
    storage.writes++;
    return new Promise(resolve => { release = () => { storage.raw = value; resolve(); }; });
  };
  h.find('Pressable', 'Save owner profile changes').props.onPress();
  await h.flush();
  assert.equal(storage.raw, original);
  assert.equal(storage.writes, 1);
  assert.equal(h.nodes.some(node => node.type === 'SettingsPanel'), false);
  assert.equal(h.nodes.some(node => node.type === 'PrivateApp'), false);
  release();
  await h.flush();
  assert.equal(h.find('SettingsPanel').props.displayName, 'Revised Synthetic');
  assert.deepEqual(JSON.parse(storage.raw), { ...profile, preferredName: 'Revised Synthetic' });
  h.unmount();
});

test('a successful missing read allows onboarding, failed save retains draft and retry persists before opening', async () => {
  const storage = storageFixture(null, { failWrite: true });
  const h = harness(storage);
  await h.flush();
  assert.equal(storage.writes, 0);
  const create = h.find('Pressable', 'Create private owner profile');
  assert.equal(create.props.disabled, true);
  h.find('TextInput', 'Your full name').props.onChangeText(profile.name);
  h.find('TextInput', 'Preferred name or nickname').props.onChangeText(profile.preferredName);
  h.find('TextInput', 'Role or short description').props.onChangeText(profile.role);
  await h.flush();
  h.find('Pressable', 'Create private owner profile').props.onPress();
  await h.flush();
  assert.equal(storage.writes, 1);
  assert.equal(storage.raw, null);
  assert.equal(h.nodes.some(node => node.type === 'PrivateApp'), false);
  assert.equal(h.find('TextInput', 'Your full name').props.value, profile.name);
  storage.failWrite = false;
  h.find('Pressable', 'Create private owner profile').props.onPress();
  await h.flush();
  assert.equal(storage.writes, 2);
  assert.deepEqual(JSON.parse(storage.raw), profile);
  assert.ok(h.nodes.includes(privateChild));
  h.unmount();
});

test('unmount while a retry read is pending never applies the late profile or writes storage', async () => {
  const storage = storageFixture('');
  const h = harness(storage);
  await h.flush();
  let release;
  storage.getItem = () => new Promise(resolve => { storage.reads++; release = resolve; });
  h.find('Pressable', copy.retryLoad).props.onPress();
  await h.flush();
  assertClosed(h);
  h.unmount();
  release(JSON.stringify(profile));
  await h.flush();
  assert.equal(storage.raw, '');
  assert.equal(storage.writes, 0);
});
