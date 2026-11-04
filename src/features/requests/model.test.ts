// Run: node --experimental-strip-types --test src/features/**/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_MAX, classifyError, formatMoscow, replaceById, unreadCount, validateBody, TEMPLATES } from './model.ts';

test('body validation mirrors the server rule 1..2000 after trim', () => {
  assert.ok(validateBody(''));
  assert.ok(validateBody('   \n '));
  assert.equal(validateBody('  ok  '), null);
  assert.equal(validateBody('x'.repeat(BODY_MAX)), null);
  assert.ok(validateBody('x'.repeat(BODY_MAX + 1)));
  assert.equal(validateBody(' ' + 'x'.repeat(BODY_MAX) + ' '), null);
});

test('templates are valid request bodies', () => {
  for (const t of TEMPLATES) assert.equal(validateBody(t.body), null, t.title);
});

test('errors are classified without turning failures into success', () => {
  assert.equal(classifyError(new TypeError('Failed to fetch')), 'network');
  assert.equal(classifyError({ message: 'JWT expired', code: 'PGRST301' }), 'session');
  assert.equal(classifyError({ status: 401, message: 'x' }), 'session');
  assert.equal(classifyError({ code: '42501', message: 'permission denied for table requests' }), 'denied');
  assert.equal(classifyError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }), 'denied');
  assert.equal(classifyError(new Error('boom')), 'unknown');
  assert.equal(classifyError(undefined), 'unknown');
});

test('dates are shown in Moscow time regardless of device zone', () => {
  // 21:30 UTC is 00:30 next day in Moscow (UTC+3)
  const s = formatMoscow('2026-11-04T21:30:00Z');
  assert.match(s, /5 ноября/);
  assert.match(s, /00:30/);
  assert.equal(formatMoscow('not a date'), '—');
});

test('unread count and in-place replacement after markRead', () => {
  const list = [
    { id: 'a', read_at: null }, { id: 'b', read_at: '2026-11-04T10:00:00Z' }, { id: 'c', read_at: null },
  ];
  assert.equal(unreadCount(list), 2);
  const next = replaceById(list, { id: 'a', read_at: '2026-11-04T11:00:00Z' });
  assert.deepEqual(next.map((i) => i.id), ['a', 'b', 'c']);
  assert.equal(unreadCount(next), 1);
  assert.equal(list[0].read_at, null, 'original list is not mutated');
});
