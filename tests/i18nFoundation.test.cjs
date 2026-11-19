const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, imports = {}) {
  const local = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(
    name => { if (!Object.hasOwn(imports, name)) throw Error('Unexpected import: ' + name); return imports[name]; }, local, local.exports);
  return local.exports;
}
const language = load('src/i18n/language.ts');
const life = load('src/strings/lifeAdmin.ts');
const assistant = load('src/strings/assistant.ts');
const { catalog, catalogIssues } = load('src/i18n/catalog.ts', { '../strings/lifeAdmin': life, '../strings/assistant': assistant });
const formats = load('src/i18n/format.ts', { './language': language, '../utils/lifeRecords': load('src/utils/lifeRecords.ts') });

test('explicit choices override system locale; canonical BCP47 variants and unsupported/malformed fallback are predictable', () => {
  for (const locale of ['tr', 'tr-TR', 'TR-tr', 'tr-CY', 'tr-Latn-TR', 'tr-TR-u-nu-latn'])
    assert.equal(language.resolveLanguage('system', locale), 'tr');
  for (const locale of ['en', 'en-GB', 'de-DE', 'az-Latn-AZ', 'truck', 'tr_TR', 'tr--TR', '', null])
    assert.equal(language.resolveLanguage('system', locale), 'en');
  assert.equal(language.resolveLanguage('en', 'tr-TR'), 'en');
  assert.equal(language.resolveLanguage('tr', 'en-US'), 'tr');
  assert.equal(language.resolveLanguage(), language.resolveLanguage('system', Intl.DateTimeFormat().resolvedOptions().locale));
  assert.throws(() => language.resolveLanguage('unsupported', 'tr-TR'));
  assert.deepEqual(language.LANGUAGE_LOCALES, { en: 'en-US', tr: 'tr-TR' });
});

test('central catalog reuses both existing feature catalogs, including typed count functions', () => {
  assert.equal(catalog.en.lifeAdmin, life.lifeAdminEn);
  assert.equal(catalog.tr.lifeAdmin, life.lifeAdminTr);
  assert.equal(catalog.en.assistant, assistant.assistantEn);
  assert.equal(catalog.tr.assistant, assistant.assistantTr);
  assert.deepEqual(catalogIssues(catalog.en), []);
  assert.deepEqual(catalogIssues(catalog.tr), []);
  assert.equal(catalog.tr.common.language, 'Dil');
  assert.equal(catalog.tr.common.tr, 'Türkçe');
  assert.equal(catalog.en.lifeAdmin.showing(2, 5), 'Showing 2 of 5');
  assert.equal(catalog.tr.assistant.showing(2, 5), assistant.assistantTr.showing(2, 5));
});

test('catalog checks detect nested missing/extra keys, wrong types, empty copy and count-function shape drift', () => {
  const changed = { ...catalog.tr, common: { ...catalog.tr.common, errors: { ...catalog.tr.common.errors } },
    lifeAdmin: { ...catalog.tr.lifeAdmin } };
  delete changed.common.errors.load;
  changed.common.errors.unexpected = 'Synthetic extra';
  changed.common.save = 123;
  changed.common.cancel = ' ';
  changed.lifeAdmin.showing = shown => String(shown);
  const issues = catalogIssues(changed);
  for (const issue of ['catalog.common.errors.load: missing', 'catalog.common.errors.unexpected: extra',
    'catalog.common.save: type', 'catalog.common.cancel: empty', 'catalog.lifeAdmin.showing: function arity'])
    assert(issues.includes(issue), issue);
  assert(catalogIssues({ ...catalog.tr, lifeAdmin: [] }).includes('catalog.lifeAdmin: type'));
  assert(catalogIssues({ ...catalog.tr, assistant: { ...catalog.tr.assistant, showing: 'Synthetic' } })
    .includes('catalog.assistant.showing: type'));
  assert.deepEqual(catalogIssues(catalog.tr), []); // Mutation fixtures never change shared translations.
});

test('placeholder validation ignores ordering but catches lost or added named arguments without calling functions', () => {
  let calls = 0;
  const reference = { greeting: '{name}: {count}', count: (shown, total) => { calls++; return `${shown}/${total}`; } };
  assert.deepEqual(catalogIssues({ greeting: '{count} — {name}', count: (a, b) => `${a} ${b}` }, reference), []);
  assert(catalogIssues({ greeting: '{name}', count: (a, b) => `${a} ${b}` }, reference).includes('catalog.greeting: placeholders'));
  assert(catalogIssues({ greeting: '{name} {count} {extra}', count: (a, b) => `${a} ${b}` }, reference).includes('catalog.greeting: placeholders'));
  assert.equal(calls, 0);
});

test('number, instant date and time use selected locale and caller timezone/options', () => {
  assert.equal(formats.formatNumber(1234.5, 'en'), '1,234.5');
  assert.equal(formats.formatNumber(1234.5, 'tr'), '1.234,5');
  const instant = new Date('2026-11-20T14:05:00Z');
  for (const lang of ['en', 'tr']) {
    const locale = language.LANGUAGE_LOCALES[lang];
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    const timeOptions = { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Istanbul' };
    assert.equal(formats.formatDate(instant, lang, dateOptions), new Intl.DateTimeFormat(locale, dateOptions).format(instant));
    assert.equal(formats.formatTime(instant.getTime(), lang, timeOptions), new Intl.DateTimeFormat(locale, timeOptions).format(instant));
    assert.equal(formats.formatNumber(12.5, lang, { minimumFractionDigits: 2 }), new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(12.5));
  }
  assert.throws(() => formats.formatNumber(NaN, 'en'));
  assert.throws(() => formats.formatDate(new Date('invalid'), 'en'));
  assert.throws(() => formats.formatTime(Infinity, 'tr'));
  assert.throws(() => formats.formatDate('2026-11-20', 'en')); // Calendar values need the explicit helper.
});

test('calendar-only formatting preserves Gregorian day across timezones, DST, leap days and early years', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['America/Los_Angeles', 'Pacific/Kiritimati', 'Europe/Istanbul']) {
      process.env.TZ = zone;
      for (const value of ['2026-03-08', '2026-11-01', '2024-02-29', '0001-01-01', '0099-12-31', '9999-12-31'])
        for (const lang of ['en', 'tr']) {
          const options = { year: 'numeric', month: 'long', day: 'numeric' };
          const expected = new Intl.DateTimeFormat(language.LANGUAGE_LOCALES[lang], { ...options, calendar: 'gregory', timeZone: 'UTC' })
            .format(new Date(`${value}T12:00:00Z`));
          assert.equal(formats.formatCalendarDate(value, lang, options), expected);
          assert.equal(formats.formatCalendarDate(value, lang, { ...options, timeZone: zone, calendar: 'islamic' }), expected);
        }
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  for (const value of ['2026-02-29', '2024-02-30', '2026-13-01', '0000-01-01', '2026-1-01', '2026-11-20T00:00:00Z', ''])
    assert.throws(() => formats.formatCalendarDate(value, 'en'), value);
});
