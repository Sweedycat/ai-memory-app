const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');

test('contact detail shows every editable profile field without opening Edit', () => {
  for (const field of ['PROFILE DETAILS', 'Relationship', 'Role', 'Company', 'Phone number', 'Last interaction']) {
    assert.ok(app.includes(field), 'Missing contact detail: ' + field);
  }
  assert.match(app, /value=\{selected\.phone \|\| 'Not added yet'\}/);
  assert.match(app, /value=\{selected\.relationship \|\| 'Not added yet'\}/);
  assert.match(app, /<ProfileDetailRow/);
});

test('home contact cards preview notes and next actions while keeping full detail', () => {
  assert.match(app, /Remember: \{person\.notes\[0\]\}/);
  assert.match(app, /Next: \{person\.followUp\.text\}/);
  assert.match(app, /Relationship: \{person\.relationship\}/);
  assert.match(app, /numberOfLines=\{2\}/);
  assert.match(app, /onPress=\{\(\) => openPerson\(person\.id\)\}/);
});

test('rich cards do not mutate person records or sync device contacts', () => {
  assert.match(app, /usePersistentPeople\(mockPeople\)/);
  assert.match(app, /not in your phone Contacts/);
  assert.doesNotMatch(app, /expo-contacts|Contacts\.addContactAsync/);
});
