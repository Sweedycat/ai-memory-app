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
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

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
  const [locked, setLocked] = useState(true);
  const [message, setMessage] = useState('');
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
    settingsRef.current = next;
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
        promptMessage: 'Unlock AI Memory',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use device unlock',
        disableDeviceFallback: false,
      });

      if (result.success) {
        applyLocked(false);
      } else if (result.error === 'not_enrolled') {
        setMessage('Set up fingerprint, face unlock or a device screen lock first.');
      } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
        setMessage('Authentication failed. Try again.');
      }
    } catch {
      setMessage('Device authentication is not available right now.');
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
            promptMessage: 'Turn off AI Memory app lock',
            cancelLabel: 'Cancel',
            fallbackLabel: 'Use device unlock',
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
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.container}>
          <Text style={styles.brand}>AI MEMORY</Text>
          <Text style={styles.body}>Preparing your privacy settings…</Text>
        </View>
      </SafeAreaView>
    );
  } else if (!settings.appLockEnabled || !locked) {
    content = <>{children}</>;
  } else {
    content = (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.container}>
          <View style={styles.iconWrap} accessibilityElementsHidden>
            <Text style={styles.icon}>🔒</Text>
          </View>
          <Text style={styles.brand}>AI MEMORY</Text>
          <Text style={styles.title}>Your memories are locked.</Text>
          <Text style={styles.body}>
            Personal notes, conversations and follow-ups stay hidden until the phone owner authenticates.
          </Text>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Unlock AI Memory"
            style={styles.button}
            onPress={() => void unlock()}
          >
            <Text style={styles.buttonText}>Unlock privately</Text>
          </Pressable>
          <Text style={styles.caption}>
            The app follows your selected privacy lock delay.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <PrivacyControlsContext.Provider value={controls}>
      {content}
    </PrivacyControlsContext.Provider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 82,
    height: 82,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13231F',
    borderWidth: 1,
    borderColor: '#315B4F',
    marginBottom: 24,
  },
  icon: {
    fontSize: 34,
  },
  brand: {
    color: '#7DE2C3',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: '#F4F7FA',
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    color: '#98A3AF',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 380,
  },
  message: {
    color: '#F2B8B5',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 18,
  },
  button: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#7DE2C3',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 28,
  },
  buttonText: {
    color: '#07100D',
    fontWeight: '900',
    fontSize: 15,
  },
  caption: {
    color: '#66727E',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 14,
  },
});
