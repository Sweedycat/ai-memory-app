const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/sqliteNotebookDatabase.ts'), 'utf8');
const context = { module: { exports: {} } };
context.exports = context.module.exports;
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
// Match CommonJS lexical scope: VM globals otherwise make the 24m boundary scan
// artificially slow, unlike the functions inside the mobile module wrapper.
vm.runInNewContext('(function(exports, module) {\n' + compiled + '\n})(module.exports, module);', context);
const { openNotebookDatabase, NOTEBOOK_DATABASE_NAME, MAX_NOTEBOOK_CIPHERTEXT_LENGTH } = context.module.exports;
// Fabricated public key markers, never encryption/recovery keys.
const KEY_ID = '0123456789abcdef0123456789abcdef';
const OTHER_ID = 'abcdef0123456789abcdef0123456789';
const plain = value => JSON.parse(JSON.stringify(value));
const sealed = label => {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.randomBytes(32), nonce);
  return Buffer.concat([nonce, cipher.update(label, 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64');
};

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'synthetic-notebook-sqlite-'));
  const filename = path.join(directory, NOTEBOOK_DATABASE_NAME);
  const roots = [];
  t.after(() => {
    for (const root of roots) root.close();
    // This exact test-created temporary directory contains synthetic records only.
    fs.rmSync(directory, { recursive: true, force: true });
  });
  function adapter() {
    const raw = new DatabaseSync(filename);
    roots.push(raw);
    const faults = {};
    const queries = [];
    let insideTransaction = false;
    function executor(connection, root = false) {
      function query(sql) {
        if (root) assert.equal(insideTransaction, false, 'transaction queries must use its supplied connection');
        queries.push(sql);
      }
      return {
        async execAsync(sql) { query(sql); connection.exec(sql); },
        async getAllAsync(sql, ...parameters) {
          query(sql);
          if (faults.read) throw Error('Synthetic read failure with private native detail');
          return connection.prepare(sql).all(...parameters);
        },
        async getFirstAsync(sql, ...parameters) {
          query(sql);
          if (faults.read) throw Error('Synthetic read failure with private native detail');
          return connection.prepare(sql).get(...parameters) ?? null;
        },
        async runAsync(sql, ...parameters) {
          query(sql);
          const result = connection.prepare(sql).run(...parameters);
          if (sql.startsWith('UPDATE') && faults.afterUpdate) faults.afterUpdate();
          return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
        },
      };
    }
    const database = {
      ...executor(raw, true),
      async withExclusiveTransactionAsync(callback) {
        faults.beforeTransaction?.();
        // Expo 57 creates a separate connection, BEGINs, and uses only the txn handle.
        const transaction = new DatabaseSync(filename);
        let committed = false;
        insideTransaction = true;
        try {
          transaction.exec('BEGIN');
          await callback(executor(transaction));
          faults.beforeCommit?.();
          transaction.exec('COMMIT');
          committed = true;
        } catch (error) {
          if (!committed) transaction.exec('ROLLBACK');
          throw error;
        } finally {
          insideTransaction = false;
          transaction.close();
        }
        faults.afterCommit?.();
      },
    };
    return { database, raw, faults, queries };
  }
  return { adapter, filename };
}

async function initialized(t) {
  const f = fixture(t);
  const a = f.adapter();
  const store = await openNotebookDatabase(a.database);
  const state = await store.initialize(KEY_ID);
  return { ...f, ...a, store, state };
}

test('fresh dedicated schema, FULL durability, deliberate emptiness and idempotent key binding survive reopen', async t => {
  const f = fixture(t), a = f.adapter();
  const store = await openNotebookDatabase(a.database);
  assert.equal(a.raw.prepare('PRAGMA synchronous').get().synchronous, 2);
  assert.equal(a.raw.prepare('PRAGMA user_version').get().user_version, 1);
  assert.deepEqual(plain(await store.read()), { revision: 0, keyId: null, active: null, previous: null, draft: null });
  const state = await store.initialize(KEY_ID);
  assert.deepEqual(plain(state), { revision: 1, keyId: KEY_ID, active: null, previous: null, draft: null });
  assert.deepEqual(plain(await store.initialize(KEY_ID)), plain(state));
  const b = f.adapter(), reopened = await openNotebookDatabase(b.database);
  assert.deepEqual(plain(await reopened.read()), plain(state));
  await assert.rejects(reopened.initialize(OTHER_ID), /marker mismatch/);
  for (const id of ['', null, undefined, 'not-a-marker', 'A'.repeat(32), 'a'.repeat(31), 'a'.repeat(33)]) {
    await assert.rejects(reopened.initialize(id), /Invalid notebook key marker/);
  }
  assert.deepEqual(plain(await reopened.read()), plain(state));
});

test('ciphertext-only writes retain prior active and an encrypted draft across independent connections', async t => {
  const f = await initialized(t);
  const active = sealed('Synthetic private note'), draft = sealed('Synthetic candidate and digest');
  const next = sealed('[]'); // Intentionally empty authenticated content is still ciphertext.
  let state = await f.store.replace(f.state, { active, previous: null, draft: null });
  state = await f.store.replace(state, { active, previous: null, draft });
  const reopened = await openNotebookDatabase(f.adapter().database);
  assert.equal((await reopened.read()).draft, draft);
  state = await reopened.replace(state, { active: next, previous: active, draft: null });
  assert.deepEqual(plain(await f.store.read()), plain(state));
  assert.equal(state.revision, 4);
  assert.equal(state.previous, active);
  const fields = f.raw.prepare('PRAGMA table_info(notebook_state)').all().map(column => column.name);
  assert.deepEqual(fields, ['id', 'revision', 'keyId', 'active', 'previous', 'draft']);
  const stored = f.raw.prepare('SELECT * FROM notebook_state').get();
  assert.equal(JSON.stringify(stored).includes('Synthetic private note'), false);
  assert.equal(stored.active, next);
  assert.equal(stored.previous, active);
});

test('all expected fields are compared inside the transaction, including same-revision mismatches', async t => {
  const f = await initialized(t);
  const other = await openNotebookDatabase(f.adapter().database);
  const active = sealed('First synthetic note');
  const state = await other.replace(f.state, { active, previous: null, draft: null });
  await assert.rejects(f.store.replace(f.state, { active: sealed('Lost update'), previous: null, draft: null }), /Stale/);
  for (const altered of [
    { keyId: OTHER_ID }, { active: sealed('Different active') },
    { previous: sealed('Different previous') }, { draft: sealed('Different draft') },
  ]) {
    await assert.rejects(f.store.replace({ ...state, ...altered }, {
      active, previous: null, draft: null,
    }), /Stale/);
  }
  assert.deepEqual(plain(await f.store.read()), plain(state));
});

test('missing key binding and unsafe snapshot omission cannot replace existing bytes', async t => {
  const f = fixture(t), a = f.adapter(), store = await openNotebookDatabase(a.database);
  const unbound = await store.read();
  await assert.rejects(store.replace(unbound, { active: sealed('Unbound'), previous: null, draft: null }), /missing/);
  let state = await store.initialize(KEY_ID);
  const active = sealed('Retained synthetic note');
  state = await store.replace(state, { active, previous: null, draft: null });
  for (const candidate of [sealed('Replacement'), null]) {
    await assert.rejects(store.replace(state, { active: candidate, previous: null, draft: null }), /must retain/);
  }
  assert.deepEqual(plain(await store.read()), plain(state));
});

test('draft stage and discard cannot replace or clear the retained previous snapshot', async t => {
  const f = await initialized(t);
  const previous = sealed('Retained earlier version'), active = sealed('Current version');
  let state = await f.store.replace(f.state, { active: previous, previous: null, draft: null });
  state = await f.store.replace(state, { active, previous, draft: null });
  for (const proposedPrevious of [null, sealed('Unrelated snapshot')]) {
    await assert.rejects(f.store.replace(state, {
      active, previous: proposedPrevious, draft: sealed('Journal staging'),
    }), /must preserve/);
  }
  state = await f.store.replace(state, { active, previous, draft: sealed('Valid journal staging') });
  await assert.rejects(f.store.replace(state, { active, previous: null, draft: null }), /must preserve/);
  assert.deepEqual(plain(await f.store.read()), plain(state));
});

test('invalid states and noncanonical or oversized ciphertext fail without writes', async t => {
  const f = await initialized(t);
  const invalid = [undefined, '', '{}', ' '.repeat(40), 'A'.repeat(41),
    'A'.repeat(38) + 'B=', 'A'.repeat(37) + 'B==', 'A'.repeat(36) + '=AAA',
    Buffer.alloc(40), 'A'.repeat(MAX_NOTEBOOK_CIPHERTEXT_LENGTH + 4)];
  for (const field of ['active', 'previous', 'draft']) {
    for (const value of invalid) {
      await assert.rejects(f.store.replace(f.state, { active: null, previous: null, draft: null, [field]: value }), /ciphertext/);
    }
  }
  for (const revision of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) {
    await assert.rejects(f.store.replace({ ...f.state, revision }, { active: null, previous: null, draft: null }), /revision/);
  }
  await assert.rejects(f.store.replace(null, { active: null, previous: null, draft: null }), /state/);
  await assert.rejects(f.store.replace(f.state, null), /replacement/);
  assert.deepEqual(plain(await f.store.read()), plain(f.state));
});

test('exact ciphertext bound is supported without recursive regex resource exhaustion', async t => {
  const f = await initialized(t);
  const bounded = 'A'.repeat(MAX_NOTEBOOK_CIPHERTEXT_LENGTH);
  const state = await f.store.replace(f.state, { active: bounded, previous: null, draft: null });
  assert.equal(state.active.length, MAX_NOTEBOOK_CIPHERTEXT_LENGTH);
  assert.equal((await f.store.read()).active, bounded);
});

test('caller mutation while awaiting I/O cannot change the expected comparison or write', async t => {
  const f = await initialized(t);
  const expected = { ...f.state }, active = sealed('Snapshot of caller intent');
  const next = { active, previous: null, draft: null };
  const pending = f.store.replace(expected, next);
  expected.keyId = OTHER_ID;
  next.active = sealed('Unexpected caller mutation');
  assert.equal((await pending).active, active);
});

test('actual SQLite rollback preserves old active, previous and draft after update and low-storage failures', async t => {
  const f = await initialized(t);
  const active = sealed('Original'), draft = sealed('Retained journal');
  const state = await f.store.replace(f.state, { active, previous: null, draft });
  const candidate = { active: sealed('Candidate'), previous: active, draft: null };
  for (const phase of ['afterUpdate', 'beforeCommit']) {
    f.faults[phase] = () => { throw Error('SQLITE_FULL synthetic low storage'); };
    await assert.rejects(f.store.replace(state, candidate), /operation failed/);
    delete f.faults[phase];
    const reopened = await openNotebookDatabase(f.adapter().database);
    assert.deepEqual(plain(await reopened.read()), plain(state));
    assert.equal(f.raw.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  }
});

test('read failure after the SQL update rolls back and sanitizes native error detail', async t => {
  const f = await initialized(t);
  f.faults.afterUpdate = () => { f.faults.read = true; };
  await assert.rejects(f.store.replace(f.state, { active: sealed('Candidate'), previous: null, draft: null }), error => {
    assert.match(error.message, /operation failed/);
    assert.equal(error.message.includes('private native detail'), false);
    return true;
  });
  delete f.faults.read;
  delete f.faults.afterUpdate;
  assert.deepEqual(plain(await f.store.read()), plain(f.state));
});

test('lost commit acknowledgement reports failure; reread exposes committed state without automatic undo', async t => {
  const f = await initialized(t);
  const active = sealed('Committed but unacknowledged');
  f.faults.afterCommit = () => { throw Error('Synthetic native close failure after durable COMMIT'); };
  await assert.rejects(f.store.replace(f.state, { active, previous: null, draft: null }), /operation failed/);
  delete f.faults.afterCommit;
  const state = await (await openNotebookDatabase(f.adapter().database)).read();
  assert.equal(state.active, active);
  assert.equal(state.revision, f.state.revision + 1);
  await assert.rejects(f.store.replace(f.state, { active: sealed('Blind retry'), previous: null, draft: null }), /Stale/);
  assert.deepEqual(plain(await f.store.read()), plain(state));
});

test('failed fresh committed verification also reports an ambiguous write', async t => {
  const f = await initialized(t);
  const active = sealed('Committed before verification failed');
  f.faults.afterCommit = () => { f.faults.read = true; };
  await assert.rejects(f.store.replace(f.state, { active, previous: null, draft: null }), /operation failed/);
  delete f.faults.read;
  delete f.faults.afterCommit;
  assert.equal((await f.store.read()).active, active);
});

test('unknown version, tables, triggers and changed schema are rejected with original bytes retained', async t => {
  for (const setup of [
    'PRAGMA user_version = 2',
    'CREATE TABLE owner_settings (value TEXT); INSERT INTO owner_settings VALUES (\'synthetic-owner-settings\')',
    'PRAGMA user_version = 1',
    'CREATE TABLE notebook_state (id INTEGER PRIMARY KEY, revision INTEGER, keyId TEXT, active TEXT, previous TEXT, draft TEXT); PRAGMA user_version = 1',
  ]) {
    const f = fixture(t), a = f.adapter();
    a.raw.exec(setup);
    const before = fs.readFileSync(f.filename);
    await assert.rejects(openNotebookDatabase(a.database), /schema/);
    assert.deepEqual(fs.readFileSync(f.filename), before);
  }
  const f = await initialized(t);
  f.raw.exec('CREATE TRIGGER unexpected AFTER UPDATE ON notebook_state BEGIN SELECT 1; END');
  const before = fs.readFileSync(f.filename);
  await assert.rejects(f.store.read(), /schema/);
  await assert.rejects(f.store.replace(f.state, { active: sealed('Candidate'), previous: null, draft: null }), /schema/);
  assert.deepEqual(fs.readFileSync(f.filename), before);
});

test('corrupt/missing row or key never reinitializes, rewrites or promotes previous ciphertext', async t => {
  for (const corrupt of [
    'DELETE FROM notebook_state',
    "UPDATE notebook_state SET keyId = ''",
    'UPDATE notebook_state SET keyId = NULL',
    "UPDATE notebook_state SET active = 'malformed', previous = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'",
    "UPDATE notebook_state SET draft = X'00010203'",
    'UPDATE notebook_state SET revision = 1.5',
    'PRAGMA ignore_check_constraints = ON; UPDATE notebook_state SET id = 2',
    'PRAGMA ignore_check_constraints = ON; INSERT INTO notebook_state VALUES (2, 0, NULL, NULL, NULL, NULL)',
  ]) {
    const f = await initialized(t);
    f.raw.exec(corrupt);
    const before = fs.readFileSync(f.filename);
    await assert.rejects(f.store.read());
    await assert.rejects(f.store.initialize(KEY_ID));
    await assert.rejects(f.store.replace(f.state, { active: sealed('Candidate'), previous: null, draft: null }));
    await assert.rejects(openNotebookDatabase(f.adapter().database));
    assert.deepEqual(fs.readFileSync(f.filename), before);
  }
});

test('failed schema creation rolls back completely; corrupt SQLite bytes never get reset', async t => {
  const f = fixture(t), a = f.adapter();
  a.faults.beforeCommit = () => { throw Error('Synthetic interrupted initialization'); };
  await assert.rejects(openNotebookDatabase(a.database), /operation failed/);
  assert.equal(a.raw.prepare('PRAGMA user_version').get().user_version, 0);
  assert.deepEqual(a.raw.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all(), []);
  delete a.faults.beforeCommit;
  const store = await openNotebookDatabase(a.database);
  assert.equal((await store.read()).keyId, null);

  const corrupt = fixture(t);
  fs.writeFileSync(corrupt.filename, Buffer.alloc(4096, 0x42));
  const original = fs.readFileSync(corrupt.filename);
  await assert.rejects(openNotebookDatabase(corrupt.adapter().database), /operation failed/);
  assert.deepEqual(fs.readFileSync(corrupt.filename), original);
});

test('oversized stored values and embedded NUL are rejected before materializing corrupt fields', async t => {
  const f = await initialized(t);
  // SQLite TEXT length stops at NUL; BLOB byte length must enforce the cap.
  f.raw.prepare('UPDATE notebook_state SET active = ?').run('\0' + 'A'.repeat(MAX_NOTEBOOK_CIPHERTEXT_LENGTH));
  const before = fs.readFileSync(f.filename);
  f.queries.length = 0;
  await assert.rejects(f.store.read(), /size/);
  assert.equal(f.queries.some(sql => sql.startsWith('SELECT id, revision')), false);
  assert.deepEqual(fs.readFileSync(f.filename), before);
});

test('safe revision exhaustion blocks writes instead of losing integer precision', async t => {
  const f = await initialized(t);
  f.raw.prepare('UPDATE notebook_state SET revision = ?').run(Number.MAX_SAFE_INTEGER);
  const state = await f.store.read();
  await assert.rejects(f.store.replace(state, { active: sealed('Candidate'), previous: null, draft: null }), /exhausted/);
  assert.deepEqual(plain(await f.store.read()), plain(state));
});
