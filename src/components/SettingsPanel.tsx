import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BackupSafetyDiagnostics } from './BackupSafetyDiagnostics';
import { LockDelaySeconds, usePrivacyControls } from './PrivacyGate';
import { ReminderPermissionActions } from './ReminderPermissionActions';
import { PermissionOverview } from './PermissionOverview';
import { AppHeader } from './ui/AppHeader';
import { Screen } from './ui/Screen';
import { useI18n } from '../i18n/LanguageProvider';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { THEMES, THEME_MODES, type ThemeMode, type ThemeTokens } from '../theme/tokens';
import manifest from '../../app.json';

type Section = 'main' | 'language' | 'appearance' | 'theme' | 'security' | 'privacy' | 'notifications' | 'backup' | 'help' | 'about';
type Props = { displayName: string; role?: string; onClose(): void; onEditProfile(): void; onReportBug(): void };
type PrivacyMessage = '' | 'enableFailed' | 'disableFailed' | 'enabled' | 'disabled' | 'delayFailed';

export function SettingsPanel({ displayName, role = '', onClose, onEditProfile, onReportBug }: Props) {
  const i18n = useI18n(), appearance = useTheme();
  const c = i18n.copy.ui.settings;
  const styles = useThemedStyles(createStyles);
  const privacy = usePrivacyControls();
  const [section, setSection] = useState<Section>('main');
  const [changingLock, setChangingLock] = useState(false);
  const changingLockRef = useRef(false);
  const [privacyMessage, setPrivacyMessage] = useState<PrivacyMessage>('');
  const goBack = () => {
    if (changingLockRef.current) return;
    if (section === 'main') onClose(); else setSection(section === 'theme' ? 'appearance' : 'main');
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => subscription.remove();
  }, [section, onClose]);
  async function toggleLock() {
    if (changingLockRef.current || !privacy.settingsReady) return;
    changingLockRef.current = true;
    setChangingLock(true); setPrivacyMessage('');
    const target = !privacy.appLockEnabled;
    try {
      const changed = await privacy.setAppLockEnabled(target);
      setPrivacyMessage(changed ? target ? 'enabled' : 'disabled' : target ? 'enableFailed' : 'disableFailed');
    } catch { setPrivacyMessage(target ? 'enableFailed' : 'disableFailed'); }
    finally { changingLockRef.current = false; setChangingLock(false); }
  }
  async function chooseDelay(seconds: LockDelaySeconds) {
    if (changingLockRef.current || !privacy.settingsReady) return;
    changingLockRef.current = true;
    setChangingLock(true); setPrivacyMessage('');
    try { await privacy.setLockDelaySeconds(seconds); }
    catch { setPrivacyMessage('delayFailed'); }
    finally { changingLockRef.current = false; setChangingLock(false); }
  }
  function action(label: string, onPress: () => void, detail?: string) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.row}>
      <View style={styles.flex}><Text style={styles.text}>{label}</Text>{detail ? <Text style={styles.meta}>{detail}</Text> : null}</View>
      <Text style={styles.link} accessibilityElementsHidden>›</Text>
    </Pressable>;
  }
  function choice(label: string, selected: boolean, disabled: boolean, onPress: () => void) {
    return <Pressable accessibilityRole="radio" accessibilityLabel={label} key={label}
      accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
      style={[styles.choice, selected && styles.selected, disabled && styles.disabled]}>
      <Text style={styles.text}>{label}</Text><Text style={styles.link} accessibilityElementsHidden>{selected ? '●' : '○'}</Text>
    </Pressable>;
  }
  const delayOptions: [LockDelaySeconds, string][] = [[0, c.immediate], [30, c.seconds30], [60, c.minute1], [300, c.minutes5]];
  const descriptions: Record<ThemeMode, string> = { classic: c.classicDescription, modern: c.modernDescription,
    light: c.lightDescription, dark: c.darkDescription, system: c.systemDescription };
  const heading = section === 'main' ? c.title : c[section];
  return <Screen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <AppHeader onBack={goBack} backLabel={section === 'main' ? 'AI Memory' : c.back}
      accessibilityLabel={section === 'main' ? c.close : c.back} title={heading} backDisabled={changingLock} />
    {section === 'main' && <>
      <Text style={styles.meta}>{c.intro}</Text>
      <View style={styles.card}>{action(c.profile, onEditProfile, displayName + (role.trim() ? ' · ' + role : ''))}</View>
      <View style={styles.card}>{(['language', 'appearance', 'security', 'privacy', 'notifications', 'backup', 'help', 'about'] as const)
        .map(key => <React.Fragment key={key}>{action(c[key], () => setSection(key))}</React.Fragment>)}</View>
    </>}
    {section === 'language' && <View style={styles.card}>
      <Text style={styles.meta}>{c.languageBody}</Text>
      {(['system', 'en', 'tr'] as const).map(preference => choice(i18n.copy.common[preference], i18n.preference === preference,
        i18n.status !== 'ready' || i18n.busy, () => { void i18n.changeLanguage(preference); }))}
      {i18n.status === 'loading' && <Text style={styles.meta}>{c.loading}</Text>}
      {i18n.busy && <Text accessibilityLiveRegion="polite" style={styles.meta}>{c.saving}</Text>}
      {i18n.status === 'error' && <><Text accessibilityRole="alert" style={styles.error}>
        {i18n.copy.common.errors[i18n.error === 'save' ? 'save' : i18n.error === 'conflict' ? 'conflict' : 'load']}</Text>
        {action(i18n.copy.common.reload, () => { void i18n.reload(); })}</>}
    </View>}
    {section === 'appearance' && <View style={styles.card}>
      <Text style={styles.meta}>{c.appearanceBody}</Text>{action(c.theme, () => setSection('theme'), c[appearance.mode])}
    </View>}
    {section === 'theme' && <View style={styles.card}>
      <Text style={styles.meta}>{c.appearanceBody}</Text>
      {THEME_MODES.map(mode => {
        const preview = THEMES[mode === 'system' ? 'light' : mode];
        const selected = appearance.mode === mode, disabled = appearance.status !== 'ready' || appearance.busy;
        return <Pressable key={mode} accessibilityRole="radio" accessibilityLabel={c[mode] + '. ' + descriptions[mode]}
          accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => { void appearance.changeMode(mode); }}
          style={[styles.choice, selected && styles.selected, disabled && styles.disabled]}>
          <View style={[styles.preview, { backgroundColor: preview.colors.background }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.swatch, { backgroundColor: preview.colors.surface, borderColor: preview.colors.controlBorder }]} />
            <View style={[styles.swatch, { backgroundColor: mode === 'system' ? THEMES.dark.colors.background : preview.colors.accent }]} />
          </View>
          <View style={styles.flex}><Text style={styles.text}>{c[mode]}</Text><Text style={styles.meta}>{descriptions[mode]}</Text></View>
          <Text style={styles.link} accessibilityElementsHidden>{selected ? '●' : '○'}</Text>
        </Pressable>;
      })}
      {appearance.status === 'loading' && <Text style={styles.meta}>{c.loading}</Text>}
      {appearance.busy && <Text accessibilityLiveRegion="polite" style={styles.meta}>{c.saving}</Text>}
      {appearance.status === 'error' && <><Text accessibilityRole="alert" style={styles.error}>{c.appearanceError}</Text>
        {action(c.reload, () => { void appearance.reload(); })}</>}
    </View>}
    {section === 'security' && <View style={styles.card}>
      <View style={styles.row}><View style={styles.flex}><Text style={styles.text}>{c.appLock}</Text>
        <Text style={styles.meta}>{privacy.appLockEnabled ? c.lockOn : c.lockOff}</Text></View>
        <View style={styles.switch}>
        <Switch accessibilityRole="switch" accessibilityLabel={c.appLock}
          accessibilityState={{ checked: privacy.appLockEnabled, disabled: changingLock || !privacy.settingsReady }}
          value={privacy.appLockEnabled} disabled={changingLock || !privacy.settingsReady}
          trackColor={{ false: appearance.theme.colors.controlBorder, true: appearance.theme.colors.accent }}
          thumbColor={appearance.theme.colors.surface} ios_backgroundColor={appearance.theme.colors.controlBorder}
          onValueChange={() => { void toggleLock(); }} />
        </View></View>
      {privacy.appLockEnabled && <><Text style={styles.text}>{c.delay}</Text><Text style={styles.meta}>{c.delayBody}</Text>
        {delayOptions.map(([seconds, label]) => choice(label, privacy.lockDelaySeconds === seconds,
          changingLock || !privacy.settingsReady, () => { void chooseDelay(seconds); }))}
        {action(c.lockNow, privacy.lockNow)}</>}
      {privacyMessage ? <Text accessibilityLiveRegion="polite" style={styles.meta}>{c[privacyMessage]}</Text> : null}
    </View>}
    {section === 'privacy' && <View style={styles.card}><Text style={styles.text}>{c.local}</Text>
      <Text style={styles.meta}>{c.localBody}</Text><Text style={styles.meta}>{c.reportPrivacy}</Text>
      <Text style={styles.meta}>{c.permissions}</Text><PermissionOverview /></View>}
    {section === 'notifications' && <View style={styles.card}><ReminderPermissionActions /></View>}
    {section === 'backup' && <BackupSafetyDiagnostics />}
    {section === 'help' && <View style={styles.card}>{action(c.bug, onReportBug, c.reportBody)}<Text style={styles.meta}>{c.reportPrivacy}</Text></View>}
    {section === 'about' && <View style={styles.card}><Text style={styles.text}>{c.beta}</Text>
      <Text style={styles.meta}>{c.version} {manifest.expo.version}</Text></View>}
  </ScrollView></Screen>;
}
const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: theme.metrics.screenGutter, paddingTop: 12, paddingBottom: 24, gap: 12 },
  card: { padding: theme.metrics.cardPadding, backgroundColor: theme.colors.surface, borderWidth: 1,
    borderColor: theme.colors.border, borderRadius: theme.radii.card, gap: 12 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  choice: { minHeight: 56, padding: 12, gap: 12, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.controlBorder, borderRadius: theme.radii.control },
  selected: { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceRaised },
  flex: { flex: 1, minWidth: 0 }, text: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
  meta: { ...theme.typography.meta, color: theme.colors.textSecondary }, link: { color: theme.colors.accent, fontSize: 20 },
  error: { ...theme.typography.meta, color: theme.colors.danger }, disabled: { opacity: 0.55 },
  switch: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    borderColor: theme.colors.controlBorder, borderRadius: theme.radii.control },
  preview: { width: 60, height: 44, borderRadius: 8, padding: 6, flexDirection: 'row', gap: 4 },
  swatch: { flex: 1, borderWidth: 1, borderRadius: 4 },
});
