const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { fixture, note, digest, marker, openPersistentNotebook, cipher } = require('./helpers/notebookRuntime.cjs');
const plain = value => JSON.parse(JSON.stringify(value));

test('encrypted saves and intentional empty deletion survive workspace recreation with bounded previous snapshot', async t => {
  const f = await fixture(t), workspace = await f.open();
  await workspace.getSession().save(note, null);
  const first = await f.database.read();
  assert.equal(first.draft, null);
  assert.equal(first.previous, null);
  assert.ok(first.active);
  assert.ok(!fs.readFileSync(f.filename).includes(Buffer.from(note.title)));
  workspace.close(); await workspace.whenIdle();
  const reopened = await f.open();
  assert.deepEqual(plain(reopened.getSession().snapshot()), [note]);
  await reopened.getSession().remove(note.id, note);
  assert.equal((await f.database.read()).previous, first.active);
  reopened.close();
  const empty = await f.open();
  assert.deepEqual(plain(empty.getSession().snapshot()), []);
  empty.close();
});

test('interrupted activation leaves encrypted intent, recreated workspace requires explicit reviewed retry', async t => {
  const f = await fixture(t), workspace = await f.open();
  let stage;
  const replace = f.database.replace;
  f.database.replace = async (expected, next) => {
    if (next.draft === null) throw Error('Synthetic interruption before activation');
    return stage = await replace(expected, next);
  };
  await assert.rejects(workspace.getSession().save(note, null));
  assert.throws(() => workspace.getSession().snapshot());
  assert.ok(stage.draft);
  assert.equal(stage.active, null);
  assert.ok(!fs.readFileSync(f.filename).includes(Buffer.from(note.body)));
  workspace.close(); await workspace.whenIdle();
  f.database.replace = replace;
  const recovered = await f.open();
  assert.equal(recovered.getRecovery().status, 'retry-safe');
  assert.deepEqual(plain(recovered.getRecovery().candidate), [note]);
  assert.deepEqual(plain(recovered.getSession().snapshot()), []);
  // Ordinary Save is refused until the interrupted intent is explicitly resolved.
  await assert.rejects(recovered.getSession().save({ ...note, id: 'other' }, null));
  await recovered.reopen();
  await recovered.resolveRecovery('retry');
  assert.deepEqual(plain(recovered.getSession().snapshot()), [note]);
  assert.equal((await f.database.read()).draft, null);
  assert.equal(recovered.getRecovery().status, 'none');
  recovered.close();
});

test('unacknowledged final commit is recognized as already saved, without duplicate creation', async t => {
  const f = await fixture(t), workspace = await f.open();
  const replace = f.database.replace;
  f.database.replace = async (expected, next) => {
    const result = await replace(expected, next);
    if (next.draft === null) throw Error('Synthetic lost commit acknowledgement');
    return result;
  };
  await assert.rejects(workspace.getSession().save(note, null));
  f.database.replace = replace;
  assert.equal(await workspace.reopen(), 'already-saved');
  const before = await f.database.read();
  await workspace.resolveRecovery('retry');
  assert.deepEqual(plain(await f.database.read()), plain(before));
  assert.deepEqual(plain(workspace.getSession().snapshot()), [note]);
  await assert.rejects(workspace.getSession().save(note, null), /changed/);
  workspace.close();
});

test('failure before journal persistence retains in-memory attempt and safely restages on explicit retry', async t => {
  const f = await fixture(t), workspace = await f.open();
  const before = await f.database.read(), replace = f.database.replace;
  f.database.replace = async () => { throw Error('Synthetic full disk'); };
  await assert.rejects(workspace.getSession().save(note, null));
  assert.deepEqual(plain(await f.database.read()), plain(before));
  f.database.replace = replace;
  assert.equal(await workspace.reopen(), 'retry-safe');
  await workspace.resolveRecovery('retry');
  assert.deepEqual(plain(workspace.getSession().snapshot()), [note]);
  workspace.close();
});

test('another writer changing or deleting records causes a conflict and never resurrects a stale draft', async t => {
  const f = await fixture(t), first = await f.open();
  await first.getSession().save(note, null);
  const replace = f.database.replace;
  f.database.replace = async () => { throw Error('Synthetic failed stage'); };
  await assert.rejects(first.getSession().save({ ...note, body: 'Stale edited draft' }, note));
  f.database.replace = replace;
  const second = await f.open();
  await second.getSession().remove(note.id, note);
  second.close();
  assert.equal(await first.reopen(), 'conflict');
  const before = await f.database.read();
  await assert.rejects(first.resolveRecovery('retry'), /conflict/);
  assert.deepEqual(plain(await f.database.read()), plain(before));
  await first.resolveRecovery('discard');
  assert.deepEqual(plain(first.getSession().snapshot()), []);
  first.close();
});

test('a stale recovery decision is rejected transactionally and can be reopened for another review', async t => {
  const f = await fixture(t), first = await f.open(), replace = f.database.replace;
  f.database.replace = async (expected, next) => {
    if (next.draft === null) throw Error('Synthetic interrupted activation');
    return replace(expected, next);
  };
  await assert.rejects(first.getSession().save(note, null));
  f.database.replace = replace;
  await first.reopen();
  const second = await f.open();
  await second.resolveRecovery('discard');
  await second.getSession().save({ ...note, body: 'Fresh independent note' }, null);
  second.close();
  await assert.rejects(first.resolveRecovery('retry'), /Stale/);
  assert.equal(await first.reopen(), 'conflict');
  assert.equal(first.getRecovery().candidate[0].body, note.body);
  first.close();
});

test('interrupted deletion recovers as an empty candidate; previous snapshot is never auto-promoted', async t => {
  const f = await fixture(t), workspace = await f.open();
  await workspace.getSession().save(note, null);
  const replace = f.database.replace;
  f.database.replace = async (expected, next) => {
    if (next.draft === null) throw Error('Synthetic interrupted delete');
    return replace(expected, next);
  };
  await assert.rejects(workspace.getSession().remove(note.id, note));
  workspace.close(); f.database.replace = replace;
  const recovered = await f.open();
  assert.deepEqual(plain(recovered.getRecovery().candidate), []);
  await recovered.resolveRecovery('retry');
  assert.deepEqual(plain(recovered.getSession().snapshot()), []);
  assert.ok((await f.database.read()).previous);
  recovered.close();
  const empty = await f.open();
  assert.deepEqual(plain(empty.getSession().snapshot()), []);
  empty.close();
});

test('wrong keys and corrupt active/previous/journal data fail closed without writing', async t => {
  const f = await fixture(t), workspace = await f.open();
  await workspace.getSession().save(note, null);
  await workspace.getSession().save({ ...note, body: 'Second revision' }, note);
  workspace.close();
  const before = await f.database.read();
  await assert.rejects(openPersistentNotebook(f.database, cipher(), digest));
  assert.deepEqual(plain(await f.database.read()), plain(before));
  for (const field of ['active', 'previous', 'draft']) {
    const sealed = await f.aes.encryptUtf8ToCombinedBase64('Authenticated wrong domain');
    f.raw.prepare(`UPDATE notebook_state SET ${field} = ? WHERE id = 1`).run(sealed);
    const bad = await f.database.read();
    await assert.rejects(f.open());
    assert.deepEqual(plain(await f.database.read()), plain(bad));
    f.raw.prepare('UPDATE notebook_state SET active = ?, previous = ?, draft = ? WHERE id = 1')
      .run(before.active, before.previous, before.draft);
  }
});

test('authenticated malformed/foreign/oversized recovery journals cannot enter recovery', async t => {
  const f = await fixture(t);
  const valid = { version: 1, keyId: marker, baseRevision: 1, baseDigest: await digest('[]'), candidate: [note] };
  for (const bad of [null, {}, { ...valid, keyId: 'f'.repeat(32) }, { ...valid, baseRevision: -1 },
    { ...valid, baseRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, baseDigest: 'not-a-digest' }, { ...valid, candidate: [note, note] },
    { ...valid, ignored: 'x'.repeat(4_001_000) },
    { ...valid, candidate: [{ ...note, updatedAt: 'Yesterday' }] }]) {
    const draft = await f.aes.encryptUtf8ToCombinedBase64('ai-memory-notebook-recovery-v1\n' + JSON.stringify(bad));
    f.raw.prepare('UPDATE notebook_state SET draft = ? WHERE id = 1').run(draft);
    const before = await f.database.read();
    await assert.rejects(f.open());
    assert.deepEqual(plain(await f.database.read()), plain(before));
  }
});

test('locking during journal staging revokes old references and reopening drains before reading', async t => {
  const f = await fixture(t), workspace = await f.open(), stale = workspace.getSession();
  const replace = f.database.replace;
  let release;
  f.database.replace = async (expected, next) => {
    await new Promise(resolve => { release = resolve; });
    return replace(expected, next);
  };
  const saving = stale.save(note, null);
  const rejected = assert.rejects(saving);
  while (!release) await new Promise(resolve => setImmediate(resolve));
  workspace.close();
  assert.throws(() => stale.snapshot());
  assert.throws(() => workspace.getRecovery());
  release(); await rejected; await workspace.whenIdle();
  f.database.replace = replace;
  const reopened = await f.open();
  assert.equal(reopened.getRecovery().status, 'retry-safe');
  assert.deepEqual(plain(reopened.getSession().snapshot()), []);
  reopened.close();
});

test('failed reopen revokes an older recovery review and preserves corrupt active/previous/journal evidence', async t => {
  const f = await fixture(t);
  for (const field of ['active', 'previous', 'draft']) {
    // A valid staged intent had already been reviewed before a subsequent read fails.
    const workspace = await f.open(), replace = f.database.replace;
    f.database.replace = async (expected, next) => {
      if (next.draft === null) throw Error('Synthetic interrupted activation');
      return replace(expected, next);
    };
    await assert.rejects(workspace.getSession().save({ ...note, id: field }, null));
    f.database.replace = replace;
    assert.equal(await workspace.reopen(), 'retry-safe');
    const valid = await f.database.read();
    const corrupt = await f.aes.encryptUtf8ToCombinedBase64('Authenticated invalid recovery evidence');
    f.raw.prepare(`UPDATE notebook_state SET ${field} = ?, revision = revision + 1 WHERE id = 1`).run(corrupt);
    const before = JSON.stringify(await f.database.read());
    await assert.rejects(workspace.reopen());
    assert.throws(() => workspace.getRecovery(), /authenticated reopening/);
    await assert.rejects(workspace.resolveRecovery('retry'), /authenticated reopening/);
    await assert.rejects(workspace.resolveRecovery('discard'), /authenticated reopening/);
    assert.throws(() => workspace.getSession());
    assert.equal(JSON.stringify(await f.database.read()), before);
    // Simulated independent repair only: the app itself never rewrites corrupt bytes.
    f.raw.prepare('UPDATE notebook_state SET revision = ?, active = ?, previous = ?, draft = ? WHERE id = 1')
      .run(valid.revision, valid.active, valid.previous, valid.draft);
    assert.equal(await workspace.reopen(), 'retry-safe');
    await workspace.resolveRecovery('discard');
    workspace.close();
  }
});

test('a failed recovery write revokes review authority until another authenticated reopen', async t => {
  const f = await fixture(t), workspace = await f.open(), replace = f.database.replace;
  f.database.replace = async (expected, next) => {
    if (next.draft === null) throw Error('Synthetic interrupted activation');
    return replace(expected, next);
  };
  await assert.rejects(workspace.getSession().save(note, null));
  await workspace.reopen();
  await assert.rejects(workspace.resolveRecovery('retry'));
  assert.throws(() => workspace.getRecovery(), /authenticated reopening/);
  await assert.rejects(workspace.resolveRecovery('discard'), /authenticated reopening/);
  f.database.replace = replace;
  await workspace.reopen();
  await workspace.resolveRecovery('retry');
  assert.deepEqual(plain(workspace.getSession().snapshot()), [note]);
  workspace.close();
});

test('a terminated host process leaves only encrypted intent that can be authenticated and reviewed', async t => {
  const f = await fixture(t);
  const child = spawnSync(process.execPath, ['-e', `
    const fs = require('node:fs');
    const h = require('./helpers/notebookRuntime.cjs');
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    (async () => {
      const { adapter } = h.databaseAdapter(input.filename);
      const db = await h.openNotebookDatabase(adapter);
      const w = await h.openPersistentNotebook(db, h.cipher(Buffer.from(input.key, 'hex')), h.digest);
      const replace = db.replace;
      db.replace = async (expected, next) => {
        if (next.draft === null) process.exit(23);
        return replace(expected, next);
      };
      await w.getSession().save(h.note, null);
      process.exit(99);
    })().catch(() => process.exit(98));
  `], { cwd: __dirname, input: JSON.stringify({ filename: f.filename, key: f.key.toString('hex') }),
    encoding: 'utf8', timeout: 15000 });
  assert.equal(child.status, 23, 'Synthetic writer must terminate after the encrypted journal commit');
  const raw = fs.readFileSync(f.filename);
  assert.ok(!raw.includes(Buffer.from(note.body)));
  assert.ok(!raw.includes(Buffer.from(f.key.toString('hex'))));
  const reopened = await f.open();
  assert.equal(reopened.getRecovery().status, 'retry-safe');
  assert.deepEqual(plain(reopened.getRecovery().candidate), [note]);
  assert.deepEqual(plain(reopened.getSession().snapshot()), []);
  await reopened.resolveRecovery('retry');
  assert.deepEqual(plain(reopened.getSession().snapshot()), [note]);
  reopened.close();
});
