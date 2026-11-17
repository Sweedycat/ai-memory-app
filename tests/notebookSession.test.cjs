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
  await session.save(note, null);
  assert.equal(JSON.parse(raw)[0].id,'n1');
  session.snapshot()[0].body = 'changed copy';
  assert.equal(session.snapshot()[0].body,note.body);
  await session.remove('n1', note);
  assert.equal(raw,'[]');
});
test('saving an existing note replaces it only after persistence and preserves other notes', async () => {
  const other = { ...note, id: 'n2', title: 'Other synthetic note' };
  let raw = JSON.stringify([note, other]);
  let release;
  let writes = 0;
  const session = await open({
    readAuthenticated: async () => raw,
    replaceAuthenticated: value => new Promise(resolve => {
      writes++;
      release = () => { raw = value; resolve(); };
    }),
  });
  const revision = { ...note, title: 'Revised synthetic note', body: 'Updated test only',
    updatedAt: '2026-11-17T12:00:00.000Z' };
  const original = raw;
  const pending = session.save(revision, note);
  assert.equal(raw, original);
  assert.equal(JSON.stringify(session.snapshot()), original);
  release();
  await pending;
  assert.equal(writes, 1);
  assert.deepEqual(JSON.parse(raw), [revision, other]);
  assert.equal(JSON.stringify(session.snapshot()), raw);
  const reopened = await open({
    readAuthenticated: async () => raw,
    replaceAuthenticated: async () => { throw Error('Unexpected write'); },
  });
  assert.equal(JSON.stringify(reopened.snapshot()), raw);
});
test('invalid existing-note revisions leave original bytes and session state unchanged', async () => {
  const existing = { ...note, updatedAt: '2026-11-17T12:00:00.000Z' };
  const original = JSON.stringify([existing]);
  let raw = original;
  let writes = 0;
  const session = await open({
    readAuthenticated: async () => raw,
    replaceAuthenticated: async value => { writes++; raw = value; },
  });
  for (const revision of [
    { ...existing, body: 'Changed creation time', createdAt: '2026-11-15T12:00:00.000Z' },
    { ...existing, body: 'Stale revision', updatedAt: note.updatedAt },
  ]) {
    await assert.rejects(session.save(revision, existing), /Invalid note revision/);
    assert.equal(writes, 0);
    assert.equal(raw, original);
    assert.equal(JSON.stringify(session.snapshot()), original);
  }
  const valid = { ...existing, body: 'Valid later revision', updatedAt: '2026-11-18T12:00:00.000Z' };
  await session.save(valid, existing);
  assert.equal(writes, 1);
  assert.deepEqual(JSON.parse(raw), [valid]);
  assert.equal(JSON.stringify(session.snapshot()), raw);
});
test('stale edits reject equal and later timestamps, then a fresh base can retry', async () => {
  const other = { ...note, id: 'n2', body: 'Unrelated synthetic note' };
  let raw = JSON.stringify([note, other]);
  let writes = 0;
  const session = await open({
    readAuthenticated: async () => raw,
    replaceAuthenticated: async value => { writes++; raw = value; },
  });
  const firstBase = session.snapshot()[0];
  const staleBase = session.snapshot()[0];
  const firstEdit = { ...firstBase, body: 'First editor saved', updatedAt: '2026-11-17T12:00:00.000Z' };
  await session.save(firstEdit, firstBase);
  const confirmed = raw;
  for (const updatedAt of [firstEdit.updatedAt, '2026-11-18T12:00:00.000Z']) {
    await assert.rejects(session.save({ ...staleBase, body: 'Stale editor draft', updatedAt }, staleBase), /Notebook changed/);
    assert.equal(raw, confirmed);
    assert.equal(writes, 1);
    assert.equal(JSON.stringify(session.snapshot()), confirmed);
  }
  const freshBase = session.snapshot()[0];
  // Equal timestamps are safe when the complete base still matches.
  const resolved = { ...freshBase, body: 'Reviewed fresh editor draft' };
  await session.save(resolved, freshBase);
  assert.equal(writes, 2);
  assert.deepEqual(JSON.parse(raw), [resolved, other]);
});

test('save and delete compare every base field without overwriting or blocking the session', async () => {
  const original = JSON.stringify([note]);
  let raw = original;
  let writes = 0;
  const session = await open({
    readAuthenticated: async () => raw,
    replaceAuthenticated: async value => { writes++; raw = value; },
  });
  for (const changedBase of [
    { ...note, id: 'different-id' },
    { ...note, title: 'Different title' },
    { ...note, body: 'Different body' },
    { ...note, createdAt: '2026-11-15T12:00:00.000Z' },
    { ...note, updatedAt: '2026-11-17T12:00:00.000Z' },
  ]) {
    await assert.rejects(session.save({ ...note, body: 'Proposed draft' }, changedBase), /Notebook changed/);
    await assert.rejects(session.remove(note.id, changedBase), /Notebook changed/);
    assert.equal(raw, original);
    assert.equal(writes, 0);
    assert.equal(JSON.stringify(session.snapshot()), original);
  }
  await session.save({ ...note, body: 'Valid draft' }, { ...note });
  assert.equal(writes, 1);
});

test('explicit creation cannot replace an existing ID and stale editing cannot resurrect a deleted note', async () => {
  let raw = JSON.stringify([note]);
  let writes = 0;
  const session = await open({
    readAuthenticated: async () => raw,
    replaceAuthenticated: async value => { writes++; raw = value; },
  });
  const original = raw;
  await assert.rejects(session.save({ ...note, body: 'Duplicate creation' }, null), /Notebook changed/);
  assert.equal(raw, original);
  assert.equal(writes, 0);
  const staleBase = session.snapshot()[0];
  await session.remove(note.id, staleBase);
  assert.equal(raw, '[]');
  assert.equal(writes, 1);
  await assert.rejects(session.save({ ...note, body: 'Stale deleted draft' }, staleBase), /Notebook changed/);
  await assert.rejects(session.remove(note.id, staleBase), /Unknown note/);
  assert.equal(raw, '[]');
  assert.equal(writes, 1);
  assert.equal(session.snapshot().length, 0);
  await session.save({ ...note, id: 'new-id' }, null);
  assert.equal(writes, 2);
  assert.equal(JSON.parse(raw)[0].id, 'new-id');
});

test('a stale delete cannot discard an edit and a freshly reviewed delete succeeds', async () => {
  const other = { ...note, id: 'n2' };
  let raw = JSON.stringify([note, other]);
  let writes = 0;
  const session = await open({
    readAuthenticated: async () => raw,
    replaceAuthenticated: async value => { writes++; raw = value; },
  });
  const staleBase = session.snapshot()[0];
  await session.save({ ...note, body: 'Edit before deletion', updatedAt: '2026-11-17T12:00:00.000Z' }, staleBase);
  const confirmed = raw;
  await assert.rejects(session.remove(note.id, staleBase), /Notebook changed/);
  assert.equal(raw, confirmed);
  assert.equal(writes, 1);
  assert.equal(JSON.stringify(session.snapshot()), confirmed);
  await session.remove(note.id, session.snapshot()[0]);
  assert.equal(writes, 2);
  assert.deepEqual(JSON.parse(raw), [other]);
});

test('omitted and malformed expectations never write, including creation into an empty notebook', async () => {
  for (const initial of [null, '[]', JSON.stringify([note])]) {
    let raw = initial;
    let writes = 0;
    const session = await open({
      readAuthenticated: async () => raw,
      replaceAuthenticated: async value => { writes++; raw = value; },
    });
    // Exercise untyped callers as well as the required TypeScript arguments.
    await assert.rejects(session.save(note));
    await assert.rejects(session.remove(note.id));
    for (const expected of [undefined, {}, [], 'invalid']) {
      await assert.rejects(session.save(note, expected));
      await assert.rejects(session.remove(note.id, expected));
    }
    await assert.rejects(session.remove(note.id, null));
    assert.equal(raw, initial);
    assert.equal(writes, 0);
    assert.equal(JSON.stringify(session.snapshot()), initial === null ? '[]' : initial);
  }
});

test('corrupt read never writes', async () => {
  let writes=0;
  await assert.rejects(open({readAuthenticated:async()=>'{bad',replaceAuthenticated:async()=>{writes++;}}));
  assert.equal(writes,0);
});
test('ambiguous failed write blocks further access until reopening', async () => {
  let writes=0;
  const session=await open({readAuthenticated:async()=>JSON.stringify([note]),replaceAuthenticated:async()=>{writes++;throw Error('failure');}});
  await assert.rejects(session.remove('n1', note));
  assert.throws(()=>session.snapshot());
  await assert.rejects(session.save({...note,body:'new'}, note));
  assert.equal(writes,1);
});
test('concurrent mutation is rejected while first write is pending', async () => {
  let release;
  const session=await open({readAuthenticated:async()=>null,replaceAuthenticated:()=>new Promise(r=>{release=r;})});
  const pending=session.save(note, null);
  await assert.rejects(session.save({...note,id:'n2'}, null));
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
  await assert.rejects(session.save(note, note));
  await assert.rejects(session.remove('n1', note));
  assert.equal(writes,0);
});
test('closing during an in-flight write does not reopen the session',async()=>{
  let release;
  const session=await open({readAuthenticated:async()=>null,replaceAuthenticated:()=>new Promise(r=>{release=r;})});
  const pending=session.save(note, null);
  const rejected=assert.rejects(pending);
  session.close();
  release();
  await rejected;
  assert.throws(()=>session.snapshot());
  await assert.rejects(session.save(note, null));
});
