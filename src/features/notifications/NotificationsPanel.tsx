import { useEffect, useState } from 'react';
import type { portalApi } from '../../api/portal.ts';
import { errorText, formatMoscow, replaceById, unreadCount } from '../requests/model.ts';
import { useLoad } from '../requests/useLoad.ts';
import '../requests/requests.css';

type Api = Pick<ReturnType<typeof portalApi>, 'notifications' | 'markRead'>;

export interface NotificationsPanelProps {
  api: Api;
  /** Current user id: changing it clears the previous student's data. */
  sessionKey: string;
  /** Increment to reload (e.g. after a request was submitted). */
  refreshKey?: number;
  /** Reports the unread count so the shell can show a badge in navigation. */
  onUnreadChange?: (n: number) => void;
}

export function NotificationsPanel({ api, sessionKey, refreshKey = 0, onUnreadChange }: NotificationsPanelProps) {
  const { state, reload, update } = useLoad(sessionKey, () => api.notifications());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (refreshKey) reload(); }, [refreshKey, reload]);
  useEffect(() => { setBusy(null); setError(null); }, [sessionKey]);

  const unread = state.status === 'ready' ? unreadCount(state.data) : 0;
  useEffect(() => { if (state.status === 'ready') onUnreadChange?.(unread); }, [state.status, unread, onUnreadChange]);

  async function markRead(id: string) {
    if (busy) return;
    setBusy(id); setError(null);
    try {
      const next = await api.markRead(id);
      update((list) => replaceById(list, next));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function markAll() {
    if (state.status !== 'ready' || busy) return;
    setBusy('all'); setError(null);
    try {
      for (const n of state.data.filter((i) => !i.read_at)) {
        const next = await api.markRead(n.id);
        update((list) => replaceById(list, next));
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="pr-panel" aria-labelledby="pr-notif-title">
      <div className="pr-row">
        <h2 id="pr-notif-title">
          Уведомления{unread > 0 && <span className="pr-badge" aria-label={`непрочитанных: ${unread}`}>{unread}</span>}
        </h2>
        {unread > 1 && (
          <button type="button" onClick={markAll} disabled={busy !== null}>Прочитать все</button>
        )}
      </div>
      {error && <div className="pr-alert" role="alert">{error}</div>}
      {state.status === 'loading' && <p className="pr-muted" role="status">Загружаем уведомления…</p>}
      {state.status === 'error' && (
        <div className="pr-alert" role="alert">
          {errorText(state.error)} <button type="button" onClick={reload}>Повторить</button>
        </div>
      )}
      {state.status === 'ready' && state.data.length === 0 && (
        <p className="pr-empty">Новых уведомлений нет. Здесь появятся новости деканата и напоминания.</p>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className="pr-list">
          {state.data.map((n) => (
            <li key={n.id} className={`pr-card ${n.read_at ? 'pr-read' : 'pr-unread'}`}>
              <div className="pr-card-head">
                <strong>{n.title}</strong>
                {!n.read_at && <span className="pr-dot" aria-label="не прочитано" />}
              </div>
              <p className="pr-body">{n.body}</p>
              <div className="pr-row">
                <time className="pr-muted" dateTime={n.created_at}>{formatMoscow(n.created_at)} (МСК)</time>
                {!n.read_at && (
                  <button type="button" onClick={() => markRead(n.id)} disabled={busy !== null}
                    aria-label={`Отметить прочитанным: ${n.title}`}>
                    {busy === n.id ? '…' : 'Прочитано'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
