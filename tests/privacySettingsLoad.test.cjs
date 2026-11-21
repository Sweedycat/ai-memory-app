const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPure } = require('./helpers/presentation.cjs');
const { parsePrivacySettings, loadPrivacySettings, DEFAULT_PRIVACY_SETTINGS } = loadPure('src/utils/privacySettingsLoad.ts');

test('only confirmed absence chooses enabled defaults; complete policies admit every supported delay', () => {
  assert.deepEqual(parsePrivacySettings(null), { appLockEnabled: true, lockDelaySeconds: 0 });
  assert.equal(DEFAULT_PRIVACY_SETTINGS.appLockEnabled, true);
  for (const enabled of [true, false]) for (const delay of [0, 30, 60, 300]) {
    const expected = { appLockEnabled: enabled, lockDelaySeconds: delay };
    assert.deepEqual(parsePrivacySettings(JSON.stringify(expected)), expected);
    assert.deepEqual(parsePrivacySettings(` { "lockDelaySeconds" : ${delay}, "appLockEnabled" : ${enabled} } `), expected);
  }
  assert.deepEqual(parsePrivacySettings('{"appLock\\u0045nabled":false,"lockDelaySeconds":0}'), { appLockEnabled: false, lockDelaySeconds: 0 });
});

test('unsupported shapes, values and incomplete disabled policies cannot establish policy', () => {
  const invalid = [undefined, false, 0, {}, [], '', ' ', '{', 'null', 'true', 'false', '0', '"policy"', '[]', '[false,0]', '{}',
    '{"appLockEnabled":false}', '{"lockDelaySeconds":0}',
    '{"appLockEnabled":"false","lockDelaySeconds":0}',
    '{"appLockEnabled":false,"lockDelaySeconds":"0"}',
    '{"appLockEnabled":false,"lockDelaySeconds":null}',
    '{"appLockEnabled":false,"lockDelaySeconds":-1}',
    '{"appLockEnabled":false,"lockDelaySeconds":31}',
    '{"appLockEnabled":false,"lockDelaySeconds":30.5}',
    '{"appLockEnabled":false,"lockDelaySeconds":1e999}',
    '{"appLockEnabled":false,"lockDelaySeconds":0,"extra":true}',
    '{"appLockEnabled":false,"lockDelaySeconds":0,"__proto__":{}}',
    ' '.repeat(257) + '{"appLockEnabled":false,"lockDelaySeconds":0}'];
  for (const raw of invalid) assert.equal(parsePrivacySettings(raw), null, raw);
});

test('duplicate members including escaped aliases and overwritten nested or string values are rejected', () => {
  for (const raw of [
    '{"appLockEnabled":true,"appLockEnabled":false,"lockDelaySeconds":0}',
    '{"appLockEnabled":false,"lockDelaySeconds":300,"lockDelaySeconds":0}',
    '{"appLockEnabled":true,"appLock\\u0045nabled":false,"lockDelaySeconds":0}',
    '{"appLockEnabled":{"nested":{"a":"ignored"}},"appLockEnabled":false,"lockDelaySeconds":0}',
    '{"appLockEnabled":"quoted \\"field\\": false","appLockEnabled":false,"lockDelaySeconds":0}',
    '{"appLockEnabled":[1,2],"appLockEnabled":false,"lockDelaySeconds":0}',
  ]) {
    assert.doesNotThrow(() => JSON.parse(raw), 'Fixture must exercise duplicate members in valid JSON');
    assert.equal(parsePrivacySettings(raw), null, raw);
  }
});

test('read errors and invalid bytes remain failures, successful absence remains distinct, and loader is read only', async () => {
  const original = '{"appLockEnabled":false,"lockDelaySeconds":"bad"}';
  let bytes = original, reads = 0;
  const read = async () => { reads++; return bytes; };
  assert.deepEqual(await loadPrivacySettings(read), { ok: false });
  assert.equal(bytes, original); assert.equal(reads, 1);
  assert.deepEqual(await loadPrivacySettings(async () => { throw Error('Synthetic read failure'); }), { ok: false });
  bytes = null;
  assert.deepEqual(await loadPrivacySettings(read), { ok: true, settings: { appLockEnabled: true, lockDelaySeconds: 0 } });
  bytes = '{"appLockEnabled":false,"lockDelaySeconds":30}';
  assert.deepEqual(await loadPrivacySettings(read), { ok: true, settings: { appLockEnabled: false, lockDelaySeconds: 30 } });
  assert.equal(reads, 3);
});
