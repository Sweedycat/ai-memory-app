import { useTheme } from '../theme/ThemeProvider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BugReportPanel } from './BugReportPanel';
import { ReminderPermissionGate } from './ReminderPermissionGate';
import { SettingsPanel } from './SettingsPanel';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

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
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as Partial<OwnerProfile>;
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) return null;
  // Legacy profiles may omit optional fields, but malformed fields must not be discarded.
  if ((candidate.preferredName !== undefined && typeof candidate.preferredName !== 'string') ||
      (candidate.role !== undefined && typeof candidate.role !== 'string')) return null;

  return {
    name: candidate.name.trim(),
    preferredName: typeof candidate.preferredName === 'string' ? candidate.preferredName.trim() : '',
    role: typeof candidate.role === 'string' ? candidate.role.trim() : '',
  };
}

export function OwnerProfileGate({ children }: OwnerProfileGateProps) {
  const { copy } = useI18n();
  const c = copy.ui.gates;
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const placeholderColor = theme.colors.textMuted;
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [draft, setDraftState] = useState<OwnerProfile>(emptyProfile);
  const liveDraft = useRef<OwnerProfile>(emptyProfile);
  function setDraft(next: OwnerProfile | ((current: OwnerProfile) => OwnerProfile)) {
    const value = typeof next === 'function' ? next(liveDraft.current) : next;
    liveDraft.current = value;
    setDraftState(value);
  }
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loading = useRef(false);
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportingBug, setReportingBug] = useState(false);
  const [returnToSettingsAfterEdit, setReturnToSettingsAfterEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<'' | 'saveError'>('');
  const profileBytes = useRef<string | null>(null), savingRef = useRef(false), alive = useRef(true);

  useEffect(() => {
    let mounted = true;
    alive.current = true;
    loading.current = true;

    async function loadProfile() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = saved === null ? null : normalizeProfile(JSON.parse(saved));
        if (saved !== null && !parsed) throw new Error('Invalid owner profile');
        if (!mounted) return;
        profileBytes.current = saved;
        setProfile(parsed);
        setDraft(parsed ?? emptyProfile);
        setLoadError(false);
        setReady(true);
      } catch {
        // Preserve original bytes and keep both onboarding and private content closed.
        if (mounted) {
          setReady(false);
          setLoadError(true);
        }
      } finally {
        if (mounted) loading.current = false;
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
      alive.current = false;
    };
  }, [loadAttempt]);

  function retryProfileLoad() {
    if (loading.current) return;
    loading.current = true;
    setReady(false);
    setLoadError(false);
    setLoadAttempt(attempt => attempt + 1);
  }

  const displayName = useMemo(
    () => profile?.preferredName.trim() || profile?.name.trim() || c.owner,
    [profile, c.owner],
  );

  const controls = useMemo<OwnerControls>(
    () => ({
      displayName,
      openSettings: () => setSettingsOpen(true),
    }),
    [displayName],
  );

  async function saveProfile(): Promise<boolean> {
    if (!alive.current || !ready || loadError || loading.current || !liveDraft.current.name.trim() || savingRef.current) return false;

    const next: OwnerProfile = {
      name: liveDraft.current.name.trim(),
      preferredName: liveDraft.current.preferredName.trim(),
      role: liveDraft.current.role.trim(),
    };

    savingRef.current = true; setSaving(true);
    setError('');

    try {
      const bytes = JSON.stringify(next);
      const before = await AsyncStorage.getItem(STORAGE_KEY);
      if (!alive.current) return false;
      // Reconcile a previous lost acknowledgement without overwriting a foreign revision.
      if (before !== bytes) {
        if (before !== profileBytes.current) throw new Error('Profile changed');
        await AsyncStorage.setItem(STORAGE_KEY, bytes);
      }
      if (await AsyncStorage.getItem(STORAGE_KEY) !== bytes) throw new Error('Profile save unconfirmed');
      if (!alive.current) return false;
      profileBytes.current = bytes;
      setProfile(next);
      setDraft(next);
      setEditing(false);
      if (returnToSettingsAfterEdit) {
        setReturnToSettingsAfterEdit(false);
        setSettingsOpen(true);
      }
      return true;
    } catch {
      if (alive.current) setError('saveError');
      return false;
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
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

  const profileForm = !profile || editing;
  const profileRevision = () => JSON.stringify([liveDraft.current.name.trim(), liveDraft.current.preferredName.trim(), liveDraft.current.role.trim()]);
  const savedRevision = JSON.stringify([profile?.name ?? '', profile?.preferredName ?? '', profile?.role ?? '']);
  const profileExit = useUnsavedChanges({
    get dirty() { return ready && profileForm && profileRevision() !== savedRevision; },
    get revision() { return profileRevision(); }, busy: saving, enabled: ready && !loadError && profileForm,
    save: saveProfile,
    discard: () => { setDraft(profile ?? emptyProfile); setError(''); },
    onBack: () => { if (profile) cancelProfileEdit(); else BackHandler.exitApp(); },
  });

  if (loadError) {
    return (
      <SafeAreaView edges={[]} style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.brand}>AI MEMORY</Text>
          <Text accessibilityRole="header" style={styles.title}>{c.recovery.loadTitle}</Text>
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.body}>
            {c.recovery.loadExplanation}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={c.recovery.retryLoad}
            onPress={retryProfileLoad} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{c.recovery.retryLoad}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView edges={[]} style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.brand}>AI MEMORY</Text>
          <Text style={styles.loading}>{c.profilePreparing}</Text>
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
      <SafeAreaView edges={[]} style={styles.safe}>
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
            <Text style={styles.title}>{isFirstRun ? c.createHeading : c.profileHeading}</Text>
            <Text style={styles.body}>
              {isFirstRun
                ? c.createIntro
                : c.editIntro}
            </Text>

            <View style={styles.card}>
              <Text style={styles.label}>{c.name}</Text>
              <TextInput
                accessibilityLabel={c.nameInput}
                value={draft.name}
                editable={!saving}
                onChangeText={(name) => { if (!savingRef.current) setDraft((current) => ({ ...current, name })); }}
                placeholder={c.nameInput}
                placeholderTextColor={placeholderColor}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                style={styles.input}
              />

              <Text style={styles.label}>{c.preferred}</Text>
              <TextInput
                accessibilityLabel={c.preferredInput}
                value={draft.preferredName}
                editable={!saving}
                onChangeText={(preferredName) => { if (!savingRef.current) setDraft((current) => ({ ...current, preferredName })); }}
                placeholder={c.preferredPlaceholder}
                placeholderTextColor={placeholderColor}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                style={styles.input}
              />

              <Text style={styles.label}>{c.role}</Text>
              <TextInput
                accessibilityLabel={c.roleInput}
                value={draft.role}
                editable={!saving}
                onChangeText={(role) => { if (!savingRef.current) setDraft((current) => ({ ...current, role })); }}
                placeholder={c.rolePlaceholder}
                placeholderTextColor={placeholderColor}
                returnKeyType="done"
                style={styles.input}
              />

              <View style={styles.privacyBox}>
                <Text style={styles.privacyTitle}>{c.privateTitle}</Text>
                <Text style={styles.privacyText}>
                  {c.privateBody}</Text>
              </View>

              {error ? <Text style={styles.error}>{c[error]}</Text> : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isFirstRun ? c.createLabel : c.saveLabel}
                onPress={() => void saveProfile()}
                disabled={saveDisabled}
                style={[styles.primaryButton, saveDisabled && styles.disabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? c.saving : isFirstRun ? c.create : c.save}
                </Text>
              </Pressable>

              {!isFirstRun ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={c.cancelEdit}
                  onPress={() => profileExit.requestExit(cancelProfileEdit)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>{c.cancel}</Text>
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
      <ReminderPermissionGate>
        <View style={styles.appWrap}>{children}</View>
      </ReminderPermissionGate>
    </OwnerControlsContext.Provider>
  );
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.metrics.cardPadding,
  },
  formWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.metrics.screenGutter,
    paddingVertical: 28,
  },
  brand: {
    color: theme.colors.accent,
    fontSize: theme.typography.meta.fontSize,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  loading: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.hero.fontSize,
    lineHeight: theme.typography.hero.lineHeight,
    fontWeight: '900',
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    marginTop: 10,
    marginBottom: 20,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.metrics.cardPadding,
  },
  label: {
    color: theme.colors.accent,
    fontSize: theme.typography.meta.fontSize,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 10,
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  privacyBox: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    padding: 13,
    marginTop: 18,
  },
  privacyTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.meta.fontSize,
    fontWeight: '900',
  },
  privacyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.meta.fontSize,
    lineHeight: theme.typography.meta.lineHeight,
    marginTop: 5,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.typography.meta.fontSize,
    lineHeight: theme.typography.meta.lineHeight,
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.control,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 18,
  },
  primaryButtonText: {
    color: theme.colors.onAccent,
    fontSize: theme.typography.meta.fontSize,
    fontWeight: '900',
  },
  secondaryButton: {
    borderRadius: theme.radii.control,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.meta.fontSize,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.35,
  },
  appWrap: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
