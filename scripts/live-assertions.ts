import type { Notification } from '../src/api/portal.ts';

// Existing notices must never serve as evidence for the request just created.
export function newRequestNotifications(before: ReadonlySet<string>, after: Notification[], studentId: string) {
  return after.filter(n => !before.has(n.id) && n.student_id === studentId && n.title === 'Заявка принята');
}

// A transient failure or an invalid input token does not prove sign-out revoked a session.
export function isRevokedRefresh(status: number, body: unknown): boolean {
  if (status !== 400 || !body || typeof body !== 'object') return false;
  // Raw GoTrue JSON uses error_code; SDK-normalized errors use code.
  const code = 'error_code' in body ? body.error_code : 'code' in body ? body.code : null;
  return code === 'refresh_token_not_found' || code === 'session_not_found';
}
