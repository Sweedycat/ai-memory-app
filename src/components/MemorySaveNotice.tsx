import { useI18n } from '../i18n/LanguageProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeTokens } from '../theme/tokens';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PeopleSaveState } from '../hooks/usePersistentPeople';

export function MemorySaveNotice({ status, retry }: PeopleSaveState) {
  const styles = useThemedStyles(createStyles);
  const { copy: catalog } = useI18n();
  const copy = catalog.ui.memorySave;
  if (status === 'idle') return null;
  return (
    <View style={styles.notice}>
      <Text accessibilityRole={status === 'error' ? 'alert' : undefined}
        accessibilityLiveRegion="polite" style={styles.title}>
        {status === 'error' ? copy.failed : copy.saving}
      </Text>
      {status === 'error' && <>
        <Text style={styles.body}>{copy.explanation}</Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
          <Text style={styles.action}>{copy.retry}</Text>
        </Pressable>
      </>}
    </View>
  );
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  notice: { marginHorizontal: theme.metrics.cardPadding, marginBottom: theme.spacing.md, padding: theme.metrics.cardPadding, gap: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.warning, borderRadius: theme.radii.card, backgroundColor: theme.colors.warningSurface },
  title: { color: theme.colors.warning, fontSize: theme.typography.body.fontSize, fontWeight: '700' },
  body: { color: theme.colors.textSecondary, fontSize: theme.typography.meta.fontSize, lineHeight: theme.typography.body.lineHeight },
  button: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: theme.spacing.md, borderRadius: theme.radii.control, backgroundColor: theme.colors.surfaceRaised },
  action: { color: theme.colors.warning, fontWeight: '700', fontSize: theme.typography.body.fontSize },
});
