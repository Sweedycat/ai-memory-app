import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useOwnerControls } from './src/components/OwnerProfileGate';
import { mockPeople } from './src/data/mockPeople';
import { usePersistentPeople } from './src/hooks/usePersistentPeople';
import { MemoryFollowUp, MemoryPerson } from './src/types';
import { buildMemoryBriefing } from './src/utils/buildMemoryBriefing';
import {
  cancelFollowUpNotification,
  scheduleFollowUpNotification,
} from './src/utils/followUpNotifications';

type Screen = 'home' | 'detail' | 'add' | 'edit';
type PickerMode = 'date' | 'time' | 'datetime' | null;
type PersonForm = {
  name: string;
  role: string;
  company: string;
  relationship: string;
  note: string;
  followUp: string;
  followUpReminderAt: string;
};

const emptyForm: PersonForm = {
  name: '',
  role: '',
  company: '',
  relationship: '',
  note: '',
  followUp: '',
  followUpReminderAt: '',
};

function reminderAtTomorrow(hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function reminderAtDaysFromNow(days: number, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function defaultCustomReminder() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return date;
}

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatReminder(iso?: string) {
  if (!iso) return 'No reminder';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No reminder';

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateText = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  if (date.getTime() < now.getTime()) return `Overdue · ${dateText} · ${time}`;
  if (sameCalendarDay(date, now)) return `Today · ${time}`;
  if (sameCalendarDay(date, tomorrow)) return `Tomorrow · ${time}`;
  return `${dateText} · ${time}`;
}

function reminderStatus(iso?: string) {
  if (!iso) return 'NO REMINDER';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'NO REMINDER';

  const now = new Date();
  if (date.getTime() < now.getTime()) return 'OVERDUE';
  if (sameCalendarDay(date, now)) return 'TODAY';
  return 'UPCOMING';
}

function sortFollowUps(a: MemoryPerson, b: MemoryPerson) {
  const aTime = a.followUp?.reminderAt ? new Date(a.followUp.reminderAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.followUp?.reminderAt ? new Date(b.followUp.reminderAt).getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
}

export default function App() {
  const [people, setPeople] = usePersistentPeople(mockPeople);
  const { openSettings } = useOwnerControls();
  const [screen, setScreen] = useState<Screen>('home');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(mockPeople[0]?.id ?? null);
  const [briefing, setBriefing] = useState('');
  const [interactionText, setInteractionText] = useState('');
  const [memoryText, setMemoryText] = useState('');
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);

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
        person.followUp?.text,
        ...person.notes,
        ...person.interactions.map((item) => item.summary),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [people, query]);

  const openFollowUps = useMemo(
    () => people.filter((person) => Boolean(person.followUp)).sort(sortFollowUps),
    [people],
  );

  const recentMemory = useMemo(() => {
    for (const person of people) {
      const interaction = person.interactions[0];
      if (interaction) return { person, interaction };
    }
    return null;
  }, [people]);

  useEffect(() => {
    function openFromNotification(response: Notifications.NotificationResponse) {
      const data = response.notification.request.content.data;
      const personId = typeof data?.personId === 'string' ? data.personId : null;
      if (!personId) return;

      setSelectedId(personId);
      setBriefing('');
      setInteractionText('');
      setMemoryText('');
      setScreen('detail');
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openFromNotification(response);
    });

    return () => subscription.remove();
  }, []);

  function openPerson(id: string) {
    setSelectedId(id);
    setBriefing('');
    setInteractionText('');
    setMemoryText('');
    setScreen('detail');
  }

  function openAddPerson() {
    setForm(emptyForm);
    setPickerMode(null);
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
      followUp: selected.followUp?.text ?? '',
      followUpReminderAt: selected.followUp?.reminderAt ?? '',
    });
    setPickerMode(null);
    setScreen('edit');
  }

  async function buildFollowUp(
    personId: string,
    personName: string,
    existing?: MemoryFollowUp,
  ): Promise<MemoryFollowUp | undefined> {
    const text = form.followUp.trim();
    if (!text) return undefined;

    const followUp: MemoryFollowUp = {
      id: existing?.id ?? `follow-up-${Date.now()}`,
      text,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      reminderAt: form.followUpReminderAt || undefined,
    };

    if (followUp.reminderAt) {
      const notificationId = await scheduleFollowUpNotification({
        personId,
        personName,
        followUpId: followUp.id,
        text: followUp.text,
        reminderAt: followUp.reminderAt,
      });

      if (notificationId) {
        followUp.notificationId = notificationId;
      } else if (new Date(followUp.reminderAt).getTime() > Date.now()) {
        Alert.alert(
          'Reminder saved',
          'The follow-up was saved, but the phone could not schedule a notification. Check notification permission for AI Memory.',
        );
      }
    }

    return followUp;
  }

  async function addPerson() {
    if (!form.name.trim()) return;

    const id = `person-${Date.now()}`;
    const followUp = await buildFollowUp(id, form.name.trim());
    const person: MemoryPerson = {
      id,
      name: form.name.trim(),
      role: form.role.trim() || undefined,
      company: form.company.trim() || undefined,
      relationship: form.relationship.trim() || 'New contact',
      lastInteraction: 'No interactions yet',
      notes: form.note.trim() ? [form.note.trim()] : [],
      followUp,
      followUpHistory: [],
      interactions: [],
    };

    setPeople((current) => [person, ...current]);
    setForm(emptyForm);
    setPickerMode(null);
    setSelectedId(id);
    setBriefing('');
    setScreen('detail');
  }

  async function saveEditedPerson() {
    if (!selected || !form.name.trim()) return;

    await cancelFollowUpNotification(selected.followUp?.notificationId);
    const nextFollowUp = await buildFollowUp(selected.id, form.name.trim(), selected.followUp);

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
          followUp: nextFollowUp,
        };
      }),
    );
    setBriefing('');
    setPickerMode(null);
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

  async function completeFollowUp() {
    if (!selected?.followUp) return;

    const completed = selected.followUp;
    await cancelFollowUpNotification(completed.notificationId);

    setPeople((current) =>
      current.map((person) =>
        person.id === selected.id
          ? {
              ...person,
              followUp: undefined,
              followUpHistory: [
                {
                  ...completed,
                  completedAt: new Date().toISOString(),
                  notificationId: undefined,
                },
                ...(person.followUpHistory ?? []),
              ],
            }
          : person,
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
            void cancelFollowUpNotification(selected.followUp?.notificationId).finally(() => {
              setPeople((current) => current.filter((person) => person.id !== selected.id));
              setSelectedId(null);
              setBriefing('');
              setScreen('home');
            });
          },
        },
      ],
    );
  }

  function setReminder(date?: Date) {
    setForm((current) => ({
      ...current,
      followUpReminderAt: date ? date.toISOString() : '',
    }));
  }

  function openCustomReminderPicker() {
    if (!form.followUpReminderAt) setReminder(defaultCustomReminder());
    setPickerMode(Platform.OS === 'ios' ? 'datetime' : 'date');
  }

  function handleReminderPicker(event: DateTimePickerEvent, picked?: Date) {
    if (event.type === 'dismissed' || !picked) {
      if (Platform.OS === 'android') setPickerMode(null);
      return;
    }

    const current = form.followUpReminderAt
      ? new Date(form.followUpReminderAt)
      : defaultCustomReminder();

    if (pickerMode === 'datetime') {
      setReminder(picked);
      return;
    }

    if (pickerMode === 'date') {
      const next = new Date(picked);
      next.setHours(current.getHours(), current.getMinutes(), 0, 0);
      setReminder(next);
      setPickerMode('time');
      return;
    }

    if (pickerMode === 'time') {
      const next = new Date(current);
      next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      setPickerMode(null);

      if (next.getTime() <= Date.now()) {
        Alert.alert('Choose a future time', 'The reminder time needs to be in the future.');
        return;
      }

      setReminder(next);
    }
  }

  if (screen === 'add' || screen === 'edit') {
    const isEdit = screen === 'edit';
    const pickerValue = form.followUpReminderAt
      ? new Date(form.followUpReminderAt)
      : defaultCustomReminder();

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
          <Field label="NAME *" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} />
          <Field label="ROLE" value={form.role} onChange={(role) => setForm((current) => ({ ...current, role }))} />
          <Field label="COMPANY" value={form.company} onChange={(company) => setForm((current) => ({ ...current, company }))} />
          <Field
            label="HOW DO YOU KNOW THEM?"
            value={form.relationship}
            onChange={(relationship) => setForm((current) => ({ ...current, relationship }))}
          />
          <Field
            label={isEdit ? 'PRIMARY MEMORY' : 'FIRST MEMORY'}
            value={form.note}
            onChange={(note) => setForm((current) => ({ ...current, note }))}
            multiline
          />
          <Field
            label="FOLLOW-UP"
            value={form.followUp}
            onChange={(followUp) => setForm((current) => ({ ...current, followUp }))}
            multiline
          />

          {form.followUp.trim() ? (
            <View style={styles.reminderBox}>
              <View style={styles.reminderHeader}>
                <View style={styles.flex}>
                  <Text style={styles.followUpLabel}>REMIND ME</Text>
                  <Text style={styles.reminderValue}>{formatReminder(form.followUpReminderAt)}</Text>
                </View>
                {form.followUpReminderAt ? (
                  <Pressable onPress={() => setReminder()} style={styles.clearReminder}>
                    <Text style={styles.clearReminderText}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.reminderChips}>
                <ReminderChip label="In 1 hour" onPress={() => setReminder(new Date(Date.now() + 60 * 60 * 1000))} />
                <ReminderChip label="Tomorrow 09:00" onPress={() => setReminder(reminderAtTomorrow())} />
                <ReminderChip label="In 3 days" onPress={() => setReminder(reminderAtDaysFromNow(3))} />
                <ReminderChip label="Pick date & time" onPress={openCustomReminderPicker} />
              </View>

              {pickerMode ? (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={pickerValue}
                    mode={pickerMode}
                    minimumDate={new Date()}
                    onChange={handleReminderPicker}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  />
                  {Platform.OS === 'ios' ? (
                    <Pressable style={styles.pickerDone} onPress={() => setPickerMode(null)}>
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          <Action
            label={isEdit ? 'Save changes' : 'Save person'}
            onPress={isEdit ? () => void saveEditedPerson() : () => void addPerson()}
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
              <View style={styles.followUpTopRow}>
                <Text style={styles.followUpLabel}>NEXT STEP</Text>
                <Text style={[
                  styles.followUpStatus,
                  reminderStatus(selected.followUp.reminderAt) === 'OVERDUE' && styles.followUpStatusOverdue,
                ]}>
                  {reminderStatus(selected.followUp.reminderAt)}
                </Text>
              </View>
              <Text style={styles.followUpText}>{selected.followUp.text}</Text>
              <Text style={styles.followUpReminder}>⏰ {formatReminder(selected.followUp.reminderAt)}</Text>
              <View style={styles.followUpActions}>
                <Pressable onPress={() => void completeFollowUp()} style={styles.followUpDone}>
                  <Text style={styles.followUpDoneText}>✓ Mark completed</Text>
                </Pressable>
                <Pressable onPress={openEditPerson} style={styles.followUpEdit}>
                  <Text style={styles.followUpEditText}>Edit reminder</Text>
                </Pressable>
              </View>
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

        {selected.followUpHistory?.length ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Completed follow-ups</Text>
              <Text style={styles.muted}>{selected.followUpHistory.length} done</Text>
            </View>
            {selected.followUpHistory.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <Text style={styles.historyDate}>✓ COMPLETED</Text>
                <Text style={styles.historyText}>{item.text}</Text>
                <Text style={styles.source}>
                  {item.completedAt ? new Date(item.completedAt).toLocaleString() : 'Completed'}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </Page>
    );
  }

  return (
    <Page>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.brand}>AI MEMORY</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={openSettings}
            style={styles.settingsButton}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Remember people. Remember context.</Text>
        <Text style={styles.sub}>Your private social memory layer for conversations and follow-ups.</Text>
      </View>

      <View style={styles.stats}>
        <Stat value={people.length} label="People" />
        <Stat value={people.reduce((sum, p) => sum + p.interactions.length, 0)} label="Interactions" />
        <Stat value={openFollowUps.length} label="Open follow-ups" />
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
        <Label text="FOLLOW-UPS" />
        <Text style={styles.cardTitle}>
          {openFollowUps.length
            ? `${openFollowUps.length} open follow-up${openFollowUps.length === 1 ? '' : 's'}.`
            : 'You are caught up.'}
        </Text>
        <Text style={styles.body}>
          {openFollowUps.length
            ? 'Overdue and time-sensitive follow-ups are shown first.'
            : 'No open follow-ups right now. Add one from any person profile.'}
        </Text>

        {openFollowUps.slice(0, 3).map((person) => (
          <Pressable
            key={`follow-up-${person.id}`}
            onPress={() => openPerson(person.id)}
            style={styles.todayRow}
          >
            <View style={[
              styles.todayDot,
              reminderStatus(person.followUp?.reminderAt) === 'OVERDUE' && styles.todayDotOverdue,
            ]} />
            <View style={styles.flex}>
              <View style={styles.todayTopRow}>
                <Text style={styles.todayName}>{person.name}</Text>
                <Text style={[
                  styles.todayStatus,
                  reminderStatus(person.followUp?.reminderAt) === 'OVERDUE' && styles.todayStatusOverdue,
                ]}>
                  {reminderStatus(person.followUp?.reminderAt)}
                </Text>
              </View>
              <Text style={styles.todayText} numberOfLines={2}>{person.followUp?.text}</Text>
              <Text style={styles.todayReminder}>{formatReminder(person.followUp?.reminderAt)}</Text>
            </View>
            <Text style={styles.todayChevron}>›</Text>
          </Pressable>
        ))}

        {recentMemory ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open recent memory for ${recentMemory.person.name}`}
            onPress={() => openPerson(recentMemory.person.id)}
            style={styles.recentMemory}
          >
            <Text style={styles.recentLabel}>RECENT MEMORY</Text>
            <Text style={styles.recentName}>{recentMemory.person.name}</Text>
            <Text style={styles.recentText} numberOfLines={3}>{recentMemory.interaction.summary}</Text>
            <Text style={styles.recentDate}>{recentMemory.interaction.date}</Text>
          </Pressable>
        ) : null}
      </Card>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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

function ReminderChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.reminderChip}>
      <Text style={styles.reminderChipText}>{label}</Text>
    </Pressable>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0F14' },
  container: { padding: 20, paddingBottom: 72, gap: 12 },
  flex: { flex: 1 },
  hero: { marginTop: 10, marginBottom: 8 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: 4 },
  brand: { color: '#7DE2C3', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121820',
    borderWidth: 1,
    borderColor: '#293541',
  },
  settingsIcon: { color: '#AAB5BE', fontSize: 21, fontWeight: '900' },
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
  followUpTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  followUpLabel: { color: '#67D9B6', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 },
  followUpStatus: { color: '#7DE2C3', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  followUpStatusOverdue: { color: '#F18B91' },
  followUpText: { color: '#D9F5EC', lineHeight: 20 },
  followUpReminder: { color: '#8FB4A9', fontSize: 11, fontWeight: '800', marginTop: 8 },
  followUpActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  followUpDone: { borderRadius: 10, borderWidth: 1, borderColor: '#315B4F', paddingHorizontal: 10, paddingVertical: 7 },
  followUpDoneText: { color: '#7DE2C3', fontSize: 11, fontWeight: '900' },
  followUpEdit: { borderRadius: 10, borderWidth: 1, borderColor: '#293541', paddingHorizontal: 10, paddingVertical: 7 },
  followUpEditText: { color: '#AAB5BE', fontSize: 11, fontWeight: '900' },
  followUpComplete: { color: '#75818D', fontSize: 12, marginTop: 12 },
  reminderBox: { backgroundColor: '#0E151B', borderRadius: 16, borderWidth: 1, borderColor: '#24323C', padding: 13, marginTop: 2, marginBottom: 8 },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reminderValue: { color: '#D9F5EC', fontSize: 13, fontWeight: '800', marginTop: 2 },
  reminderChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  reminderChip: { backgroundColor: '#13231F', borderRadius: 999, borderWidth: 1, borderColor: '#315B4F', paddingHorizontal: 10, paddingVertical: 8 },
  reminderChipText: { color: '#7DE2C3', fontSize: 11, fontWeight: '800' },
  clearReminder: { paddingHorizontal: 8, paddingVertical: 6 },
  clearReminderText: { color: '#F18B91', fontSize: 11, fontWeight: '800' },
  pickerWrap: { backgroundColor: '#0B0F14', borderRadius: 14, marginTop: 10, overflow: 'hidden' },
  pickerDone: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 9 },
  pickerDoneText: { color: '#7DE2C3', fontWeight: '900' },
  historyCard: { backgroundColor: '#10171E', borderRadius: 17, borderWidth: 1, borderColor: '#1D2832', padding: 15 },
  historyDate: { color: '#7DE2C3', fontSize: 11, fontWeight: '900', marginBottom: 6 },
  historyText: { color: '#C0C9D2', lineHeight: 20 },
  source: { color: '#66727E', fontSize: 9, marginTop: 8, fontWeight: '800' },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E151B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#223039',
    padding: 12,
    marginTop: 10,
  },
  todayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7DE2C3', marginRight: 11 },
  todayDotOverdue: { backgroundColor: '#F18B91' },
  todayTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  todayName: { color: '#E9EEF2', fontSize: 13, fontWeight: '900' },
  todayStatus: { color: '#7DE2C3', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  todayStatusOverdue: { color: '#F18B91' },
  todayText: { color: '#8E9AA5', fontSize: 12, lineHeight: 18, marginTop: 3 },
  todayReminder: { color: '#668F83', fontSize: 10, fontWeight: '800', marginTop: 5 },
  todayChevron: { color: '#66727E', fontSize: 24, marginLeft: 8 },
  recentMemory: {
    backgroundColor: '#10251F',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#315B4F',
    padding: 13,
    marginTop: 12,
  },
  recentLabel: { color: '#67D9B6', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  recentName: { color: '#E7F8F2', fontSize: 14, fontWeight: '900', marginTop: 6 },
  recentText: { color: '#9FC2B8', fontSize: 12, lineHeight: 18, marginTop: 4 },
  recentDate: { color: '#668F83', fontSize: 10, fontWeight: '800', marginTop: 8 },
});
