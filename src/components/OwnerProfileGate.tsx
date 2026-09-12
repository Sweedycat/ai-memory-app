import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type OwnerProfileGateProps = {
  children: React.ReactNode;
};

type OwnerProfile = {
  name: string;
  preferredName: string;
  role: string;
};

const STORAGE_KEY = '@ai-memory/owner-profile/v1';

const emptyProfile: OwnerProfile = {
  name: '',
  preferredName: '',
  role: '',
};

export function OwnerProfileGate({ children }: OwnerProfileGateProps) {
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [draft, setDraft] = useState<OwnerProfile>(emptyProfile);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && mounted) {
          const parsed = JSON.parse(saved) as OwnerProfile;
          setProfile(parsed);
          setDraft(parsed);
        }
      } catch {
        // If local profile data cannot be read, onboarding is shown again.
      } finally {
        if (mounted) setReady(true);
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const displayName = useMemo(
    () => profile?.preferredName.trim() || profile?.name.trim() || 'Owner',
    [profile],
  );

  const initials = useMemo(() => {
    const source = displayName.trim();
    if (!source) return 'ME';
    const parts = source.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'ME';
  }, [displayName]);

  async function saveProfile() {
    if (!draft.name.trim()) return;

    const next: OwnerProfile = {
      name: draft.name.trim(),
      preferredName: draft.preferredName.trim(),
      role: draft.role.trim(),
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProfile(next);
    setDraft(next);
    setEditing(false);
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.center}>
          <Text style={styles.brand}>AI MEMORY</Text>
          <Text style={styles.loading}>Preparing your private space…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile || editing) {
    const isFirstRun = !profile;

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.formWrap}>
          <Text style={styles.brand}>AI MEMORY</Text>
          <Text style={styles.title}>{isFirstRun ? 'Make this memory yours.' : 'Your private profile'}</Text>
          <Text style={styles.body}>
            {isFirstRun
              ? 'Tell AI Memory who owns this phone. This profile stays on this device for now.'
              : 'Update how AI Memory should address you. Your profile remains local on this device.'}
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>YOUR NAME *</Text>
            <TextInput
              value={draft.name}
              onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
              placeholder="Your full name"
              placeholderTextColor="#727D89"
              autoCapitalize="words"
              style={styles.input}
            />

            <Text style={styles.label}>WHAT SHOULD AI MEMORY CALL YOU?</Text>
            <TextInput
              value={draft.preferredName}
              onChangeText={(preferredName) => setDraft((current) => ({ ...current, preferredName }))}
              placeholder="First name or nickname"
              placeholderTextColor="#727D89"
              autoCapitalize="words"
              style={styles.input}
            />

            <Text style={styles.label}>ROLE / ABOUT YOU</Text>
            <TextInput
              value={draft.role}
              onChangeText={(role) => setDraft((current) => ({ ...current, role }))}
              placeholder="Founder, engineer, student…"
              placeholderTextColor="#727D89"
              style={styles.input}
            />

            <View style={styles.privacyBox}>
              <Text style={styles.privacyTitle}>🔒 Private by default</Text>
              <Text style={styles.privacyText}>
                This owner profile is stored locally and is hidden behind the app lock.
              </Text>
            </View>

            <Pressable
              onPress={() => void saveProfile()}
              disabled={!draft.name.trim()}
              style={[styles.primaryButton, !draft.name.trim() && styles.disabled]}
            >
              <Text style={styles.primaryButtonText}>{isFirstRun ? 'Create my private profile' : 'Save changes'}</Text>
            </Pressable>

            {!isFirstRun ? (
              <Pressable
                onPress={() => {
                  setDraft(profile);
                  setEditing(false);
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.appWrap}>
      {children}
      <Pressable
        accessibilityLabel="Open owner profile"
        onPress={() => {
          setDraft(profile);
          setEditing(true);
        }}
        style={styles.ownerBadge}
      >
        <Text style={styles.ownerInitials}>{initials}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  formWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  brand: {
    color: '#7DE2C3',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  loading: {
    color: '#A7B0BA',
    fontSize: 15,
  },
  title: {
    color: '#F4F7FA',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  body: {
    color: '#98A3AF',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#121820',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#202B36',
    padding: 17,
  },
  label: {
    color: '#7DE2C3',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 10,
    marginBottom: 7,
  },
  input: {
    backgroundColor: '#0E141B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#293541',
    color: '#F4F7FA',
    fontSize: 15,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  privacyBox: {
    backgroundColor: '#10251F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#315B4F',
    padding: 13,
    marginTop: 18,
  },
  privacyTitle: {
    color: '#D9F5EC',
    fontSize: 13,
    fontWeight: '900',
  },
  privacyText: {
    color: '#8FB4A9',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  primaryButton: {
    backgroundColor: '#7DE2C3',
    borderRadius: 15,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 18,
  },
  primaryButtonText: {
    color: '#07100D',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    borderRadius: 15,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#98A3AF',
    fontSize: 13,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.35,
  },
  appWrap: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  ownerBadge: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13231F',
    borderWidth: 1,
    borderColor: '#4B8877',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  ownerInitials: {
    color: '#7DE2C3',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
