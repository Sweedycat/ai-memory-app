const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
function load(name, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/utils', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  const context = {module:{exports:{}}, require: name => {
    if (!(name in imports)) throw Error('Unexpected import');
    return imports[name];
  }};
  context.exports = context.module.exports;
  vm.runInNewContext(code, context);
  return context.module.exports;
}
const model = load('personalNotebook');
const {openNotebookSession: open} = load('notebookSession', {'./personalNotebook':model});
const note = {id:'n1', title:'Synthetic', body:'Test only',
  createdAt:'2026-11-16T12:00:00.000Z', updatedAt:'2026-11-16T12:00:00.000Z'};
const {createNotebookAccessGate:create}=load('notebookAccessGate',{'./notebookSession':{openNotebookSession:open}});
const vault={readAuthenticated:async()=>null,replaceAuthenticated:async()=>{}};
test('locked access and duplicate opening are rejected',async()=>{
  const gate=create();
  assert.throws(()=>gate.getSession());
  const pending=gate.unlock(vault);
  await assert.rejects(gate.unlock(vault));
  const session=await pending;
  assert.equal(gate.getSession(),session);
  gate.lock();
  assert.throws(()=>gate.getSession());
  assert.throws(()=>session.snapshot());
});
test('locking during authenticated read rejects stale session',async()=>{
  const gate=create();
  let release, started;
  const entered=new Promise(r=>{started=r;});
  const pending=gate.unlock({...vault,readAuthenticated:()=>new Promise(r=>{release=r;started();})});
  const rejected=assert.rejects(pending);
  await entered;
  gate.lock();
  release(JSON.stringify([note]));
  await rejected;
  assert.throws(()=>gate.getSession());
  await gate.unlock(vault);
});
test('reopening waits for prior native write to settle',async()=>{
  const gate=create();
  let release, raw=null, reads=0;
  const storage={readAuthenticated:async()=>{reads++;return raw;},replaceAuthenticated:v=>new Promise(r=>{release=()=>{raw=v;r();};})};
  const old=await gate.unlock(storage);
  const pending=old.save(note, null);
  const rejected=assert.rejects(pending);
  gate.lock();
  const reopening=gate.unlock(storage);
  await Promise.resolve();
  assert.equal(reads,1);
  release();
  await rejected;
  const next=await reopening;
  assert.equal(reads,2);
  assert.equal(next.snapshot()[0].id,note.id);
});
