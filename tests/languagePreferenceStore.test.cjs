const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, imports = {}) {
  const local = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(
    name => { if (!Object.hasOwn(imports, name)) throw Error('Unexpected import: ' + name); return imports[name]; }, local, local.exports);
  return local.exports;
}
const language = load('src/i18n/language.ts');
const { createLanguagePreferenceStore: create, decodeLanguagePreference: decode, LANGUAGE_PREFERENCE_KEY: KEY } =
  load('src/i18n/languageStore.ts', { './language': language,
    '../preferences/enumPreferenceStore': load('src/preferences/enumPreferenceStore.ts') });
const document = (preference = 'system', revision = 0) => JSON.stringify({ version: 1, revision, preference });
function memory(initial = null) {
  let raw = initial, writes = 0, reads = 0;
  return {
    get raw() { return raw; }, set raw(value) { raw = value; },
    get writes() { return writes; }, get reads() { return reads; },
    async getItem(key) { assert.equal(key, KEY); reads++; return raw; },
    async setItem(key, value) { assert.equal(key, KEY); writes++; raw = value; },
  };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('construction and unloaded mutation perform no IO; missing and saved preferences reload without initial writes', async () => {
  assert.equal(KEY, '@ai-memory/language-preference-v1');
  for (const raw of [null, document(), document('en', 3), document('tr', 4)]) {
    const storage = memory(raw), store = create(storage);
    assert.equal(store.getState().preference, null);
    assert.equal(await store.save('tr', { preference: 'system', revision: 0 }), false);
    assert.equal(storage.reads, 0); assert.equal(storage.writes, 0);
    await store.reload();
    assert.equal(store.getState().status, 'ready');
    assert.equal(store.getState().preference, raw === null ? 'system' : decode(raw).preference);
    assert.equal(storage.writes, 0); assert.equal(storage.raw, raw);
  }
});

test('strict version/schema/size validation preserves invalid bytes and blocks mutation until explicit successful reload', async () => {
  for (const raw of ['{broken', 'null', '[]', 'true', '"tr"',
    JSON.stringify({ version: 2, revision: 0, preference: 'en' }),
    JSON.stringify({ version: 1, preference: 'tr' }),
    JSON.stringify({ version: 1, revision: -1, preference: 'en' }),
    JSON.stringify({ version: 1, revision: 0.5, preference: 'tr' }),
    JSON.stringify({ version: 1, revision: Number.MAX_SAFE_INTEGER + 1, preference: 'tr' }),
    JSON.stringify({ version: 1, revision: 0, preference: 'TR' }),
    JSON.stringify({ version: 1, revision: 0, preference: null }),
    JSON.stringify({ version: 1, revision: 0, preference: 'tr', extra: true }), ' '.repeat(257)]) {
    assert.throws(() => decode(raw));
    const storage = memory(raw), store = create(storage);
    await store.reload();
    assert.equal(store.getState().error, 'load'); assert.equal(store.getState().preference, null);
    assert.equal(await store.save('tr', { preference: 'system', revision: 0 }), false);
    assert.equal(storage.writes, 0); assert.equal(storage.raw, raw);
    storage.raw = document('en', 1);
    assert.equal(await store.save('tr', { preference: 'en', revision: 1 }), false); // No implicit recovery.
    await store.reload();
    assert.equal(await store.save('tr', store.getState()), true);
  }
});

test('failed reload retains last verified preference and never applies a system default or overwrites bytes', async () => {
  const storage = memory(document('tr', 2)), store = create(storage), get = storage.getItem;
  await store.reload();
  storage.getItem = async () => { throw Error('Synthetic unavailable read'); };
  await store.reload();
  assert.equal(store.getState().status, 'error'); assert.equal(store.getState().preference, 'tr');
  assert.equal(await store.save('en', store.getState()), false);
  assert.equal(storage.raw, document('tr', 2)); assert.equal(storage.writes, 0);
  storage.getItem = get;
  await store.reload();
  assert.equal(store.getState().status, 'ready');
});

test('save applies the preference only after confirmed readback and keeps state snapshots isolated', async () => {
  const storage = memory(), store = create(storage), get = storage.getItem;
  await store.reload();
  const entered = deferred(), release = deferred();
  storage.getItem = async key => {
    if (storage.writes === 1) { entered.resolve(); await release.promise; }
    return get(key);
  };
  const pending = store.save('tr', store.getState());
  await entered.promise;
  assert.equal(store.getState().preference, 'system');
  assert.equal(decode(storage.raw).preference, 'tr');
  const snapshot = store.getState(); snapshot.preference = 'en';
  release.resolve(); assert.equal(await pending, true);
  assert.equal(store.getState().preference, 'tr'); assert.equal(store.getState().revision, 1);
  const reopened = create(storage); await reopened.reload();
  assert.equal(reopened.getState().preference, 'tr'); assert.equal(storage.writes, 1);
});

test('queued saves serialize and reject stale bases, including revision conflicts when preference returns to the same value', async () => {
  const storage = memory(), store = create(storage);
  await store.reload();
  const base = store.getState();
  assert.deepEqual(await Promise.all([store.save('tr', base), store.save('en', base)]), [true, false]);
  assert.equal(storage.writes, 1); assert.equal(store.getState().error, 'conflict');
  assert.equal(await store.save('en', store.getState()), false);
  await store.reload();
  assert.equal(await store.save('system', store.getState()), true);
  assert.equal(await store.save('tr', base), false);
  assert.equal(decode(storage.raw).preference, 'system'); assert.equal(decode(storage.raw).revision, 2);
});

test('read-before-write refuses external bytes, including malformed changes, without replacing them', async () => {
  for (const changed of [document('en', 1), '{external-corruption']) {
    const storage = memory(document('tr', 0)), store = create(storage);
    await store.reload();
    storage.raw = changed;
    assert.equal(await store.save('en', store.getState()), false);
    assert.equal(store.getState().error, 'conflict');
    assert.equal(storage.raw, changed); assert.equal(storage.writes, 0);
    assert.equal(await store.save('system', store.getState()), false);
  }
});

test('interrupted setItem before or after persistence requires reload; no retry or rollback hides an unknown result', async () => {
  for (const afterWrite of [false, true]) {
    const storage = memory(document('en', 1)), store = create(storage), write = storage.setItem;
    let attempts = 0;
    storage.setItem = async (key, bytes) => {
      attempts++;
      if (afterWrite) await write(key, bytes);
      throw Error('Synthetic interrupted acknowledgement');
    };
    await store.reload();
    assert.equal(await store.save('tr', store.getState()), false);
    assert.equal(store.getState().preference, 'en'); assert.equal(store.getState().error, 'save');
    const uncertain = storage.raw;
    assert.equal(await store.save('system', store.getState()), false);
    assert.equal(attempts, 1); assert.equal(storage.raw, uncertain);
    const reopened = create(storage); await reopened.reload();
    assert.equal(reopened.getState().preference, afterWrite ? 'tr' : 'en');
    storage.setItem = write;
    await store.reload();
    assert.equal(store.getState().preference, afterWrite ? 'tr' : 'en');
    assert.equal(await store.save('system', store.getState()), true);
  }
});

test('read-before-write failure and failed/mismatched/corrupt readback block future changes until reload', async () => {
  for (const failure of ['before', 'readback', 'mismatch', 'corrupt']) {
    const storage = memory(document('en')), store = create(storage), get = storage.getItem;
    await store.reload();
    storage.getItem = async key => {
      if (failure === 'before' || (failure === 'readback' && storage.writes)) throw Error('Synthetic failed read');
      if (storage.writes && failure === 'mismatch') return document('system', 7);
      if (storage.writes && failure === 'corrupt') return '{synthetic-corruption';
      return get(key);
    };
    assert.equal(await store.save('tr', store.getState()), false);
    assert.equal(store.getState().preference, 'en'); assert.equal(store.getState().status, 'error');
    const count = storage.writes;
    assert.equal(await store.save('system', store.getState()), false);
    assert.equal(storage.writes, count);
    storage.getItem = get; await store.reload();
    assert.equal(store.getState().preference, failure === 'before' ? 'en' : 'tr');
  }
});

test('invalidation cancels queued writes and late reads without applying stale authority', async () => {
  const storage = memory(), store = create(storage);
  await store.reload();
  const queued = store.save('tr', store.getState());
  store.invalidate(); assert.equal(await queued, false); assert.equal(storage.writes, 0);
  const get = storage.getItem, entered = deferred(), release = deferred();
  storage.getItem = async key => { entered.resolve(); await release.promise; return get(key); };
  const loading = store.reload();
  await entered.promise; store.invalidate(); release.resolve(); await loading;
  assert.equal(store.getState().error, 'invalidated'); assert.equal(store.getState().preference, 'system');
  storage.getItem = get; await store.reload();
  assert.equal(store.getState().status, 'ready');
});

test('invalidation during each awaited save boundary prevents publication and reconciles any issued write only on reload', async () => {
  for (const boundary of ['before', 'write', 'readback']) {
    const storage = memory(document('en')), store = create(storage), get = storage.getItem, write = storage.setItem;
    await store.reload();
    const entered = deferred(), release = deferred();
    storage.getItem = async key => {
      if ((boundary === 'before' && storage.writes === 0) || (boundary === 'readback' && storage.writes === 1)) {
        entered.resolve(); await release.promise;
      }
      return get(key);
    };
    storage.setItem = async (key, bytes) => {
      if (boundary === 'write') { entered.resolve(); await release.promise; }
      await write(key, bytes);
    };
    const saving = store.save('tr', store.getState());
    await entered.promise; store.invalidate(); release.resolve();
    assert.equal(await saving, false);
    assert.equal(store.getState().preference, 'en'); assert.equal(store.getState().error, 'invalidated');
    assert.equal(await store.save('system', store.getState()), false);
    storage.getItem = get; storage.setItem = write;
    await store.reload();
    assert.equal(store.getState().preference, boundary === 'before' ? 'en' : 'tr');
    assert.equal(storage.writes, boundary === 'before' ? 0 : 1);
  }
});

test('explicit reload fences a pending save and reconciles its write without stale preference publication', async () => {
  const storage = memory(document('en')), store = create(storage), write = storage.setItem;
  await store.reload();
  const entered = deferred(), release = deferred();
  storage.setItem = async (key, bytes) => { entered.resolve(); await release.promise; await write(key, bytes); };
  const saving = store.save('tr', store.getState());
  await entered.promise;
  const loading = store.reload();
  assert.equal(store.getState().preference, 'en'); assert.equal(store.getState().status, 'loading');
  release.resolve(); assert.equal(await saving, false); await loading;
  assert.equal(store.getState().preference, 'tr'); assert.equal(storage.writes, 1);
});

test('invalid input/revision overflow writes nothing and throwing observers cannot turn confirmed writes into failures', async () => {
  const storage = memory(document('en')), store = create(storage);
  await store.reload();
  assert.equal(await store.save('unsupported', store.getState()), false);
  assert.equal(await store.save('tr', { preference: 'en', revision: -1 }), false);
  assert.equal(storage.writes, 0);
  let observations = 0;
  const unsubscribe = store.subscribe(() => { observations++; throw Error('Synthetic observer failure'); });
  assert.equal(await store.save('tr', store.getState()), true);
  unsubscribe(); const count = observations;
  await store.reload(); assert.equal(observations, count);
  const overflowStorage = memory(document('en', Number.MAX_SAFE_INTEGER)), overflow = create(overflowStorage);
  await overflow.reload();
  assert.equal(await overflow.save('tr', overflow.getState()), false);
  assert.equal(overflowStorage.writes, 0); assert.equal(overflowStorage.raw, document('en', Number.MAX_SAFE_INTEGER));
});
