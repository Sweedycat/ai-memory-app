import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CURRENT_PERMISSIONS,
  FUTURE_PERMISSIONS,
  PERMISSION_PRIVACY_NOTE,
} from '../utils/permissionDisclosures';

/**
 * An informational disclosure, not a permission prompt.
 * Actual prompts remain attached to user actions in ReminderPermissionActions.
 */
export function PermissionOverview() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>What AI Memory uses today</Text>
      <Text style={styles.intro}>
        Permission choices belong to you. Android handles access requests. You can skip
        optional permissions and still save people and notes offline.
      </Text>

      {CURRENT_PERMISSIONS.map((item) => (
        <View key={item.id} style={styles.item}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.kind}>{item.optional ? 'OPTIONAL' : 'REQUIRED'}</Text>
          </View>
          <Text style={styles.description}>{item.purpose}</Text>
          <Text style={styles.how}>{item.howGranted}</Text>
          <Text style={styles.when}>Used: {item.whenUsed}</Text>
        </View>
      ))}

      <View style={styles.sectionBreak} />
      <Text style={styles.heading}>Not requested by this version</Text>
      <Text style={styles.intro}>
        These are future ideas, not active capabilities. AI Memory will explain
        and ask separately before using any of them.
      </Text>
      {FUTURE_PERMISSIONS.map((item) => (
        <View key={item.id} style={styles.future}>
          <Text style={styles.futureTitle}>{item.name}</Text>
          <Text style={styles.futureBody}>{item.context}</Text>
        </View>
      ))}

      <View style={styles.privacyBox}>
        <Text style={styles.privacyTitle}>Your memories stay yours</Text>
        <Text style={styles.privacyText}>{PERMISSION_PRIVACY_NOTE}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  heading: { fontSize: 15, fontWeight: '900', color: '#F4F7FA', marginBottom: 7 },
  intro: { fontSize: 12, color: '#98A3AF', lineHeight: 19, marginBottom: 9 },
  item: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#27313C' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 9 },
  title: { color: '#EAF1F5', fontSize: 13, fontWeight: '800', flex: 1 },
  kind: { color: '#7DE2C3', fontSize: 10, fontWeight: '900' },
  description: { color: '#C0CBD3', fontSize: 12, lineHeight: 19, marginTop: 6 },
  how: { color: '#94A1AD', fontSize: 11, lineHeight: 18, marginTop: 6 },
  when: { color: '#7DE2C3', fontSize: 10, lineHeight: 16, marginTop: 5 },
  sectionBreak: { height: 20 },
  future: { paddingVertical: 8 },
  futureTitle: { color: '#BBC6D0', fontSize: 12, fontWeight: '800' },
  futureBody: { color: '#85919E', fontSize: 11, lineHeight: 18, marginTop: 3 },
  privacyBox: {
    borderColor: '#315B4F', borderWidth: 1, backgroundColor: '#10251F',
    padding: 13, borderRadius: 14, marginTop: 15,
  },
  privacyTitle: { color: '#D9F5EC', fontSize: 13, fontWeight: '900' },
  privacyText: { color: '#A2C7B9', fontSize: 11, lineHeight: 18, marginTop: 6 },
});
