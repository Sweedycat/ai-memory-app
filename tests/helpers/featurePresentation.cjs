const { loadPure, presentationImports } = require('./presentation.cjs');
const { catalog } = loadPure('src/i18n/catalog.ts');
const { THEMES } = loadPure('src/theme/tokens.ts');

// The context is mutable to simulate language/theme changes without remounting.
function createPresentation(load, react, native, { language = 'en', mode = 'classic' } = {}) {
  const state = { language, mode };
  const contexts = {};
  for (const key of Object.keys(presentationImports())) contexts[key] = new Proxy({}, {
    get(_, name) { return presentationImports(state.language, state.mode)[key][name]; },
  });
  contexts['./ui/AppHeader'] = load('src/components/ui/AppHeader.tsx', {
    react: { __esModule: true, default: react, ...react }, 'react-native': native,
    '../../theme/useThemedStyles': contexts['../theme/useThemedStyles'],
  });
  return { imports: contexts, state, catalog, THEMES };
}
module.exports = { createPresentation, pureSource: loadPure, catalog, THEMES };
