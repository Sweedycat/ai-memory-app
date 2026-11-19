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
const { createLifeRecordStore, decodeLifeDocument, LIFE_STORAGE_KEY } = load('src/utils/lifeRecordStore.ts', { './lifeRecords': model });
const record = (id = 'synthetic-life', extra = {}) => ({ id, title: 'Synthetic inspection', category: 'vehicle-inspection', dueDate: '2026-06-02', notes: '', recurring: false, history: [], ...extra });
const document = records => JSON.stringify({ version: 1, revision: 0, records, previous: null });
function memory(initial = null) {
  let raw = initial, writes = 0, reads = 0;
  return {
    get raw() { return raw; }, set raw(value) { raw = value; },
    get writes() { return writes; }, get reads() { return reads; },
    async getItem(key) { assert.equal(key, LIFE_STORAGE_KEY); reads++; return raw; },
    async setItem(key, value) { assert.equal(key, LIFE_STORAGE_KEY); writes++; raw = value; },
  };
}

test('missing, intentionally empty and populated documents open without writing or other storage keys', async () => {
  for (const raw of [null, document([]), document([record()])]) {
    const storage = memory(raw), store = createLifeRecordStore(storage);
    await store.reload();
    assert.equal(store.getState().status, 'ready');
    assert.equal(store.getState().records.length, raw?.includes('synthetic-life') ? 1 : 0);
    assert.equal(storage.writes, 0);
    assert.equal(storage.raw, raw);
  }
});

test('strict document validation preserves corrupt/unsupported/duplicate/oversized bytes and blocks all mutation', async () => {
  const inputs = ['{broken', '[]', JSON.stringify({ version: 2, revision: 0, records: [], previous: null }),
    document([record(), record()]), document([record('a', { notes: null })]),
    JSON.stringify({ version: 1, revision: 1, records: [], previous: { revision: 0, records: [null] } }),
    JSON.stringify({ version: 1, revision: 2, records: [], previous: { revision: 0, records: [] } }),
    JSON.stringify({ version: 1, revision: 1, records: [], previous: { revision: 0, records: [], previous: null } }),
    ' '.repeat(model.LIFE_LIMITS.documentCharacters + 1)];
  for (const raw of inputs) {
    assert.throws(() => decodeLifeDocument(raw));
    const storage = memory(raw), store = createLifeRecordStore(storage);
    await store.reload();
    assert.equal(store.getState().error, 'load');
    assert.equal(await store.save(record(), null), false);
    assert.equal(await store.remove(record()), false);
    assert.equal(await store.complete(record(), new Date('2026-06-02T00:00:00.000Z'), null), false);
    assert.equal(storage.writes, 0);
    assert.equal(storage.raw, raw);
  }
});

test('a failed read leaves existing published records and bytes untouched until a successful explicit reload', async () => {
  const storage = memory(document([record()]));
  const get = storage.getItem;
  const store = createLifeRecordStore(storage);
  await store.reload();
  storage.getItem = async () => { throw Error('Synthetic unavailable read'); };
  await store.reload();
  assert.equal(store.getState().status, 'error');
  assert.equal(store.getState().records[0].id, 'synthetic-life');
  assert.equal(await store.save(record('new'), null), false);
  assert.equal(storage.writes, 0);
  storage.getItem = get;
  await store.reload();
  assert.equal(store.getState().status, 'ready');
});

test('verified saves and deletion retain a complete one-generation snapshot, including deliberately empty lists', async () => {
  const storage = memory(), store = createLifeRecordStore(storage);
  await store.reload();
  assert.equal(await store.save(record(), null), true);
  let saved = decodeLifeDocument(storage.raw);
  assert.deepEqual(saved.previous, { revision: 0, records: [] });
  const base = store.getState().records[0];
  assert.equal(await store.save({ ...base, notes: 'Synthetic revision' }, base), true);
  saved = decodeLifeDocument(storage.raw);
  assert.deepEqual(saved.previous.records, [record()]);
  assert.equal(saved.previous.previous, undefined);
  assert.equal(await store.remove(store.getState().records[0]), true);
  saved = decodeLifeDocument(storage.raw);
  assert.deepEqual(saved.records, []);
  assert.equal(saved.previous.records[0].notes, 'Synthetic revision');
  const reopened = createLifeRecordStore(storage);
  await reopened.reload();
  assert.deepEqual(reopened.getState().records, []);
  assert.equal(storage.writes, 3);
});

test('full-base edit/delete/complete reject stale conflicts and concurrent creates are serialized', async () => {
  const storage = memory(document([record()])), store = createLifeRecordStore(storage);
  await store.reload();
  const base = store.getState().records[0];
  const outcomes = await Promise.all([store.save({ ...base, notes: 'First edit' }, base), store.save({ ...base, title: 'Stale edit' }, base)]);
  assert.deepEqual(outcomes, [true, false]);
  assert.equal(store.getState().error, 'conflict');
  assert.equal(await store.remove(base), false);
  assert.equal(await store.complete(base, new Date('2026-06-02T00:00:00.000Z'), null), false);
  assert.equal(storage.writes, 1);
  const creates = await Promise.all([store.save(record('second'), null), store.save(record('third'), null)]);
  assert.deepEqual(creates, [true, true]);
  assert.equal(store.getState().records.length, 3);
  assert.equal(await store.save(record('second'), null), false);
  assert.equal(storage.writes, 3);
});

test('completion preserves history and cannot be accidentally undone or truncated by ordinary edits', async () => {
  const storage = memory(document([record('r', { recurring: true })])), store = createLifeRecordStore(storage);
  await store.reload();
  const base = store.getState().records[0];
  const now = new Date('2026-06-03T12:00:00.000Z');
  assert.equal(await store.complete(base, now, '2026-07-02'), true);
  const next = store.getState().records[0];
  assert.equal(next.history.length, 1);
  assert.equal(decodeLifeDocument(storage.raw).previous.records[0].dueDate, base.dueDate);
  assert.equal(await store.save({ ...next, history: [] }, next), false);
  assert.equal(await store.save({ ...next, completedAt: now.toISOString() }, next), false);
  assert.equal(await store.save(record('injected', { history: next.history }), null), false);
  assert.equal(await store.complete(next, now, null), true);
  const done = store.getState().records[0];
  assert.equal(await store.save({ ...done, notes: 'Edited completed record' }, done), true);
  assert.equal(store.getState().records[0].history.length, 2);
  assert.equal(store.getState().records[0].completedAt, now.toISOString());
});

test('interruption before setItem and lost acknowledgement after setItem block retry until reload reconciles', async () => {
  for (const afterWrite of [false, true]) {
    const original = document([record()]);
    const storage = memory(original), write = storage.setItem;
    let fail = true;
    storage.setItem = async (key, bytes) => {
      if (afterWrite || !fail) await write(key, bytes);
      if (fail) throw Error('Synthetic interrupted write');
    };
    const store = createLifeRecordStore(storage);
    await store.reload();
    const base = store.getState().records[0];
    assert.equal(await store.save({ ...base, notes: 'Saved revision' }, base), false);
    assert.equal(store.getState().status, 'error');
    assert.equal(store.getState().records[0].notes, '');
    const uncertainBytes = storage.raw;
    assert.equal(await store.save(record('blocked'), null), false);
    assert.equal(storage.raw, uncertainBytes);
    assert.equal(afterWrite ? decodeLifeDocument(uncertainBytes).previous.records[0].notes : uncertainBytes, afterWrite ? '' : original);
    fail = false;
    await store.reload();
    assert.equal(store.getState().records[0].notes, afterWrite ? 'Saved revision' : '');
    assert.equal(await store.save(record('allowed'), null), true);
  }
});

test('publication waits for verified readback; mismatch and failed readback never publish a speculative edit', async () => {
  for (const mode of ['pause', 'mismatch', 'throw']) {
    const storage = memory(document([record()])), read = storage.getItem;
    let wrote = false, release;
    const write = storage.setItem;
    storage.setItem = async (key, raw) => { await write(key, raw); wrote = true; };
    storage.getItem = key => {
      if (!wrote) return read(key);
      if (mode === 'throw') return Promise.reject(Error('Synthetic readback failure'));
      if (mode === 'mismatch') return Promise.resolve(document([]));
      return new Promise(resolve => { release = () => resolve(storage.raw); });
    };
    const store = createLifeRecordStore(storage);
    await store.reload();
    const base = store.getState().records[0];
    const save = store.save({ ...base, notes: 'Verified revision' }, base);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(store.getState().records[0].notes, '');
    if (mode === 'pause') { assert.equal(store.getState().busy, true); release(); }
    assert.equal(await save, mode === 'pause');
    assert.equal(store.getState().records[0].notes, mode === 'pause' ? 'Verified revision' : '');
    if (mode !== 'pause') assert.equal(store.getState().status, 'error');
  }
});

test('reload drains an in-flight writer, prevents external overwrite, and callers cannot mutate cached records', async () => {
  const storage = memory(document([record()])), write = storage.setItem;
  let release;
  storage.setItem = (key, raw) => new Promise(resolve => { release = async () => { await write(key, raw); resolve(); }; });
  const store = createLifeRecordStore(storage);
  await store.reload();
  const base = store.getState().records[0];
  const save = store.save({ ...base, notes: 'In flight' }, base);
  await new Promise(resolve => setImmediate(resolve));
  const before = storage.reads;
  const reload = store.reload();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(storage.reads, before);
  await release();
  assert.equal(await save, true);
  await reload;
  assert.equal(store.getState().records[0].notes, 'In flight');
  store.getState().records[0].history.push({ invalid: true });
  assert.equal(store.getState().records[0].history.length, 0);
  storage.raw = document([record('outside')]);
  const externalBytes = storage.raw;
  assert.equal(await store.remove(store.getState().records[0]), false);
  assert.equal(store.getState().error, 'conflict');
  assert.equal(storage.raw, externalBytes);
  assert.equal(storage.writes, 1);
  await store.reload();
  assert.equal(store.getState().records[0].id, 'outside');
});

test('invalid edits and capacity exhaustion fail before a write without dropping existing data', async () => {
  const records = Array.from({ length: model.LIFE_LIMITS.records }, (_, i) => record(String(i)));
  const storage = memory(document(records)), store = createLifeRecordStore(storage);
  await store.reload();
  assert.equal(await store.save(record('overflow'), null), false);
  assert.equal(await store.save(record('invalid', { dueDate: '2026-02-30' }), null), false);
  assert.equal(storage.writes, 0);
  assert.equal(store.getState().records.length, model.LIFE_LIMITS.records);
  assert.equal(storage.raw, document(records));
});
