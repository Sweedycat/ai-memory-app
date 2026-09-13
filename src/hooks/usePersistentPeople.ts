import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

import { MemoryFollowUp, MemoryPerson } from '../types';

const STORAGE_KEY = '@ai-memory/people-v1';

type LegacyPerson = Omit<MemoryPerson, 'followUp'> & {
  followUp?: MemoryFollowUp | string;
};

function normalizeFollowUp(value: MemoryFollowUp | string | undefined): MemoryFollowUp | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return undefined;

    return {
      id: `follow-up-migrated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: new Date().toISOString(),
    };
  }

  if (!value.text?.trim()) return undefined;

  return {
    ...value,
    text: value.text.trim(),
    createdAt: value.createdAt || new Date().toISOString(),
  };
}

function normalizePeople(value: unknown): MemoryPerson[] | null {
  if (!Array.isArray(value)) return null;

  return value.map((item) => {
    const person = item as LegacyPerson;
    return {
      ...person,
      followUp: normalizeFollowUp(person.followUp),
      followUpHistory: Array.isArray(person.followUpHistory) ? person.followUpHistory : [],
    } as MemoryPerson;
  });
}

export function usePersistentPeople(
  initialPeople: MemoryPerson[],
): [MemoryPerson[], Dispatch<SetStateAction<MemoryPerson[]>>, boolean] {
  const [people, setPeople] = useState<MemoryPerson[]>(initialPeople);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted || !stored) return;

        const parsed = normalizePeople(JSON.parse(stored));
        if (parsed) {
          setPeople(parsed);
        }
      } catch (error) {
        console.warn('Could not restore saved memories', error);
      } finally {
        if (mounted) setIsReady(true);
      }
    }

    void restore();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(people)).catch((error) => {
      console.warn('Could not save memories', error);
    });
  }, [isReady, people]);

  return [people, setPeople, isReady];
}
