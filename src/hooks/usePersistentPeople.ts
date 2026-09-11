import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

import { MemoryPerson } from '../types';

const STORAGE_KEY = '@ai-memory/people-v1';

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

        const parsed = JSON.parse(stored) as MemoryPerson[];
        if (Array.isArray(parsed)) {
          setPeople(parsed);
        }
      } catch (error) {
        console.warn('Could not restore saved memories', error);
      } finally {
        if (mounted) setIsReady(true);
      }
    }

    restore();

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
