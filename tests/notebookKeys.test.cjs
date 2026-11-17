const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { load, marker } = require('./helpers/notebookRuntime.cjs');
const { resolveNotebookKey } = load('notebookKeys');
const generated = () => ({ version: 1, id: marker, key: crypto.randomBytes(32).toString('hex') });
function fixture() {
  let state = { revision: 0, keyId: null, active: null, previous: null, draft: null };
  let raw = null, writes = 0, generations = 0;
  return {
    get raw() { return raw; }, set raw(value) { raw = value; },
    get writes() { return writes; }, get generations() { return generations; },
    get state() { return state; },
    db: { read: async () => ({ ...state }), initialize: async id => { state = { ...state, revision: 1, keyId: id }; return state; } },
    store: { read: async () => raw, write: async value => { raw = value; writes++; } },
    generate: async () => { generations++; return generated(); },
  };
}
test('bootstrap verifies secure persistence before database binding; reopening never rotates', async () => {
  const f = fixture();
  f.db.initialize = async id => {
    assert.equal(JSON.parse(f.raw).id, id);
    f.state.keyId = id; f.state.revision = 1; return f.state;
  };
  const key = await resolveNotebookKey(f.db, f.store, f.generate);
  assert.equal(key.id, marker);
  assert.equal(f.writes, 1);
  assert.equal(f.generations, 1);
  assert.equal((await resolveNotebookKey(f.db, f.store, f.generate)).key, key.key);
  assert.equal(f.writes, 1); assert.equal(f.generations, 1);
});
test('an orphan secure key is reused after interrupted binding or lost write acknowledgement', async () => {
  const f = fixture();
  f.store.write = async value => { f.raw = value; throw Error('Synthetic lost acknowledgement'); };
  await assert.rejects(resolveNotebookKey(f.db, f.store, f.generate));
  assert.equal(f.state.keyId, null);
  const orphan = JSON.parse(f.raw);
  assert.equal((await resolveNotebookKey(f.db, f.store, f.generate)).key, orphan.key);
  assert.equal(f.generations, 1);
});
test('missing/malformed/mismatched existing keys never regenerate or alter database/data', async () => {
  for (const raw of [null, '', 'null', '{}', 'x'.repeat(300), JSON.stringify({ ...generated(), id: 'f'.repeat(32) })]) {
    const f = fixture(); f.raw = raw; f.state.keyId = marker; f.state.revision = 1;
    f.state.active = 'existing ciphertext preserved';
    const before = JSON.stringify(f.state);
    await assert.rejects(resolveNotebookKey(f.db, f.store, f.generate), /key unavailable/);
    assert.equal(JSON.stringify(f.state), before);
    assert.equal(f.raw, raw); assert.equal(f.writes, 0); assert.equal(f.generations, 0);
  }
});
test('read errors, unbound existing data and unconfirmed key writes fail closed', async () => {
  const f = fixture();
  f.store.read = async () => { throw Error('Synthetic secure-store failure'); };
  await assert.rejects(resolveNotebookKey(f.db, f.store, f.generate));
  assert.equal(f.generations, 0);
  const existing = fixture(); existing.state.draft = 'encrypted recovery evidence';
  await assert.rejects(resolveNotebookKey(existing.db, existing.store, existing.generate));
  assert.equal(existing.writes, 0);
  const unwritten = fixture(); unwritten.store.write = async () => {};
  await assert.rejects(resolveNotebookKey(unwritten.db, unwritten.store, unwritten.generate));
  assert.equal(unwritten.state.keyId, null);
});
test('concurrent key creation is refused before a second secret can be written', async () => {
  const f = fixture();
  let release;
  f.generate = () => new Promise(resolve => { release = () => resolve(generated()); });
  const first = resolveNotebookKey(f.db, f.store, f.generate);
  while (!release) await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(resolveNotebookKey(f.db, f.store, f.generate), /busy/);
  release(); await first;
  assert.equal(f.writes, 1);
});
