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
test('save and remove only publish after persistence succeeds', async () => {
  let raw = null;
  const session = await open({readAuthenticated:async()=>raw, replaceAuthenticated:async v=>{raw=v;}});
  await session.save(note);
  assert.equal(JSON.parse(raw)[0].id,'n1');
  session.snapshot()[0].body = 'changed copy';
  assert.equal(session.snapshot()[0].body,note.body);
  await session.remove('n1');
  assert.equal(raw,'[]');
});
test('corrupt read never writes', async () => {
  let writes=0;
  await assert.rejects(open({readAuthenticated:async()=>'{bad',replaceAuthenticated:async()=>{writes++;}}));
  assert.equal(writes,0);
});
test('ambiguous failed write blocks further access until reopening', async () => {
  let writes=0;
  const session=await open({readAuthenticated:async()=>JSON.stringify([note]),replaceAuthenticated:async()=>{writes++;throw Error('failure');}});
  await assert.rejects(session.remove('n1'));
  assert.throws(()=>session.snapshot());
  await assert.rejects(session.save({...note,body:'new'}));
  assert.equal(writes,1);
});
test('concurrent mutation is rejected while first write is pending', async () => {
  let release;
  const session=await open({readAuthenticated:async()=>null,replaceAuthenticated:()=>new Promise(r=>{release=r;})});
  const pending=session.save(note);
  await assert.rejects(session.save({...note,id:'n2'}));
  assert.equal(session.snapshot().length,0);
  release();
  await pending;
  assert.equal(session.snapshot().length,1);
});

test('closed session rejects reads and mutations',async()=>{
  let writes=0;
  const session=await open({readAuthenticated:async()=>JSON.stringify([note]),replaceAuthenticated:async()=>{writes++;}});
  session.close();
  session.close();
  assert.throws(()=>session.snapshot());
  await assert.rejects(session.save(note));
  await assert.rejects(session.remove('n1'));
  assert.equal(writes,0);
});
test('closing during an in-flight write does not reopen the session',async()=>{
  let release;
  const session=await open({readAuthenticated:async()=>null,replaceAuthenticated:()=>new Promise(r=>{release=r;})});
  const pending=session.save(note);
  const rejected=assert.rejects(pending);
  session.close();
  release();
  await rejected;
  assert.throws(()=>session.snapshot());
  await assert.rejects(session.save(note));
});
