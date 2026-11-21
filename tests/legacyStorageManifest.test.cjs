const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/legacyStorageManifest.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
function load(overrides = {}) {
  const context = { TextEncoder, module: { exports: {} }, ...overrides };
  context.exports = context.module.exports;
  vm.runInNewContext(compiled, context);
  return context.module.exports;
}
const api = load();
const keys = [
  '@ai-memory/people-v1', '@ai-memory/life-records-v1', '@ai-memory/owner-profile/v1',
  '@ai-memory/privacy-settings/v1', '@ai-memory/language-preference-v1',
  '@ai-memory/appearance-preference-v1', '@ai-memory/bug-reports/v1',
  'ai-memory.backup.preferences.v1', '@ai-memory/permission-transparency-setup/v2',
];
const entries = () => keys.map(key => ({ key, raw: null }));
const manifest = (values = entries()) => ({ kind: 'ai-memory-legacy-storage-manifest', version: 1, entries: values });
const ERROR = 'Invalid or unsupported legacy storage manifest';
const rejects = operation => assert.throws(operation, error => error.message === ERROR);

test('exact nine-domain schema preserves absent, empty and populated strings without source normalization', () => {
  assert.deepEqual(Array.from(api.LEGACY_STORAGE_KEYS), keys);
  assert.equal(api.MAX_LEGACY_RAW_CODE_UNITS, 8 * 1024 * 1024);
  assert.equal(api.MAX_LEGACY_MANIFEST_UTF8_BYTES, 32 * 1024 * 1024);
  const values = [null, '', '[]', '  {malformed JSON \n', '"legacy follow-up"',
    '{"name":"Fabricated owner"}', '{"revision":9,"records":[]}',
    ' \t {"frequency":"Off","wifiOnly":true} \r\n', 'seen'];
  const input = keys.map((key, index) => ({ key, raw: values[index] })).reverse();
  const preserved = JSON.stringify(input);
  const built = api.buildLegacyStorageManifest(input);
  assert.deepEqual(Array.from(built.entries, entry => entry.key), keys);
  assert.deepEqual(Array.from(built.entries, entry => entry.raw), values);
  assert.equal(JSON.stringify(input), preserved);
  const encoded = api.encodeLegacyStorageManifest(built);
  const decoded = api.decodeLegacyStorageManifest(encoded);
  assert.equal(api.encodeLegacyStorageManifest(decoded), encoded);
  assert.deepEqual(Array.from(decoded.entries, entry => entry.raw), values);
});

test('all-null and all-deliberately-empty documents remain distinct for every domain', () => {
  for (const raw of [null, '', '[]']) {
    const result = api.decodeLegacyStorageManifest(api.encodeLegacyStorageManifest(manifest(keys.map(key => ({ key, raw })))));
    assert.deepEqual(Array.from(result.entries, item => item.raw), keys.map(() => raw));
  }
});

test('Unicode, controls, quotes and lone surrogates roundtrip across UTF8 chunk boundaries', () => {
  const raw = 'a'.repeat(16_383) + '\uD83E\uDDE0' + 'İstanbul 😀\u0000\b\f\n\r\t"\\' +
    '\uD800x\uDC00' + '\uD800\uD800\uDC00';
  const input = entries(); input[0].raw = raw;
  const encoded = api.encodeLegacyStorageManifest(manifest(input));
  assert.equal(api.decodeLegacyStorageManifest(encoded).entries[0].raw, raw);
  assert.match(encoded, /\\ud800x\\udc00/);
  const boundary = '\uD800'.repeat(16_384) + 'x';
  input[1].raw = boundary;
  assert.equal(api.decodeLegacyStorageManifest(api.encodeLegacyStorageManifest(manifest(input))).entries[1].raw, boundary);
});

test('builder and validator copy arrays/entries and canonicalize only domain order', () => {
  const input = entries(); input[0].raw = '  fabricated original  ';
  const built = api.buildLegacyStorageManifest(input);
  const validated = api.validateLegacyStorageManifest(built);
  input[0].raw = 'source changed'; input.reverse();
  built.entries[0].raw = 'returned value changed'; built.entries.reverse();
  assert.equal(validated.entries[0].key, keys[0]);
  assert.equal(validated.entries[0].raw, '  fabricated original  ');
  assert.notEqual(validated.entries, built.entries);
});

test('unsupported versions, shapes, extra fields, unknown/duplicate/missing domains and undefined fail closed', () => {
  const invalid = [null, [], {}, { ...manifest(), version: 2 }, { ...manifest(), version: '1' },
    { ...manifest(), kind: 'other' }, { ...manifest(), extra: 'fabricated private marker' },
    { ...manifest(), entries: {} }, manifest(entries().slice(1)), manifest([...entries(), entries()[0]]),
    manifest(entries().map((entry, i) => i ? entry : { ...entry, key: 'ai-memory.notebook.local-key.v1' })),
    manifest(entries().map((entry, i) => i ? entry : { ...entry, key: keys[1] })),
    manifest(entries().map((entry, i) => i ? entry : { key: entry.key })),
    manifest(entries().map((entry, i) => i ? entry : { ...entry, raw: undefined })),
    manifest(entries().map((entry, i) => i ? entry : { ...entry, raw: 1 })),
    manifest(entries().map((entry, i) => i ? entry : { ...entry, extra: null })),
  ];
  const sparse = entries(); delete sparse[0]; invalid.push(manifest(sparse));
  const arrayExtra = entries(); arrayExtra.extra = null; invalid.push(manifest(arrayExtra));
  const symbolExtra = manifest(); symbolExtra[Symbol('extra')] = true; invalid.push(symbolExtra);
  for (const input of invalid) {
    rejects(() => api.validateLegacyStorageManifest(input));
    rejects(() => api.encodeLegacyStorageManifest(input));
  }
  rejects(() => api.buildLegacyStorageManifest(undefined));
});

test('supplied getters and serialization hooks never run and failures never echo private inputs', () => {
  let accessed = 0;
  const input = manifest();
  Object.defineProperty(input, 'kind', { get() { accessed++; throw Error('fabricated private marker'); } });
  rejects(() => api.validateLegacyStorageManifest(input));
  const entryInput = entries();
  Object.defineProperty(entryInput[0], 'raw', { get() { accessed++; return 'private'; } });
  rejects(() => api.buildLegacyStorageManifest(entryInput));
  const arrayInput = entries();
  Object.defineProperty(arrayInput, '0', { get() { accessed++; return entryInput[0]; } });
  rejects(() => api.buildLegacyStorageManifest(arrayInput));
  const hookInput = manifest(); hookInput.toJSON = () => { accessed++; return {}; };
  rejects(() => api.encodeLegacyStorageManifest(hookInput));
  assert.equal(accessed, 0);
});

test('per-value code-unit ceiling accepts its boundary and rejects larger input before full serialization', () => {
  const input = entries(); input[0].raw = 'x'.repeat(8 * 1024 * 1024);
  assert.equal(api.buildLegacyStorageManifest(input).entries[0].raw.length, 8 * 1024 * 1024);
  let serialized = 0;
  const observed = load({ JSON: { parse: JSON.parse, stringify(value) { serialized++; return JSON.stringify(value); } } });
  input[0].raw += 'x';
  rejects(() => observed.buildLegacyStorageManifest(input));
  assert.equal(serialized, 0);
});

test('aggregate budget includes exact structure overhead and accepts exactly32MiB while rejecting one extra byte', () => {
  const input = entries();
  const base = Buffer.byteLength(JSON.stringify(manifest(input)), 'utf8');
  const unitLimit = 8 * 1024 * 1024;
  for (let index = 0; index < 3; index++) input[index].raw = 'x'.repeat(unitLimit);
  input[3].raw = 'x'.repeat(32 * 1024 * 1024 - base - 3 * unitLimit + 8);
  // Later null/empty tokens also count; exact-byte result is independently measured.
  const encoded = api.encodeLegacyStorageManifest(manifest(input));
  assert.equal(Buffer.byteLength(encoded, 'utf8'), 32 * 1024 * 1024);
  input[3].raw += 'x';
  rejects(() => api.buildLegacyStorageManifest(input));
});

test('multibyte and JSON-escaped budgets reject before serializing a complete oversized manifest', () => {
  const cases = [
    ['é'.repeat(8 * 1024 * 1024), 'é'.repeat(8 * 1024 * 1024)],
    ['\u0000'.repeat(6 * 1024 * 1024)],
    ['\uD800'.repeat(6 * 1024 * 1024)],
    ['"'.repeat(8 * 1024 * 1024), '\\'.repeat(8 * 1024 * 1024)],
  ];
  for (const values of cases) {
    const input = entries(); values.forEach((raw, i) => { input[i].raw = raw; });
    let largestSerializedRaw = 0;
    const observed = load({ JSON: { parse: JSON.parse, stringify(value) {
      largestSerializedRaw = Math.max(largestSerializedRaw, typeof value === 'string' ? value.length :
        Math.max(...value.entries.map(item => item.raw?.length ?? 0)));
      return JSON.stringify(value);
    } } });
    rejects(() => observed.encodeLegacyStorageManifest(manifest(input)));
    assert.ok(largestSerializedRaw <= 16_384);
  }
});

test('decode refuses malformed JSON/schema and bounds incoming serialized UTF8 bytes before parse', () => {
  for (const raw of [undefined, null, 1, '', '{', '[]', 'null', '{"kind":"fabricated private marker"}']) {
    rejects(() => api.decodeLegacyStorageManifest(raw));
  }
  let parsed = 0;
  const observed = load({ JSON: { stringify: JSON.stringify, parse(value) { parsed++; return JSON.parse(value); } } });
  rejects(() => observed.decodeLegacyStorageManifest(' '.repeat(32 * 1024 * 1024 + 1)));
  rejects(() => observed.decodeLegacyStorageManifest('é'.repeat(16 * 1024 * 1024 + 1)));
  assert.equal(parsed, 0);
  rejects(() => api.decodeLegacyStorageManifest(' \n' + JSON.stringify(manifest()) + '\t '));
  const valid = api.encodeLegacyStorageManifest(manifest());
  assert.equal(api.encodeLegacyStorageManifest(api.decodeLegacyStorageManifest(valid)), valid);
});

test('decoder rejects duplicate serialized members including escaped aliases that JSON.parse would collapse', () => {
  const encoded = api.encodeLegacyStorageManifest(manifest());
  const firstKey = JSON.stringify(keys[0]);
  const duplicates = [
    encoded.replace('"version":1', '"version":2,"version":1'),
    encoded.replace('"kind":', '"kind":"fabricated-other","kind":'),
    encoded.replace('"entries":[', '"entries":[],"entries":['),
    encoded.replace('"key":' + firstKey, '"key":"fabricated-other","key":' + firstKey),
    encoded.replace('"raw":null', '"raw":"fabricated-other","raw":null'),
    encoded.replace('"raw":null', '"\\u0072aw":"fabricated-other","raw":null'),
    encoded.replace('"kind":', '"\\u006bind":"fabricated-other","kind":'),
  ];
  for (const duplicate of duplicates) {
    assert.notEqual(duplicate, encoded);
    // Each negative was deliberately chosen to pass ordinary parsed validation.
    assert.equal(api.encodeLegacyStorageManifest(api.validateLegacyStorageManifest(JSON.parse(duplicate))), encoded);
    rejects(() => api.decodeLegacyStorageManifest(duplicate));
  }
});

test('decoder accepts canonical output only while raw JSON duplicates and whitespace stay untouched', () => {
  const input = entries(); input[0].raw = '  {"x":1,"x":2,"raw":"\\uD800"} \n'; input[1].raw = 'é/';
  const encoded = api.encodeLegacyStorageManifest(manifest(input));
  assert.equal(api.decodeLegacyStorageManifest(encoded).entries[0].raw, input[0].raw);
  const noncanonical = [
    encoded + '\n', ' ' + encoded,
    JSON.stringify({ version: 1, kind: manifest().kind, entries: input }),
    JSON.stringify(manifest(input.slice().reverse())),
    JSON.stringify(manifest(input.map(({ key, raw }) => ({ raw, key })))),
    encoded.replace('é/', '\\u00e9\\/'),
  ];
  for (const raw of noncanonical) {
    assert.notEqual(raw, encoded);
    rejects(() => api.decodeLegacyStorageManifest(raw));
  }
  // Object input APIs remain order-independent and preserve the original raw strings.
  assert.equal(api.encodeLegacyStorageManifest(api.buildLegacyStorageManifest(input.slice().reverse())), encoded);
});

test('every API fails closed when TextEncoder is unavailable', () => {
  const unavailable = load({ TextEncoder: undefined });
  rejects(() => unavailable.buildLegacyStorageManifest(entries()));
  rejects(() => unavailable.validateLegacyStorageManifest(manifest()));
  rejects(() => unavailable.encodeLegacyStorageManifest(manifest()));
  rejects(() => unavailable.decodeLegacyStorageManifest(JSON.stringify(manifest())));
});

test('pure module loads without IO dependencies and exposes no migration or native operations', () => {
  assert.doesNotMatch(source, /^\s*import\b|\brequire\s*\(|\b(?:fetch|console|AsyncStorage|SecureStore|SQLite|FileSystem)\b/m);
  assert.deepEqual(Object.keys(api).sort(), [
    'LEGACY_STORAGE_KEYS', 'LEGACY_STORAGE_MANIFEST_KIND', 'LEGACY_STORAGE_MANIFEST_VERSION',
    'MAX_LEGACY_MANIFEST_UTF8_BYTES', 'MAX_LEGACY_RAW_CODE_UNITS', 'buildLegacyStorageManifest',
    'decodeLegacyStorageManifest', 'encodeLegacyStorageManifest', 'validateLegacyStorageManifest',
  ].sort());
});
