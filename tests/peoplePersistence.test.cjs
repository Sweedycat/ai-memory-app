const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const local = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText)(name => {
    if (!(name in imports)) throw Error('Unexpected import: ' + name);
    return imports[name];
  }, local, local.exports);
  return local.exports;
}

// Minimal effect/state harness exercises the real hook with fabricated storage;
// it does not render native UI or establish Android lifecycle behavior.
function harness(storage) {
  let slots = [], effects = [], cursor = 0, scheduled = [], dirty = false;
  let output, mounted = true;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
        dirty = true;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useCallback(callback) { cursor++; return callback; },
    useEffect(callback, deps) {
      const index = cursor++;
      const prior = effects[index];
      if (!prior || deps.some((dep, i) => !Object.is(dep, prior.deps[i]))) {
        scheduled.push(() => {
          prior?.cleanup?.();
          effects[index] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const { usePersistentPeople: hook } = load('src/hooks/usePersistentPeople.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    react,
    '../utils/normalizeStoredPeople': load('src/utils/normalizeStoredPeople.ts'),
    '../utils/memorySaveQueue': load('src/utils/memorySaveQueue.ts'),
  });
  function render() {
    cursor = 0;
    dirty = false;
    output = hook([]);
    const pending = scheduled;
    scheduled = [];
    pending.forEach(run => run());
  }
  render();
  return {
    get value() { return output; },
    async flush() {
      for (let i = 0; i < 8; i++) {
        await new Promise(resolve => setImmediate(resolve));
        if (mounted && dirty) render();
      }
    },
    unmount() {
      effects.forEach(effect => effect?.cleanup?.());
      slots = []; effects = []; mounted = false;
    },
    remount() { mounted = true; render(); },
  };
}

const person = { id: 'synthetic-person', name: 'Test Person', role: '', relationship: '',
  lastInteraction: 'Today', notes: ['Synthetic note'], interactions: [] };
const KEY = '@ai-memory/people-v1';

test('opening valid, legacy and intentionally empty data performs no write', async () => {
  for (const raw of [null, '[]', JSON.stringify([person])]) {
    let writes = 0;
    const h = harness({ getItem: async key => { assert.equal(key, KEY); return raw; },
      setItem: async () => { writes++; } });
    await h.flush();
    assert.equal(h.value[2], true);
    assert.equal(h.value[3], false);
    assert.equal(h.value[0].length, raw?.includes('synthetic-person') ? 1 : 0);
    assert.equal(writes, 0);
    h.unmount();
  }
});

test('read and validation failure preserve original bytes and block retry', async () => {
  for (const raw of ['{corrupt', '[null]', 'throw']) {
    let writes = 0;
    const h = harness({ getItem: async () => {
      if (raw === 'throw') throw Error('Synthetic read failure');
      return raw;
    }, setItem: async () => { writes++; } });
    await h.flush();
    assert.equal(h.value[2], false);
    assert.equal(h.value[3], true);
    h.value[4].retry();
    assert.equal(await h.value[4].confirm([person]), false);
    h.value[1]([person]);
    await h.flush();
    assert.equal(writes, 0);
    h.unmount();
  }
});

test('confirmation requires the current observed revision and a disk ACK; abort preserves final data', async () => {
  let raw = '[]', release;
  const h = harness({ getItem: async () => raw,
    setItem: (_, value) => new Promise(resolve => { release = () => { raw = value; resolve(); }; }) });
  await h.flush();
  h.value[1]([person]); await h.flush();
  const current = h.value[0], lifetime = new AbortController();
  let completed = false;
  const confirmation = h.value[4].confirm(current, lifetime.signal).then(saved => { completed = true; return saved; });
  await h.flush(); assert.equal(completed, false);
  assert.equal(await h.value[4].confirm([]), false);
  lifetime.abort(); assert.equal(await confirmation, false);
  h.unmount(); release(); h.remount(); await h.flush();
  assert.equal(h.value[0][0].id, person.id); assert.equal(h.value[4].status, 'idle');
  h.unmount();
});

test('failed edits stay visible through lock-style remount; retry saves latest without repeating native actions', async () => {
  let raw = JSON.stringify([person]), writes = 0, fail = true;
  const h = harness({ getItem: async () => raw, setItem: async (key, value) => {
    assert.equal(key, KEY);
    writes++;
    if (fail) throw Error('Synthetic low storage');
    raw = value;
  } });
  await h.flush();
  const revision = { ...h.value[0][0], notes: ['Latest synthetic note'] };
  h.value[1]([revision]);
  await h.flush();
  assert.equal(h.value[4].status, 'error');
  assert.equal(writes, 1);
  assert.equal(JSON.parse(raw)[0].notes[0], 'Synthetic note');
  h.unmount();
  h.remount();
  await h.flush();
  assert.equal(h.value[0][0].notes[0], 'Latest synthetic note');
  assert.equal(h.value[4].status, 'error');
  h.value[1]([]);
  await h.flush();
  assert.equal(writes, 1);
  fail = false;
  h.value[4].retry();
  h.value[4].retry();
  await h.flush();
  assert.equal(writes, 2);
  assert.equal(raw, '[]');
  assert.equal(h.value[4].status, 'idle');
  h.unmount();
});

test('reopening drains an older in-flight save before restoring records', async () => {
  let raw = '[]', release, reads = 0;
  const h = harness({ getItem: async () => { reads++; return raw; },
    setItem: (_, value) => new Promise(resolve => { release = () => { raw = value; resolve(); }; }) });
  await h.flush();
  h.value[1]([person]);
  await h.flush();
  assert.equal(h.value[4].status, 'saving');
  h.unmount();
  h.remount();
  await h.flush();
  assert.equal(reads, 1);
  assert.equal(h.value[2], false);
  release();
  await h.flush();
  assert.equal(reads, 2);
  assert.equal(h.value[0][0].id, person.id);
  assert.equal(h.value[4].status, 'idle');
  h.unmount();
});
