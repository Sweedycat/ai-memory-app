const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const local = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText)(name => {
    if (!(name in imports)) throw Error('Unexpected import: ' + name);
    return imports[name];
  }, local, local.exports);
  return local.exports;
}
const model = load('src/utils/lifeRecords.ts');
const storeModule = load('src/utils/lifeRecordStore.ts', { './lifeRecords': model });
const KEY = storeModule.LIFE_STORAGE_KEY;
const record = (id = 'synthetic-life', extra = {}) => ({ id, title: 'Synthetic appointment', category: 'appointment',
  dueDate: '2026-06-02', notes: '', recurring: false, history: [], ...extra });
const document = records => JSON.stringify({ version: 1, revision: 0, records, previous: null });

// Mocked React effects/state exercise the actual hook and process-lifetime store.
// This is not native lifecycle or Android storage durability evidence.
function harness(storage) {
  let slots = [], effects = [], cursor = 0, scheduled = [], dirty = false;
  let output, mounted = true, lateStateWrites = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        if (!mounted) { lateStateWrites++; return; }
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
        dirty = true;
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(callback) { cursor++; return callback; },
    useEffect(callback, deps) {
      const index = cursor++, prior = effects[index];
      if (!prior || deps.some((dep, i) => !Object.is(dep, prior.deps[i]))) {
        scheduled.push(() => { prior?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  const hook = load('src/hooks/useLifeRecords.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage }, react,
    '../utils/lifeRecordStore': storeModule,
  }).useLifeRecords;
  function render() {
    cursor = 0; dirty = false; output = hook();
    const pending = scheduled; scheduled = []; pending.forEach(run => run());
  }
  render();
  return {
    get value() { return output; }, get lateStateWrites() { return lateStateWrites; },
    async flush() {
      for (let i = 0; i < 8; i++) {
        await new Promise(resolve => setImmediate(resolve));
        if (mounted && dirty) render();
      }
    },
    unmount() {
      effects.forEach(effect => effect?.cleanup?.());
      slots = []; effects = []; mounted = false;
    },
    remount() { mounted = true; render(); },
  };
}

test('hook opens missing/empty/populated records without a write and reports successful persisted edits', async () => {
  for (const initial of [null, document([]), document([record()])]) {
    let raw = initial, writes = 0;
    const h = harness({ getItem: async key => { assert.equal(key, KEY); return raw; },
      setItem: async (key, bytes) => { assert.equal(key, KEY); writes++; raw = bytes; } });
    assert.equal(h.value.status, 'loading');
    await h.flush();
    assert.equal(h.value.status, 'ready');
    assert.equal(h.value.busy, false);
    assert.equal(writes, 0);
    assert.equal(await h.value.save(record('new'), null), true);
    await h.flush();
    assert.equal(h.value.records.some(x => x.id === 'new'), true);
    assert.equal(writes, 1);
    const base = h.value.records.find(x => x.id === 'new');
    assert.equal(await h.value.complete(base, null), true);
    await h.flush();
    const done = h.value.records.find(x => x.id === 'new');
    assert.equal(typeof done.completedAt, 'string');
    assert.equal(done.history[0].dueDate, base.dueDate);
    assert.equal(await h.value.remove(done), true);
    await h.flush();
    assert.equal(h.value.records.some(x => x.id === 'new'), false);
    h.unmount();
  }
});

test('hook never replaces failed or corrupt reads with empty defaults; explicit reload can recover', async () => {
  for (const initial of ['{broken', 'throw']) {
    let raw = initial, writes = 0;
    const h = harness({ getItem: async () => {
      if (raw === 'throw') throw Error('Synthetic read failure');
      return raw;
    }, setItem: async () => { writes++; } });
    await h.flush();
    assert.equal(h.value.status, 'error');
    assert.equal(h.value.error, 'load');
    assert.equal(await h.value.save(record(), null), false);
    assert.equal(await h.value.remove(record()), false);
    assert.equal(await h.value.complete(record(), null), false);
    assert.equal(raw, initial);
    assert.equal(writes, 0);
    raw = document([record()]);
    await h.value.reload();
    await h.flush();
    assert.equal(h.value.status, 'ready');
    assert.equal(h.value.error, null);
    assert.equal(h.value.records.length, 1);
    h.unmount();
  }
});

test('hook retains confirmed records after uncertain saves and requires reload before another write', async () => {
  let raw = document([record()]), fail = true, writes = 0;
  const h = harness({ getItem: async () => raw, setItem: async (_, bytes) => {
    writes++; raw = bytes;
    if (fail) throw Error('Synthetic lost acknowledgement');
  } });
  await h.flush();
  const base = h.value.records[0];
  assert.equal(await h.value.save({ ...base, notes: 'Uncertain revision' }, base), false);
  await h.flush();
  assert.equal(h.value.status, 'error');
  assert.equal(h.value.error, 'save');
  assert.equal(h.value.records[0].notes, '');
  assert.equal(await h.value.save(record('blocked'), null), false);
  assert.equal(writes, 1);
  fail = false;
  await h.value.reload();
  await h.flush();
  assert.equal(h.value.records[0].notes, 'Uncertain revision');
  assert.equal(await h.value.save({ ...base, title: 'Stale draft' }, base), false);
  await h.flush();
  assert.equal(h.value.error, 'conflict');
  assert.equal(writes, 1);
  h.unmount();
});

test('lock-style remount drains the process writer and blocks callbacks from the retired mount', async () => {
  let raw = document([record()]), release, reads = 0, writes = 0;
  const h = harness({ getItem: async () => { reads++; return raw; }, setItem: (_, bytes) => new Promise(resolve => {
    writes++; release = () => { raw = bytes; resolve(); };
  }) });
  await h.flush();
  const oldCallbacks = h.value;
  const save = h.value.save({ ...h.value.records[0], notes: 'Saved across lock' }, h.value.records[0]);
  await h.flush();
  assert.equal(h.value.busy, true);
  h.unmount();
  assert.equal(await oldCallbacks.save(record('late'), null), false);
  assert.equal(await oldCallbacks.remove(record()), false);
  assert.equal(await oldCallbacks.complete(record(), null), false);
  await oldCallbacks.reload();
  h.remount();
  await h.flush();
  assert.equal(reads, 2); // opening read and pre-write comparison; no remount read yet
  assert.equal(h.value.status, 'loading');
  release();
  assert.equal(await save, true);
  await h.flush();
  assert.equal(h.value.status, 'ready');
  assert.equal(h.value.records[0].notes, 'Saved across lock');
  assert.equal(writes, 1);
  assert.equal(h.lateStateWrites, 0);
  h.unmount();
});

test('late load and late failed write after unmount cause no state updates or unhandled rejection', async () => {
  let resolveRead;
  const loading = harness({ getItem: () => new Promise(resolve => { resolveRead = resolve; }),
    setItem: async () => { throw Error('Unexpected write'); } });
  await loading.flush();
  loading.unmount();
  resolveRead(document([record()]));
  await loading.flush();
  assert.equal(loading.lateStateWrites, 0);

  let rejectWrite;
  const saving = harness({ getItem: async () => document([record()]),
    setItem: () => new Promise((_, reject) => { rejectWrite = reject; }) });
  await saving.flush();
  const base = saving.value.records[0];
  const pending = saving.value.save({ ...base, notes: 'Synthetic late save' }, base);
  await saving.flush();
  saving.unmount();
  rejectWrite(Error('Synthetic interrupted write'));
  assert.equal(await pending, false);
  await saving.flush();
  assert.equal(saving.lateStateWrites, 0);
});
