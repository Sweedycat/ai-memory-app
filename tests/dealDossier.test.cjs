const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'src/utils/dealDossier.ts');
const source = fs.readFileSync(file, 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const ctx = { module: { exports: {} } };
ctx.exports = ctx.module.exports;
vm.runInNewContext(code, ctx);
const d = ctx.module.exports;

const baseDeal = () => ({
  id: 'sale-synthetic-100k',
  title: '100,000 USD sample equipment sale',
  stage: 'won',
  currency: 'USD',
  amountMinor: '10000000',
  createdAt: '2026-11-05T09:00:00Z',
  updatedAt: '2026-11-05T10:00:00Z',
  closedAt: '2026-11-05T10:00:00Z',
  description: 'Synthetic contract to demonstrate what was sold',
  lineItems: [{
    id: 'line-1',
    description: 'Industrial equipment model DEMO',
    quantity: '2',
    sku: 'DEMO-001',
    unit: 'set',
  }],
  attachments: [{
    id: 'attach-1',
    fileName: 'Sample-Contract.pdf',
    mimeType: 'application/pdf',
    encryptedBlobId: 'encrypted_contract_blob_01',
    ciphertextSha256: 'a'.repeat(64),
    encryptedByteSize: 10_000_000,
  }],
});

const baseDossier = () => ({
  kind: d.DEAL_DOSSIER_KIND,
  version: d.DEAL_DOSSIER_VERSION,
  personId: 'person-synthetic-1',
  deals: [baseDeal()],
});

test('100,000 USD synthetic sale keeps exact smallest-unit amount and what was sold', () => {
  const source = baseDossier();
  const output = d.validateEncryptedPersonDealDossier(source);
  assert.equal(output.personId, 'person-synthetic-1');
  assert.equal(output.deals[0].currency, 'USD');
  assert.equal(output.deals[0].amountMinor, '10000000');
  assert.equal(output.deals[0].lineItems[0].description, 'Industrial equipment model DEMO');
  assert.equal(output.deals[0].attachments[0].fileName, 'Sample-Contract.pdf');
  assert.equal(output.deals[0].attachments[0].encryptedByteSize, 10_000_000);
  assert.equal(JSON.stringify(source.deals[0]), JSON.stringify(baseDeal()), 'must not mutate original record');
});

test('missing or imprecise money is rejected instead of rounding a business deal', () => {
  for (const money of [10000000, 100000.00, '100000.0', '-1', '1e8', '01', '1'.repeat(19)]) {
    assert.throws(() => d.validateEncryptedPersonDealDossier({
      ...baseDossier(),
      deals: [{ ...baseDeal(), amountMinor: money }],
    }), /Invalid deal amount|Invalid amount in minor units/);
  }
});

test('unsafe unencrypted local file URI must never be a valid encrypted attachment reference', () => {
  for (const id of ['content://android.provider/file/123', 'file:///private/plain.pdf',
    '../../sample.pdf', 'https://drive.google.com/open?id=123']) {
    assert.throws(() => d.validateEncryptedPersonDealDossier({
      ...baseDossier(),
      deals: [{ ...baseDeal(), attachments: [{
        ...baseDeal().attachments[0], encryptedBlobId: id,
      }] }],
    }), /Invalid encrypted blob ID/);
  }
});

test('invalid filenames and corrupted encrypted metadata are rejected', () => {
  for (const patch of [
    { fileName: '../../secrets.pdf' },
    { fileName: 'folder\\document.pdf' },
    { fileName: 'contract\r\n.pdf' },
    { ciphertextSha256: 'not-a-sha' },
    { encryptedByteSize: -1 },
    { encryptedByteSize: 1.5 },
    { mimeType: 'not-a-mime' },
  ]) {
    assert.throws(() => d.validateEncryptedPersonDealDossier({
      ...baseDossier(),
      deals: [{ ...baseDeal(), attachments: [{
        ...baseDeal().attachments[0], ...patch,
      }] }],
    }));
  }
});

test('duplicate deal, attachment or product IDs are rejected to avoid overwrite', () => {
  const item = baseDeal();
  const variants = [
    { ...baseDossier(), deals: [item, item] },
    { ...baseDossier(), deals: [{ ...item, lineItems: [item.lineItems[0], item.lineItems[0]] }] },
    { ...baseDossier(), deals: [{ ...item, attachments: [item.attachments[0], item.attachments[0]] }] },
  ];
  for (const data of variants) {
    assert.throws(() => d.validateEncryptedPersonDealDossier(data), /Duplicate/);
  }
});

test('unsupported version and invalid person link reject dossier before touching any storage', () => {
  assert.throws(() => d.validateEncryptedPersonDealDossier({ ...baseDossier(), version: 2 }), /unsupported/);
  assert.throws(() => d.validateEncryptedPersonDealDossier({ ...baseDossier(), personId: '' }), /linked person ID/);
  assert.throws(() => d.validateEncryptedPersonDealDossier({ ...baseDossier(), deals: 'missing' }), /deal list/);
});

test('validated dossier returns only known fields, stripping unexpected sensitive properties', () => {
  const deal = { ...baseDeal(), secretPhone: 'Never copy extra fields' };
  const dossier = d.validateEncryptedPersonDealDossier({
    ...baseDossier(), debugNote: 'Never export this', deals: [deal],
  });
  assert.equal(dossier.deals[0].secretPhone, undefined);
  assert.equal(dossier.debugNote, undefined);
});

test('data model performs no network calls, file uploads, contacts read, or storage writes', () => {
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executable, /fetch\s*\(|XMLHttpRequest|AsyncStorage|SecureStore|console\.|writeFile|readFile|Share\.share|DocumentPicker|contacts/i);
});
