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
  assert.deepEqual(screen.props.edges,['top','right','bottom','left']);
  assert.equal(screen.props.style[0].backgroundColor,theme.colors.background);
  assert.equal(screen.props.style[0].paddingTop,undefined,'native insets must not be added a second time by Screen');
});

test('one root safe-area provider preserves gate order and dynamic system bars',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../index.tsx'),'utf8');
  assert.equal((source.match(/<SafeAreaProvider>/g)||[]).length,1);
  assert.match(source,/<PrivacyGate>[\s\S]*<OwnerProfileGate>[\s\S]*<NotebookBoundary><App \/>/);
  assert.match(source,/barStyle=\{isDark \? 'light-content' : 'dark-content'\}/);
  assert.doesNotMatch(source,/key=\{(theme|mode|language)/);
});
