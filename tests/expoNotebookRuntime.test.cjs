const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const h = require('./helpers/notebookRuntime.cjs');

async function runtimeFixture(t, platform = 'android') {
  const f = await h.fixture(t);
  // Native bootstrap must start from an unbound, dedicated notebook row.
  f.raw.prepare('UPDATE notebook_state SET keyId = NULL, revision = 0').run();
  let secure = null, generated = 0, opens = 0, closes = 0, available = true;
  const handles = [];
  t.after(() => { for (const handle of handles) { try { handle.raw.close(); } catch {} } });
  function options(value) {
    assert.equal(value.keychainService, 'ai-memory.notebook.local.v1');
    assert.equal(value.keychainAccessible, 9);
    assert.equal(value.requireAuthentication, false);
  }
  const runtime = h.load('expoNotebookRuntime', {
    'react-native': { Platform: { OS: platform } },
    'expo-crypto': { getRandomBytes: count => crypto.randomBytes(count),
      CryptoDigestAlgorithm: { SHA256: 'SHA256' }, digestStringAsync: (_, value) => h.digest(value) },
    'expo-secure-store': {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 9,
      isAvailableAsync: async () => available,
      getItemAsync: async (slot, opts) => { assert.equal(slot, 'ai-memory.notebook.local-key.v1'); options(opts); return secure; },
      setItemAsync: async (slot, value, opts) => { assert.equal(slot, 'ai-memory.notebook.local-key.v1'); options(opts); secure = value; },
    },
    'expo-sqlite': { openDatabaseAsync: async (filename, opts) => {
      assert.equal(filename, 'ai-memory-notebook-v1.db'); assert.equal(opts.useNewConnection, true);
      opens++; const handle = h.databaseAdapter(f.filename); handles.push(handle);
      return { ...handle.adapter, closeAsync: async () => { closes++; handle.raw.close(); } };
    } },
    './expoBackupCipher': {
      generateBackupRecoveryKey: async () => { generated++; return crypto.randomBytes(32).toString('hex'); },
      createExpoAesGcmCipher: async key => h.cipher(Buffer.from(key, 'hex')),
    },
    './notebookKeys': h.load('notebookKeys'),
    './persistentNotebook': { openPersistentNotebook: h.openPersistentNotebook },
    './sqliteNotebookDatabase': { NOTEBOOK_DATABASE_NAME: 'ai-memory-notebook-v1.db', openNotebookDatabase: h.openNotebookDatabase },
  });
  return { ...f, runtime, get secure() { return secure; }, set secure(value) { secure = value; },
    get generated() { return generated; }, get opens() { return opens; }, get closes() { return closes; },
    set available(value) { available = value; } };
}

test('native composition is lazy; one separate secure key opens encrypted SQLite and closes drained handles', async t => {
  const f = await runtimeFixture(t);
  assert.equal(f.opens, 0); assert.equal(f.generated, 0); assert.equal(f.secure, null);
  const first = await f.runtime.openExpoNotebook();
  const secure = f.secure;
  assert.equal(f.generated, 1);
  assert.equal((await f.database.read()).keyId, JSON.parse(secure).id);
  await first.getSession().save(h.note, null);
  first.close(); await first.whenIdle(); assert.equal(f.closes, 1);
  const next = await f.runtime.openExpoNotebook();
  assert.equal(f.secure, secure); assert.equal(f.generated, 1);
  assert.equal(next.getSession().snapshot()[0].body, h.note.body);
  next.close(); await next.whenIdle(); assert.equal(f.closes, 2);
});

test('loss of the device key never generates a replacement over existing ciphertext', async t => {
  const f = await runtimeFixture(t), first = await f.runtime.openExpoNotebook();
  await first.getSession().save(h.note, null); first.close(); await first.whenIdle();
  const before = JSON.stringify(await f.database.read());
  f.secure = null;
  await assert.rejects(f.runtime.openExpoNotebook(), /^Error: Notebook could not be opened$/);
  assert.equal(f.generated, 1); assert.equal(f.secure, null);
  assert.equal(JSON.stringify(await f.database.read()), before);
});

test('unsupported platform and unavailable secure store do not create database or keys', async t => {
  const web = await runtimeFixture(t, 'web');
  await assert.rejects(web.runtime.openExpoNotebook());
  assert.equal(web.opens, 0); assert.equal(web.generated, 0);
  const unavailable = await runtimeFixture(t); unavailable.available = false;
  await assert.rejects(unavailable.runtime.openExpoNotebook());
  assert.equal(unavailable.opens, 0); assert.equal(unavailable.generated, 0);
});
