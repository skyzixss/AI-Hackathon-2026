import { useCallback, useEffect, useRef, useState } from 'react';

export type LoadState<T> =
  | { status: 'loading'; data?: T }
  | { status: 'error'; error: unknown; data?: T }
  | { status: 'ready'; data: T };

/**
 * Loads data for the current student. `sessionKey` (user id) resets state when
 * the account changes, and responses from an older key/attempt are ignored so
 * student A's data is never rendered after B signs in.
 */
export function useLoad<T>(sessionKey: string, load: () => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const attempt = useRef(0);
  const pending = useRef<((data: T) => T)[]>([]);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    const my = ++attempt.current;
    setState(s => ({ status: 'loading', data: s.data }));
    loadRef.current().then(
      (data) => { if (my === attempt.current) {
        const merged = pending.current.reduce((value, change) => change(value), data);
        pending.current = [];
        setState({ status: 'ready', data: merged });
      } },
      (error: unknown) => { if (my === attempt.current) setState(s => ({ status: 'error', error, data: s.data })); },
    );
  }, []);

  useEffect(() => {
    pending.current = [];
    setState({ status: 'loading' });
    reload();
    return () => { attempt.current++; };
  }, [sessionKey, reload]);

  /** Local update after a confirmed server write (never before it). */
  const update = useCallback((fn: (data: T) => T, fallback?: T) => {
    pending.current.push(fn);
    setState((s) => {
      const data = s.data ?? fallback;
      return data === undefined ? s : { ...s, data: fn(data) };
    });
  }, []);

  return { state, reload, update };
}
