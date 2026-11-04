import { useCallback, useEffect, useRef, useState } from 'react';

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: T };

/**
 * Loads data for the current student. `sessionKey` (user id) resets state when
 * the account changes, and responses from an older key/attempt are ignored so
 * student A's data is never rendered after B signs in.
 */
export function useLoad<T>(sessionKey: string, load: () => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const attempt = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    const my = ++attempt.current;
    setState({ status: 'loading' });
    loadRef.current().then(
      (data) => { if (my === attempt.current) setState({ status: 'ready', data }); },
      (error: unknown) => { if (my === attempt.current) setState({ status: 'error', error }); },
    );
  }, []);

  useEffect(() => {
    reload();
    return () => { attempt.current++; };
  }, [sessionKey, reload]);

  /** Local update after a confirmed server write (never before it). */
  const update = useCallback((fn: (data: T) => T) => {
    setState((s) => (s.status === 'ready' ? { status: 'ready', data: fn(s.data) } : s));
  }, []);

  return { state, reload, update };
}
