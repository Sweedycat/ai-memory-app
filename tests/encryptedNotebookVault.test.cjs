const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
function load(name, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/utils', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const context = {module:{exports:{}},require:n=>{
    if (!(n in imports)) throw Error('Unexpected import');
    return imports[n];
  }};
  context.exports=context.module.exports;
  vm.runInNewContext(code,context);
  return context.module.exports;
}
const model=load('personalNotebook');
const {createEncryptedNotebookVault:create}=load('encryptedNotebookVault',{'./personalNotebook':model});
const raw=JSON.stringify([{id:'n1',title:'Synthetic private note',body:'Türkçe 🚗',
  createdAt:'2026-11-16T12:00:00.000Z',updatedAt:'2026-11-16T12:00:00.000Z'}]);
// Test-only Node crypto implementation; never imported by the mobile app.
function cipher(key=crypto.randomBytes(32)) {
  return {
    async encryptUtf8ToCombinedBase64(text) {
      const iv=crypto.randomBytes(12);
      const c=crypto.createCipheriv('aes-256-gcm',key,iv);
      const payload=Buffer.concat([c.update(text,'utf8'),c.final()]);
      return Buffer.concat([iv,payload,c.getAuthTag()]).toString('base64');
    },
    async decryptCombinedBase64ToUtf8(text) {
      const bytes=Buffer.from(text,'base64');
      const d=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
      d.setAuthTag(bytes.subarray(-16));
      return Buffer.concat([d.update(bytes.subarray(12,-16)),d.final()]).toString('utf8');
    }
  };
}
function store() {
  let value=null;
  return {read:async()=>value,replaceAtomically:async next=>{value=next;}};
}
test('encrypted roundtrip preserves Turkish and emoji and uses fresh nonces',async()=>{
  const s=store(),v=create(s,cipher());
  assert.equal(await v.readAuthenticated(),null);
  await v.replaceAuthenticated(raw);
  const first=await s.read();
  assert.ok(!first.includes('Synthetic private note'));
  assert.equal(await v.readAuthenticated(),raw);
  await v.replaceAuthenticated(raw);
  assert.notEqual(await s.read(),first);
});
test('wrong key and tampered ciphertext fail authentication',async()=>{
  const s=store(),v=create(s,cipher());
  await v.replaceAuthenticated(raw);
  await assert.rejects(create(s,cipher()).readAuthenticated());
  const bytes=Buffer.from(await s.read(),'base64');
  bytes[15]^=1;
  await s.replaceAtomically(bytes.toString('base64'));
  await assert.rejects(v.readAuthenticated());
});
test('authenticated unrelated payload and malformed ciphertext are rejected',async()=>{
  const s=store(),c=cipher(),v=create(s,c);
  await s.replaceAtomically(await c.encryptUtf8ToCombinedBase64(raw));
  await assert.rejects(v.readAuthenticated());
  await s.replaceAtomically('not-base64');
  await assert.rejects(v.readAuthenticated());
});
test('invalid new data and failed encryption never replace existing ciphertext',async()=>{
  const s=store(),v=create(s,cipher());
  await v.replaceAuthenticated(raw);
  const before=await s.read();
  await assert.rejects(v.replaceAuthenticated('{}'));
  await assert.rejects(create(s,{encryptUtf8ToCombinedBase64:async()=>{throw Error('failure');}}).replaceAuthenticated(raw));
  assert.equal(await s.read(),before);
});
