import { isLanguagePreference, type LanguagePreference } from './language';
import { createEnumPreferenceStore, decodeEnumPreference, type EnumPreferenceBase,
  type EnumPreferenceState, type PreferenceStorage } from '../preferences/enumPreferenceStore';

export const LANGUAGE_PREFERENCE_KEY = '@ai-memory/language-preference-v1';
export type LanguagePreferenceBase = EnumPreferenceBase<LanguagePreference>;
export type LanguagePreferenceState = EnumPreferenceState<LanguagePreference>;

export function decodeLanguagePreference(raw: string) {
  return decodeEnumPreference(raw, isLanguagePreference);
}

/** Preserves the version-1 document/API; no IO until an explicit store operation. */
export function createLanguagePreferenceStore(storage: PreferenceStorage) {
  return createEnumPreferenceStore(storage, {
    key: LANGUAGE_PREFERENCE_KEY, defaultPreference: 'system', isPreference: isLanguagePreference,
  });
}
