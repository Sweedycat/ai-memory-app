import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BugReportPanel } from './BugReportPanel';
import { SettingsPanel } from './SettingsPanel';

type OwnerProfileGateProps = {
  children: React.ReactNode;
};

type OwnerProfile = {
  name: string;
  preferredName: string;
  role: string;
};

type OwnerControls = {
  displayName: string;
  openSettings: () => void;
};

const OwnerControlsContext = createContext<OwnerControls>({
  displayName: 'Owner',
  openSettings: () => undefined,
});

export function useOwnerControls() {
  return useContext(OwnerControlsContext);
}

const STORAGE_KEY = '@ai-memory/owner-profile/v1';

const emptyProfile: OwnerProfile = {
  name: '',
  preferredName: '',
  role: '',
};

function normalizeProfile(value: unknown): OwnerProfile | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<OwnerProfile>;
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) return null;

  return {
    name: candidate.name.trim(),
    preferredName: typeof candidate.preferredName === 'string' ? candidate.preferredName.trim() : '',
    role: typeof candidate.role === 'string' ? candidate.role.trim() : '',
  };
}

export function OwnerProfileGate({ children }: OwnerProfileGateProps) {
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [draft, setDraft] = useState<OwnerProfile>(emptyProfile);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportingBug, setReportingBug] = useState(false);
  const [returnToSettingsAfterEdit, setReturnToSettingsAfterEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && mounted) {
          const parsed = normalizeProfile(JSON.parse(saved));
          if (parsed) {
            setProfile(parsed);
            setDraft(parsed);
          }
        }
      } catch {
        // Corrupt or unavailable local data safely falls back to onboarding.
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

  const controls = useMemo<OwnerControls>(
    () => ({
      displayName,
      openSettings: () => setSettingsOpen(true),
    }),
    [displayName],
  );

  async function saveProfile() {
    if (!draft.name.trim() || saving) return;

    const next: OwnerProfile = {
      name: draft.name.trim(),
      preferredName: draft.preferredName.trim(),
      role: draft.role.trim(),
    };

    setSaving(true);
    setError('');

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setProfile(next);
      setDraft(next);
      setEditing(false);
      if (returnToSettingsAfterEdit) {
        setReturnToSettingsAfterEdit(false);
        setSettingsOpen(true);
      }
    } catch {
      setError('Could not save your private profile on this device. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function openProfileFromSettings() {
    if (!profile) return;
    setDraft(profile);
    setError('');
    setSettingsOpen(false);
    setReturnToSettingsAfterEdit(true);
    setEditing(true);
  }

  function cancelProfileEdit() {
    if (!profile) return;
    setDraft(profile);
    setError('');
    setEditing(false);
    if (returnToSettingsAfterEdit) {
      setReturnToSettingsAfterEdit(false);
      setSettingsOpen(true);
    }
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

  if (profile && reportingBug) {
    return (
      <BugReportPanel
        reporterName={displayName}
        onClose={() => {
          setReportingBug(false);
          setSettingsOpen(true);
        }}
      />
    );
  }

  if (profile && settingsOpen && !editing) {
    return (
      <SettingsPanel
        displayName={displayName}
        role={profile.role}
        onClose={() => setSettingsOpen(false)}
        onEditProfile={openProfileFromSettings}
        onReportBug={() => {
          setSettingsOpen(false);
          setReportingBug(true);
        }}
      />
    );
  }

  if (!profile || editing) {
    const isFirstRun = !profile;
    const saveDisabled = !draft.name.trim() || saving;

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.formWrap}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                accessibilityLabel="Your full name"
                value={draft.name}
                onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
                placeholder="Your full name"
                placeholderTextColor="#727D89"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                style={styles.input}
              />

              <Text style={styles.label}>WHAT SHOULD AI MEMORY CALL YOU?</Text>
              <TextInput
                accessibilityLabel="Preferred name or nickname"
                value={draft.preferredName}
                onChangeText={(preferredName) => setDraft((current) => ({ ...current, preferredName }))}
                placeholder="First name or nickname"
                placeholderTextColor="#727D89"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                style={styles.input}
              />

              <Text style={styles.label}>ROLE / ABOUT YOU</Text>
              <TextInput
                accessibilityLabel="Role or short description"
                value={draft.role}
                onChangeText={(role) => setDraft((current) => ({ ...current, role }))}
                placeholder="Founder, engineer, student…"
                placeholderTextColor="#727D89"
                returnKeyType="done"
                style={styles.input}
              />

              <View style={styles.privacyBox}>
                <Text style={styles.privacyTitle}>🔒 Private by default</Text>
                <Text style={styles.privacyText}>
                  This owner profile is stored locally and hidden behind the app lock.
                </Text>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isFirstRun ? 'Create private owner profile' : 'Save owner profile changes'}
                onPress={() => void saveProfile()}
                disabled={saveDisabled}
                style={[styles.primaryButton, saveDisabled && styles.disabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? 'Saving…' : isFirstRun ? 'Create my private profile' : 'Save changes'}
                </Text>
              </Pressable>

              {!isFirstRun ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing owner profile"
                  onPress={cancelProfileEdit}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <OwnerControlsContext.Provider value={controls}>
      <View style={styles.appWrap}>{children}</View>
    </OwnerControlsContext.Provider>
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
    flexGrow: 1,
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
  error: {
    color: '#F2B8B5',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
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
});