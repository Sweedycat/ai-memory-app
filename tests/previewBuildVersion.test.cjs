const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const buildConfigCode = fs.readFileSync(path.join(root, 'app.config.js'), 'utf8');
const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

function evaluateVariant(variant) {
  const context = { module: { exports: {} }, process: { env: { APP_VARIANT: variant } } };
  vm.runInNewContext(buildConfigCode, context, { filename: 'app.config.js' });
  return context.module.exports({ config: app.expo });
}

test('B2 display version preserves EAS Preview identity and its separate code', () => {
  const config = evaluateVariant('preview');
  assert.equal(config.version, '0.0.5-dev');
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
  assert.equal(app.expo.version, '0.0.5-dev');
  assert.doesNotMatch(buildConfigCode, /unlink|remove|AsyncStorage|clear|uninstall|fetch\(/);
});

test('GitHub Test correction preserves historical package and strictly increases latest verified delivered code 4', () => {
  const config = evaluateVariant('github-test');
  assert.equal(config.name, 'AI Memory GitHub Test');
  assert.equal(config.android.package, 'com.sweedycat.aimemory.githubtest');
  assert.equal(config.ios.bundleIdentifier, 'com.sweedycat.aimemory.githubtest');
  assert.equal(config.version, '0.0.5-dev');
  assert.equal(config.android.versionCode, 5);
  assert.ok(config.android.versionCode > 4);
  assert.equal(config.extra.eas.projectId, app.expo.extra.eas.projectId);
  assert.equal(pkg.version, app.expo.version);
  assert.equal(lock.version, app.expo.version);
  assert.equal(lock.packages[''].version, app.expo.version);
  const settings = fs.readFileSync(path.join(root, 'src/components/SettingsPanel.tsx'), 'utf8');
  assert.match(settings, /\{c\.version\} \{manifest\.expo\.version\}/);
});

test('automatic development build is limited to one authorized request and rejects ordinary pushes and reruns', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/android-preview-apk.yml'), 'utf8');
  const expressions = [...workflow.matchAll(/^    if: >-\r?\n      (.+)$/gm)].map(match => match[1]);
  assert.equal(expressions.length, 2, 'verification and Android jobs each enforce the request guard');
  const request = { event_name: 'push', ref: 'refs/heads/development/omega-commercial-mvp', run_attempt: 1,
    event: { head_commit: { message: 'build: preview APK [APK_READY]' } } };
  for (const expression of expressions) {
    const allowed = github => new Function('github', 'return (' + expression + ')')(github);
    assert.equal(allowed(request), true);
    assert.equal(allowed({ ...request, event: { head_commit: { message: 'docs: ordinary checkpoint' } } }), false);
    assert.equal(allowed({ ...request, run_attempt: 2 }), false);
    assert.equal(allowed({ ...request, event: { head_commit: { message: 'build: prepare Android Preview APK 0.1.0 (2) [APK-20261119-REMOTE-ONE]' } } }), false);
    assert.equal(allowed({ ...request, event_name: 'workflow_dispatch', event: {} }), true);
    assert.equal(allowed({ ...request, event_name: 'workflow_dispatch', event: {}, run_attempt: 2 }), false);
  }
  assert.match(workflow, /android-apk:\s+needs: verify/);
  assert.match(workflow, /npm run doctor/);
  assert.match(workflow, /apksigner.*verify --verbose --print-certs/);
  assert.match(workflow, /fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c/);
  assert.doesNotMatch(workflow, /keytool|genkey|eas build|APP_VARIANT: preview|autoIncrement/);
});

test('reviewed checkpoint metadata rejects stale update codes and mismatched manifests without building', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/android-preview-apk.yml'), 'utf8');
  const code = workflow.match(/node <<'CHECKPOINT' >> "\$GITHUB_OUTPUT"\r?\n([\s\S]+?)\r?\n          CHECKPOINT/)[1];
  function metadata({ version = '0.0.5-dev', versionCode = 5, packageId = 'com.sweedycat.aimemory.githubtest', packageVersion = version } = {}) {
    const output = [];
    const files = { 'app.json': { expo: { version } }, 'package.json': { version: packageVersion },
      'package-lock.json': { version, packages: { '': { version } } } };
    vm.runInNewContext(code, { require: name => name === 'node:fs'
      ? { readFileSync: file => JSON.stringify(files[file]) }
      : ({ config }) => ({ ...config, android: { package: packageId, versionCode } }),
      console: { log: value => output.push(value) } });
    return output;
  }
  assert.deepEqual(metadata(), ['version=0.0.5-dev', 'version_code=5']);
  for (const versionCode of [1, 2, 3, 4, 4.5, NaN, '5', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => metadata({ versionCode }));
  assert.throws(() => metadata({ packageId: 'com.sweedycat.aimemory.preview' }));
  assert.throws(() => metadata({ packageVersion: '0.1.0' }));
  for (const version of ['0.2.0', '0.0.4', '0.0.04-dev', '0.1.0-dev', '1.0.0', '0.0.5-dev\nother=value']) assert.throws(() => metadata({ version }));
});

test('actual APK badging gate compares exact package, code and version without shell interpolation', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/android-preview-apk.yml'), 'utf8');
  const code = workflow.match(/node -e '([^']+)' "\$RUNNER_TEMP\/apk-badging\.txt"/)[1];
  const line = "package: name='com.sweedycat.aimemory.githubtest' versionCode='3' versionName='0.2.0' platformBuildVersionName='16'";
  function verify(badging) {
    return vm.runInNewContext(code, { require: () => ({ readFileSync: () => badging }),
      process: { argv: ['node', 'synthetic-badging'], env: { EXPECTED_VERSION: '0.2.0', EXPECTED_CODE: '3' } } });
  }
  assert.doesNotThrow(() => verify(line + '\napplication: label=synthetic'));
  assert.doesNotThrow(() => verify(line + '\r\n'));
  for (const badging of ['', line.replace('.githubtest', '.preview'), line.replace("versionCode='3'", "versionCode='2'"),
    line.replace("versionName='0.2.0'", "versionName='0.1.0'"), 'diagnostic\n' + line]) assert.throws(() => verify(badging));
});

test('APK certificate gate accepts both verified apksigner labels and rejects mismatches or duplicate matches', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/android-preview-apk.yml'), 'utf8');
  const pattern = workflow.match(/grep -Eic '([^']+)'/)[1];
  const certificate = 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c';
  const accepts = output => output.split(/\r?\n/).filter(line => new RegExp(pattern, 'i').test(line)).length === 1;
  const historical = 'Signer #1 certificate SHA-256 digest: ' + certificate;
  const current = 'V2 Signer: certificate SHA-256 digest: ' + certificate;
  // Older apksigner uses no colon between Signer #1 and certificate.
  assert.equal(accepts(current), true);
  assert.equal(accepts(current.toUpperCase()), true);
  assert.equal(accepts(current.replace(certificate, '0'.repeat(64))), false);
  assert.equal(accepts(current + '\n' + current), false);
  assert.equal(accepts('diagnostic: ' + current), false);
  assert.equal(accepts(current + '0'), false);
  assert.equal(accepts(''), false);
  assert.equal(accepts(historical), true);
  assert.match(workflow, /grep -Fxq 'Number of signers: 1'/);
  assert.match(workflow, /apksigner" verify --verbose --print-certs/);
});
