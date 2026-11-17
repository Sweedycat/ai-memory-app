import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

import type { MemoryPerson } from '../types';
import { decodeStoredPeople } from '../utils/normalizeStoredPeople';
import { createMemorySaveQueue, type MemorySaveStatus } from '../utils/memorySaveQueue';

const STORAGE_KEY = '@ai-memory/people-v1';
// Survives App Lock unmounts. New readers drain this single writer first;
// failed, unsaved changes remain available in memory until an explicit retry.
const writer = createMemorySaveQueue(value => AsyncStorage.setItem(STORAGE_KEY, value));

export type PeopleSaveState = { status: MemorySaveStatus; retry: () => void };

export function usePersistentPeople(
  initialPeople: MemoryPerson[],
): [MemoryPerson[], Dispatch<SetStateAction<MemoryPerson[]>>, boolean, boolean, PeopleSaveState] {
  const [people, setPeople] = useState<MemoryPerson[]>(initialPeople);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<MemorySaveStatus>(writer.getStatus);
  const observed = useRef<MemoryPerson[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = writer.subscribe(status => { if (mounted) setSaveStatus(status); });

    async function restore() {
      try {
        await writer.whenIdle();
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;

        // Validate saved bytes even when a newer unsaved in-memory draft exists.
        // A failed read/validation still blocks all writes and retry controls.
        const restored = stored === null ? initialPeople : decodeStoredPeople(stored);
        const pending = writer.getPending();
        const next = pending === null ? restored : decodeStoredPeople(pending);
        observed.current = next;
        setPeople(next);
        setSaveStatus(writer.getStatus());
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
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isReady || observed.current === people) return;
    observed.current = people;
    writer.enqueue(JSON.stringify(people));
  }, [isReady, people]);

  const retry = useCallback(() => { if (isReady && !loadError) writer.retry(); }, [isReady, loadError]);
  return [people, setPeople, isReady, loadError, { status: saveStatus, retry }];
}
