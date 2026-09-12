import React, { useCallback, useEffect, useRef, useState } from 'react';
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

export function PrivacyGate({ children }: PrivacyGateProps) {
  const [locked, setLocked] = useState(true);
  const [message, setMessage] = useState('');
  const authenticating = useRef(false);
  const lockedRef = useRef(true);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const applyLocked = useCallback((value: boolean) => {
    lockedRef.current = value;
    setLocked(value);
  }, []);

  const unlock = useCallback(async () => {
    if (authenticating.current || !lockedRef.current) return;

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

  useEffect(() => {
    const timer = setTimeout(() => {
      void unlock();
    }, 250);

    return () => clearTimeout(timer);
  }, [unlock]);

  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appState.current;
      appState.current = nextState;

      if (nextState === 'inactive' || nextState === 'background') {
        applyLocked(true);
        setMessage('');
        return;
      }

      if (
        nextState === 'active' &&
        previousState !== 'active' &&
        lockedRef.current &&
        !authenticating.current
      ) {
        resumeTimer = setTimeout(() => {
          void unlock();
        }, 200);
      }
    });

    return () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      subscription.remove();
    };
  }, [applyLocked, unlock]);

  if (!locked) {
    return <>{children}</>;
  }

  return (
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
        <Text style={styles.caption}>The app locks again whenever it leaves the foreground.</Text>
      </View>
    </SafeAreaView>
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
