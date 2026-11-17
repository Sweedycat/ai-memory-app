const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');

function load(name, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../../src/utils', name + '.ts'), 'utf8');
  const local = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText)(name => {
    if (!(name in imports)) throw Error('Unexpected import: ' + name);
    return imports[name];
  }, local, local.exports);
  return local.exports;
}
const model = load('personalNotebook');
const encrypted = load('encryptedNotebookVault', { './personalNotebook': model });
const sessions = load('notebookSession', { './personalNotebook': model });
const gates = load('notebookAccessGate', { './notebookSession': sessions });
const { openPersistentNotebook } = load('persistentNotebook', {
  './personalNotebook': model, './encryptedNotebookVault': encrypted, './notebookAccessGate': gates,
  './notebookSession': sessions,
});
const { openNotebookDatabase } = load('sqliteNotebookDatabase');
const digest = async value => crypto.createHash('sha256').update(value).digest('hex');
const marker = '0123456789abcdef0123456789abcdef';
const note = { id: 'synthetic-note', title: 'Synthetic private title', body: 'Türkçe 🚗 only fabricated data',
  createdAt: '2026-11-17T10:00:00.000Z', updatedAt: '2026-11-17T10:00:00.000Z' };
function cipher(key = crypto.randomBytes(32)) {
  return {
    async encryptUtf8ToCombinedBase64(value) {
      const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, c.update(value, 'utf8'), c.final(), c.getAuthTag()]).toString('base64');
    },
    async decryptCombinedBase64ToUtf8(value) {
      const bytes = Buffer.from(value, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      d.setAuthTag(bytes.subarray(-16));
      return Buffer.concat([d.update(bytes.subarray(12, -16)), d.final()]).toString('utf8');
    },
  };
}

function databaseAdapter(filename) {
  const raw = new DatabaseSync(filename);
  const faults = { commits: 0 };
  const executor = connection => ({
    async execAsync(sql) { connection.exec(sql); },
    async getAllAsync(sql, ...args) { return connection.prepare(sql).all(...args); },
    async getFirstAsync(sql, ...args) { return connection.prepare(sql).get(...args) ?? null; },
    async runAsync(sql, ...args) {
      const r = connection.prepare(sql).run(...args);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
  });
  const adapter = { ...executor(raw), async withExclusiveTransactionAsync(callback) {
    const transaction = new DatabaseSync(filename);
    let committed = false;
    try {
      transaction.exec('BEGIN');
      await callback(executor(transaction));
      await faults.beforeCommit?.();
      transaction.exec('COMMIT'); committed = true; faults.commits++;
    } catch (error) {
      if (!committed) transaction.exec('ROLLBACK');
      throw error;
    } finally { transaction.close(); }
    await faults.afterCommit?.();
  } };
  return { adapter, raw, faults };
}

async function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'ai-memory-synthetic-runtime-'));
  const filename = path.join(directory, 'notebook.db');
  const { adapter, raw, faults } = databaseAdapter(filename);
  t.after(() => {
    raw.close();
    const resolved = fs.realpathSync(directory);
    if (path.dirname(resolved) !== parent || !path.basename(resolved).startsWith('ai-memory-synthetic-runtime-')) {
      throw Error('Refusing unexpected synthetic cleanup path');
    }
    fs.rmSync(resolved, { recursive: true });
  });
  const database = await openNotebookDatabase(adapter);
  await database.initialize(marker);
  const key = crypto.randomBytes(32), aes = cipher(key);
  return { database, aes, key, raw, filename, faults, open: () => openPersistentNotebook(database, aes, digest) };
}
module.exports = { load, model, encrypted, openPersistentNotebook, openNotebookDatabase, databaseAdapter,
  digest, marker, note, cipher, fixture };
