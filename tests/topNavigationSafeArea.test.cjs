const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { loadPure } = require('./helpers/presentation.cjs');
const { THEMES } = loadPure('src/theme/tokens.ts');
function component(file, imports) {
  const m = {exports:{}};
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText)(
      n => { if (!(n in imports)) throw Error('Unexpected '+n); return imports[n]; },m,m.exports);
  return m.exports;
}
const react = {createElement:(type,props,...children)=>({type,props:{...props,children}})};
function nodes(n){return Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];}
for(const mode of ['classic','modern','light','dark']) test('shared compact Back and screen insets preserve navigation in '+mode,()=>{
  const theme=THEMES[mode];let calls=0;
  const {AppHeader}=component('src/components/ui/AppHeader.tsx',{
    react:{__esModule:true,default:react},'react-native':{Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{create:x=>x}},
    '../../theme/useThemedStyles':{useThemedStyles:factory=>factory(theme)},
  });
  const rendered=AppHeader({onBack:()=>calls++,backLabel:'Synthetic back',accessibilityLabel:'Synthetic navigation',title:'Synthetic title'});
  const back=nodes(rendered).find(n=>n.type==='Pressable');
  assert.equal(back.props.accessibilityRole,'button');assert.equal(back.props.accessibilityLabel,'Synthetic navigation');
  assert.equal(back.props.style.alignSelf,'flex-start');assert.ok(back.props.style.minHeight>=48);assert.ok(back.props.style.minWidth>=48);
  assert.equal(back.props.disabled,false);back.props.onPress();assert.equal(calls,1);
  const disabled=nodes(AppHeader({onBack:()=>calls++,backLabel:'Synthetic back',accessibilityLabel:'Synthetic navigation',backDisabled:true})).find(n=>n.type==='Pressable');
  assert.equal(disabled.props.disabled,true);assert.equal(disabled.props.accessibilityState.disabled,true);
  const {Screen}=component('src/components/ui/Screen.tsx',{
    react:{__esModule:true,default:react},'react-native-safe-area-context':{SafeAreaView:'NativeSafeArea'},
    '../../theme/ThemeProvider':{useTheme:()=>({theme})},
  });
  const screen=Screen({children:rendered});assert.equal(screen.type,'NativeSafeArea');
  assert.deepEqual(screen.props.edges,[],'root owns insets; a screen must not add a second inset');
  assert.equal(screen.props.style[0].backgroundColor,theme.colors.background);
  assert.equal(screen.props.style[0].paddingTop,undefined,'native insets must not be added a second time by Screen');
});

test('all gates share one clipped native safe viewport inside keyboard avoidance',()=>{
  let Root;
  const {THEMES}=loadPure('src/theme/tokens.ts');
  const m={exports:{}};
  const imports={react:{__esModule:true,default:react},
    'react-native':{KeyboardAvoidingView:'Keyboard',Platform:{OS:'android'},StatusBar:'StatusBar',StyleSheet:{create:x=>x},View:'View'},
    'react-native-safe-area-context':{SafeAreaProvider:'Provider',SafeAreaView:'NativeSafeArea'},
    expo:{registerRootComponent:value=>{Root=value;}},
    './App':{__esModule:true,default:'App'},
    './src/components/OwnerProfileGate':{OwnerProfileGate:'Owner'},
    './src/components/PrivacyGate':{PrivacyGate:'Privacy'},
    './src/components/NotebookBoundary':{NotebookBoundary:'Notebook'},
    './src/i18n/LanguageProvider':{LanguageProvider:'Language'},
    './src/theme/ThemeProvider':{ThemeProvider:'Theme',useTheme:()=>({theme:THEMES.classic,isDark:true})},
  };
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../index.tsx'),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText)(n=>{assert.ok(n in imports,n);return imports[n];},m,m.exports);
  function expand(n){if(Array.isArray(n))return n.flatMap(expand);if(!n||typeof n!=='object')return [];
    if(typeof n.type==='function')return expand(n.type(n.props));return [n,...expand(n.props.children)];}
  const tree=expand(Root());
  const keyboard=tree.find(n=>n.type==='Keyboard');assert.equal(keyboard.props.behavior,'height');
  const safe=expand(keyboard.props.children).find(n=>n.type==='NativeSafeArea');
  assert.deepEqual(safe.props.edges,['top','right','bottom','left']);
  assert.equal(safe.props.style.flex,1);assert.equal(safe.props.style.paddingTop,undefined);
  const viewport=safe.props.children.find(n=>n?.type==='View');
  assert.equal(viewport.props.style.flex,1);assert.equal(viewport.props.style.overflow,'hidden');
  assert.deepEqual(expand(viewport).filter(n=>['Privacy','Owner','Notebook','App'].includes(n.type)).map(n=>n.type),['Privacy','Owner','Notebook','App']);
});

test('assigned descendant routes delegate system insets and auth layout remains scrollable',()=>{
  for(const name of ['PrivacyGate','ReminderPermissionGate','GroundedAssistantPanel','PersonalNotebookPreview']){
    const source=fs.readFileSync(path.resolve(__dirname,'../src/components/'+name+'.tsx'),'utf8');
    const views=[...source.matchAll(/<SafeAreaView\b[^>]*>/g)];assert.ok(views.length,name);
    assert.ok(views.every(match=>match[0].includes('edges={[]}')),name+' must delegate insets');
  }
  const auth=fs.readFileSync(path.resolve(__dirname,'../src/components/PrivacyGate.tsx'),'utf8');
  assert.equal((auth.match(/<ScrollView contentContainerStyle=\{styles.container\}>/g)||[]).length,2);
  assert.match(auth,/container:\s*\{\s*flexGrow: 1/);
});

test('one root safe-area provider preserves gate order and dynamic system bars',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../index.tsx'),'utf8');
  assert.equal((source.match(/<SafeAreaProvider>/g)||[]).length,1);
  assert.match(source,/<PrivacyGate>[\s\S]*<OwnerProfileGate>[\s\S]*<NotebookBoundary><App \/>/);
  assert.match(source,/barStyle=\{isDark \? 'light-content' : 'dark-content'\}/);
  assert.doesNotMatch(source,/key=\{(theme|mode|language)/);
});
