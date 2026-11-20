import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useOwnerControls } from './src/components/OwnerProfileGate';
import { MemorySaveNotice } from './src/components/MemorySaveNotice';
import { DailyBriefingCard } from './src/components/DailyBriefingCard';
import { LifeAdminPanel } from './src/components/LifeAdminPanel';
import { GroundedAssistantPanel } from './src/components/GroundedAssistantPanel';
import { NOTEBOOK_PRODUCTION_ENABLED, useNotebookLifecycle } from './src/components/NotebookBoundary';
import { NotebookPanel } from './src/components/NotebookPanel';
import { PersonHistory } from './src/components/PersonHistory';
import { latestDatedInteraction, recentPersonMemory } from './src/utils/personHistory';
import { mockPeople } from './src/data/mockPeople';
import { usePersistentPeople, type PeopleSaveState } from './src/hooks/usePersistentPeople';
import { MemoryFollowUp, MemoryPerson } from './src/types';
import { buildMemoryBriefing } from './src/utils/buildMemoryBriefing';
import { createInteractionTimestamp, formatInteractionDate } from './src/utils/interactionDates';
import { planReminderEdit } from './src/utils/reminderEditDecision';
import { useI18n } from './src/i18n/LanguageProvider';
import { useTheme } from './src/theme/ThemeProvider';
import { useUnsavedChanges } from './src/hooks/useUnsavedChanges';
import { AppHeader } from './src/components/ui/AppHeader';
import { DigitalTimeInput } from './src/components/ui/DigitalTimeInput';
import { applyDigitalReminderTime, digitalReminderFields } from './src/utils/digitalReminderTime';
import type { appEn } from './src/i18n/catalogs/app';
import { normalizeStandardPhone } from './src/utils/standardPhone';
import {
  cancelFollowUpNotification,
  scheduleFollowUpNotification,
} from './src/utils/followUpNotifications';

type Screen = 'home' | 'detail' | 'add' | 'edit' | 'notebook' | 'life' | 'assistant';
type PickerMode = 'date' | 'time' | null;
type PersonOperation = 'save' | 'complete' | 'delete' | 'add' | 'note' | 'interaction';
type PersonForm = {
  name: string;
  role: string;
  company: string;
  phone: string;
  relationship: string;
  note: string;
  followUp: string;
  followUpReminderAt: string;
};

const emptyForm: PersonForm = {
  name: '',
  role: '',
  company: '',
  phone: '',
  relationship: '',
  note: '',
  followUp: '',
  followUpReminderAt: '',
};

function formFromPerson(person: MemoryPerson): PersonForm {
  return { name: person.name, role: person.role ?? '', company: person.company ?? '',
    phone: person.phone ?? '', relationship: person.relationship, note: person.notes[0] ?? '',
    followUp: person.followUp?.text ?? '', followUpReminderAt: person.followUp?.reminderAt ?? '' };
}

function meaningfulForm(form: PersonForm) {
  return JSON.stringify(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])));
}

function pickerSignature(date: Date, fields: { hour: string; minute: string }) {
  return JSON.stringify([date.getFullYear(), date.getMonth(), date.getDate(), fields.hour, fields.minute]);
}

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

function formatReminder(iso: string | undefined, c: typeof appEn, locale: string) {
  if (!iso) return c.noReminder;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return c.noReminder;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const dateText = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });

  if (date.getTime() < now.getTime()) return c.overdueReminder(dateText, time);
  if (sameCalendarDay(date, now)) return c.todayReminder(time);
  if (sameCalendarDay(date, tomorrow)) return c.tomorrowReminder(time);
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

function sameFollowUp(a: MemoryFollowUp | undefined, b: MemoryFollowUp | undefined) {
  return a === b || Boolean(a && b && a.id === b.id && a.text === b.text &&
    a.createdAt === b.createdAt && a.reminderAt === b.reminderAt &&
    a.notificationId === b.notificationId && a.completedAt === b.completedAt);
}

function samePerson(a: MemoryPerson | undefined, b: MemoryPerson) {
  return Boolean(a && JSON.stringify(a) === JSON.stringify(b));
}

export default function App() {
  const { copy, locale, language } = useI18n();
  const c = copy.app;
  const { theme } = useTheme();
  const styles = useAppStyles();
  const [people, setPeople, isReady, loadError, saveState] = usePersistentPeople(mockPeople);
  const { openSettings } = useOwnerControls();
  const notebookLifecycle = useNotebookLifecycle();
  const [screen, setScreen] = useState<Screen>('home');
  const [lifeTarget, setLifeTarget] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(mockPeople[0]?.id ?? null);
  const [briefing, setBriefing] = useState('');
  const [interactionText, setInteractionText] = useState('');
  const [memoryText, setMemoryText] = useState('');
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerDraft, setPickerDraft] = useState<Date>(defaultCustomReminder);
  const [pickerFields, setPickerFields] = useState(() => digitalReminderFields(pickerDraft));
  const pickerBaseline = useRef<string | null>(null);
  const drafts = useRef({ form, memoryText, interactionText, pickerDraft, pickerFields, pickerMode });
  drafts.current = { form, memoryText, interactionText, pickerDraft, pickerFields, pickerMode };
  const [busy, setBusy] = useState<PersonOperation | null>(null);
  const operation = useRef<PersonOperation | null>(null);
  const mounted = useRef(true);
  const saveLifetime = useRef(new AbortController());
  const editBase = useRef<MemoryPerson | null>(null);
  const latestPeople = useRef(people);
  const view = useRef({ screen, selectedId });
  const pendingChange = useRef<{
    before: MemoryPerson[];
    accepted: (next: MemoryPerson[]) => boolean;
    resolve: (accepted: boolean) => void;
    afterSaved?: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    mounted.current = true;
    saveLifetime.current = new AbortController();
    return () => {
      mounted.current = false;
      saveLifetime.current.abort();
      pendingChange.current?.resolve(false);
      pendingChange.current = null;
    };
  }, []);

  useEffect(() => {
    latestPeople.current = people;
    view.current = { screen, selectedId };
    const pending = pendingChange.current;
    if (pending && people !== pending.before) {
      pendingChange.current = null;
      if (!pending.accepted(people)) pending.resolve(false);
      else {
        // Native cleanup follows acknowledged final bytes even if App Lock
        // detaches this editor. The queue settles superseded waiters as false.
        const cleanup = pending.afterSaved
          ? saveState.confirm(people).then(async saved => { if (saved) await pending.afterSaved?.(); })
          : Promise.resolve();
        void saveState.confirm(people, saveLifetime.current.signal).then(async saved => {
          if (saved) await cleanup;
          pending.resolve(saved && mounted.current);
        });
      }
    }
  }, [people, screen, selectedId]);

  function beginOperation(kind: PersonOperation) {
    if (!mounted.current || operation.current || saveState.getStatus() !== 'idle') return false;
    operation.current = kind;
    setBusy(kind);
    return true;
  }

  function finishOperation() {
    operation.current = null;
    if (mounted.current) setBusy(null);
  }

  // Accept the immutable revision, then wait for the single writer's exact
  // AsyncStorage acknowledgement. This is not native crash durability or a
  // transaction with notifications. Updaters stay pure under React replay.
  function changePeople(update: (current: MemoryPerson[]) => MemoryPerson[],
    accepted: (next: MemoryPerson[]) => boolean, afterSaved?: () => Promise<void>): Promise<boolean> {
    if (!mounted.current || saveState.getStatus() !== 'idle') return Promise.resolve(false);
    return new Promise(resolve => {
      pendingChange.current = { before: latestPeople.current, accepted, resolve, afterSaved };
      setPeople(update);
    });
  }

  const selected = useMemo(
    () => people.find((person) => person.id === selectedId) ?? null,
    [people, selectedId],
  );

  const briefingText = useMemo(
    () => briefing && selected ? buildMemoryBriefing(selected, new Date(), locale) : '',
    [briefing, selected, locale],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;

    return people.filter((person) =>
      [
        person.name,
        person.role,
        person.company,
        person.phone,
        person.relationship,
        person.followUp?.text,
        ...person.notes,
        ...person.interactions.map((item) => item.summary),
        ...(person.followUpHistory ?? []).map((item) => item.text),
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

  const recentMemory = useMemo(() => recentPersonMemory(people), [people]);

  // Every input callback rejects changes synchronously during an operation.
  // This also fences the two-step detail save, whose own intermediate draft
  // clearing must not invalidate Save and exit before React's next render.
  const { requestExit } = useUnsavedChanges({
    // An accessor sees native text events immediately, including Back delivered
    // before React renders the new controlled value. These refs are never stored.
    get dirty() {
      const next = drafts.current;
      if (screen === 'detail') return Boolean(next.memoryText.trim() || next.interactionText.trim());
      if (screen !== 'add' && screen !== 'edit') return false;
      return meaningfulForm(next.form) !== meaningfulForm(
        screen === 'edit' && editBase.current ? formFromPerson(editBase.current) : emptyForm)
        || (next.pickerMode !== null && pickerSignature(next.pickerDraft, next.pickerFields) !== pickerBaseline.current);
    },
    busy: busy !== null,
    enabled: isReady && !loadError && ['home', 'add', 'edit', 'detail'].includes(screen),
    save: async () => {
      if (screen === 'add') return addPerson();
      if (screen === 'edit') return saveEditedPerson();
      if (drafts.current.memoryText.trim() && !await addMemoryNote()) return false;
      if (drafts.current.interactionText.trim() && !await addInteraction()) return false;
      return true;
    },
    discard: () => {
      drafts.current.form = emptyForm; drafts.current.memoryText = ''; drafts.current.interactionText = '';
      setForm(emptyForm); setMemoryText(''); setInteractionText(''); closePicker();
    },
    onBack: screen === 'home' ? undefined : () => setScreen(screen === 'edit' ? 'detail' : 'home'),
  });
  // Notification listeners live for this mount; always consult the current
  // editor/operation rather than the clean first-render closure.
  const navigation = useRef(requestExit);
  navigation.current = requestExit;

  useEffect(() => {
    function openFromNotification(response: Notifications.NotificationResponse) {
      if (!mounted.current) return;
      const data = response.notification.request.content.data;
      const personId = typeof data?.personId === 'string' ? data.personId : null;
      if (!personId) return;

      navigation.current(() => {
        setSelectedId(personId);
        setBriefing('');
        setInteractionText('');
        setMemoryText('');
        setScreen('detail');
      });
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openFromNotification(response);
    });

    return () => subscription.remove();
  }, []);

  function openPerson(id: string) {
    requestExit(() => {
      setSelectedId(id);
      setBriefing('');
      setInteractionText('');
      setMemoryText('');
      setScreen('detail');
    });
  }

  async function openContactAction(action: 'call' | 'sms' | 'whatsapp') {
    const raw = selected?.phone?.trim() ?? '';
    if (!/^\+?[0-9 ()-]+$/.test(raw)) {
      Alert.alert(c.checkPhone, c.phoneCharacters);
      return;
    }
    const number = raw.replace(/[ ()-]/g, '');
    if (!/^\+?[0-9]{3,15}$/.test(number)) {
      Alert.alert(c.checkPhone, c.validPhone);
      return;
    }
    if (action === 'whatsapp' && !/^\+[1-9][0-9]{6,14}$/.test(number)) {
      Alert.alert(c.internationalRequired, c.whatsappCountry);
      return;
    }
    const url = action === 'call' ? 'tel:' + number :
      action === 'sms' ? 'sms:' + number : 'https://wa.me/' + number.slice(1);
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(c.openAppError, c.compatibleApp);
    }
  }

  function exportContact() {
    if (!selected || !selected.phone) return;
    const name = selected.name.replace(/\s*\(AI Memory\)\s*$/i, '').trim() + ' (AI Memory)';
    const phone = selected.phone.trim();
    if (!/^\+?[0-9 ()-]+$/.test(phone) || !/^\+?[0-9]{3,15}$/.test(phone.replace(/[ ()-]/g, ''))) {
      Alert.alert(c.checkPhone, c.exportPhone);
      return;
    }
    if (Platform.OS !== 'android') {
      Alert.alert(c.unavailable, c.androidContacts);
      return;
    }
    Alert.alert(c.exportTitle, c.exportConsent, [
      { text: c.cancel, style: 'cancel' },
      { text: c.contactsEditor, onPress: () => {
        void IntentLauncher.startActivityAsync('android.intent.action.INSERT', {
          type: 'vnd.android.cursor.dir/contact',
          extra: { name, phone, company: selected.company ?? '', job_title: selected.role ?? '' },
        }).catch(() => Alert.alert(c.contactsError, c.contactsRetry));
      } },
    ]);
  }

  function openAddPerson() {
    if (!mounted.current || operation.current || saveState.getStatus() !== 'idle') return;
    requestExit(() => {
      if (saveState.getStatus() !== 'idle') return;
      editBase.current = null;
      setForm(emptyForm);
      setPickerMode(null);
      setScreen('add');
    });
  }

  function openEditPerson() {
    if (!selected || !mounted.current || operation.current || saveState.getStatus() !== 'idle') return;

    const personId = selected.id;
    requestExit(() => {
      if (saveState.getStatus() !== 'idle') return;
      const current = latestPeople.current.find(person => person.id === personId);
      if (!current) return;
      // Retain the full revision, including notes/history.
      editBase.current = current;
      setForm(formFromPerson(current));
      setPickerMode(null);
      setScreen('edit');
    });
  }

  async function buildFollowUp(
    personId: string,
    personName: string,
    draft: PersonForm,
    existing?: MemoryFollowUp,
  ): Promise<MemoryFollowUp | undefined> {
    const text = draft.followUp.trim();
    if (!text) return undefined;

    const followUp: MemoryFollowUp = {
      id: existing?.id ?? `follow-up-${Date.now()}`,
      text,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      reminderAt: draft.followUpReminderAt || undefined,
    };

    if (followUp.reminderAt) {
      const notificationId = await scheduleFollowUpNotification({
        language,
        personId,
        personName,
        followUpId: followUp.id,
        text: followUp.text,
        reminderAt: followUp.reminderAt,
      });

      if (notificationId) {
        followUp.notificationId = notificationId;
      } else if (mounted.current && new Date(followUp.reminderAt).getTime() > Date.now()) {
        Alert.alert(
          c.reminderSaved,
          c.scheduleUnavailable,
        );
      }
    }

    return followUp;
  }

  async function addPerson(): Promise<boolean> {
    if (!mounted.current || operation.current) return false;
    const draft = formForSave();
    if (!draft?.name.trim()) return false;
    let phone: string | undefined;
    try {
      phone = normalizeStandardPhone(draft.phone);
    } catch {
      Alert.alert(c.checkPhone, c.phoneFormat);
      return false;
    }

    if (!beginOperation('add')) return false;
    try {
      const id = `person-${Date.now()}`;
      const followUp = await buildFollowUp(id, draft.name.trim(), draft);
      if (!mounted.current) {
        await cancelFollowUpNotification(followUp?.notificationId);
        return false;
      }
      const person: MemoryPerson = {
        id,
        name: draft.name.trim(),
        role: draft.role.trim() || undefined,
        company: draft.company.trim() || undefined,
        phone,
        relationship: draft.relationship.trim() || c.newContact,
        lastInteraction: c.noInteractionsValue,
        notes: draft.note.trim() ? [draft.note.trim()] : [],
        followUp,
        followUpHistory: [],
        interactions: [],
      };

      const applied = await changePeople((current) => [person, ...current], next => next.includes(person));
      if (!applied || !mounted.current || view.current.screen !== 'add') return false;
      setForm(emptyForm);
      setPickerMode(null);
      setSelectedId(id);
      setBriefing('');
      setScreen('detail');
      return true;
    } finally {
      finishOperation();
    }
  }

  async function saveEditedPerson(): Promise<boolean> {
    if (!selected || !mounted.current || operation.current) return false;
    const draft = formForSave();
    if (!draft?.name.trim()) return false;
    const base = editBase.current;
    if (!base || selected.id !== base.id || !samePerson(latestPeople.current.find(person => person.id === base.id), base)) {
      Alert.alert(c.personChanged, c.draftKept);
      return false;
    }
    let phone: string | undefined;
    try {
      phone = normalizeStandardPhone(draft.phone);
    } catch {
      Alert.alert(c.checkPhone, c.phoneFormat);
      return false;
    }

    const nextName = draft.name.trim();
    const nextText = draft.followUp.trim();
    const nextReminderAt = draft.followUpReminderAt || undefined;
    const oldFollowUp = base.followUp;

    const reminderPlan = planReminderEdit({
      current: oldFollowUp,
      nextText,
      nextReminderAt,
      personNameChanged: nextName !== base.name,
      nowMs: Date.now(),
    });

    if (reminderPlan === 'invalid' || reminderPlan === 'expired') {
      Alert.alert(
        c.futureReminder,
        c.pastReminder,
      );
      return false;
    }

    if (!beginOperation('save')) return false;
    try {
      let nextFollowUp: MemoryFollowUp | undefined;
      let createdNotificationId: string | undefined;

      if (nextText) {
        nextFollowUp = {
          id: oldFollowUp?.id ?? `follow-up-${Date.now()}`,
          text: nextText,
          createdAt: oldFollowUp?.createdAt ?? new Date().toISOString(),
          reminderAt: nextReminderAt,
        };

        if (reminderPlan === 'reuse') {
          nextFollowUp.notificationId = oldFollowUp?.notificationId;
        } else if (reminderPlan === 'schedule' && nextReminderAt) {
          // Schedule first: an error must never cancel a valid existing reminder.
          const newNotificationId = await scheduleFollowUpNotification({
            language,
            personId: base.id,
            personName: nextName,
            followUpId: nextFollowUp.id,
            text: nextFollowUp.text,
            reminderAt: nextReminderAt,
          });

          if (!mounted.current) {
            if (newNotificationId) await cancelFollowUpNotification(newNotificationId);
            return false;
          }
          if (!newNotificationId) {
            Alert.alert(
              c.reminderNotUpdated,
              c.previousNotCancelled,
            );
            return false;
          }

          nextFollowUp.notificationId = newNotificationId;
          createdNotificationId = newNotificationId;
        }
      }

      const firstNote = draft.note.trim();
      const replacement: MemoryPerson = {
        ...base,
        name: nextName,
        role: draft.role.trim() || undefined,
        company: draft.company.trim() || undefined,
        phone,
        relationship: draft.relationship.trim() || c.contact,
        notes: firstNote ? [firstNote, ...base.notes.slice(1)] : base.notes.slice(1),
        followUp: nextFollowUp,
      };
      const applied = await changePeople(current => current.map(person =>
        person.id === base.id && samePerson(person, base) ? replacement : person), next => next.includes(replacement),
      async () => {
        if (oldFollowUp?.notificationId && oldFollowUp.notificationId !== nextFollowUp?.notificationId) {
          await cancelFollowUpNotification(oldFollowUp.notificationId);
        }
      });
      if (!applied) {
        // An aborted UI waiter does not undo an intentional pending final save.
        // Only clean up a new alarm when the revision was actually rejected.
        if (!latestPeople.current.includes(replacement)) {
          if (createdNotificationId) await cancelFollowUpNotification(createdNotificationId);
          if (mounted.current) Alert.alert(c.personChanged, c.draftKept);
        }
        return false;
      }

      if (!mounted.current) return false;
      editBase.current = replacement;
      if (view.current.selectedId === base.id) {
        setBriefing('');
        setPickerMode(null);
        if (view.current.screen === 'edit') setScreen('detail');
      }

      if (reminderPlan === 'schedule' && oldFollowUp?.reminderAt) {
        Alert.alert(c.reminderUpdated, c.rescheduled);
      }
      return true;
    } finally {
      finishOperation();
    }
  }

  async function addInteraction(): Promise<boolean> {
    const text = drafts.current.interactionText.trim();
    if (!selected || !text || !beginOperation('interaction')) return false;
    const personId = selected.id;

    try {
      const timestamp = createInteractionTimestamp();
      const interaction = { id: `interaction-${Date.now()}`, date: timestamp, summary: text, source: 'manual' as const };
      const applied = await changePeople(current => current.map(person => person.id === personId
        ? { ...person, lastInteraction: timestamp, interactions: [interaction, ...person.interactions] }
        : person), next => next.some(person => person.id === personId && person.interactions.includes(interaction)));
      if (!applied || !mounted.current || view.current.selectedId !== personId) return false;
      setInteractionText('');
      drafts.current.interactionText = '';
      setBriefing('');
      return true;
    } finally {
      finishOperation();
    }
  }

  async function addMemoryNote(): Promise<boolean> {
    const text = drafts.current.memoryText.trim();
    if (!selected || !text || !beginOperation('note')) return false;
    const personId = selected.id;

    try {
      const applied = await changePeople(current => current.map(person => person.id === personId
        ? { ...person, notes: [text, ...person.notes] }
        : person), next => next.some(person => person.id === personId));
      if (!applied || !mounted.current || view.current.selectedId !== personId) return false;
      setMemoryText('');
      drafts.current.memoryText = '';
      setBriefing('');
      return true;
    } finally {
      finishOperation();
    }
  }

  async function completeFollowUp() {
    if (!selected?.followUp || !beginOperation('complete')) return;

    try {
      const personId = selected.id;
      const completed = selected.followUp;
      const historyItem = { ...completed, completedAt: new Date().toISOString(), notificationId: undefined };

      await changePeople(current => current.map(person =>
        person.id === personId && sameFollowUp(person.followUp, completed)
          ? { ...person, followUp: undefined, followUpHistory: [historyItem, ...(person.followUpHistory ?? [])] }
          : person), next => next.some(person => person.id === personId && person.followUpHistory?.includes(historyItem)),
      () => cancelFollowUpNotification(completed.notificationId));
      if (mounted.current && view.current.selectedId === personId) setBriefing('');
    } finally {
      finishOperation();
    }
  }

  function deleteSelectedPerson() {
    if (!selected || !mounted.current || operation.current || saveState.getStatus() !== 'idle') return;
    const base = selected;

    Alert.alert(
      c.deleteTitle,
      c.deleteMessage(selected.name),
      [
        { text: c.cancel, style: 'cancel' },
        {
          text: c.delete,
          style: 'destructive',
          onPress: () => {
            if (!mounted.current || operation.current) return;
            if (!samePerson(latestPeople.current.find(person => person.id === base.id), base)) {
              Alert.alert(c.personChanged, c.reviewDelete);
              return;
            }
            if (!beginOperation('delete')) return;
            void (async () => {
              try {
                const applied = await changePeople(current => current.filter(person =>
                  person.id !== base.id || !samePerson(person, base)), next => !next.some(person => person.id === base.id),
                () => cancelFollowUpNotification(base.followUp?.notificationId));
                if (!applied || !mounted.current || view.current.selectedId !== base.id) return;
                setSelectedId(null);
                setBriefing('');
                setScreen('home');
              } finally {
                finishOperation();
              }
            })();
          },
        },
      ],
    );
  }

  function setReminder(date?: Date) {
    if (!mounted.current || operation.current) return;
    const next = {
      ...drafts.current.form,
      followUpReminderAt: date ? date.toISOString() : '',
    };
    drafts.current.form = next;
    setForm(next);
    closePicker();
  }

  function changeForm(update: (current: PersonForm) => PersonForm) {
    if (!mounted.current || operation.current || saveState.getStatus() !== 'idle') return;
    const next = update(drafts.current.form);
    drafts.current.form = next;
    setForm(next);
  }

  function formForSave(): PersonForm | null {
    const current = drafts.current;
    if (current.pickerMode === null || !current.form.followUp.trim()
      || pickerSignature(current.pickerDraft, current.pickerFields) === pickerBaseline.current) return current.form;
    const result = applyDigitalReminderTime(current.pickerDraft, current.pickerFields.hour, current.pickerFields.minute);
    if (!result.ok) {
      Alert.alert(copy.timeEntry.title, copy.timeEntry[result.reason]);
      return null;
    }
    if (result.date.getTime() <= Date.now()) {
      Alert.alert(c.futureTime, c.futureTimeHelp);
      return null;
    }
    return { ...current.form, followUpReminderAt: result.date.toISOString() };
  }

  function closePicker() {
    if (!mounted.current || operation.current) return;
    drafts.current.pickerMode = null;
    setPickerMode(null);
  }

  function openCustomReminderPicker() {
    if (!mounted.current || operation.current) return;
    const date = drafts.current.form.followUpReminderAt ? new Date(drafts.current.form.followUpReminderAt) : defaultCustomReminder();
    const fields = digitalReminderFields(date);
    pickerBaseline.current = pickerSignature(date, fields);
    Object.assign(drafts.current, { pickerDraft: date, pickerFields: fields, pickerMode: 'date' });
    setPickerDraft(date);
    setPickerFields(fields);
    setPickerMode('date');
  }

  function handleReminderPicker(event: DateTimePickerEvent, picked?: Date) {
    if (!mounted.current || operation.current) return;
    if (event.type === 'dismissed' || !picked) {
      closePicker();
      return;
    }
    if (pickerMode === 'date') {
      const next = new Date(picked);
      // Carry the requested wall clock as raw fields. Applying setHours here
      // could silently turn a DST-gap 02:30 into 03:30 before validation.
      setPickerDraft(next);
      drafts.current.pickerDraft = next;
      if (Platform.OS !== 'ios') { drafts.current.pickerMode = 'time'; setPickerMode('time'); }
    }
  }

  function confirmReminderTime(next: Date) {
    if (!mounted.current || operation.current) return;
    if (!Number.isFinite(next.getTime()) || next.getTime() <= Date.now()) {
      Alert.alert(c.futureTime, c.futureTimeHelp);
      return;
    }
    setReminder(next);
  }

  if (loadError) {
    return (
      <Page>
        <Text style={styles.titleSmall}>{c.loadError}</Text>
        <Text style={styles.sub}>
          {c.loadErrorHelp}
        </Text>
      </Page>
    );
  }

  if (!isReady) {
    return (
      <Page>
        <Text style={styles.titleSmall}>{c.loading}</Text>
        <Text style={styles.sub}>{c.loadingHelp}</Text>
      </Page>
    );
  }

  if (screen === 'life') {
    return <LifeAdminPanel onBack={() => setScreen('home')} initialRecordId={lifeTarget}
      createId={async () => { const crypto = await import('expo-crypto'); return crypto.randomUUID(); }} />;
  }

  if (screen === 'assistant') {
    return <GroundedAssistantPanel people={people} onBack={() => setScreen('home')} onOpenPerson={openPerson}
      onOpenLife={id => { setLifeTarget(id); setScreen('life'); }} />;
  }

  if (screen === 'notebook' && NOTEBOOK_PRODUCTION_ENABLED && notebookLifecycle) {
    return <NotebookPanel lifecycle={notebookLifecycle} onBack={() => setScreen('home')}
      createId={async () => { const crypto = await import('expo-crypto'); return crypto.randomUUID(); }} />;
  }

  if (screen === 'add' || screen === 'edit') {
    const isEdit = screen === 'edit';
    return (
      <Page key={screen} saveState={saveState} busy={busy !== null}>
        <Back onPress={() => requestExit(() => setScreen(isEdit ? 'detail' : 'home'))} />
        <Text style={styles.titleSmall}>{isEdit ? c.editPerson : c.addPerson}</Text>
        <Text style={styles.sub}>
          {isEdit
            ? c.editHelp
            : c.addHelp}
        </Text>

        <Card>
          <Field label={c.nameLabel} value={form.name} editable={busy === null} onChange={(name) => changeForm((current) => ({ ...current, name }))} />
          <Field label={c.roleLabel} value={form.role} editable={busy === null} onChange={(role) => changeForm((current) => ({ ...current, role }))} />
          <Field label={c.companyLabel} value={form.company} editable={busy === null} onChange={(company) => changeForm((current) => ({ ...current, company }))} />
          <Field label={c.phoneLabel} value={form.phone} editable={busy === null} onChange={(phone) => changeForm((current) => ({ ...current, phone }))} keyboardType="phone-pad" />
          <Text style={styles.muted}>
            {c.phoneScope}
          </Text>
          <Field
            label={c.relationshipLabel}
            editable={busy === null}
            value={form.relationship}
            onChange={(relationship) => changeForm((current) => ({ ...current, relationship }))}
          />
          <Field
            label={isEdit ? c.primaryMemory : c.firstMemory}
            editable={busy === null}
            value={form.note}
            onChange={(note) => changeForm((current) => ({ ...current, note }))}
            multiline
          />
          <Field
            label={c.followUpLabel}
            editable={busy === null}
            value={form.followUp}
            onChange={(followUp) => changeForm((current) => ({ ...current, followUp }))}
            multiline
          />

          {form.followUp.trim() ? (
            <View style={styles.reminderBox}>
              <View style={styles.reminderHeader}>
                <View style={styles.flex}>
                  <Text style={styles.followUpLabel}>{c.remindMe}</Text>
                  <Text style={styles.reminderValue}>{formatReminder(form.followUpReminderAt, c, locale)}</Text>
                </View>
                {form.followUpReminderAt ? (
                  <Pressable onPress={() => setReminder()} style={styles.clearReminder}>
                    <Text style={styles.clearReminderText}>{c.clear}</Text>
                  </Pressable>
                ) : null}
              </View>

              {isEdit && form.followUpReminderAt && new Date(form.followUpReminderAt).getTime() <= Date.now() ? (
                <Text style={styles.muted}>
                  {c.previousPassed}
                </Text>
              ) : null}
              <View style={styles.reminderChips}>
                <ReminderChip label={c.tenMinutes} onPress={() => setReminder(new Date(Date.now() + 10 * 60 * 1000))} />
                <ReminderChip label={c.oneHour} onPress={() => setReminder(new Date(Date.now() + 60 * 60 * 1000))} />
                <ReminderChip label={c.tomorrowNine} onPress={() => setReminder(reminderAtTomorrow())} />
                <ReminderChip label={c.threeDays} onPress={() => setReminder(reminderAtDaysFromNow(3))} />
                <ReminderChip label={c.pickDate} onPress={openCustomReminderPicker} />
              </View>

              {pickerMode === 'date' ? (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    locale={locale}
                    themeVariant={theme.isDark ? 'dark' : 'light'}
                    accentColor={theme.colors.accent}
                    value={pickerDraft}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={handleReminderPicker}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  />
                  {Platform.OS === 'ios' ? (<>
                    <Pressable style={styles.pickerDone} onPress={closePicker}>
                      <Text style={styles.pickerDoneText}>{c.cancel}</Text>
                    </Pressable>
                    <Pressable style={styles.pickerDone} onPress={() => {
                      if (!mounted.current || operation.current) return;
                      drafts.current.pickerMode = 'time'; setPickerMode('time');
                    }}>
                      <Text style={styles.pickerDoneText}>{c.done}</Text>
                    </Pressable>
                  </>) : null}
                </View>
              ) : null}
              {pickerMode === 'time' && <DigitalTimeInput value={pickerDraft} fields={pickerFields}
                onFieldsChange={fields => {
                  if (mounted.current && !operation.current && saveState.getStatus() === 'idle') {
                    drafts.current.pickerFields = fields; setPickerFields(fields);
                  }
                }}
                onConfirm={confirmReminderTime} onCancel={closePicker} disabled={busy !== null} />}
            </View>
          ) : null}

          <Action
            label={busy === 'save' || busy === 'add' ? c.saving : isEdit ? c.saveChanges : c.savePerson}
            onPress={isEdit ? () => void saveEditedPerson() : () => void addPerson()}
            disabled={!form.name.trim() || busy !== null || saveState.status !== 'idle'}
          />
        </Card>
      </Page>
    );
  }

  if (screen === 'detail' && selected) {
    return (
      <Page key={screen} saveState={saveState} busy={busy !== null}>
        <Back onPress={() => requestExit(() => setScreen('home'))} />

        <View style={styles.profile}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>{selected.name[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>{selected.name}</Text>
          <Text style={styles.subCenter}>
            {[selected.role, selected.company].filter(Boolean).join(' · ') || c.contact}
          </Text>
          <Text style={styles.mutedCenter}>{selected.relationship}</Text>
          {selected.phone ? <Text style={styles.mutedCenter}>{c.phonePrefix} {selected.phone}</Text> : null}
          {selected.phone ? (
            <View style={styles.contactActions}>
              <MiniAction label={c.call} onPress={() => void openContactAction('call')} />
              <MiniAction label={c.whatsapp} onPress={() => void openContactAction('whatsapp')} />
              <MiniAction label={c.sms} onPress={() => void openContactAction('sms')} />
              <MiniAction label={c.saveContacts} onPress={exportContact} />
            </View>
          ) : null}
          <View style={styles.profileActions}>
            <MiniAction label={c.edit} onPress={openEditPerson} disabled={busy !== null || saveState.status !== 'idle'} />
            <MiniAction label={c.delete} onPress={deleteSelectedPerson} danger disabled={busy !== null || saveState.status !== 'idle'} />
          </View>
        </View>

        <Card>
          <Label text={c.rememberLabel} />
          {selected.notes.length ? (
            selected.notes.map((note, index) => (
              <Text key={`${note}-${index}`} style={styles.note}>• {note}</Text>
            ))
          ) : (
            <Text style={styles.muted}>{c.noNotes}</Text>
          )}

          <TextInput
            accessibilityLabel={c.memoryPlaceholder}
            value={memoryText}
            onChangeText={text => { if (mounted.current && !operation.current && saveState.getStatus() === 'idle') { drafts.current.memoryText = text; setMemoryText(text); } }}
            editable={busy === null && saveState.status === 'idle'}
            multiline
            placeholder={c.memoryPlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, styles.multilineSmall]}
          />
          <OutlineAction label={c.addNote} onPress={() => void addMemoryNote()} disabled={!memoryText.trim() || busy !== null || saveState.status !== 'idle'} />

          {selected.followUp ? (
            <View style={styles.followUp}>
              <View style={styles.followUpTopRow}>
                <Text style={styles.followUpLabel}>{c.nextStep}</Text>
                <Text style={[
                  styles.followUpStatus,
                  reminderStatus(selected.followUp.reminderAt) === 'OVERDUE' && styles.followUpStatusOverdue,
                ]}>
                  {c.reminderStatuses[reminderStatus(selected.followUp.reminderAt)]}
                </Text>
              </View>
              <Text style={styles.followUpText}>{selected.followUp.text}</Text>
              <Text style={styles.followUpReminder}>⏰ {formatReminder(selected.followUp.reminderAt, c, locale)}</Text>
              <View style={styles.followUpActions}>
                <Pressable onPress={() => void completeFollowUp()} disabled={busy !== null || saveState.status !== 'idle'} style={[styles.followUpDone, (busy !== null || saveState.status !== 'idle') && styles.disabled]}>
                  <Text style={styles.followUpDoneText}>{c.markCompleted}</Text>
                </Pressable>
                <Pressable onPress={openEditPerson} disabled={busy !== null || saveState.status !== 'idle'} style={[styles.followUpEdit, (busy !== null || saveState.status !== 'idle') && styles.disabled]}>
                  <Text style={styles.followUpEditText}>{c.editReminder}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.followUpComplete}>{c.noFollowUp}</Text>
          )}
        </Card>

        <Card>
          <Label text={c.briefingLabel} />
          <Text style={styles.cardTitle}>{c.whoPerson}</Text>
          <Text style={styles.body}>
            {briefingText || c.briefingHelp}
          </Text>
          <OutlineAction label={c.generateBriefing} onPress={() => setBriefing(buildMemoryBriefing(selected, new Date(), locale))} />
        </Card>

        <Card>
          <Label text={c.newInteraction} />
          <TextInput
            accessibilityLabel={c.interactionPlaceholder}
            value={interactionText}
            onChangeText={text => { if (mounted.current && !operation.current && saveState.getStatus() === 'idle') { drafts.current.interactionText = text; setInteractionText(text); } }}
            editable={busy === null && saveState.status === 'idle'}
            multiline
            placeholder={c.interactionPlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, styles.multiline]}
          />
          <Action label={c.addInteraction} onPress={() => void addInteraction()} disabled={!interactionText.trim() || busy !== null || saveState.status !== 'idle'} />
        </Card>

        <PersonHistory key={selected.id} interactions={selected.interactions} completed={selected.followUpHistory ?? []} />
      </Page>
    );
  }

  return (
    <Page key="home" saveState={saveState} busy={busy !== null}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.brand}>{c.brand}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.openSettings}
            onPress={() => requestExit(openSettings)}
            style={styles.settingsButton}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>{c.heroTitle}</Text>
        <Text style={styles.sub}>{c.heroHelp}</Text>
      </View>

      <View style={styles.stats}>
        <Stat value={people.length} label={c.people} />
        <Stat value={people.reduce((sum, p) => sum + p.interactions.length, 0)} label={c.interactions} />
        <Stat value={openFollowUps.length} label={c.openFollowUps} />
      </View>

      <Card>
        <Label text={c.searchLabel} />
        <TextInput
          accessibilityLabel={c.searchLabel}
          value={query}
          onChangeText={setQuery}
          placeholder={c.searchPlaceholder}
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
        />
      </Card>

      {!query.trim() && <DailyBriefingCard people={people} onOpenPerson={openPerson} />}
      <OutlineAction label={copy.lifeAdmin.title} onPress={() => requestExit(() => { setLifeTarget(undefined); setScreen('life'); })} />
      <OutlineAction label={copy.assistant.title} onPress={() => requestExit(() => setScreen('assistant'))} />
      {NOTEBOOK_PRODUCTION_ENABLED && notebookLifecycle && <OutlineAction label={c.notebookTitle} onPress={() => requestExit(() => setScreen('notebook'))} />}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{c.people}</Text>
          <Text style={styles.muted}>{c.matchingMemories(filtered.length)}</Text>
        </View>
        <Pressable style={[styles.addButton, (busy !== null || saveState.status !== 'idle') && styles.disabled]} onPress={openAddPerson} disabled={busy !== null || saveState.status !== 'idle'}>
          <Text style={styles.addButtonText}>{c.addPersonButton}</Text>
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
            {person.phone ? <Text style={styles.muted}>{c.phonePrefix} {person.phone}</Text> : null}
            {(person.role || person.company) && person.relationship ? (
              <Text style={styles.muted}>{person.relationship}</Text>
            ) : null}
            {person.notes[0] ? <Text style={styles.body} numberOfLines={2}>{person.notes[0]}</Text> : null}
            {person.followUp ? (
              <View>
                <Text style={styles.followUpLabel}>{c.nextStep}</Text>
                <Text style={styles.body} numberOfLines={2}>{person.followUp.text}</Text>
                <Text style={styles.muted}>{formatReminder(person.followUp.reminderAt, c, locale)}</Text>
              </View>
            ) : null}
            <Text style={styles.muted}>{c.recordCounts(person.notes.length, person.interactions.length)}</Text>
            <Text style={styles.muted}>{c.latest}{person.interactions.length
                ? formatInteractionDate(latestDatedInteraction(person.interactions)?.date, locale)
                : c.noInteractions}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

      {!filtered.length ? <Card><Text style={styles.muted}>{c.noMemories}</Text></Card> : null}

      <Card>
        <Label text={c.followUps} />
        <Text style={styles.cardTitle}>
          {openFollowUps.length
            ? c.openFollowUpCount(openFollowUps.length)
            : c.caughtUp}
        </Text>
        <Text style={styles.body}>
          {openFollowUps.length
            ? c.followUpsHelp
            : c.noFollowUpsHelp}
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
                  {c.reminderStatuses[reminderStatus(person.followUp?.reminderAt)]}
                </Text>
              </View>
              <Text style={styles.todayText} numberOfLines={2}>{person.followUp?.text}</Text>
              <Text style={styles.todayReminder}>{formatReminder(person.followUp?.reminderAt, c, locale)}</Text>
            </View>
            <Text style={styles.todayChevron}>›</Text>
          </Pressable>
        ))}

        {recentMemory ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.openRecent(recentMemory.person.name)}
            onPress={() => openPerson(recentMemory.person.id)}
            style={styles.recentMemory}
          >
            <Text style={styles.recentLabel}>{recentMemory.dated ? c.recentDated : c.recentUndated}</Text>
            <Text style={styles.recentName}>{recentMemory.person.name}</Text>
            <Text style={styles.recentText} numberOfLines={3}>{recentMemory.interaction.summary}</Text>
            <Text style={styles.recentDate}>{formatInteractionDate(recentMemory.interaction.date, locale)}</Text>
          </Pressable>
        ) : null}
      </Card>
    </Page>
  );
}

function Page({ children, saveState, busy = false }: { children: React.ReactNode; saveState?: PeopleSaveState; busy?: boolean }) {
  const styles = useAppStyles();
  const { copy } = useI18n();
  const c = copy.app;
  return (
    <View style={styles.safe}>      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: 12, paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {busy && <Text accessibilityRole="alert" style={styles.muted}>{c.updating}</Text>}
        {children}
      </ScrollView>
      {saveState && <MemorySaveNotice {...saveState} />}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const styles = useAppStyles();
  return <View style={styles.card}>{children}</View>;
}

function Back({ onPress }: { onPress: () => void }) {
  const { copy } = useI18n();
  return <AppHeader onBack={onPress} backLabel={copy.app.people} accessibilityLabel={copy.app.backPeople} />;
}

function Label({ text }: { text: string }) {
  const styles = useAppStyles();
  return <Text style={styles.label}>{text}</Text>;
}

function Field({ label, value, onChange, multiline = false, keyboardType = 'default', editable = true }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad';
  editable?: boolean;
}) {
  const styles = useAppStyles();
  const { copy, locale } = useI18n();
  const c = copy.app;
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      <Label text={label} />
      <TextInput
        value={value}
        accessibilityLabel={label}
        editable={editable}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholder={c.enterField(label.toLocaleLowerCase(locale).replace(' *', ''))}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

function ReminderChip({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useAppStyles();
  return (
    <Pressable onPress={onPress} style={styles.reminderChip}>
      <Text style={styles.reminderChipText}>{label}</Text>
    </Pressable>
  );
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const styles = useAppStyles();
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
  const styles = useAppStyles();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.outline, disabled && styles.disabled]}>
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
  );
}

function MiniAction({ label, onPress, danger = false, disabled = false }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const styles = useAppStyles();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.miniAction, danger && styles.miniActionDanger, disabled && styles.disabled]}>
      <Text style={[styles.miniActionText, danger && styles.miniActionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const styles = useAppStyles();
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>;
}

type AppTheme = ReturnType<typeof useTheme>['theme'];

function useAppStyles() {
  const { theme } = useTheme();
  return useMemo(() => createStyles(theme), [theme]);
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.background },
    container: { paddingHorizontal: theme.metrics.screenGutter, gap: theme.spacing.md },
    flex: { flex: 1 },
    hero: { marginTop: 10, marginBottom: 8 },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: theme.metrics.controlMinHeight, marginBottom: 4 },
    brand: { color: theme.colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
    settingsButton: {
      width: theme.metrics.controlMinHeight,
      height: theme.metrics.controlMinHeight,
      borderRadius: theme.radii.control,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.controlBorder,
    },
    settingsIcon: { color: theme.colors.textSecondary, fontSize: 21, fontWeight: '900' },
    title: { ...theme.typography.hero, color: theme.colors.text, fontWeight: '800' },
    titleSmall: { ...theme.typography.title, color: theme.colors.text, fontWeight: '800', marginTop: 10 },
    sub: { ...theme.typography.body, color: theme.colors.textSecondary, marginTop: 8 },
    subCenter: { ...theme.typography.body, color: theme.colors.textSecondary, marginTop: 5, textAlign: 'center' },
    muted: { ...theme.typography.meta, color: theme.colors.textMuted, },
    mutedCenter: { ...theme.typography.meta, color: theme.colors.textMuted, marginTop: 5, textAlign: 'center' },
    card: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.border, padding: theme.metrics.cardPadding, marginTop: 2 },
    label: { color: theme.colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
    cardTitle: { ...theme.typography.section, color: theme.colors.text, fontWeight: '800' },
    body: { ...theme.typography.body, color: theme.colors.textSecondary, marginTop: 8 },
    input: { ...theme.typography.body, minHeight: theme.metrics.controlMinHeight, backgroundColor: theme.colors.input, borderRadius: theme.radii.control, borderWidth: 1, borderColor: theme.colors.controlBorder, color: theme.colors.text, paddingHorizontal: 13, paddingVertical: 12 },
    multiline: { minHeight: 90, textAlignVertical: 'top' },
    multilineSmall: { minHeight: 70, textAlignVertical: 'top', marginTop: 10 },
    field: { marginBottom: 14 },
    action: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', backgroundColor: theme.colors.accent, borderRadius: theme.radii.control, alignItems: 'center', paddingVertical: 14, marginTop: 10 },
    disabled: { opacity: 0.35 },
    actionText: { ...theme.typography.body, color: theme.colors.onAccent, fontWeight: '900', },
    outline: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', borderRadius: theme.radii.control, borderWidth: 1, borderColor: theme.colors.controlBorder, alignItems: 'center', paddingVertical: 13, marginTop: 12 },
    outlineText: { ...theme.typography.body, color: theme.colors.accent, fontWeight: '800' },
    backButton: { alignSelf: 'flex-start', minHeight: theme.metrics.controlMinHeight, justifyContent: 'center' },
    back: { color: theme.colors.accent, fontSize: 15, fontWeight: '800', paddingVertical: 8 },
    stats: { flexDirection: 'row', gap: 9 },
    stat: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 13 },
    statValue: { ...theme.typography.section, color: theme.colors.text, fontWeight: '900', marginBottom: 3 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 },
    sectionTitle: { ...theme.typography.section, color: theme.colors.text, fontWeight: '800' },
    addButton: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', backgroundColor: theme.colors.accent, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
    addButtonText: { color: theme.colors.onAccent, fontWeight: '900', fontSize: 12 },
    personCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.border, padding: theme.metrics.cardPadding },
    avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: theme.colors.successSurface, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    avatarText: { color: theme.colors.accent, fontWeight: '900', fontSize: 19 },
    personName: { ...theme.typography.body, color: theme.colors.text, fontWeight: '800' },
    personMeta: { ...theme.typography.meta, color: theme.colors.textSecondary, marginTop: 3, marginBottom: 4 },
    chevron: { color: theme.colors.textMuted, fontSize: 27, marginLeft: 8 },
    profile: { alignItems: 'center', paddingVertical: 18 },
    avatarLarge: { width: 76, height: 76, borderRadius: 24, backgroundColor: theme.colors.successSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    avatarTextLarge: { color: theme.colors.accent, fontSize: 31, fontWeight: '900' },
    profileName: { ...theme.typography.title, color: theme.colors.text, fontWeight: '900', textAlign: 'center' },
    contactActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
    profileActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
    miniAction: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.controlBorder, paddingHorizontal: 15, paddingVertical: 7 },
    miniActionDanger: { borderColor: theme.colors.danger },
    miniActionText: { ...theme.typography.meta, color: theme.colors.accent, fontWeight: '900' },
    miniActionTextDanger: { color: theme.colors.danger },
    note: { ...theme.typography.body, color: theme.colors.textSecondary, marginBottom: 7 },
    followUp: { backgroundColor: theme.colors.successSurface, borderRadius: theme.radii.control, padding: 13, marginTop: 12 },
    followUpTopRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    followUpLabel: { ...theme.typography.meta, color: theme.colors.accent, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 },
    followUpStatus: { ...theme.typography.meta, color: theme.colors.accent, fontWeight: '900', letterSpacing: 0.8 },
    followUpStatusOverdue: { color: theme.colors.danger },
    followUpText: { ...theme.typography.body, color: theme.colors.text, },
    followUpReminder: { ...theme.typography.meta, color: theme.colors.textSecondary, fontWeight: '800', marginTop: 8 },
    followUpActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    followUpDone: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.controlBorder, paddingHorizontal: 10, paddingVertical: 7 },
    followUpDoneText: { ...theme.typography.meta, color: theme.colors.accent, fontWeight: '900' },
    followUpEdit: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.controlBorder, paddingHorizontal: 10, paddingVertical: 7 },
    followUpEditText: { ...theme.typography.meta, color: theme.colors.textSecondary, fontWeight: '900' },
    followUpComplete: { ...theme.typography.meta, color: theme.colors.textMuted, marginTop: 12 },
    reminderBox: { backgroundColor: theme.colors.input, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 13, marginTop: 2, marginBottom: 8 },
    reminderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    reminderValue: { ...theme.typography.body, color: theme.colors.text, fontWeight: '800', marginTop: 2 },
    reminderChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
    reminderChip: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', backgroundColor: theme.colors.successSurface, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.controlBorder, paddingHorizontal: 10, paddingVertical: 8 },
    reminderChipText: { ...theme.typography.meta, color: theme.colors.accent, fontWeight: '800' },
    clearReminder: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 6 },
    clearReminderText: { ...theme.typography.meta, color: theme.colors.danger, fontWeight: '800' },
    pickerWrap: { backgroundColor: theme.colors.background, borderRadius: theme.radii.control, marginTop: 10, overflow: 'hidden' },
    pickerDone: { minHeight: theme.metrics.controlMinHeight, justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 9 },
    pickerDoneText: { color: theme.colors.accent, fontWeight: '900' },
    historyCard: { backgroundColor: theme.colors.surface, borderRadius: 17, borderWidth: 1, borderColor: theme.colors.border, padding: 15 },
    historyDate: { color: theme.colors.accent, fontSize: 11, fontWeight: '900', marginBottom: 6 },
    historyText: { color: theme.colors.textSecondary, lineHeight: 20 },
    source: { color: theme.colors.textMuted, fontSize: 9, marginTop: 8, fontWeight: '800' },
    todayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.input,
      borderRadius: theme.radii.control,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      marginTop: 10,
    },
    todayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent, marginRight: 11 },
    todayDotOverdue: { backgroundColor: theme.colors.danger },
    todayTopRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    todayName: { ...theme.typography.body, color: theme.colors.text, fontWeight: '900' },
    todayStatus: { ...theme.typography.meta, color: theme.colors.accent, fontWeight: '900', letterSpacing: 0.6 },
    todayStatusOverdue: { color: theme.colors.danger },
    todayText: { ...theme.typography.meta, color: theme.colors.textSecondary, marginTop: 3 },
    todayReminder: { ...theme.typography.meta, color: theme.colors.textMuted, fontWeight: '800', marginTop: 5 },
    todayChevron: { color: theme.colors.textMuted, fontSize: 24, marginLeft: 8 },
    recentMemory: {
      backgroundColor: theme.colors.successSurface,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.colors.controlBorder,
      padding: 13,
      marginTop: 12,
    },
    recentLabel: { ...theme.typography.meta, color: theme.colors.accent, fontWeight: '900', letterSpacing: 1.2 },
    recentName: { ...theme.typography.body, color: theme.colors.text, fontWeight: '900', marginTop: 6 },
    recentText: { ...theme.typography.meta, color: theme.colors.textSecondary, marginTop: 4 },
    recentDate: { ...theme.typography.meta, color: theme.colors.textMuted, fontWeight: '800', marginTop: 8 },
  });
}
