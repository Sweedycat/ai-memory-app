import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { usePersistentPeople } from './src/hooks/usePersistentPeople';
import { MemoryPerson } from './src/types';
import { buildMemoryBriefing } from './src/utils/buildMemoryBriefing';

type Screen = 'home' | 'detail' | 'add' | 'edit';
type PersonForm = {
  name: string;
  role: string;
  company: string;
  relationship: string;
  note: string;
  followUp: string;
};

const emptyForm: PersonForm = {
  name: '',
  role: '',
  company: '',
  relationship: '',
  note: '',
  followUp: '',
};

export default function App() {
  const [people, setPeople, storageReady] = usePersistentPeople(mockPeople);
  const [screen, setScreen] = useState<Screen>('home');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(mockPeople[0]?.id ?? null);
  const [briefing, setBriefing] = useState('');
  const [interactionText, setInteractionText] = useState('');
  const [memoryText, setMemoryText] = useState('');
  const [form, setForm] = useState<PersonForm>(emptyForm);

  const selected = useMemo(
    () => people.find((person) => person.id === selectedId) ?? null,
    [people, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;

    return people.filter((person) =>
      [
        person.name,
        person.role,
        person.company,
        person.relationship,
        person.followUp,
        ...person.notes,
        ...person.interactions.map((item) => item.summary),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [people, query]);

  function openPerson(id: string) {
    setSelectedId(id);
    setBriefing('');
    setInteractionText('');
    setMemoryText('');
    setScreen('detail');
  }

  function openAddPerson() {
    setForm(emptyForm);
    setScreen('add');
  }

  function openEditPerson() {
    if (!selected) return;

    setForm({
      name: selected.name,
      role: selected.role ?? '',
      company: selected.company ?? '',
      relationship: selected.relationship,
      note: selected.notes[0] ?? '',
      followUp: selected.followUp ?? '',
    });
    setScreen('edit');
  }

  function addPerson() {
    if (!form.name.trim()) return;

    const id = `person-${Date.now()}`;
    const person: MemoryPerson = {
      id,
      name: form.name.trim(),
      role: form.role.trim() || undefined,
      company: form.company.trim() || undefined,
      relationship: form.relationship.trim() || 'New contact',
      lastInteraction: 'No interactions yet',
      notes: form.note.trim() ? [form.note.trim()] : [],
      followUp: form.followUp.trim() || undefined,
      interactions: [],
    };

    setPeople((current) => [person, ...current]);
    setForm(emptyForm);
    setSelectedId(id);
    setBriefing('');
    setScreen('detail');
  }

  function saveEditedPerson() {
    if (!selected || !form.name.trim()) return;

    setPeople((current) =>
      current.map((person) => {
        if (person.id !== selected.id) return person;

        const firstNote = form.note.trim();
        const restOfNotes = person.notes.slice(1);

        return {
          ...person,
          name: form.name.trim(),
          role: form.role.trim() || undefined,
          company: form.company.trim() || undefined,
          relationship: form.relationship.trim() || 'Contact',
          notes: firstNote ? [firstNote, ...restOfNotes] : restOfNotes,
          followUp: form.followUp.trim() || undefined,
        };
      }),
    );
    setBriefing('');
    setScreen('detail');
  }

  function addInteraction() {
    const text = interactionText.trim();
    if (!selected || !text) return;

    setPeople((current) =>
      current.map((person) =>
        person.id === selected.id
          ? {
              ...person,
              lastInteraction: 'Just now',
              interactions: [
                {
                  id: `interaction-${Date.now()}`,
                  date: 'Just now',
                  summary: text,
                  source: 'manual',
                },
                ...person.interactions,
              ],
            }
          : person,
      ),
    );
    setInteractionText('');
    setBriefing('');
  }

  function addMemoryNote() {
    const text = memoryText.trim();
    if (!selected || !text) return;

    setPeople((current) =>
      current.map((person) =>
        person.id === selected.id
          ? { ...person, notes: [text, ...person.notes] }
          : person,
      ),
    );
    setMemoryText('');
    setBriefing('');
  }

  function completeFollowUp() {
    if (!selected) return;

    setPeople((current) =>
      current.map((person) =>
        person.id === selected.id ? { ...person, followUp: undefined } : person,
      ),
    );
    setBriefing('');
  }

  function deleteSelectedPerson() {
    if (!selected) return;

    Alert.alert(
      'Delete person?',
      `${selected.name} and all saved interactions on this device will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setPeople((current) => current.filter((person) => person.id !== selected.id));
            setSelectedId(null);
            setBriefing('');
            setScreen('home');
          },
        },
      ],
    );
  }

  if (screen === 'add' || screen === 'edit') {
    const isEdit = screen === 'edit';

    return (
      <Page>
        <Back onPress={() => setScreen(isEdit ? 'detail' : 'home')} />
        <Text style={styles.titleSmall}>{isEdit ? 'Edit person' : 'Add a person'}</Text>
        <Text style={styles.sub}>
          {isEdit
            ? 'Keep the profile accurate as your relationship and context change.'
            : 'Save the context now so you do not have to rely on memory later.'}
        </Text>

        <Card>
          <Field label="NAME *" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field label="ROLE" value={form.role} onChange={(role) => setForm({ ...form, role })} />
          <Field label="COMPANY" value={form.company} onChange={(company) => setForm({ ...form, company })} />
          <Field
            label="HOW DO YOU KNOW THEM?"
            value={form.relationship}
            onChange={(relationship) => setForm({ ...form, relationship })}
          />
          <Field
            label={isEdit ? 'PRIMARY MEMORY' : 'FIRST MEMORY'}
            value={form.note}
            onChange={(note) => setForm({ ...form, note })}
            multiline
          />
          <Field
            label="FOLLOW-UP"
            value={form.followUp}
            onChange={(followUp) => setForm({ ...form, followUp })}
            multiline
          />
          <Action
            label={isEdit ? 'Save changes' : 'Save person'}
            onPress={isEdit ? saveEditedPerson : addPerson}
            disabled={!form.name.trim()}
          />
        </Card>
      </Page>
    );
  }

  if (screen === 'detail' && selected) {
    return (
      <Page>
        <Back onPress={() => setScreen('home')} />

        <View style={styles.profile}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>{selected.name[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>{selected.name}</Text>
          <Text style={styles.subCenter}>
            {[selected.role, selected.company].filter(Boolean).join(' · ') || 'Contact'}
          </Text>
          <Text style={styles.mutedCenter}>{selected.relationship}</Text>
          <View style={styles.profileActions}>
            <MiniAction label="Edit" onPress={openEditPerson} />
            <MiniAction label="Delete" onPress={deleteSelectedPerson} danger />
          </View>
        </View>

        <Card>
          <Label text="WHAT TO REMEMBER" />
          {selected.notes.length ? (
            selected.notes.map((note, index) => (
              <Text key={`${note}-${index}`} style={styles.note}>• {note}</Text>
            ))
          ) : (
            <Text style={styles.muted}>No memory notes yet.</Text>
          )}

          <TextInput
            value={memoryText}
            onChangeText={setMemoryText}
            multiline
            placeholder="Add another thing you want to remember..."
            placeholderTextColor="#727D89"
            style={[styles.input, styles.multilineSmall]}
          />
          <OutlineAction label="Add memory note" onPress={addMemoryNote} disabled={!memoryText.trim()} />

          {selected.followUp ? (
            <View style={styles.followUp}>
              <Text style={styles.followUpLabel}>NEXT STEP</Text>
              <Text style={styles.followUpText}>{selected.followUp}</Text>
              <Pressable onPress={completeFollowUp} style={styles.followUpDone}>
                <Text style={styles.followUpDoneText}>✓ Mark completed</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.followUpComplete}>No open follow-up.</Text>
          )}
        </Card>

        <Card>
          <Label text="MEMORY BRIEFING · LOCAL PREVIEW" />
          <Text style={styles.cardTitle}>Who was this person?</Text>
          <Text style={styles.body}>
            {briefing || 'Build a quick briefing from the memories already saved for this person.'}
          </Text>
          <OutlineAction label="Generate briefing" onPress={() => setBriefing(buildMemoryBriefing(selected))} />
        </Card>

        <Card>
          <Label text="NEW INTERACTION" />
          <TextInput
            value={interactionText}
            onChangeText={setInteractionText}
            multiline
            placeholder="What happened? What should you remember?"
            placeholderTextColor="#727D89"
            style={[styles.input, styles.multiline]}
          />
          <Action label="Add interaction" onPress={addInteraction} disabled={!interactionText.trim()} />
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>History</Text>
          <Text style={styles.muted}>{selected.interactions.length} interactions</Text>
        </View>

        {selected.interactions.length ? (
          selected.interactions.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <Text style={styles.historyDate}>{item.date}</Text>
              <Text style={styles.historyText}>{item.summary}</Text>
              <Text style={styles.source}>SOURCE: {item.source}</Text>
            </View>
          ))
        ) : (
          <Card><Text style={styles.muted}>No interactions yet.</Text></Card>
        )}
      </Page>
    );
  }

  return (
    <Page>
      <View style={styles.hero}>
        <Text style={styles.brand}>AI MEMORY</Text>
        <Text style={styles.title}>Remember people. Remember context.</Text>
        <Text style={styles.sub}>Your private social memory layer for conversations and follow-ups.</Text>
      </View>

      <View style={styles.stats}>
        <Stat value={people.length} label="People" />
        <Stat value={people.reduce((sum, p) => sum + p.interactions.length, 0)} label="Interactions" />
        <Stat value={people.filter((p) => p.followUp).length} label="Follow-ups" />
      </View>

      <Card>
        <Label text="SEARCH YOUR MEMORY" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Name, company, note or conversation..."
          placeholderTextColor="#727D89"
          style={styles.input}
        />
      </Card>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>People</Text>
          <Text style={styles.muted}>{filtered.length} matching memories</Text>
        </View>
        <Pressable style={styles.addButton} onPress={openAddPerson}>
          <Text style={styles.addButtonText}>+ Add person</Text>
        </Pressable>
      </View>

      {filtered.map((person) => (
        <Pressable key={person.id} style={styles.personCard} onPress={() => openPerson(person.id)}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{person.name[0]?.toUpperCase()}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.personName}>{person.name}</Text>
            <Text style={styles.personMeta}>
              {[person.role, person.company].filter(Boolean).join(' · ') || person.relationship}
            </Text>
            <Text style={styles.muted}>Last interaction: {person.lastInteraction}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

      {!filtered.length ? <Card><Text style={styles.muted}>No memories found.</Text></Card> : null}

      <Card>
        <Label text="MVP STATUS" />
        <Text style={styles.cardTitle}>Phone first. Glasses later.</Text>
        <Text style={styles.body}>
          {storageReady
            ? 'Your people and interactions are saved on this device. Cloud sync, real AI and smart-glasses input are the next layers.'
            : 'Loading your saved memories on this device...'}
        </Text>
        <View style={styles.pills}>
          <Pill text="Local save ✓" active={storageReady} />
          <Pill text="Cloud sync next" />
          <Pill text="Real AI next" />
          <Pill text="Glasses later" />
        </View>
      </Card>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Back({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress}><Text style={styles.back}>‹ People</Text></Pressable>;
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function Field({ label, value, onChange, multiline = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Label text={label} />
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={`Enter ${label.toLowerCase().replace(' *', '')}`}
        placeholderTextColor="#727D89"
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.action, disabled && styles.disabled]}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function OutlineAction({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.outline, disabled && styles.disabled]}>
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
  );
}

function MiniAction({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.miniAction, danger && styles.miniActionDanger]}>
      <Text style={[styles.miniActionText, danger && styles.miniActionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>;
}

function Pill({ text, active = false }: { text: string; active?: boolean }) {
  return <View style={[styles.pill, active && styles.pillActive]}><Text style={[styles.pillText, active && styles.pillTextActive]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0F14' },
  container: { padding: 20, paddingBottom: 52, gap: 12 },
  flex: { flex: 1 },
  hero: { marginTop: 10, marginBottom: 8 },
  brand: { color: '#7DE2C3', fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  title: { color: '#F4F7FA', fontSize: 34, lineHeight: 40, fontWeight: '800' },
  titleSmall: { color: '#F4F7FA', fontSize: 30, fontWeight: '800', marginTop: 10 },
  sub: { color: '#98A3AF', fontSize: 15, lineHeight: 22, marginTop: 8 },
  subCenter: { color: '#A6B0BA', fontSize: 14, marginTop: 5, textAlign: 'center' },
  muted: { color: '#75818D', fontSize: 12, lineHeight: 18 },
  mutedCenter: { color: '#75818D', fontSize: 12, marginTop: 5, textAlign: 'center' },
  card: { backgroundColor: '#121820', borderRadius: 20, borderWidth: 1, borderColor: '#202B36', padding: 16, marginTop: 2 },
  label: { color: '#7DE2C3', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  cardTitle: { color: '#F4F7FA', fontSize: 18, fontWeight: '800' },
  body: { color: '#A5AFB9', fontSize: 14, lineHeight: 21, marginTop: 8 },
  input: { backgroundColor: '#0E141B', borderRadius: 14, borderWidth: 1, borderColor: '#293541', color: '#F4F7FA', fontSize: 15, paddingHorizontal: 13, paddingVertical: 12 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  multilineSmall: { minHeight: 70, textAlignVertical: 'top', marginTop: 10 },
  field: { marginBottom: 14 },
  action: { backgroundColor: '#7DE2C3', borderRadius: 14, alignItems: 'center', paddingVertical: 14, marginTop: 10 },
  disabled: { opacity: 0.35 },
  actionText: { color: '#07100D', fontWeight: '900', fontSize: 14 },
  outline: { borderRadius: 14, borderWidth: 1, borderColor: '#3E6A5E', alignItems: 'center', paddingVertical: 13, marginTop: 12 },
  outlineText: { color: '#7DE2C3', fontWeight: '800' },
  back: { color: '#7DE2C3', fontSize: 15, fontWeight: '800', paddingVertical: 8 },
  stats: { flexDirection: 'row', gap: 9 },
  stat: { flex: 1, backgroundColor: '#111820', borderRadius: 16, borderWidth: 1, borderColor: '#202A34', padding: 13 },
  statValue: { color: '#F4F7FA', fontSize: 22, fontWeight: '900', marginBottom: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 },
  sectionTitle: { color: '#F4F7FA', fontSize: 22, fontWeight: '800' },
  addButton: { backgroundColor: '#7DE2C3', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  addButtonText: { color: '#07100D', fontWeight: '900', fontSize: 12 },
  personCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111820', borderRadius: 18, borderWidth: 1, borderColor: '#1E2933', padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#19302B', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#7DE2C3', fontWeight: '900', fontSize: 19 },
  personName: { color: '#F4F7FA', fontSize: 16, fontWeight: '800' },
  personMeta: { color: '#A7B0BA', fontSize: 13, marginTop: 3, marginBottom: 4 },
  chevron: { color: '#66727E', fontSize: 27, marginLeft: 8 },
  profile: { alignItems: 'center', paddingVertical: 18 },
  avatarLarge: { width: 76, height: 76, borderRadius: 24, backgroundColor: '#19302B', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarTextLarge: { color: '#7DE2C3', fontSize: 31, fontWeight: '900' },
  profileName: { color: '#F4F7FA', fontSize: 27, fontWeight: '900', textAlign: 'center' },
  profileActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  miniAction: { borderRadius: 999, borderWidth: 1, borderColor: '#355348', paddingHorizontal: 15, paddingVertical: 7 },
  miniActionDanger: { borderColor: '#5B3437' },
  miniActionText: { color: '#7DE2C3', fontSize: 11, fontWeight: '900' },
  miniActionTextDanger: { color: '#F18B91' },
  note: { color: '#BCC5CE', fontSize: 14, lineHeight: 21, marginBottom: 7 },
  followUp: { backgroundColor: '#10251F', borderRadius: 14, padding: 13, marginTop: 12 },
  followUpLabel: { color: '#67D9B6', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 },
  followUpText: { color: '#D9F5EC', lineHeight: 20 },
  followUpDone: { alignSelf: 'flex-start', marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: '#315B4F', paddingHorizontal: 10, paddingVertical: 7 },
  followUpDoneText: { color: '#7DE2C3', fontSize: 11, fontWeight: '900' },
  followUpComplete: { color: '#75818D', fontSize: 12, marginTop: 12 },
  historyCard: { backgroundColor: '#10171E', borderRadius: 17, borderWidth: 1, borderColor: '#1D2832', padding: 15 },
  historyDate: { color: '#7DE2C3', fontSize: 11, fontWeight: '900', marginBottom: 6 },
  historyText: { color: '#C0C9D2', lineHeight: 20 },
  source: { color: '#66727E', fontSize: 9, marginTop: 8, fontWeight: '800' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  pill: { backgroundColor: '#151C23', borderRadius: 999, borderWidth: 1, borderColor: '#29333D', paddingHorizontal: 9, paddingVertical: 6 },
  pillActive: { backgroundColor: '#10251F', borderColor: '#315B4F' },
  pillText: { color: '#7B8792', fontSize: 10, fontWeight: '800' },
  pillTextActive: { color: '#7DE2C3' },
});