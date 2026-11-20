import { createEnumPreferenceStore, decodeEnumPreference, type EnumPreferenceBase,
  type EnumPreferenceState, type PreferenceStorage } from '../preferences/enumPreferenceStore';
import { isThemeMode, type ThemeMode } from './tokens';

export const APPEARANCE_PREFERENCE_KEY = '@ai-memory/appearance-preference-v1';
export type AppearancePreferenceBase = EnumPreferenceBase<ThemeMode>;
export type AppearancePreferenceState = EnumPreferenceState<ThemeMode>;
export function decodeAppearancePreference(raw: string) { return decodeEnumPreference(raw, isThemeMode); }
export function createAppearancePreferenceStore(storage: PreferenceStorage) {
  return createEnumPreferenceStore(storage, {
    key: APPEARANCE_PREFERENCE_KEY, defaultPreference: 'classic', isPreference: isThemeMode,
  });
}
