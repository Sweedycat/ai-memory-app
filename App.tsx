import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { mockPeople } from './src/data/mockPeople';
import { MemoryPerson } from './src/types';

export default function App() {
  const [query, setQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<MemoryPerson | null>(mockPeople[0] ?? null);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return mockPeople;

    return mockPeople.filter((person) => {
      const searchable = [person.name, person.role, person.company, person.relationship]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalized);
    });
  }, [query]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>AI MEMORY</Text>
          <Text style={styles.title}>Remember people. Remember context.</Text>
          <Text style={styles.subtitle}>
            Your private social memory layer for conversations, relationships and follow-ups.
          </Text>
        </View>

        <View style={styles.searchCard}>
          <Text style={styles.sectionLabel}>Ask your memory</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a person, company or context..."
            placeholderTextColor="#77808C"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>People</Text>
          <Text style={styles.sectionMeta}>{filteredPeople.length} saved</Text>
        </View>

        <View style={styles.peopleList}>
          {filteredPeople.map((person) => {
            const isSelected = selectedPerson?.id === person.id;
            return (
              <Pressable
                key={person.id}
                onPress={() => setSelectedPerson(person)}
                style={[styles.personCard, isSelected && styles.personCardSelected]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{person.name.slice(0, 1)}</Text>
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{person.name}</Text>
                  <Text style={styles.personRole}>
                    {[person.role, person.company].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.lastSeen}>Last interaction: {person.lastInteraction}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {selectedPerson ? (
          <View style={styles.memoryCard}>
            <Text style={styles.sectionLabel}>Memory snapshot</Text>
            <Text style={styles.memoryName}>{selectedPerson.name}</Text>
            <Text style={styles.relationship}>{selectedPerson.relationship}</Text>

            <View style={styles.divider} />

            <Text style={styles.memoryHeading}>What you should remember</Text>
            {selectedPerson.notes.map((note) => (
              <View key={note} style={styles.noteRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}

            {selectedPerson.followUp ? (
              <View style={styles.followUpBox}>
                <Text style={styles.followUpLabel}>FOLLOW-UP</Text>
                <Text style={styles.followUpText}>{selectedPerson.followUp}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.futureCard}>
          <Text style={styles.futureTitle}>Smart glasses ready later</Text>
          <Text style={styles.futureText}>
            The phone remains the main product. Glasses can later become an optional live-context input and display layer.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  container: {
    padding: 20,
    paddingBottom: 48,
  },
  header: {
    marginTop: 12,
    marginBottom: 24,
  },
  eyebrow: {
    color: '#7DE2C3',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
  },
  title: {
    color: '#F4F7FA',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    maxWidth: 330,
  },
  subtitle: {
    color: '#9BA5B2',
    marginTop: 12,
    fontSize: 16,
    lineHeight: 23,
  },
  searchCard: {
    backgroundColor: '#121820',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2833',
  },
  sectionLabel: {
    color: '#7DE2C3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#0E141B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#25303C',
    color: '#F4F7FA',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#F4F7FA',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionMeta: {
    color: '#798492',
    fontSize: 13,
  },
  peopleList: {
    gap: 10,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111820',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1D2731',
  },
  personCardSelected: {
    borderColor: '#7DE2C3',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#1A2D2B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#7DE2C3',
    fontSize: 19,
    fontWeight: '800',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    color: '#F4F7FA',
    fontSize: 16,
    fontWeight: '700',
  },
  personRole: {
    color: '#A1ABB7',
    marginTop: 3,
    fontSize: 13,
  },
  lastSeen: {
    color: '#687380',
    marginTop: 5,
    fontSize: 12,
  },
  memoryCard: {
    marginTop: 24,
    backgroundColor: '#141B24',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#24303C',
  },
  memoryName: {
    color: '#F4F7FA',
    fontSize: 25,
    fontWeight: '800',
  },
  relationship: {
    color: '#97A2AF',
    marginTop: 5,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#27323D',
    marginVertical: 18,
  },
  memoryHeading: {
    color: '#DCE2E8',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  noteRow: {
    flexDirection: 'row',
    marginBottom: 9,
    paddingRight: 8,
  },
  bullet: {
    color: '#7DE2C3',
    marginRight: 8,
    fontWeight: '900',
  },
  noteText: {
    color: '#AFB8C3',
    flex: 1,
    lineHeight: 20,
  },
  followUpBox: {
    backgroundColor: '#10251F',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  followUpLabel: {
    color: '#65D7B4',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  followUpText: {
    color: '#D9F5EC',
    lineHeight: 20,
  },
  futureCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#0E141B',
    borderWidth: 1,
    borderColor: '#202A35',
  },
  futureTitle: {
    color: '#F4F7FA',
    fontWeight: '800',
    fontSize: 16,
  },
  futureText: {
    color: '#8F9AA7',
    marginTop: 8,
    lineHeight: 20,
  },
});
