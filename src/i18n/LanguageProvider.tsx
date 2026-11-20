import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { PreferenceStorage } from '../preferences/enumPreferenceStore';
import { catalog, type Catalog } from './catalog';
import { LANGUAGE_LOCALES, resolveLanguage, type Language, type LanguagePreference } from './language';
import { createLanguagePreferenceStore, type LanguagePreferenceState } from './languageStore';

export type I18nValue = {
  language: Language; locale: string; copy: Catalog; preference: LanguagePreference;
  status: LanguagePreferenceState['status']; busy: boolean; error: LanguagePreferenceState['error'];
  changeLanguage(preference: LanguagePreference): Promise<boolean>; reload(): Promise<void>;
};
const I18nContext = createContext<I18nValue>({
  language: 'en', locale: LANGUAGE_LOCALES.en, copy: catalog.en, preference: 'system',
  status: 'loading', busy: false, error: null,
  changeLanguage: async () => false, reload: async () => undefined,
});
const stores = new WeakMap<PreferenceStorage, ReturnType<typeof createLanguagePreferenceStore>>();
function sharedStore(storage: PreferenceStorage) {
  let store = stores.get(storage);
  if (!store) { store = createLanguagePreferenceStore(storage); stores.set(storage, store); }
  return store;
}
const systemLocale = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().locale; } catch { return 'en-US'; }
};

export function LanguageProvider({ children, storage = AsyncStorage, locale: suppliedLocale }: {
  children: React.ReactNode; storage?: PreferenceStorage; locale?: string;
}) {
  const store = useMemo(() => sharedStore(storage), [storage]);
  const [state, setState] = useState(store.getState);
  const [deviceLocale, setDeviceLocale] = useState(systemLocale);
  useEffect(() => {
    const unsubscribe = store.subscribe(setState);
    void store.reload();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') { setDeviceLocale(systemLocale()); void store.reload(); }
      else store.invalidate();
    });
    return () => { unsubscribe(); subscription.remove(); store.invalidate(); };
  }, [store]);
  const preference = state.preference ?? 'system';
  const language = resolveLanguage(preference, suppliedLocale ?? deviceLocale);
  const value: I18nValue = {
    language, locale: LANGUAGE_LOCALES[language], copy: catalog[language], preference,
    status: state.status, busy: state.busy, error: state.error,
    changeLanguage(next) {
      const base = store.getState();
      if (base.status !== 'ready' || base.preference === null || base.revision === null) return Promise.resolve(false);
      return store.save(next, { preference: base.preference, revision: base.revision });
    },
    reload: store.reload,
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Without a provider, the context is a deterministic read-only English fallback. */
export function useI18n(): I18nValue { return useContext(I18nContext); }
