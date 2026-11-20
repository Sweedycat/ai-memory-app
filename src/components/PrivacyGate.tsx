import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  AppStateStatus,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { persistPrivacySettingBeforeApplying } from '../utils/privacySettingsPersistence';

type PrivacyGateProps = {
  children: React.ReactNode;
};

export type LockDelaySeconds = 0 | 30 | 60 | 300;

type PrivacySettings = {
  appLockEnabled: boolean;
  lockDelaySeconds: LockDelaySeconds;
};

type PrivacyControls = PrivacySettings & {
  settingsReady: boolean;
  setAppLockEnabled: (enabled: boolean) => Promise<boolean>;
  setLockDelaySeconds: (seconds: LockDelaySeconds) => Promise<void>;
  lockNow: () => void;
};

const STORAGE_KEY = '@ai-memory/privacy-settings/v1';
const DEFAULT_SETTINGS: PrivacySettings = {
  appLockEnabled: true,
  lockDelaySeconds: 0,
};
const VALID_DELAYS: LockDelaySeconds[] = [0, 30, 60, 300];

const PrivacyControlsContext = createContext<PrivacyControls>({
  ...DEFAULT_SETTINGS,
  settingsReady: false,
  setAppLockEnabled: async () => false,
  setLockDelaySeconds: async () => undefined,
  lockNow: () => undefined,
});

export function usePrivacyControls() {
  return useContext(PrivacyControlsContext);
}

function normalizeSettings(value: unknown): PrivacySettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;

  const candidate = value as Partial<PrivacySettings>;
  const delay = VALID_DELAYS.includes(candidate.lockDelaySeconds as LockDelaySeconds)
    ? (candidate.lockDelaySeconds as LockDelaySeconds)
    : DEFAULT_SETTINGS.lockDelaySeconds;

  return {
    appLockEnabled:
      typeof candidate.appLockEnabled === 'boolean'
        ? candidate.appLockEnabled
        : DEFAULT_SETTINGS.appLockEnabled,
    lockDelaySeconds: delay,
  };
}

export function PrivacyGate({ children }: PrivacyGateProps) {
  const { copy } = useI18n();
  const c = copy.ui.gates;
  const copyRef = useRef(c); copyRef.current = c;
  const styles = useThemedStyles(createStyles);
  const [locked, setLocked] = useState(true);
  const [message, setMessage] = useState<'' | 'noEnrollment' | 'authFailed' | 'authUnavailable'>('');
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);

  const authenticating = useRef(false);
  const lockedRef = useRef(true);
  const settingsRef = useRef<PrivacySettings>(DEFAULT_SETTINGS);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundAt = useRef<number | null>(null);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLockTimer = useCallback(() => {
    if (lockTimer.current) {
      clearTimeout(lockTimer.current);
      lockTimer.current = null;
    }
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
  }, []);

  const applyLocked = useCallback((value: boolean) => {
    lockedRef.current = value;
    setLocked(value);
  }, []);

  const persistSettings = useCallback(async (next: PrivacySettings) => {
    // Fail closed: do not reflect privacy changes if storing them fails.
    await persistPrivacySettingBeforeApplying(
      next,
      (serialized) => AsyncStorage.setItem(STORAGE_KEY, serialized),
      (saved) => {
        settingsRef.current = saved;
        setSettings(saved);
      },
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      let next = DEFAULT_SETTINGS;

      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) next = normalizeSettings(JSON.parse(raw));
      } catch {
        next = DEFAULT_SETTINGS;
      }

      if (!mounted) return;

      settingsRef.current = next;
      setSettings(next);
      setSettingsReady(true);

      if (!next.appLockEnabled) {
        applyLocked(false);
      }
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, [applyLocked]);

  const unlock = useCallback(async () => {
    if (
      authenticating.current ||
      !lockedRef.current ||
      !settingsRef.current.appLockEnabled
    ) {
      return;
    }

    authenticating.current = true;
    setMessage('');

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: copyRef.current.unlock,
        cancelLabel: copyRef.current.cancel,
        fallbackLabel: copyRef.current.deviceUnlock,
        disableDeviceFallback: false,
      });

      if (result.success) {
        applyLocked(false);
      } else if (result.error === 'not_enrolled') {
        setMessage("noEnrollment");
      } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
        setMessage("authFailed");
      }
    } catch {
      setMessage("authUnavailable");
    } finally {
      authenticating.current = false;
    }
  }, [applyLocked]);

  const setAppLockEnabled = useCallback(
    async (enabled: boolean) => {
      if (!settingsReady) return false;
      if (enabled === settingsRef.current.appLockEnabled) return true;

      if (!enabled) {
        if (authenticating.current) return false;
        authenticating.current = true;

        try {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: copyRef.current.disableLock,
            cancelLabel: copyRef.current.cancel,
            fallbackLabel: copyRef.current.deviceUnlock,
            disableDeviceFallback: false,
          });

          if (!result.success) return false;
        } catch {
          return false;
        } finally {
          authenticating.current = false;
        }
      }

      const next: PrivacySettings = {
        ...settingsRef.current,
        appLockEnabled: enabled,
      };

      try {
        await persistSettings(next);
        clearLockTimer();
        clearResumeTimer();
        backgroundAt.current = null;
        applyLocked(false);
        setMessage('');
        return true;
      } catch {
        return false;
      }
    },
    [applyLocked, clearLockTimer, clearResumeTimer, persistSettings, settingsReady],
  );

  const setLockDelaySeconds = useCallback(
    async (seconds: LockDelaySeconds) => {
      const next: PrivacySettings = {
        ...settingsRef.current,
        lockDelaySeconds: seconds,
      };
      await persistSettings(next);
    },
    [persistSettings],
  );

  const lockNow = useCallback(() => {
    if (!settingsRef.current.appLockEnabled) return;
    clearLockTimer();
    clearResumeTimer();
    backgroundAt.current = null;
    setMessage('');
    applyLocked(true);
  }, [applyLocked, clearLockTimer, clearResumeTimer]);

  useEffect(() => {
    if (!settingsReady) return;

    if (!settingsRef.current.appLockEnabled) {
      applyLocked(false);
      return;
    }

    const timer = setTimeout(() => {
      void unlock();
    }, 250);

    return () => clearTimeout(timer);
  }, [applyLocked, settingsReady, unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appState.current;
      appState.current = nextState;

      if (authenticating.current) return;

      const currentSettings = settingsRef.current;

      if (nextState === 'inactive' || nextState === 'background') {
        if (!currentSettings.appLockEnabled) return;

        backgroundAt.current = Date.now();
        clearResumeTimer();
        clearLockTimer();
        setMessage('');

        if (currentSettings.lockDelaySeconds === 0) {
          applyLocked(true);
        } else {
          lockTimer.current = setTimeout(() => {
            applyLocked(true);
            lockTimer.current = null;
          }, currentSettings.lockDelaySeconds * 1000);
        }
        return;
      }

      if (nextState === 'active' && previousState !== 'active') {
        clearLockTimer();

        if (!currentSettings.appLockEnabled) {
          backgroundAt.current = null;
          applyLocked(false);
          return;
        }

        const leftAt = backgroundAt.current;
        backgroundAt.current = null;

        if (
          leftAt !== null &&
          currentSettings.lockDelaySeconds > 0 &&
          Date.now() - leftAt >= currentSettings.lockDelaySeconds * 1000
        ) {
          applyLocked(true);
        }

        if (lockedRef.current && !authenticating.current) {
          clearResumeTimer();
          resumeTimer.current = setTimeout(() => {
            void unlock();
            resumeTimer.current = null;
          }, 200);
        }
      }
    });

    return () => {
      clearLockTimer();
      clearResumeTimer();
      subscription.remove();
    };
  }, [applyLocked, clearLockTimer, clearResumeTimer, unlock]);

  const controls = useMemo<PrivacyControls>(
    () => ({
      appLockEnabled: settings.appLockEnabled,
      lockDelaySeconds: settings.lockDelaySeconds,
      settingsReady,
      setAppLockEnabled,
      setLockDelaySeconds,
      lockNow,
    }),
    [
      lockNow,
      setAppLockEnabled,
      setLockDelaySeconds,
      settings.appLockEnabled,
      settings.lockDelaySeconds,
      settingsReady,
    ],
  );

  let content: React.ReactNode;

  if (!settingsReady) {
    content = (
      <SafeAreaView edges={[]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.brand}>AI MEMORY</Text>
          <Text style={styles.body}>{c.preparing}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  } else if (!settings.appLockEnabled || !locked) {
    content = <>{children}</>;
  } else {
    content = (
      <SafeAreaView edges={[]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.iconWrap} accessibilityElementsHidden>
            <Text style={styles.icon}>🔒</Text>
          </View>
          <Text style={styles.brand}>AI MEMORY</Text>
          <Text style={styles.title}>{c.locked}</Text>
          <Text style={styles.body}>
            {c.lockedBody}</Text>

          {message ? <Text style={styles.message}>{c[message]}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.unlock}
            style={styles.button}
            onPress={() => void unlock()}
          >
            <Text style={styles.buttonText}>{c.unlockButton}</Text>
          </Pressable>
          <Text style={styles.caption}>
            {c.delayCaption}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <PrivacyControlsContext.Provider value={controls}>
      {content}
    </PrivacyControlsContext.Provider>
  );
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.metrics.screenGutter,
    paddingVertical: theme.spacing.section,
  },
  iconWrap: {
    width: 82,
    height: 82,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    marginBottom: 24,
  },
  icon: {
    fontSize: 34,
  },
  brand: {
    color: theme.colors.accent,
    fontSize: theme.typography.meta.fontSize,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.hero.fontSize,
    lineHeight: theme.typography.hero.lineHeight,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 380,
  },
  message: {
    color: theme.colors.danger,
    fontSize: theme.typography.meta.fontSize,
    lineHeight: theme.typography.meta.lineHeight,
    textAlign: 'center',
    marginTop: 18,
  },
  button: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.control,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 28,
  },
  buttonText: {
    color: theme.colors.onAccent,
    fontWeight: '900',
    fontSize: theme.typography.body.fontSize,
  },
  caption: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.meta.fontSize,
    lineHeight: theme.typography.meta.lineHeight,
    textAlign: 'center',
    marginTop: 14,
  },
});
