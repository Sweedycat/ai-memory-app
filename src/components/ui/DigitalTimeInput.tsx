import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '../../i18n/LanguageProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeTokens } from '../../theme/tokens';
import { applyDigitalReminderTime, digitalReminderFields } from '../../utils/digitalReminderTime';

/** Inline draft only; the caller owns date selection, dismissal and reminder persistence. */
export function DigitalTimeInput({ value, onConfirm, onCancel, disabled = false, fields: controlledFields, onFieldsChange }: {
  value: Date; onConfirm: (next: Date) => void; onCancel: () => void; disabled?: boolean;
  fields?: { hour: string; minute: string };
  onFieldsChange?: (fields: { hour: string; minute: string }) => void;
}) {
  const { copy } = useI18n();
  const c = copy.timeEntry;
  const styles = useThemedStyles(createStyles);
  const [localFields, setFields] = useState(() => digitalReminderFields(value));
  const fields = controlledFields ?? localFields;
  const currentFields = useRef(fields);
  currentFields.current = fields;
  const hourRef = useRef<TextInput>(null);
  const minuteRef = useRef<TextInput>(null);
  const confirmed = useRef(false);
  const instant = value.getTime();
  useEffect(() => {
    setFields(digitalReminderFields(new Date(instant)));
    confirmed.current = false;
    hourRef.current?.focus();
  }, [instant]);
  const result = applyDigitalReminderTime(value, fields.hour, fields.minute);
  const error = result.ok ? null : c[result.reason];
  function confirm() {
    const latest = applyDigitalReminderTime(value, currentFields.current.hour, currentFields.current.minute);
    if (disabled || confirmed.current || !latest.ok) return;
    confirmed.current = true;
    onConfirm(latest.date);
  }
  function update(field: 'hour' | 'minute', next: string) {
    if (disabled) return;
    confirmed.current = false;
    const updated = { ...currentFields.current, [field]: next };
    currentFields.current = updated;
    if (controlledFields) onFieldsChange?.(updated);
    else setFields(updated);
  }
  function pad(field: 'hour' | 'minute') {
    const raw = currentFields.current[field];
    if (/^[0-9]{1,2}$/.test(raw) && Number(raw) <= (field === 'hour' ? 23 : 59)) update(field, raw.padStart(2, '0'));
  }
  return <View style={styles.container}>
    <Text accessibilityRole="header" style={styles.title}>{c.title}</Text>
    <Text style={styles.caption}>{c.format}</Text>
    <View style={styles.fields}>
      <View style={styles.field}>
        <Text style={styles.label}>{c.hour}</Text>
        <TextInput ref={hourRef} accessibilityLabel={c.hour} accessibilityHint={c.hourHint}
          keyboardType="number-pad" inputMode="numeric" returnKeyType="next" submitBehavior="submit"
          value={fields.hour} onChangeText={next => update('hour', next)} onBlur={() => pad('hour')}
          onSubmitEditing={() => minuteRef.current?.focus()} selectTextOnFocus editable={!disabled}
          autoCorrect={false} autoComplete="off" style={styles.input} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>{c.minute}</Text>
        <TextInput ref={minuteRef} accessibilityLabel={c.minute} accessibilityHint={c.minuteHint}
          keyboardType="number-pad" inputMode="numeric" returnKeyType="done" submitBehavior="blurAndSubmit"
          value={fields.minute} onChangeText={next => update('minute', next)} onBlur={() => pad('minute')}
          onSubmitEditing={() => minuteRef.current?.blur()} selectTextOnFocus editable={!disabled}
          autoCorrect={false} autoComplete="off" style={styles.input} />
      </View>
    </View>
    {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={c.confirm}
        accessibilityState={{ disabled: disabled || !result.ok }} disabled={disabled || !result.ok}
        onPress={confirm} style={[styles.confirm, (disabled || !result.ok) && styles.disabled]}>
        <Text style={styles.confirmText}>{c.confirm}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={c.cancel} accessibilityState={{ disabled }}
        disabled={disabled} onPress={onCancel} style={[styles.cancel, disabled && styles.disabled]}>
        <Text style={styles.label}>{c.cancel}</Text>
      </Pressable>
    </View>
  </View>;
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  container: { gap: theme.spacing.md },
  title: { ...theme.typography.section, color: theme.colors.text, fontWeight: '700' },
  caption: { ...theme.typography.meta, color: theme.colors.textSecondary },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  field: { flexGrow: 1, flexBasis: 100, minWidth: 80, gap: theme.spacing.xs },
  label: { ...theme.typography.body, color: theme.colors.text },
  input: { ...theme.typography.title, color: theme.colors.text, backgroundColor: theme.colors.input,
    borderColor: theme.colors.controlBorder, borderWidth: 1, borderRadius: theme.radii.control,
    minHeight: theme.metrics.controlMinHeight, padding: theme.spacing.md, textAlign: 'center' },
  error: { ...theme.typography.meta, color: theme.colors.danger },
  actions: { gap: theme.spacing.sm },
  confirm: { minHeight: theme.metrics.controlMinHeight, padding: theme.spacing.md, alignItems: 'center',
    justifyContent: 'center', backgroundColor: theme.colors.accent, borderRadius: theme.radii.control },
  confirmText: { ...theme.typography.body, color: theme.colors.onAccent, fontWeight: '700', textAlign: 'center' },
  cancel: { minHeight: theme.metrics.controlMinHeight, padding: theme.spacing.md, alignItems: 'center',
    justifyContent: 'center', borderColor: theme.colors.controlBorder, borderWidth: 1, borderRadius: theme.radii.control },
  disabled: { opacity: 0.5 },
});
