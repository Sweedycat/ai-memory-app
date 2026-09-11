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
import { buildMemoryBriefing } from './src/utils/buildMemoryBriefing';

type Screen = 'home' | 'detail' | 'add';

export default function App() {
  const [people, setPeople] = useState<MemoryPerson[]>(mockPeople);
  const [screen, setScreen] = useState<Screen>('home');
  const [query, setQuery] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(mockPeople[0]?.id ?? null);
  const [briefing, setBriefing] = useState('');
  const [interactionText, setInteractionText] = useState('');

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [relationship, setRelationship] = useState('');
  const [firstNote, setFirstNote] = useState('');
  const [followUp, setFollowUp] = useState('');

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedPersonId) ?? null,
    [people, selectedPersonId],
  );

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return people;

    return people.filter((person) => {
      const searchable = [
        person.name,
        person.role,
        person.company,
        person.relationship,
        person.followUp,
        ...person.notes,
        ...person.interactions.map((interaction) => interaction.summary),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalized);
    });
  }, [people, query]);

  const openPerson = (id: string) => {
    setSelectedPersonId(id);
    setBriefing('');
    setInteractionText('');
    setScreen('detail');
  };

  const resetPersonForm = () => {
    setName('');
    setRole('');
    setCompany('');
    setRelationship('');
    setFirstNote('');
    setFollowUp('');
  };

  const addPerson = () => {
    const cleanName = name.trim();
    if (!cleanName) return;

    const id = `person-${Date.now()}`;
    const newPerson: MemoryPerson = {
      id,
      name: cleanName,
      role: role.trim() || undefined,
      company: company.trim() || undefined,
      lastInteraction: 'No interactions yet',
      relationship: relationship.trim() || 'New contact',
      notes: firstNote.trim() ? [firstNote.trim()] : [],
      followUp: followUp.trim() || undefined,
      interactions: [],
    };

    setPeople((current) => [newPerson, ...current]);
    setSelectedPersonId(id);
    setBriefing('');
    resetPersonForm();
    setScreen('detail');
  };

  const addInteraction = () => {
    const cleanText = interactionText.trim();
    if (!selectedPerson || !cleanText) return;

    setPeople((current) =>
      current.map((person) => {
        if (person.id !== selectedPerson.id) return person;

        return {
          ...person,
          lastInteraction: 'Just now',
          interactions: [
            {
              id: `interaction-${Date.now()}`,
              date: 'Just now',
              summary: cleanText,
              source: 'manual',
            },
            ...person.interactions,
          ],
        };
      }),
    );

    setInteractionText('');
    setBriefing('');
  };

  if (screen === 'add') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <BackButton label="People" onPress={() => setScreen('home')} />

          <Text style={styles.pageTitle}>Add a person</Text>
          <Text style={styles.pageSubtitle}>
            Save the context now so you do not have to rely on memory later.
          </Text>

          <View style={styles.formCard}>
            <Field label="NAME *" value={name} onChangeText={setName} placeholder="e.g. Alex Morgan" />
            <Field label="ROLE" value={role} onChangeText={setRole} placeholder="e.g. Sales Director" />
            <Field label="COMPANY" value={company} onChangeText={setCompany} placeholder="e.g. Northstar Labs" />
            <Field
              label="HOW DO YOU KNOW THEM?"
              value={relationship}
              onChangeText={setRelationship}
              placeholder="e.g. Met at an industry event"
            />
            <Field
              label="FIRST MEMORY"
              value={firstNote}
              onChangeText={setFirstNote}
              placeholder="Something important to remember"
              multiline
            />
            <Field
              label="FOLLOW-UP"
              value={followUp}
              onChangeText={setFollowUp}
              placeholder="What should you do next?"
              multiline
            />

            <Pressable
              onPress={addPerson}
              disabled={!name.trim()}
              style={[styles.primaryButton, !name.trim() && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryButtonText}>Save person</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'detail' && selectedPerson) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <BackButton label="People" onPress={() => setScreen('home')} />

          <View style={styles.profileHeader}>
            <View style={styles.largeAvatar}>
              <Text style={styles.largeAvatarText}>{selectedPerson.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={styles.profileName}>{selectedPerson.name}</Text>
            <Text style={styles.profileRole}>
              {[selectedPerson.role, selectedPerson.company].filter(Boolean).join(' · ') || 'Contact'}
            </Text>
            <Text style={styles.profileRelationship}>{selectedPerson.relationship}</Text>
          </View>

          <View style={styles.memoryCard}>
            <Text style={styles.sectionLabel}>WHAT TO REMEMBER</Text>
            {selectedPerson.notes.length ? (
              selectedPerson.notes.map((note) => (
                <View key={note} style={styles.noteRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No saved memory notes yet.</Text>
            )}

            {selectedPerson.followUp ? (
              <View style={styles.followUpBox}>
                <Text style={styles.followUpLabel}>NEXT STEP</Text>
                <Text style={styles.followUpText}>{selectedPerson.followUp}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.briefingCard}>
            <View style={styles.sectionHeaderCompact}>
              <View style={styles.flexOne}>
                <Text style={styles.sectionLabel}>MEMORY BRIEFING</Text>
                <Text style={styles.cardTitle}>“Who was this person?”</Text>
              </View>
              <View style={styles.prototypeBadge}>
                <Text style={styles.prototypeBadgeText}>LOCAL PREVIEW</Text>
              </View>
            </View>

            {briefing ? (
              <Text style={styles.briefingText}>{briefing}</Text>
            ) : (
              <Text style={styles.cardBody}>
                Build a quick briefing from the memories already saved for this person.
              </Text>
            )}

            <Pressable
              onPress={() => setBriefing(buildMemoryBriefing(selectedPerson))}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Generate briefing</Text>
            </Pressable>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>NEW INTERACTION</Text>
            <Text style={styles.cardTitle}>What happened?</Text>
            <TextInput
              value={interactionText}
              onChangeText={setInteractionText}
              placeholder="e.g. We discussed the pilot. He wants pricing next week."
              placeholderTextColor="#727D89"
              multiline
              style={[styles.input, styles.multilineInput]}
            />
            <Pressable
              onPress={addInteraction}
              disabled={!interactionText.trim()}
              style={[styles.primaryButton, !interactionText.trim() && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryButtonText}>Add interaction</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>History</Text>
            <Text style={styles.sectionMeta}>{selectedPerson.interactions.length} interactions</Text>
          </View>

          <View style={styles.timeline}>
            {selectedPerson.interactions.length ? (
              selectedPerson.interactions.map((interaction) => (
                <View key={interaction.id} style={styles.timelineCard}>
                  <View style={styles.timelineDot} />
                  <View style={styles.flexOne}>
                    <Text style={styles.timelineDate}>{interaction.date}</Text>
                    <Text style={styles.timelineText}>{interaction.summary}</Text>
                    <Text style={styles.timelineSource}>Source: {interaction.source}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No interactions yet. Add the first one above.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>AI MEMORY</Text>
          <Text style={styles.title}>Remember people. Remember context.</Text>
          <Text style={styles.subtitle}>
            A private social memory layer for conversations, relationships and follow-ups.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{people.length}</Text>
            <Text style={styles.statLabel}>People</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {people.reduce((total, person) => total + person.interactions.length, 0)}
            </Text>
            <Text style={styles.statLabel}>Interactions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{people.filter((person) => person.followUp).length}</Text>
            <Text style={styles.statLabel}>Follow-ups</Text>
          </View>
        </View>

        <View style={styles.searchCard}>
          <Text style={styles.sectionLabel}>SEARCH YOUR MEMORY</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, company, note or conversation..."
            placeholderTextColor="#77808C"
            style={styles.input}
          />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>People</Text>
            <Text style={styles.sectionMeta}>{filteredPeople.length} matching memories</Text>
          </View>
          <Pressable onPress={() => setScreen('add')} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add person</Text>
          </Pressable>
        </View>

        <View style={styles.peopleList}>
          {filteredPeople.length ? (
            filteredPeople.map((person) => (
              <Pressable key={person.id} onPress={() => openPerson(person.id)} style={styles.personCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{person.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{person.name}</Text>
                  <Text style={styles.personRole}>
                    {[person.role, person.company].filter(Boolean).join(' · ') || person.relationship}
                  </Text>
                  <Text style={styles.lastSeen}>Last interaction: {person.lastInteraction}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No memories found</Text>
              <Text style={styles.emptyText}>Try another search or add a new person.</Text>
            </View>
          )}
        </View>

        <View style={styles.productCard}>
          <Text style={styles.sectionLabel}>PRODUCT DIRECTION</Text>
          <Text style={styles.productTitle}>Phone first. Glasses optional.</Text>
          <Text style={styles.productText}>
            This MVP starts with deliberate, user-controlled memory capture on the phone. Camera, voice and smart-glasses inputs can be added later with explicit consent and privacy controls.
          </Text>
          <View style={styles.statusRow}>
            <StatusPill text="Phone MVP" active />
            <StatusPill text="Cloud sync next" />
            <StatusPill text="Glasses later" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backButton}>
      <Text style={styles.backButtonText}>‹ {label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#727D89"
        multiline={multiline}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function StatusPill({ text, active = false }: { text: string; active?: boolean }) {
  return (
    <View style={[styles.statusPill, active && styles.statusPillActive]}>
      <Text style={[styles.statusPillText, active && styles.statusPillTextActive]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  container: {
    padding: 20,
    paddingBottom: 52,
  },
  flexOne: {
    flex: 1,
  },
  header: {
    marginTop: 12,
    marginBottom: 22,
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
    maxWidth: 340,
  },
  subtitle: {
    color: '#9BA5B2',
    marginTop: 12,
    fontSize: 16,
    lineHeight: 23,
  },
  pageTitle: {
    color: '#F4F7FA',
    fontSize: 31,
    lineHeight: 38,
    fontWeight: '800',
    marginTop: 12,
  },
  pageSubtitle: {
    color: '#929EAA',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111820',
    borderRadius: 17,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2833',
  },
  statValue: {
    color: '#F4F7FA',
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: '#7C8794',
    fontSize: 11,
    marginTop: 5,
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
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 9,
  },
  input: {
    backgroundColor: '#0E141B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#25303C',
    color: '#F4F7FA',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 12,
    gap: 12,
  },
  sectionHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  sectionTitle: {
    color: '#F4F7FA',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionMeta: {
    color: '#798492',
    fontSize: 12,
    marginTop: 3,
  },
  addButton: {
    backgroundColor: '#7DE2C3',
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#07100D',
    fontWeight: '900',
    fontSize: 12,
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
  chevron: {
    color: '#5F6B78',
    fontSize: 28,
    marginLeft: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 14,
  },
  backButtonText: {
    color: '#7DE2C3',
    fontSize: 15,
    fontWeight: '700',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  largeAvatar: {
    width: 78,
    height: 78,
    borderRadius: 25,
    backgroundColor: '#17302B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  largeAvatarText: {
    color: '#7DE2C3',
    fontSize: 32,
    fontWeight: '900',
  },
  profileName: {
    color: '#F4F7FA',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileRole: {
    color: '#A1ABB7',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
  profileRelationship: {
    color: '#6F7B88',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  memoryCard: {
    backgroundColor: '#141B24',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#24303C',
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
  briefingCard: {
    backgroundColor: '#111820',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#21303A',
    marginTop: 14,
  },
  prototypeBadge: {
    backgroundColor: '#241F12',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  prototypeBadgeText: {
    color: '#D8BB6B',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cardTitle: {
    color: '#F4F7FA',
    fontSize: 18,
    fontWeight: '800',
  },
  cardBody: {
    color: '#929DA9',
    marginTop: 8,
    lineHeight: 20,
  },
  briefingText: {
    color: '#D9E2E9',
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
  },
  formCard: {
    backgroundColor: '#121820',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#202B36',
    marginTop: 14,
  },
  fieldWrap: {
    marginBottom: 15,
  },
  fieldLabel: {
    color: '#8995A1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  primaryButton: {
    backgroundColor: '#7DE2C3',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 14,
  },
  primaryButtonDisabled: {
    opacity: 0.35,
  },
  primaryButtonText: {
    color: '#07100D',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3B665B',
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 16,
  },
  secondaryButtonText: {
    color: '#7DE2C3',
    fontSize: 13,
    fontWeight: '800',
  },
  timeline: {
    gap: 10,
  },
  timelineCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#10171E',
    borderRadius: 17,
    padding: 15,
    borderWidth: 1,
    borderColor: '#1C2630',
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#7DE2C3',
    marginTop: 5,
  },
  timelineDate: {
    color: '#7DE2C3',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  timelineText: {
    color: '#C1C9D2',
    lineHeight: 20,
  },
  timelineSource: {
    color: '#606C78',
    fontSize: 10,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  emptyCard: {
    backgroundColor: '#10161D',
    borderRadius: 17,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E2730',
  },
  emptyTitle: {
    color: '#E1E6EB',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 5,
  },
  emptyText: {
    color: '#7E8995',
    lineHeight: 20,
  },
  productCard: {
    marginTop: 26,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#0E141B',
    borderWidth: 1,
    borderColor: '#202A35',
  },
  productTitle: {
    color: '#F4F7FA',
    fontWeight: '800',
    fontSize: 18,
  },
  productText: {
    color: '#8F9AA7',
    marginTop: 8,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  statusPill: {
    backgroundColor: '#141B22',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#242F3A',
  },
  statusPillActive: {
    backgroundColor: '#10251F',
    borderColor: '#315B4F',
  },
  statusPillText: {
    color: '#727E8A',
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillTextActive: {
    color: '#7DE2C3',
  },
});
