import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useI18n } from '../i18n/LanguageProvider';

type Options = {
  dirty: boolean; save: () => Promise<boolean>; discard: () => void;
  busy?: boolean; enabled?: boolean; onBack?: () => void; revision?: unknown;
};

/** Navigation only: no storage, background save, auth override or process-death recovery. */
export function useUnsavedChanges(options: Options) {
  const { copy } = useI18n();
  const current = useRef({ options, copy: copy.navigation });
  current.current = { options, copy: copy.navigation };
  const alive = useRef(true), pending = useRef<object | null>(null), savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; pending.current = null; };
  }, []);
  const requestExit = useCallback((action: () => void) => {
    if (!alive.current || savingRef.current || current.current.options.busy || pending.current) return;
    if (!current.current.options.dirty) { action(); return; }
    const ticket = {};
    pending.current = ticket;
    const valid = () => alive.current && pending.current === ticket;
    const c = current.current.copy;
    Alert.alert(c.title, c.body, [
      { text: c.stay, style: 'cancel', onPress: () => { if (valid()) pending.current = null; } },
      { text: c.discard, style: 'destructive', onPress: () => {
        if (!valid() || savingRef.current || current.current.options.busy) return;
        pending.current = null;
        current.current.options.discard();
        if (alive.current) action();
      } },
      { text: c.saveExit, onPress: () => {
        if (!valid() || savingRef.current || current.current.options.busy) return;
        savingRef.current = true; setSaving(true);
        const revision = current.current.options.revision;
        void (async () => {
          let saved = false;
          try { saved = await current.current.options.save(); } catch { /* Failed save never grants navigation. */ }
          if (!valid()) return;
          savingRef.current = false; setSaving(false); pending.current = null;
          const latest = current.current;
          if (saved && (!latest.options.dirty || Object.is(revision, latest.options.revision))) action();
          else Alert.alert(latest.copy.failedTitle, latest.copy.failedBody);
        })();
      } },
    ], { cancelable: true, onDismiss: () => { if (valid() && !savingRef.current) pending.current = null; } });
  }, []);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      const latest = current.current.options;
      if (latest.enabled === false || !latest.onBack) return false;
      requestExit(latest.onBack);
      return true;
    });
    return () => listener.remove();
  }, [requestExit]);
  return { requestExit, saving };
}
