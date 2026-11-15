'use strict';

// In-memory filesystem fault injection: no fixtures, writes or native processes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const verifier = path.join(__dirname, 'verify-skills.cjs');
const source = fs.readFileSync(verifier, 'utf8');
const target = path.resolve(__dirname, '..', '.agents', 'skills', 'memory-continuity');

function runProbe(extraEntry) {
  let result;
  let skillReads = 0;
  const fakeFs = { ...fs,
    readdirSync(directory, options) {
      const entries = fs.readdirSync(directory, options);
      return path.resolve(directory) === target && extraEntry ? [...entries, extraEntry] : entries;
    },
    readFileSync(file, ...args) {
      if (path.resolve(file).endsWith(`${path.sep}SKILL.md`)) skillReads++;
      return fs.readFileSync(file, ...args);
    },
  };
  try {
    vm.runInNewContext(source, {
      require: name => name === 'node:fs' ? fakeFs : name === 'node:child_process'
        ? { spawnSync: () => assert.fail('Native processes are prohibited in unit tests') }
        : require(name),
      __dirname, __filename: verifier, process: { argv: ['node', verifier] },
      console: { log: value => { result = JSON.parse(value); } },
    }, { timeout: 5000 });
    return result;
  } catch (error) {
    assert.equal(skillReads, 0, 'Inventory must reject unexpected entries before reading skills');
    throw error;
  }
}

test('current complete inventory passes without native processes', () => {
  assert.equal(runProbe().skillCount, 12);
});
for (const [kind, message] of [
  ['file', /Unexpected skill file/],
  ['directory', /Unexpected skill directory/],
  ['link', /Unexpected link/],
]) {
  test(`reject unexpected nested ${kind} before reading contents`, () => {
    assert.throws(() => runProbe({
      name: 'synthetic-unexpected-entry',
      isDirectory: () => kind === 'directory',
      isFile: () => kind === 'file',
      isSymbolicLink: () => kind === 'link',
    }), message);
  });
}
