import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { createLifeRecordStore } from '../utils/lifeRecordStore';
import type { LifeRecord } from '../utils/lifeRecords';

// Module lifetime spans App Lock unmounts. Reload queues behind every older write.
const store = createLifeRecordStore(AsyncStorage);

export function useLifeRecords() {
  const [state, setState] = useState(() => ({ ...store.getState(), status: 'loading' as 'loading' | 'ready' | 'error' }));
  const mounted = useRef(false);
  useEffect(() => {
    let active = true;
    let opening = true;
    mounted.current = true;
    const unsubscribe = store.subscribe(next => {
      if (active) setState(opening ? { ...next, status: 'loading' } : next);
    });
    void store.reload().then(() => {
      opening = false;
      if (active) setState(store.getState());
    });
    return () => { active = false; mounted.current = false; unsubscribe(); };
  }, []);

  const reload = useCallback(async () => {
    if (mounted.current) await store.reload();
  }, []);
  const save = useCallback(async (record: LifeRecord, base: LifeRecord | null) =>
    mounted.current ? store.save(record, base) : false, []);
  const remove = useCallback(async (base: LifeRecord) =>
    mounted.current ? store.remove(base) : false, []);
  const complete = useCallback(async (base: LifeRecord, nextDate: string | null) =>
    mounted.current ? store.complete(base, new Date(), nextDate) : false, []);

  return { ...state, reload, save, remove, complete };
}
