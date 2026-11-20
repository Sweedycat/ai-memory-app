// Pure catalog/token loading for synthetic UI harnesses. Native/auth/storage
// behavior remains owned by each harness; this helper never supplies those mocks.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const cache = new Map();
function loadPure(file) {
  const absolute = path.resolve(root, file);
  if (!absolute.startsWith(root + path.sep)) throw Error('Unexpected fixture path');
  if (cache.has(absolute)) return cache.get(absolute);
  const module = { exports: {} };
  cache.set(absolute, module.exports);
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => {
    if (!name.startsWith('.')) throw Error('Unexpected non-pure import: ' + name);
    return loadPure(path.relative(root, path.resolve(path.dirname(absolute), name + '.ts')));
  }, module, module.exports);
  cache.set(absolute, module.exports);
  return module.exports;
}
function presentationImports(language = 'en', mode = 'classic') {
  const { catalog } = loadPure('src/i18n/catalog.ts');
  const { THEMES } = loadPure('src/theme/tokens.ts');
  const theme = THEMES[mode];
  return {
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) },
    '../i18n/LanguageProvider': { useI18n: () => ({ language, locale: language === 'tr' ? 'tr-TR' : 'en-US', copy: catalog[language] }) },
    '../theme/ThemeProvider': { useTheme: () => ({ theme, mode, isDark: theme.isDark }) },
    '../theme/useThemedStyles': { useThemedStyles: create => create(theme) },
  };
}
module.exports = { loadPure, presentationImports };
