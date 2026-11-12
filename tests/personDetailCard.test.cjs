const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync(require.resolve('../App.tsx'), 'utf8');

test('read-only person profile exposes saved edit fields without entering Edit', () => {
  const detailStart = app.indexOf("if (screen === 'detail' && selected)");
  const homeStart = app.indexOf('  return (\n    <Page>\n      <View style={styles.hero}>', detailStart);
  assert.ok(detailStart > 0 && homeStart > detailStart);
  const detail = app.slice(detailStart, homeStart);
  assert.match(detail, /<Label text="PERSON DETAILS" \/>/);
  for (const key of ['role', 'company', 'phone', 'relationship']) {
    assert.match(detail, new RegExp('value=\\{selected\\.' + key + '\\}'));
  }
  assert.match(detail, /value=\{selected\.interactions\[0\]/);
  assert.match(detail, /<Label text="WHAT TO REMEMBER" \/>/);
  assert.match(detail, /<Label text="NEW INTERACTION" \/>/);
  assert.match(detail, /<Text style=\{styles\.sectionTitle\}>History<\/Text>/);
});

test('home person cards show context, optional phone, note, and next follow-up', () => {
  const start = app.indexOf('{filtered.map((person) => (');
  assert.ok(start > 0);
  const card = app.slice(start, app.indexOf('      {!filtered.length', start));
  for (const key of ['relationship', 'phone', 'notes[0]', 'followUp', 'interactions[0]']) {
    assert.ok(card.includes('person.' + key), 'missing ' + key + ' from person card');
  }
  assert.match(card, /numberOfLines=\{2\}>Remember:/);
  assert.match(card, /numberOfLines=\{2\}>Next:/);
  assert.match(card, /onPress=\{\(\) => openPerson\(person\.id\)\}/);
});
