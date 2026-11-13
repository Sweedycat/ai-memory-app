const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/generationInspection.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
const ctx = { module: { exports: {} }, require() { throw Error('Unexpected import'); } };
ctx.exports = ctx.module.exports;
vm.runInNewContext(js, ctx);
const { inspectActiveGeneration, inspectKnownGeneration } = ctx.module.exports;
const id = 'a'.repeat(32);
const prefix = '@ai-memory/generation-v1/';
const pointer = prefix + 'active';
const key = prefix + 'data/' + id;
const codec = { encode: JSON.stringify, decode: JSON.parse };
const store = (values) => ({
  async getItem(k) { return values.has(k) ? values.get(k) : null; },
  async setItem() { throw Error('Read-only inspection must never write'); },
});

test('uninitialized, invalid pointer, missing and corrupt generations are distinguished', async () => {
  const values = new Map();
  const storage = store(values);
  assert.equal((await inspectActiveGeneration(storage, codec)).status, 'uninitialized');
  values.set(pointer, '../bad');
  assert.equal((await inspectActiveGeneration(storage, codec)).status, 'pointer-invalid');
  values.set(pointer, id);
  assert.equal((await inspectActiveGeneration(storage, codec)).status, 'missing');
  values.set(key, '{bad');
  assert.equal((await inspectActiveGeneration(storage, codec)).status, 'invalid');
  values.set(key, '{"synthetic":true}');
  assert.equal((await inspectActiveGeneration(storage, codec)).status, 'valid');
});

test('known valid generation is inspected without switching active pointer', async () => {
  const values = new Map([[key, '{"synthetic":true}']]);
  const result = await inspectKnownGeneration(store(values), codec, id);
  assert.equal(result.status, 'valid');
  assert.equal(values.has(pointer), false);
});

test('pointer changes during inspection are reported', async () => {
  const values = new Map([[pointer, id], [key, '{"synthetic":true}']]);
  const storage = {
    ...store(values),
    async getItem(k) {
      if (k === key) values.set(pointer, 'b'.repeat(32));
      return values.has(k) ? values.get(k) : null;
    },
  };
  assert.equal((await inspectActiveGeneration(storage, codec)).status, 'pointer-changed');
});

test('untrusted generation identifier is refused', async () => {
  await assert.rejects(inspectKnownGeneration(store(new Map()), codec, '../../people'), /Invalid/);
});

test('inspection module cannot write or delete personal records', () => {
  assert.doesNotMatch(source, /setItem\s*\(|removeItem\s*\(|fetch\s*\(|console\./);
});

test('pointer initialization between reads cannot be mistaken for empty store', async () => {
  let reads = 0;
  const storage = {
    async getItem(k) {
      if (k !== pointer) throw Error('Unexpected key');
      reads += 1;
      return reads === 1 ? null : id;
    },
  };
  assert.equal((await inspectActiveGeneration(storage, codec)).status, 'pointer-changed');
});

test('invalid pointer replaced during inspection is reported as a race', async () => {
  let reads = 0;
  const storage = {
    async getItem(k) {
      if (k !== pointer) throw Error('Unexpected key');
      reads += 1;
      return reads === 1 ? '../bad' : id;
    },
  };
  assert.equal((await inspectActiveGeneration(storage, codec)).status, 'pointer-changed');
});

test('empty generation payload is invalid', async () => {
  const values = new Map([[key, '']]);
  assert.equal((await inspectKnownGeneration(store(values), codec, id)).status, 'invalid');
});

test('lossy codec cannot mark a generation valid', async () => {
  const values = new Map([[key, '{"x":1}']]);
  const lossy = { decode() { return { x: 2 }; }, encode: JSON.stringify };
  assert.equal((await inspectKnownGeneration(store(values), lossy, id)).status, 'invalid');
});

test('generation changing between inspection reads is invalid', async () => {
  let reads = 0;
  const storage = {
    async getItem(k) {
      if (k !== key) throw Error('Unexpected key');
      return ++reads === 1 ? '{"x":1}' : '{"x":2}';
    },
  };
  assert.equal((await inspectKnownGeneration(storage, codec, id)).status, 'invalid');
});

test('pointer changing before data inspection is detected', async () => {
  let reads = 0;
  const storage = {
    async getItem(k) {
      if (k === pointer) return ++reads === 1 ? id : 'b'.repeat(32);
      throw Error('Data must not be read after pointer change');
    },
  };
  assert.equal((await inspectActiveGeneration(storage, codec)).status, 'pointer-changed');
});

test('pointer switching on final verification is detected', async () => {
  let reads = 0;
  const values = new Map([[key, '{"x":1}']]);
  const storage = {
    ...store(values),
    async getItem(k) {
      if (k === pointer) return ++reads < 4 ? id : 'b'.repeat(32);
      return values.get(k) ?? null;
    },
  };
  assert.equal((await inspectActiveGeneration(storage, codec)).status, 'pointer-changed');
});

test('non-string generation identifiers are rejected', async () => {
  for (const invalid of [null, undefined, 123, {}, ['a'.repeat(32)]]) {
    await assert.rejects(inspectKnownGeneration(store(new Map()), codec, invalid), /Invalid/);
  }
});

test('generation changing on last stability read is invalid', async () => {
  let reads = 0;
  const storage = {
    async getItem(k) {
      if (k !== key) throw Error('Unexpected key');
      return ++reads < 3 ? '{"x":1}' : '{"x":2}';
    },
  };
  assert.equal((await inspectKnownGeneration(storage, codec, id)).status, 'invalid');
});

test('data appearing after missing read cannot be reported missing', async () => {
  let reads = 0;
  const storage = {
    async getItem(k) {
      if (k !== key) throw Error('Unexpected key');
      return ++reads === 1 ? null : '{"x":1}';
    },
  };
  assert.equal((await inspectKnownGeneration(storage, codec, id)).status, 'invalid');
});

test('inspection never reads legacy people-v1 storage', () => {
  assert.doesNotMatch(source, /@ai-memory\/people-v1/);
});
