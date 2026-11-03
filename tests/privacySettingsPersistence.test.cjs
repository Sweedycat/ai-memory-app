const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/utils/privacySettingsPersistence.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { module: { exports: {} } };
context.exports = context.module.exports;
vm.runInNewContext(js, context);
const { persistPrivacySettingBeforeApplying } = context.module.exports;

test('privacy changes take effect only after successful persistent write', async () => {
  const stages = [];
  const next = { appLockEnabled: false, lockDelaySeconds: 30 };
  await persistPrivacySettingBeforeApplying(
    next,
    async (json) => {
      assert.equal(JSON.parse(json).appLockEnabled, false);
      stages.push('written');
    },
    (saved) => {
      assert.equal(saved, next);
      stages.push('applied');
    },
  );
  assert.equal(stages.join(','), 'written,applied');
});

test('failed privacy preference write never applies unlocked settings in memory', async () => {
  const initial = { appLockEnabled: true, lockDelaySeconds: 0 };
  let active = initial;
  const fail = new Error('Simulated full storage');
  await assert.rejects(
    persistPrivacySettingBeforeApplying(
      { appLockEnabled: false, lockDelaySeconds: 0 },
      async () => { throw fail; },
      (next) => { active = next; },
    ),
    /Simulated full storage/,
  );
  assert.equal(active, initial);
  assert.equal(active.appLockEnabled, true);
});

test('PrivacyGate persists first before replacing active settings reference', () => {
  const gate = fs.readFileSync(path.join(root, 'src/components/PrivacyGate.tsx'), 'utf8');
  assert.match(gate, /await persistPrivacySettingBeforeApplying\(/);
  assert.match(gate, /\(serialized\) => AsyncStorage\.setItem\(STORAGE_KEY, serialized\)/);
  assert.doesNotMatch(
    gate,
    /settingsRef\.current = next;\s*setSettings\(next\);\s*await AsyncStorage\.setItem/,
  );
});
