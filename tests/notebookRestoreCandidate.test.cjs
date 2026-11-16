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
const reviewModule=load('notebookBackupReview',{'./personalNotebook':model});
const {prepareNotebookRestoreCandidate:prepare}=load('notebookRestoreCandidate',{'./personalNotebook':model,'./notebookBackupReview':reviewModule});
const existing=[note,{...note,id:'local-only'}];
const incoming=[{...note,body:'Incoming'},{...note,id:'new'}];
function input(overrides={}){
  return {authenticatedNotes:JSON.stringify(incoming),reviewedExistingNotes:existing,currentNotes:existing,
    choices:[{id:'n1',action:'keep-existing'}],includeAdditions:true,...overrides};
}
test('explicit decisions preserve local-only notes and select incoming additions',()=>{
  const result=prepare(input());
  assert.equal(result.length,3);
  assert.equal(result[0].body,'Current');
  assert.equal(result[1].id,'local-only');
  assert.equal(result[2].id,'new');
  const replacement=prepare(input({choices:[{id:'n1',action:'use-incoming'}],includeAdditions:false}));
  assert.equal(replacement.length,2);
  assert.equal(replacement[0].body,'Incoming');
  assert.equal(existing[0].body,'Current');
});
test('missing, duplicate and invented conflict choices are rejected',()=>{
  for(const choices of [[],[{id:'n1',action:'keep-existing'},{id:'n1',action:'use-incoming'}],
    [{id:'unknown',action:'use-incoming'}],[{id:'n1',action:'delete'}]]) {
    assert.throws(()=>prepare(input({choices})));
  }
});
test('stale review cannot replace newer local notes',()=>{
  assert.throws(()=>prepare(input({currentNotes:[{...note,body:'New local edit'},existing[1]]})));
});
test('empty backup never deletes local notes',()=>{
  const result=prepare(input({authenticatedNotes:'[]',choices:[]}));
  assert.equal(JSON.stringify(result),JSON.stringify(existing));
});
