import { useId, useState, type FormEvent } from 'react';
import type { StudentRequest, portalApi } from '../../api/portal.ts';
import { BODY_MAX, KIND_LABELS, STATUS_LABELS, TEMPLATES, errorText, formatMoscow, validateBody } from './model.ts';
import { useLoad } from './useLoad.ts';
import './requests.css';

type Api = Pick<ReturnType<typeof portalApi>, 'requests' | 'createRequest'>;

export interface RequestsPanelProps {
  api: Api;
  /** Current user id: changing it clears the previous student's data. */
  sessionKey: string;
  /** Called after a successful submit so the shell can refresh notifications (the server trigger creates one). */
  onSubmitted?: (r: StudentRequest) => void;
}

export function RequestsPanel({ api, sessionKey, onSubmitted }: RequestsPanelProps) {
  const { state, reload, update } = useLoad(sessionKey, () => api.requests());
  return (
    <section className="pr-panel" aria-labelledby="pr-requests-title">
      <h2 id="pr-requests-title">Справки и заявления</h2>
      <RequestForm
        key={sessionKey}
        api={api}
        onCreated={(r) => { update((list) => list.some(item => item.id === r.id) ? list : [r, ...list]); onSubmitted?.(r); }}
      />
      <h3>Мои заявки</h3>
      {state.status === 'loading' && <p className="pr-muted" role="status">Загружаем заявки…</p>}
      {state.status === 'error' && (
        <div className="pr-alert" role="alert">
          {errorText(state.error)} <button type="button" onClick={reload}>Повторить</button>
        </div>
      )}
      {state.status === 'ready' && state.data.length === 0 && (
        <p className="pr-empty">Заявок пока нет. Выберите шаблон выше — это займёт минуту.</p>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className="pr-list">
          {state.data.map((r) => (
            <li key={r.id} className="pr-card">
              <div className="pr-card-head">
                <span className="pr-kind">{KIND_LABELS[r.kind]}</span>
                <span className={`pr-status pr-status-${r.status}`}>{STATUS_LABELS[r.status]}</span>
              </div>
              <p className="pr-body">{r.body}</p>
              <time className="pr-muted" dateTime={r.created_at}>{formatMoscow(r.created_at)} (МСК)</time>
            </li>
          ))}
        </ul>
      )}
      <p className="pr-note">Обработка заявок деканатом в прототипе не выполняется: новая заявка остаётся в статусе «Подана».</p>
    </section>
  );
}

function RequestForm({ api, onCreated }: { api: Api; onCreated: (r: StudentRequest) => void }) {
  const ids = useId();
  const [kind, setKind] = useState<StudentRequest['kind']>('certificate');
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const invalid = validateBody(body);
    if (invalid) { setError(invalid); return; }
    setPending(true); setError(null); setDone(false);
    try {
      const created = await api.createRequest(kind, body); // single attempt, no automatic retry
      onCreated(created);
      setBody(''); setDone(true);
    } catch (err) {
      setError(errorText(err)); // a failed write never shows success
    } finally {
      setPending(false);
    }
  }

  const len = body.trim().length;
  return (
    <form className="pr-form" onSubmit={submit} noValidate>
      <fieldset className="pr-templates">
        <legend>Быстрый старт</legend>
        {TEMPLATES.map((t) => (
          <button key={t.title} type="button" className="pr-chip" disabled={pending}
            onClick={() => { setKind(t.kind); setBody(t.body); setError(null); setDone(false); }}>
            {t.title}
          </button>
        ))}
      </fieldset>
      <label htmlFor={`${ids}-kind`}>Тип</label>
      <select id={`${ids}-kind`} value={kind} disabled={pending}
        onChange={(e) => setKind(e.target.value as StudentRequest['kind'])}>
        <option value="certificate">{KIND_LABELS.certificate}</option>
        <option value="application">{KIND_LABELS.application}</option>
      </select>
      <label htmlFor={`${ids}-body`}>Текст заявки</label>
      <textarea id={`${ids}-body`} rows={4} value={body} disabled={pending}
        aria-invalid={error ? true : undefined} aria-describedby={`${ids}-hint ${ids}-msg`}
        onChange={(e) => { setBody(e.target.value); setDone(false); }} />
      <div className="pr-row">
        <span id={`${ids}-hint`} className={len > BODY_MAX ? 'pr-over' : 'pr-muted'}>{len} / {BODY_MAX}</span>
        <button type="submit" className="pr-primary" disabled={pending} aria-busy={pending}>
          {pending ? 'Отправляем…' : 'Отправить'}
        </button>
      </div>
      <p id={`${ids}-msg`} aria-live="polite" className={error ? 'pr-error' : 'pr-success'}>
        {error ?? (done ? 'Заявка отправлена и сохранена.' : '')}
      </p>
    </form>
  );
}
