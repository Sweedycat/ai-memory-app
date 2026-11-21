const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPure } = require('./helpers/presentation.cjs');
const { localEncryptionContextAAD: aad, LOCAL_ENCRYPTION_DOMAINS } = loadPure('src/utils/localEncryptionContext.ts');
const context = () => ({ version: 1, domain: 'people', schemaVersion: 1,
  vaultId: '1'.repeat(32), keyId: '2'.repeat(32), generationId: '3'.repeat(32) });

test('local context has stable ASCII binding, independent of property order and later mutation', () => {
  const value = context(), encoded = aad(value);
  assert.equal(encoded, JSON.stringify(['ai-memory-local-vault', 1, 'people', 1,
    value.vaultId, value.keyId, value.generationId]));
  assert.equal(aad(Object.fromEntries(Object.entries(value).reverse())), encoded);
  assert.match(encoded, /^[\x20-\x7E]+$/);
  value.generationId = '4'.repeat(32); assert.notEqual(aad(value), encoded);
  assert.equal(new Set(LOCAL_ENCRYPTION_DOMAINS.map(domain => aad({ ...context(), domain }))).size, 6);
});

test('unsupported context versions, fields, domains and identifiers fail without echoing input', () => {
  const invalid = [null, [], {}, 'PRIVATE-CANARY', { ...context(), version: 2 }, { ...context(), schemaVersion: 0 },
    { ...context(), domain: 'attachments' }, { ...context(), extra: 'PRIVATE-CANARY' }];
  for (const field of Object.keys(context())) { const missing = context(); delete missing[field]; invalid.push(missing); }
  for (const field of ['vaultId', 'keyId', 'generationId'])
    for (const value of ['', 'a'.repeat(31), 'A'.repeat(32), 'PRIVATE-CANARY', 1]) invalid.push({ ...context(), [field]: value });
  for (const value of invalid) assert.throws(() => aad(value), error => error.message === 'Invalid local encryption context');
});

test('context rejects accessors and symbol fields without evaluating caller code', () => {
  let reads = 0; const value = context();
  Object.defineProperty(value, 'keyId', { get() { reads++; throw Error('PRIVATE-CANARY'); } });
  assert.throws(() => aad(value), /Invalid local encryption context/); assert.equal(reads, 0);
  assert.throws(() => aad({ ...context(), [Symbol('extra')]: 1 }), /Invalid local encryption context/);
});
