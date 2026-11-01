const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('safe Android top inset includes status-bar height and an extra visual gap', () => {
  const helper = read('src/utils/screenInsets.ts');
  assert.match(helper, /StatusBar\.currentHeight/);
  assert.match(helper, /Math\.max\(StatusBar\.currentHeight\s*\?\?\s*24,\s*24\)\s*\+\s*12/);
});

test('people detail and edit screens use the shared safe top inset and a tappable back control', () => {
  const app = read('App.tsx');
  assert.match(app, /paddingTop:\s*SCREEN_TOP_PADDING/);
  assert.match(app, /<Back onPress=/);
  assert.match(app, /accessibilityRole="button"/);
  assert.match(app, /accessibilityLabel="Back to people"/);
  assert.match(app, /minHeight:\s*44/);
});

test('Settings and bug report navigation use the same safe top inset', () => {
  for (const file of ['src/components/SettingsPanel.tsx', 'src/components/BugReportPanel.tsx']) {
    const component = read(file);
    assert.match(component, /import \{ SCREEN_TOP_PADDING \} from '\.\.\/utils\/screenInsets'/, file);
    assert.match(component, /paddingTop:\s*SCREEN_TOP_PADDING/, file);
  }
});
