import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Appearance } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import type { PreferenceStorage } from '../preferences/enumPreferenceStore';
import { createAppearancePreferenceStore, type AppearancePreferenceState } from './appearanceStore';
import { THEMES, resolveThemeMode, type ThemeMode, type ThemeTokens, type ResolvedThemeMode } from './tokens';

export type ThemeValue = {
  theme: ThemeTokens; mode: ThemeMode; resolvedMode: ResolvedThemeMode; isDark: boolean;
  status: AppearancePreferenceState['status']; busy: boolean; error: AppearancePreferenceState['error'];
  changeMode(mode: ThemeMode): Promise<boolean>; reload(): Promise<void>;
};
const ThemeContext = createContext<ThemeValue>({
  theme: THEMES.classic, mode: 'classic', resolvedMode: 'classic', isDark: true,
  status: 'loading', busy: false, error: null, changeMode: async () => false, reload: async () => undefined,
});
const stores = new WeakMap<PreferenceStorage, ReturnType<typeof createAppearancePreferenceStore>>();
function sharedStore(storage: PreferenceStorage) {
  let store = stores.get(storage);
  if (!store) { store = createAppearancePreferenceStore(storage); stores.set(storage, store); }
  return store;
}
const scheme = (): string | null | undefined => {
  try { return Appearance.getColorScheme(); } catch { return undefined; }
};
let backgroundWarningReported = false;
function backgroundUnavailable() {
  if (!backgroundWarningReported) {
    backgroundWarningReported = true;
    console.warn('theme-root-background-unavailable'); // Whitelisted code only; never raw native errors.
  }
}

export function ThemeProvider({ children, storage = AsyncStorage }: {
  children: React.ReactNode; storage?: PreferenceStorage;
}) {
  const store = useMemo(() => sharedStore(storage), [storage]);
  const [state, setState] = useState(store.getState);
  const [deviceScheme, setDeviceScheme] = useState(scheme);
  const mode = state.preference ?? 'classic';
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const resolvedMode = resolveThemeMode(mode, deviceScheme);
  const theme = THEMES[resolvedMode];
  useEffect(() => {
    const unsubscribe = store.subscribe(setState);
    void store.reload();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') { setDeviceScheme(scheme()); void store.reload(); }
      else store.invalidate();
    });
    const appearance = Appearance.addChangeListener(next => {
      // Ignore feedback from fixed app-only overrides. System clears that override below.
      if (modeRef.current === 'system') setDeviceScheme(next.colorScheme);
    });
    return () => { unsubscribe(); subscription.remove(); appearance.remove(); store.invalidate(); };
  }, [store]);
  useEffect(() => {
    try {
      Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode === 'light' ? 'light' : 'dark');
      if (mode === 'system') setDeviceScheme(scheme());
    } catch { /* Native override is cosmetic; shared tokens and content remain usable. */ }
  }, [mode]);
  useEffect(() => {
    try { void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(backgroundUnavailable); }
    catch { backgroundUnavailable(); }
  }, [theme.colors.background]);
  const value: ThemeValue = {
    theme, mode, resolvedMode, isDark: theme.isDark, status: state.status, busy: state.busy, error: state.error,
    changeMode(next) {
      const base = store.getState();
      if (base.status !== 'ready' || base.preference === null || base.revision === null) return Promise.resolve(false);
      return store.save(next, { preference: base.preference, revision: base.revision });
    },
    reload: store.reload,
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** All default choices and provider choices are free; no entitlement or gate is consulted. */
export function useTheme(): ThemeValue { return useContext(ThemeContext); }
