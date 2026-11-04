// Pure logic for requests and notifications UI: labels, validation, error
// classification and Moscow-time formatting. No React and no network here,
// so it is covered by node:test without a browser.
import type { StudentRequest } from '../../api/portal.ts';

export const BODY_MAX = 2000;

export const KIND_LABELS: Record<StudentRequest['kind'], string> = {
  certificate: 'Справка',
  application: 'Заявление',
};

export const STATUS_LABELS: Record<StudentRequest['status'], string> = {
  submitted: 'Подана',
  in_review: 'На рассмотрении',
  ready: 'Готово',
  rejected: 'Отклонена',
};

/** Ready-made templates so a student does not have to compose text from scratch. */
export const TEMPLATES: { kind: StudentRequest['kind']; title: string; body: string }[] = [
  { kind: 'certificate', title: 'Справка об обучении', body: 'Прошу выдать справку об обучении для предоставления по месту требования.' },
  { kind: 'certificate', title: 'Справка для военкомата', body: 'Прошу выдать справку об обучении для предоставления в военный комиссариат.' },
  { kind: 'application', title: 'Пересдача', body: 'Прошу разрешить пересдачу по дисциплине: ' },
  { kind: 'application', title: 'Академический отпуск', body: 'Прошу рассмотреть возможность предоставления академического отпуска по причине: ' },
];

/** Mirrors the server rule (1..2000 chars after trim); the server still enforces it. */
export function validateBody(body: string): string | null {
  const t = body.trim();
  if (!t) return 'Опишите, что нужно: поле не может быть пустым.';
  if (t.length > BODY_MAX) return `Слишком длинный текст: ${t.length} из ${BODY_MAX} символов.`;
  return null;
}

export type ErrorKind = 'network' | 'session' | 'denied' | 'unknown';

/** Separates network failure, missing/expired session and refused operation. */
export function classifyError(err: unknown): ErrorKind {
  const e = (err ?? {}) as { name?: string; message?: string; code?: string; status?: number };
  const msg = String(e.message ?? '').toLowerCase();
  if (e.name === 'TypeError' && /fetch|network|load failed/.test(msg)) return 'network';
  if (/failed to fetch|networkerror|network request failed/.test(msg)) return 'network';
  if (e.status === 401 || e.code === 'PGRST301' || e.code === 'PGRST303' || /jwt|session|not authenticated/.test(msg)) return 'session';
  if (e.status === 403 || e.code === '42501' || e.code === 'PGRST116' || /permission|denied|row-level security/.test(msg)) return 'denied';
  return 'unknown';
}

export function errorText(err: unknown): string {
  switch (classifyError(err)) {
    case 'network': return 'Нет соединения с сервером. Проверьте интернет и повторите.';
    case 'session': return 'Сессия истекла. Войдите снова.';
    case 'denied': return 'Операция отклонена сервером.';
    default: return 'Что-то пошло не так. Повторите попытку.';
  }
}

const moscow = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
});

/** All timestamps are displayed in Europe/Moscow regardless of the device zone. */
export function formatMoscow(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : moscow.format(d);
}

export function unreadCount(items: { read_at: string | null }[]): number {
  return items.reduce((n, i) => n + (i.read_at ? 0 : 1), 0);
}

/** Replaces one item by id without reordering; used after markRead. */
export function replaceById<T extends { id: string }>(items: T[], next: T): T[] {
  return items.map((i) => (i.id === next.id ? next : i));
}
