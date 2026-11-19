export type Language = 'en' | 'tr';
export type LanguagePreference = Language | 'system';

export const LANGUAGE_LOCALES = { en: 'en-US', tr: 'tr-TR' } as const;

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'en' || value === 'tr' || value === 'system';
}

/** Unsupported/malformed system locales fall back to English; no record text is translated. */
export function resolveLanguage(preference: LanguagePreference = 'system', systemLocale?: string | null): Language {
  if (!isLanguagePreference(preference)) throw new Error('Invalid language preference');
  if (preference !== 'system') return preference;
  try {
    const locale = systemLocale === undefined ? Intl.DateTimeFormat().resolvedOptions().locale : systemLocale;
    if (!locale) return 'en';
    const canonical = Intl.getCanonicalLocales(locale)[0];
    return canonical?.split('-')[0] === 'tr' ? 'tr' : 'en';
  } catch { return 'en'; }
}
