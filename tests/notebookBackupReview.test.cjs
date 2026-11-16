const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const vm=require('node:vm');
function load(name,imports={}){
  const source=fs.readFileSync(path.join(__dirname,'../src/utils',name+'.ts'),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const context={module:{exports:{}},require:n=>{if(!(n in imports))throw Error('Unexpected import');return imports[n];}};
  context.exports=context.module.exports;
  vm.runInNewContext(code,context);
  return context.module.exports;
}
const model=load('personalNotebook');
const {planNotebookRestoreReview:review}=load('notebookBackupReview',{'./personalNotebook':model});
const note={id:'n1',title:'Synthetic',body:'Current',createdAt:'2026-11-16T12:00:00.000Z',updatedAt:'2026-11-16T12:00:00.000Z'};
test('review distinguishes additions, identical notes and conflicts',()=>{
  const existing=[note,{...note,id:'n2'}];
  const incoming=[note,{...note,id:'n2',body:'Different'},{...note,id:'n3'}];
  const before=JSON.stringify(existing);
  const plan=review(JSON.stringify(incoming),existing);
  assert.equal(plan.status,'review-required');
  assert.equal(plan.identical,1);
  assert.equal(plan.additions[0].id,'n3');
  assert.equal(plan.conflicts[0].existing.body,'Current');
  assert.equal(plan.conflicts[0].incoming.body,'Different');
  plan.conflicts[0].existing.body='Changed copy';
  assert.equal(JSON.stringify(existing),before);
});
test('empty archive is not an instruction to delete existing notes',()=>{
  const plan=review('[]',[note]);
  assert.equal(plan.existingCount,1);
  assert.equal(plan.additions.length,0);
  assert.equal(plan.conflicts.length,0);
});
test('invalid or duplicate archives are rejected',()=>{
  assert.throws(()=>review('bad',[note]));
  assert.throws(()=>review(JSON.stringify([note,note]),[note]));
  assert.throws(()=>review('[]',[note,note]));
});
