import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoData, createDeadlineReminder } from "../scripts/demo-data.ts";

test("demo data covers a Moscow week, different students and stable refresh IDs", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const a = createDemoData("student-a", 0, now);
  const b = createDemoData("student-b", 1, now);
  assert.equal(a.schedule.length, 14);
  assert.equal(a.schedule.filter(item => item.starts_at.startsWith("2026-11-04")).length, 4);
  assert.ok(a.schedule.every(item => Date.parse(item.ends_at) > Date.parse(item.starts_at)));
  assert.equal(a.schedule.filter(item => item.change_note).length, 2);
  assert.deepEqual(a.schedule.map(item => item.id), createDemoData("student-a", 0, new Date("2026-11-11T12:00:00Z")).schedule.map(item => item.id));
  assert.ok(!a.schedule.some(item => b.schedule.some(other => other.id === item.id)));
  assert.ok(a.grades.some(item => item.result === "2"));
  assert.ok(a.grades.some(item => item.result === "Не зачтено"));
  assert.ok(b.grades.every(item => item.result !== "2" && item.result !== "Не зачтено"));
  assert.equal(new Set(a.grades.map(item => item.assessment)).size, 3);
  assert.equal(new Set(a.grades.map(item => item.semester)).size, 2);
  assert.deepEqual(a.requests.map(item => item.status), ["ready", "in_review", "rejected"]);
  assert.ok(a.notifications.some(item => item.read_at));
  assert.ok(a.notifications.some(item => !item.read_at));
});


test("deadline reminders have an explicit Moscow due date, isolated stable IDs and honest demo wording", () => {
 const a = createDeadlineReminder("student-a", 0, new Date("2026-12-31T20:59:00Z"));
 const sameDay = createDeadlineReminder("student-a", 0, new Date("2026-12-31T09:00:00Z"));
 const nextDay = createDeadlineReminder("student-a", 0, new Date("2026-12-31T21:01:00Z"));
 const b = createDeadlineReminder("student-b", 1, new Date("2026-12-31T20:59:00Z"));
 assert.match(a.body, /3 января 2027/); assert.match(nextDay.body, /4 января 2027/);
 assert.match(a.body, /18:00 \(МСК\)/); assert.match(a.body, /выборе темы/);
 assert.match(b.body, /учебной практики/); assert.match(a.body, /вымышленный учебный срок/);
 assert.equal(a.id, sameDay.id); assert.notEqual(a.id, nextDay.id); assert.notEqual(a.id, b.id);
 assert.equal(a.read_at, null); assert.equal(a.student_id, "student-a");
 assert.equal(createDemoData("student-a", 0, new Date("2026-12-31T20:59:00Z")).notifications.filter(n => n.id === a.id).length, 1);
});
