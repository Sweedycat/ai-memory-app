const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {loadPure}=require('./helpers/presentation.cjs');
const {applyDigitalReminderTime:apply,digitalReminderFields:fields}=loadPure('src/utils/digitalReminderTime.ts');

test('all exact minutes, midnight and last minute retain the caller calendar date without mutation',()=>{
  const original=new Date(2026,10,20,15,22,31,123),stamp=original.getTime();
  for(let hour=0;hour<24;hour++)for(let minute=0;minute<60;minute++){
    const result=apply(original,String(hour),String(minute));assert.equal(result.ok,true);
    const next=result.date;assert.equal(next.getFullYear(),2026);assert.equal(next.getMonth(),10);assert.equal(next.getDate(),20);
    assert.equal(next.getHours(),hour);assert.equal(next.getMinutes(),minute);
  }
  assert.equal(original.getTime(),stamp);assert.deepEqual(fields(new Date(2026,0,1,0,7)),{hour:'00',minute:'07'});
  assert.equal(apply(original,'15','22').date.getTime(),stamp);
});

test('invalid numeric/date inputs are rejected rather than clamped, truncated or normalized',()=>{
  const value=new Date(2026,10,20,12,30);
  for(const invalid of ['', '24', '99', '-1',' 1','1 ','1.5','001','1e1','١٢','ab']){
    assert.deepEqual(apply(value,invalid,'00'),{ok:false,reason:'invalidHour'});
  }
  for(const invalid of ['', '60','99','-1',' 1','1.5','001','1e1','ab']){
    assert.deepEqual(apply(value,'00',invalid),{ok:false,reason:'invalidMinute'});
  }
  assert.deepEqual(apply(new Date(NaN),'00','00'),{ok:false,reason:'invalidDate'});
  assert.deepEqual(fields(new Date(NaN)),{hour:'',minute:''});
});

test('DST gaps reject silent shifts and unchanged repeated-hour edits preserve the exact occurrence',()=>{
  const code=`const assert=require('node:assert/strict');
    const {loadPure}=require('./tests/helpers/presentation.cjs');
    const {applyDigitalReminderTime:apply}=loadPure('src/utils/digitalReminderTime.ts');
    const spring=new Date('2026-03-08T05:30:00.000Z');
    assert.equal(spring.getHours(),0,'test timezone must have New York DST rules');
    assert.deepEqual(apply(spring,'02','30'),{ok:false,reason:'unavailableTime'});
    assert.equal(apply(spring,'03','30').date.toISOString(),'2026-03-08T07:30:00.000Z');
    const second=new Date('2026-11-01T06:30:27.123Z');assert.equal(second.getHours(),1);
    assert.equal(apply(second,'01','30').date.toISOString(),second.toISOString());
    assert.equal(apply(second,'23','59').date.getDate(),1);`;
  const result=spawnSync(process.execPath,['-e',code],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,TZ:'America/New_York'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
