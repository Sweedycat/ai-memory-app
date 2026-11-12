const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const buildConfigCode = fs.readFileSync(path.join(root, 'app.config.js'), 'utf8');
const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

function evaluateVariant(variant) {
  const context = { module: { exports: {} }, process: { env: { APP_VARIANT: variant } } };
  vm.runInNewContext(buildConfigCode, context, { filename: 'app.config.js' });
  return context.module.exports({ config: app.expo });
}

test('Preview 0.0.2 uses a higher Android versionCode than old 0.1.0 (1)', () => {
  const config = evaluateVariant('preview');
  assert.equal(config.version, '0.0.2');
  assert.equal(config.name, 'AI Memory Preview');
  assert.equal(config.android.package, 'com.sweedycat.aimemory.preview');
  assert.equal(config.android.versionCode, 2);
  assert.equal(config.ios.bundleIdentifier, 'com.sweedycat.aimemory.preview');
  assert.equal(eas.cli.appVersionSource, 'local');
  assert.equal(eas.build.preview.env.APP_VARIANT, 'preview');
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build.preview.distribution, 'internal');
});

test('Preview versioning does not change production application identity or code', () => {
  const config = evaluateVariant(undefined);
  assert.equal(config.name, 'AI Memory');
  assert.equal(config.android.package, 'com.sweedycat.aimemory');
  assert.equal(config.android.versionCode, undefined);
  assert.equal(config.ios.bundleIdentifier, 'com.sweedycat.aimemory');
});

test('Preview code does not introduce automatic version upgrades or force install', () => {
  assert.notEqual(eas.build.preview.autoIncrement, true);
  assert.equal(app.expo.version, '0.0.2');
  assert.doesNotMatch(buildConfigCode, /unlink|remove|AsyncStorage|clear|uninstall|fetch\(/);
});
