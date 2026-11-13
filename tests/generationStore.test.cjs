const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/generationStore.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
const ctx = { module: { exports: {} }, require() { throw Error('Unexpected import'); } };
ctx.exports = ctx.module.exports;
vm.runInNewContext(js, ctx);
const { createGenerationStore } = ctx.module.exports;
const A = 'a'.repeat(32), B = 'b'.repeat(32), C = 'c'.repeat(32);
const ROOT = '@ai-memory/generation-v1/';
const POINTER = ROOT + 'active';
const key = (id) => ROOT + 'data/' + id;
const codec = { encode: JSON.stringify, decode: JSON.parse };

function harness() {
  const values = new Map();
  let failOn = null;
  const store = {
    async getItem(k) { return values.has(k) ? values.get(k) : null; },
    async setItem(k, v) {
      if (k === failOn) throw Error('Simulated write failure');
      values.set(k, v);
    },
  };
  return { values, store, fail(k) { failOn = k; } };
}

test('staging and activation preserve old generation for recovery', async () => {
  const h = harness();
  const s = createGenerationStore(h.store, codec, () => B);
  h.values.set(key(A), JSON.stringify({ records: ['old'] }));
  h.values.set(POINTER, A);
  await s.stageAndActivate({ records: ['new'] });
  assert.equal(h.values.get(POINTER), B);
  assert.equal(JSON.stringify(await s.readActive()), JSON.stringify({ records: ['new'] }));
  assert.deepEqual(JSON.parse(h.values.get(key(A))), { records: ['old'] });
});

test('failed stage write never switches active pointer', async () => {
  const h = harness();
  h.values.set(key(A), '{"old":true}');
  h.values.set(POINTER, A);
  h.fail(key(B));
  await assert.rejects(createGenerationStore(h.store, codec, () => B)
    .stageAndActivate({ new: true }), /Simulated/);
  assert.equal(h.values.get(POINTER), A);
});

test('failed pointer write leaves previous generation active', async () => {
  const h = harness();
  h.values.set(key(A), '{"old":true}');
  h.values.set(POINTER, A);
  h.fail(POINTER);
  await assert.rejects(createGenerationStore(h.store, codec, () => B)
    .stageAndActivate({ new: true }), /Simulated/);
  assert.equal(h.values.get(POINTER), A);
  assert.ok(h.values.has(key(B)));
});

test('missing or corrupt active generation refuses activation', async () => {
  for (const value of [null, '{broken']) {
    const h = harness();
    h.values.set(POINTER, A);
    if (value !== null) h.values.set(key(A), value);
    await assert.rejects(createGenerationStore(h.store, codec, () => B)
      .stageAndActivate({ new: true }));
    assert.equal(h.values.get(POINTER), A);
    assert.equal(h.values.has(key(B)), false);
  }
});

test('collision and concurrent pointer changes fail closed', async () => {
  const h = harness();
  h.values.set(key(A), '{"old":true}');
  h.values.set(POINTER, A);
  h.values.set(key(B), '{"existing":true}');
  await assert.rejects(createGenerationStore(h.store, codec, () => B)
    .stageAndActivate({ new: true }), /already exists/);
  const other = harness();
  other.values.set(key(A), '{"old":true}');
  other.values.set(POINTER, A);
  const store = {
    getItem: other.store.getItem,
    async setItem(k, v) {
      await other.store.setItem(k, v);
      if (k === key(B)) other.values.set(POINTER, C);
    },
  };
  await assert.rejects(createGenerationStore(store, codec, () => B)
    .stageAndActivate({ new: true }), /changed during staging/);
  assert.equal(other.values.get(POINTER), C);
});

test('invalid id and corrupted staged read fail before pointer activation', async () => {
  const h = harness();
  await assert.rejects(createGenerationStore(h.store, codec, () => '../bad')
    .stageAndActivate({ x: 1 }), /Invalid generation/);
  const broken = {
    ...h.store,
    async getItem(k) {
      if (k === key(B)) return '{"tampered":true}';
      return h.store.getItem(k);
    },
  };
  await assert.rejects(createGenerationStore(broken, codec, () => B)
    .stageAndActivate({ x: 1 }), /verification failed/);
  assert.equal(h.values.get(POINTER), undefined);
});

test('experimental adapter never reads or writes legacy people-v1 key', () => {
  assert.doesNotMatch(source, /@ai-memory\/people-v1|removeItem|multiRemove/);
});

test('active pointer changing during read refuses torn snapshot', async () => {
  const h = harness();
  h.values.set(POINTER, A);
  h.values.set(key(A), '{"old":true}');
  const storage = {
    ...h.store,
    async getItem(k) {
      if (k === key(A)) {
        h.values.set(POINTER, C);
      }
      return h.store.getItem(k);
    },
  };
  await assert.rejects(createGenerationStore(storage, codec, () => B).readActive(), /changed during read/);
});

test('pointer mutation after activation is reported as uncertain', async () => {
  const h = harness();
  const storage = {
    ...h.store,
    async setItem(k, v) {
      await h.store.setItem(k, v);
      if (k === POINTER) h.values.set(POINTER, C);
    },
  };
  await assert.rejects(
    createGenerationStore(storage, codec, () => B).stageAndActivate({ new: true }),
    /outcome uncertain/,
  );
  assert.equal(h.values.has(key(B)), true);
});

test('concurrent pointer switch during preflight cannot overwrite newer generation', async () => {
  const h = harness();
  h.values.set(POINTER, A);
  h.values.set(key(A), '{"old":true}');
  h.values.set(key(C), '{"other":true}');
  let pointerReads = 0;
  const storage = {
    ...h.store,
    async getItem(k) {
      if (k === POINTER) {
        pointerReads += 1;
        // First and second reads observe A; the third read inside
        // readActive observes A; the fourth preflight read observes C.
        if (pointerReads === 4) h.values.set(POINTER, C);
      }
      return h.store.getItem(k);
    },
  };
  await assert.rejects(
    createGenerationStore(storage, codec, () => B).stageAndActivate({ new: true }),
    /changed before staging/,
  );
  assert.equal(h.values.get(POINTER), C);
  assert.equal(h.values.has(key(B)), false);
});

test('readActive refuses pointer initialization between empty reads', async () => {
  const h = harness();
  let reads = 0;
  const storage = {
    ...h.store,
    async getItem(k) {
      if (k === POINTER && ++reads === 2) h.values.set(POINTER, A);
      return h.store.getItem(k);
    },
  };
  await assert.rejects(
    createGenerationStore(storage, codec, () => B).readActive(),
    /changed during read/,
  );
});

test('invalid codec output is rejected before any generation write', async () => {
  const h = harness();
  const badCodec = { encode() { return undefined; }, decode: JSON.parse };
  await assert.rejects(
    createGenerationStore(h.store, badCodec, () => B).stageAndActivate({ x: 1 }),
    /codec produced invalid data/,
  );
  assert.equal(h.values.size, 0);
});

test('lossy codec roundtrip is rejected before pointer activation', async () => {
  const h = harness();
  const lossyCodec = {
    encode: JSON.stringify,
    decode() { return { lost: true }; },
  };
  await assert.rejects(
    createGenerationStore(h.store, lossyCodec, () => B).stageAndActivate({ original: true }),
    /roundtrip verification failed/,
  );
  assert.equal(h.values.has(POINTER), false);
  assert.equal(h.values.has(key(B)), false);
});

test('concurrent first initialization before staging is refused', async () => {
  const h = harness();
  let reads = 0;
  const storage = {
    ...h.store,
    async getItem(k) {
      if (k === POINTER && ++reads === 2) h.values.set(POINTER, A);
      return h.store.getItem(k);
    },
  };
  await assert.rejects(
    createGenerationStore(storage, codec, () => B).stageAndActivate({ x: 1 }),
    /changed before staging/,
  );
  assert.equal(h.values.has(key(B)), false);
});

test('late generation collision prevents candidate encoding and writes', async () => {
  const h = harness();
  let generationReads = 0;
  let encoded = false;
  const storage = {
    ...h.store,
    async getItem(k) {
      if (k === key(B) && ++generationReads === 2) h.values.set(key(B), '{"other":true}');
      return h.store.getItem(k);
    },
  };
  const guardedCodec = { encode(v) { encoded = true; return JSON.stringify(v); }, decode: JSON.parse };
  await assert.rejects(
    createGenerationStore(storage, guardedCodec, () => B).stageAndActivate({ x: 1 }),
    /already exists/,
  );
  assert.equal(encoded, false);
  assert.equal(h.values.has(POINTER), false);
});
