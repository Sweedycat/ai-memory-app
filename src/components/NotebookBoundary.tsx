import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { createNotebookLifecycle } from '../utils/notebookLifecycle';

// Promotion requires owner approval and physical native/key/recovery evidence.
// No production key/database is opened while this remains false.
export const NOTEBOOK_PRODUCTION_ENABLED = false;
type Lifecycle = ReturnType<typeof createNotebookLifecycle>;
const NotebookContext = createContext<Lifecycle | null>(null);
export function useNotebookLifecycle() { return useContext(NotebookContext); }

function ActiveNotebookBoundary({ children }: { children: React.ReactNode }) {
  const controller = useRef<Lifecycle | null>(null);
  if (!controller.current) controller.current = createNotebookLifecycle(async () => {
    const runtime = await import('../utils/expoNotebookRuntime');
    return runtime.openExpoNotebook();
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') controller.current?.lock();
    });
    return () => { subscription.remove(); controller.current?.lock(); };
  }, []);
  return <NotebookContext.Provider value={controller.current}>{children}</NotebookContext.Provider>;
}

export function NotebookBoundary({ children }: { children: React.ReactNode }) {
  return NOTEBOOK_PRODUCTION_ENABLED ? <ActiveNotebookBoundary>{children}</ActiveNotebookBoundary> : <>{children}</>;
}
