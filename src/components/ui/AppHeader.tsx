import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';

/** The containing screen owns safe areas. Back is content-width with a 48dp target. */
export function AppHeader({ onBack, backLabel, accessibilityLabel, title, children, backDisabled = false }: {
  onBack: () => void; backLabel: string; accessibilityLabel: string;
  title?: string; children?: React.ReactNode; backDisabled?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.header}>
    <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      disabled={backDisabled} accessibilityState={{ disabled: backDisabled }}
      style={styles.back}><Text style={styles.backText}>‹ {backLabel}</Text></Pressable>
    {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : null}
    {children}
  </View>;
}
const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  header: { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  back: { minHeight: theme.metrics.controlMinHeight, minWidth: 48, alignSelf: 'flex-start',
    justifyContent: 'center', paddingHorizontal: theme.spacing.sm, borderRadius: theme.radii.control },
  backText: { ...theme.typography.body, color: theme.colors.accent, fontWeight: '700' },
  title: { ...theme.typography.title, color: theme.colors.text, fontWeight: '800' },
});
