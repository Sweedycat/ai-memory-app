import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

import type { MemoryPerson } from '../types';
import { decodeStoredPeople } from '../utils/normalizeStoredPeople';

const STORAGE_KEY = '@ai-memory/people-v1';

export function usePersistentPeople(
  initialPeople: MemoryPerson[],
): [MemoryPerson[], Dispatch<SetStateAction<MemoryPerson[]>>, boolean, boolean] {
  const [people, setPeople] = useState<MemoryPerson[]>(initialPeople);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;

        if (stored !== null) {
          setPeople(decodeStoredPeople(stored));
        }
        setIsReady(true);
      } catch {
        // Never overwrite existing storage after a read or validation failure.
        // The app stays blocked until the saved data can be safely recovered.
        if (mounted) setLoadError(true);
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

  return [people, setPeople, isReady, loadError];
}
