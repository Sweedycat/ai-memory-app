import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PeopleSaveState } from '../hooks/usePersistentPeople';
import { en } from '../strings/en';

export function MemorySaveNotice({ status, retry }: PeopleSaveState) {
  const copy = en.memorySave;
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

const styles = StyleSheet.create({
  notice: { marginHorizontal: 16, marginBottom: 12, padding: 16, gap: 8, borderWidth: 1, borderColor: '#8B6E45', borderRadius: 16, backgroundColor: '#211D17' },
  title: { color: '#FFE4B8', fontSize: 16, fontWeight: '700' },
  body: { color: '#E0D5C5', fontSize: 14, lineHeight: 21 },
  button: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#3D3324' },
  action: { color: '#FFE4B8', fontWeight: '700', fontSize: 15 },
});
