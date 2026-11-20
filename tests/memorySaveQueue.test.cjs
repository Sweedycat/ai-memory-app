const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/memorySaveQueue.ts'), 'utf8');
const local = { exports: {} };
new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText)(local, local.exports);
const { createMemorySaveQueue: create } = local.exports;

const tick = () => new Promise(resolve => setImmediate(resolve));

test('one writer coalesces rapid edits and never allows old writes to finish last', async () => {
  const calls = [], releases = [], statuses = [];
  let saved;
  const queue = create(value => new Promise(resolve => {
    calls.push(value);
    releases.push(() => { saved = value; resolve(); });
  }));
  queue.subscribe(value => statuses.push(value));
  queue.enqueue('first');
  assert.equal(queue.getStatus(), 'saving', 'Queued intent is visible before adapter microtask');
  await tick();
  queue.enqueue('second');
  queue.enqueue('latest');
  assert.deepEqual(calls, ['first']);
  assert.equal(queue.getStatus(), 'saving');
  releases.shift()();
  await tick();
  assert.deepEqual(calls, ['first', 'latest']);
  assert.equal(queue.getStatus(), 'saving');
  releases.shift()();
  await queue.whenIdle();
  assert.equal(saved, 'latest');
  assert.equal(queue.getPending(), null);
  assert.equal(queue.getStatus(), 'idle');
  assert.deepEqual(statuses, ['saving', 'saving', 'idle']);
});

test('failed write keeps newest changes and waits for explicit retry', async () => {
  const calls = [];
  let reject;
  const queue = create(value => {
    calls.push(value);
    if (calls.length === 1) return new Promise((_, fail) => { reject = fail; });
    return Promise.resolve();
  });
  queue.enqueue('old draft');
  await tick();
  queue.enqueue('new draft');
  reject(Error('Synthetic storage failure'));
  await queue.whenIdle();
  assert.equal(queue.getStatus(), 'error');
  assert.equal(queue.getPending(), 'new draft');
  queue.enqueue('newest draft');
  await tick();
  assert.deepEqual(calls, ['old draft']);
  queue.retry();
  queue.retry();
  await queue.whenIdle();
  assert.deepEqual(calls, ['old draft', 'newest draft']);
  assert.equal(queue.getStatus(), 'idle');
});

test('retry after persisted-but-unacknowledged replacement is idempotent, including empty lists', async () => {
  let saved = '["synthetic existing"]', writes = 0;
  const queue = create(async value => {
    saved = value;
    if (++writes === 1) throw Error('Synthetic lost acknowledgement');
  });
  queue.enqueue('[]');
  await queue.whenIdle();
  assert.equal(saved, '[]');
  assert.equal(queue.getStatus(), 'error');
  assert.equal(queue.getPending(), '[]');
  queue.retry();
  await queue.whenIdle();
  assert.equal(saved, '[]');
  assert.equal(writes, 2);
  assert.equal(queue.getStatus(), 'idle');
  queue.retry();
  await queue.whenIdle();
  assert.equal(writes, 2);
});

test('synchronous adapter failures are contained and disposed subscribers receive no updates', async () => {
  const queue = create(() => { throw Error('Synthetic sync failure'); });
  let notifications = 0;
  const unsubscribe = queue.subscribe(() => { notifications++; });
  unsubscribe();
  queue.enqueue('synthetic');
  await queue.whenIdle();
  assert.equal(queue.getStatus(), 'error');
  queue.retry();
  await queue.whenIdle();
  assert.equal(queue.getStatus(), 'error');
  assert.equal(notifications, 0);
});

test('exact acknowledgement waits through failure and a lost ACK without replaying the mutation', async () => {
  let writes = 0, raw = 'old', acknowledged = false;
  const queue = create(async value => { raw = value; if (++writes === 1) throw Error('Synthetic lost ACK'); });
  queue.enqueue('final');
  const saved = queue.waitFor('final').then(result => { acknowledged = result; return result; });
  await queue.whenIdle();
  assert.equal(raw, 'final'); assert.equal(acknowledged, false);
  assert.equal(queue.getStatus(), 'error');
  queue.retry();
  assert.equal(await saved, true); assert.equal(writes, 2);
  assert.equal(await queue.waitFor('final'), true);
});

test('superseded in-flight and coalesced revisions never acknowledge navigation', async () => {
  const releases = [];
  const queue = create(() => new Promise(resolve => releases.push(resolve)));
  queue.enqueue('old'); const old = queue.waitFor('old'); await tick();
  queue.enqueue('skipped'); const skipped = queue.waitFor('skipped');
  queue.enqueue('latest'); const latest = queue.waitFor('latest');
  assert.equal(await skipped, false);
  releases.shift()(); await tick();
  assert.equal(await old, false);
  let done = false; void latest.then(() => { done = true; }); await tick(); assert.equal(done, false);
  releases.shift()(); assert.equal(await latest, true);
  await queue.whenIdle(); assert.equal(await queue.waitFor('old'), false);
});

test('unmount abort detaches an acknowledgement waiter while final bytes remain queued', async () => {
  let release, raw;
  const queue = create(value => new Promise(resolve => { release = () => { raw = value; resolve(); }; }));
  queue.enqueue('final'); const lifecycle = new AbortController();
  const saved = queue.waitFor('final', lifecycle.signal); await tick();
  lifecycle.abort(); assert.equal(await saved, false); assert.equal(queue.getPending(), 'final');
  release(); await queue.whenIdle(); assert.equal(raw, 'final');
  assert.equal(await queue.waitFor('final'), true);
});
