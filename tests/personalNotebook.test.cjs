const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/personalNotebook.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020
} }).outputText;
const context = { module: { exports: {} } };
context.exports = context.module.exports;
vm.runInNewContext(code, context);
const { decodePersonalNotebook: decode, searchPersonalNotebook: search } = context.module.exports;
const note = { id: 'n1', title: 'Vehicle', body: 'Inspection in March',
  createdAt: '2026-11-15T12:00:00.000Z', updatedAt: '2026-11-15T12:00:00.000Z' };
test('valid notes survive decoding', () => {
  assert.equal(JSON.stringify(decode(JSON.stringify([note]))), JSON.stringify([note]));
  assert.equal(decode('[]').length, 0);
});
test('corrupt or duplicate records reject the entire notebook', () => {
  for (const raw of ['broken', '{}', JSON.stringify([note, note]),
    JSON.stringify([note, {...note, id:'n2', body:42}]),
    JSON.stringify([{...note, title:'', body:' '}]),
    JSON.stringify([{...note, updatedAt:'2025-01-01T00:00:00.000Z'}]),
    JSON.stringify([{...note, body:'x'.repeat(20001)}])]) {
    assert.throws(() => decode(raw));
  }
});
test('search matches title and body without mutating original order', () => {
  const recent = {...note, id:'n2', title:'Other', updatedAt:'2026-11-16T12:00:00.000Z'};
  const notes = decode(JSON.stringify([note,recent]));
  assert.equal(search(notes,' VEHICLE ')[0].id,'n1');
  assert.equal(search(notes,'inspection').length,2);
  assert.equal(search(notes,'missing').length,0);
  assert.equal(search(notes,'')[0].id,'n2');
  assert.equal(notes[0].id,'n1');
});
