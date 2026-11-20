const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {loadPure}=require('./helpers/presentation.cjs');
const {THEMES,resolveThemeMode}=loadPure('src/theme/tokens.ts');
const {timeEntryEn,timeEntryTr}=loadPure('src/i18n/catalogs/timeEntry.ts');
const model=loadPure('src/utils/digitalReminderTime.ts');
function screen(language='en',mode='classic',system='light',controlled=false){
  let cursor=0,pending=[],dirty=false,output,value=new Date(2026,10,20,9,7),disabled=false,cancels=0;
  const slots=[],effects=[],focuses=[],confirmed=[];
  let fields=model.digitalReminderFields(value);
  const copy=language==='tr'?timeEntryTr:timeEntryEn,theme=THEMES[resolveThemeMode(mode,system)];
  const react={
    createElement(type,props,...children){if(props?.ref)props.ref.current={focus(){focuses.push(props.accessibilityLabel);},blur(){focuses.push('blur');}};return{type,props:{...props,children}};},
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;dirty=true;}];},
    useRef(initial){return slots[cursor++]??={current:initial};},
    useEffect(callback,deps){const i=cursor++,prior=effects[i];if(!prior||deps.some((d,j)=>!Object.is(d,prior[j])))pending.push(()=>{effects[i]=deps;callback();});},
  };
  const imports={react:{__esModule:true,default:react,...react},'react-native':{Pressable:'Pressable',Text:'Text',TextInput:'TextInput',View:'View',StyleSheet:{create:x=>x}},
    '../../i18n/LanguageProvider':{useI18n:()=>({copy:{timeEntry:copy}})},
    '../../theme/useThemedStyles':{useThemedStyles:create=>create(theme)},'../../utils/digitalReminderTime':model};
  const m={exports:{}};
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/components/ui/DigitalTimeInput.tsx'),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText)(n=>{assert.ok(n in imports,n);return imports[n];},m,m.exports);
  function render(){cursor=0;dirty=false;output=m.exports.DigitalTimeInput({value,disabled,
    ...(controlled?{fields,onFieldsChange:next=>{fields=next;dirty=true;}}:{}),
    onConfirm:date=>confirmed.push(date),onCancel:()=>cancels++});const run=pending;pending=[];run.forEach(f=>f());}
  function flush(){for(let i=0;i<6&&dirty;i++)render();assert.equal(dirty,false);}
  function nodes(n){return Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props.children)]:[];}
  const ui={copy,theme,focuses,confirmed,flush,get cancels(){return cancels;},get nodes(){return nodes(output);},
    find(type,label){const n=nodes(output).find(n=>n.type===type&&n.props.accessibilityLabel===label);assert.ok(n,label);return n;},
    input(label,text){ui.find('TextInput',label).props.onChangeText(text);flush();},
    press(label){const n=ui.find('Pressable',label);assert.equal(n.props.disabled,false);n.props.onPress();flush();},
    blur(label){ui.find('TextInput',label).props.onBlur();flush();},
    next(date){value=date;render();flush();},fields(next){fields=next;render();flush();},disable(){disabled=true;render();flush();}};
  render();flush();return ui;
}

for(const language of ['en','tr'])for(const [mode,system] of [['classic','light'],['modern','dark'],['light','light'],['dark','dark'],['system','light'],['system','dark']])
  test(`localized numeric/focus/accessibility/theme contract ${language}/${mode}/${system}`,()=>{
    const ui=screen(language,mode,system),c=ui.copy;
    const hour=ui.find('TextInput',c.hour),minute=ui.find('TextInput',c.minute);
    assert.equal(hour.props.value,'09');assert.equal(minute.props.value,'07');assert.deepEqual(ui.focuses,[c.hour]);
    hour.props.onSubmitEditing();assert.deepEqual(ui.focuses,[c.hour,c.minute]);
    for(const field of [hour,minute]){
      assert.equal(field.props.inputMode,'numeric');assert.equal(field.props.keyboardType,'number-pad');assert.equal(field.props.selectTextOnFocus,true);
      assert.ok(field.props.accessibilityHint);assert.notEqual(field.props.allowFontScaling,false);
      assert.equal(field.props.style.color,ui.theme.colors.text);assert.ok(field.props.style.minHeight>=48);assert.equal(field.props.style.height,undefined);
    }
    ui.input(c.minute,'8');ui.blur(c.minute);assert.equal(ui.find('TextInput',c.minute).props.value,'08');
    ui.press(c.confirm);ui.press(c.confirm);assert.equal(ui.confirmed.length,1);assert.equal(ui.confirmed[0].getHours(),9);assert.equal(ui.confirmed[0].getMinutes(),8);
  });

test('invalid input retains draft, blocks confirmation immediately and cancel never commits',()=>{
  const ui=screen(),c=ui.copy;ui.input(c.hour,'24');assert.equal(ui.find('TextInput',c.hour).props.value,'24');
  assert.equal(ui.find('Pressable',c.confirm).props.disabled,true);assert.ok(ui.nodes.some(n=>n.props.accessibilityLiveRegion==='polite'&&n.props.children.includes(c.invalidHour)));
  ui.blur(c.hour);assert.equal(ui.find('TextInput',c.hour).props.value,'24');
  ui.press(c.cancel);assert.equal(ui.cancels,1);assert.equal(ui.confirmed.length,0);
});

test('caller date changes prepopulate a new draft, Done does not confirm and disabled actions stay inert',()=>{
  const ui=screen(),c=ui.copy;ui.input(c.hour,'22');ui.next(new Date(2027,0,2,0,59));
  assert.equal(ui.find('TextInput',c.hour).props.value,'00');assert.equal(ui.find('TextInput',c.minute).props.value,'59');
  ui.find('TextInput',c.minute).props.onSubmitEditing();assert.equal(ui.confirmed.length,0);
  ui.disable();assert.equal(ui.find('TextInput',c.hour).props.editable,false);assert.equal(ui.find('Pressable',c.cancel).props.disabled,true);
  ui.find('Pressable',c.confirm).props.onPress();assert.equal(ui.confirmed.length,0);
});

test('controlled raw clock survives caller date changes and validates parent-owned input',()=>{
  const ui=screen('en','classic','light',true),c=ui.copy;
  ui.input(c.hour,'23');ui.input(c.minute,'');
  ui.next(new Date(2099,2,8,12,0));
  assert.equal(ui.find('TextInput',c.hour).props.value,'23');assert.equal(ui.find('TextInput',c.minute).props.value,'');
  assert.equal(ui.find('Pressable',c.confirm).props.disabled,true);
  ui.fields({hour:'23',minute:'07'});ui.press(c.confirm);
  assert.equal(ui.confirmed[0].getHours(),23);assert.equal(ui.confirmed[0].getMinutes(),7);
  ui.disable();ui.find('TextInput',c.hour).props.onChangeText('01');
  assert.equal(ui.find('TextInput',c.hour).props.value,'23');
});

for(const controlled of [false,true])test(`native input/blur/confirm before render validate the latest raw clock; controlled=${controlled}`,()=>{
  const ui=screen('en','classic','light',controlled),c=ui.copy;
  const hour=ui.find('TextInput',c.hour),minute=ui.find('TextInput',c.minute),confirm=ui.find('Pressable',c.confirm);
  hour.props.onChangeText('2');hour.props.onBlur();ui.flush();
  assert.equal(ui.find('TextInput',c.hour).props.value,'02');
  minute.props.onChangeText('');confirm.props.onPress();assert.equal(ui.confirmed.length,0);
  ui.flush();assert.equal(ui.find('Pressable',c.confirm).props.disabled,true);
});
