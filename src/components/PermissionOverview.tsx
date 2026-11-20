import { useI18n } from '../i18n/LanguageProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CURRENT_PERMISSIONS,
  FUTURE_PERMISSIONS,
} from '../utils/permissionDisclosures';

/**
 * An informational disclosure, not a permission prompt.
 * Actual prompts remain attached to user actions in ReminderPermissionActions.
 */
export function PermissionOverview() {
  const styles = useThemedStyles(createStyles);
  const { copy: catalog } = useI18n();
  const copy = catalog.ui.permissions;
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{copy.heading}</Text>
      <Text style={styles.intro}>{copy.intro}</Text>

      {CURRENT_PERMISSIONS.map((item) => (
        <View key={item.id} style={styles.item}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{copy.current[item.id].name}</Text>
            <Text style={styles.kind}>{item.access === 'user-choice' ? copy.choice : copy.system}</Text>
          </View>
          <Text style={styles.description}>{copy.current[item.id].purpose}</Text>
          <Text style={styles.how}>{copy.current[item.id].howGranted}</Text>
          <Text style={styles.when}>{copy.used(copy.current[item.id].whenUsed)}</Text>
        </View>
      ))}

      <View style={styles.sectionBreak} />
      <Text style={styles.heading}>{copy.futureHeading}</Text>
      <Text style={styles.intro}>{copy.futureIntro}</Text>
      {FUTURE_PERMISSIONS.map((item) => (
        <View key={item.id} style={styles.future}>
          <Text style={styles.futureTitle}>{copy.future[item.id].name}</Text>
          <Text style={styles.futureBody}>{copy.future[item.id].context}</Text>
        </View>
      ))}

      <View style={styles.privacyBox}>
        <Text style={styles.privacyTitle}>{copy.privacyTitle}</Text>
        <Text style={styles.privacyText}>{copy.privacy}</Text>
      </View>
    </View>
  );
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  wrap: { marginTop: theme.spacing.xs },
  heading: { fontSize: theme.typography.body.fontSize, fontWeight: '900', color: theme.colors.text, marginBottom: 7 },
  intro: { fontSize: theme.typography.meta.fontSize, color: theme.colors.textSecondary, lineHeight: theme.typography.meta.lineHeight, marginBottom: 9 },
  item: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 9 },
  title: { color: theme.colors.text, fontSize: theme.typography.meta.fontSize, fontWeight: '800', flex: 1 },
  kind: { color: theme.colors.accent, fontSize: theme.typography.meta.fontSize, fontWeight: '900' },
  description: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: theme.spacing.sm },
  how: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: theme.spacing.sm },
  when: { color: theme.colors.accent, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: 5 },
  sectionBreak: { height: 20 },
  future: { paddingVertical: theme.spacing.sm },
  futureTitle: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, fontWeight: '800' },
  futureBody: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: 3 },
  privacyBox: {
    borderColor: theme.colors.border, borderWidth: 1, backgroundColor: theme.colors.surface,
    padding: 13, borderRadius: theme.radii.control, marginTop: theme.spacing.md,
  },
  privacyTitle: { color: theme.colors.text, fontSize: theme.typography.meta.fontSize, fontWeight: '900' },
  privacyText: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.meta.lineHeight, marginTop: theme.spacing.sm },
});
