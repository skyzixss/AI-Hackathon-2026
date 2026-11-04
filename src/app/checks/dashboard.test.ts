import { test } from "node:test";
import assert from "node:assert/strict";
import { featuredLesson } from "../dashboard-model.ts";
import type { Lesson } from "../../api/portal.ts";

const lesson = (hour: number): Lesson => ({
  id: String(hour), student_id: "fixture", subject: "Вымышленная дисциплина",
  starts_at: `2026-11-04T${hour}:00:00+03:00`,
  ends_at: `2026-11-04T${hour + 1}:00:00+03:00`, room: "Демо-101",
  teacher: "Вымышленный преподаватель", change_note: null,
});
test("featured lesson distinguishes upcoming, current and finished at time boundaries", () => {
  const lessons = [lesson(12), lesson(10)];
  const at = (value: string) => Date.parse(`2026-11-04T${value}:00+03:00`);
  assert.equal(featuredLesson(lessons, at("09:00"))?.lesson.id, "10");
  assert.equal(featuredLesson(lessons, at("09:00"))?.phase, "next");
  assert.equal(featuredLesson(lessons, at("10:00"))?.phase, "current");
  assert.equal(featuredLesson(lessons, at("11:00"))?.lesson.id, "12");
  assert.equal(featuredLesson(lessons, at("11:00"))?.phase, "next");
  assert.equal(featuredLesson(lessons, at("13:00"))?.phase, "finished");
  assert.equal(featuredLesson(lessons, at("13:00"))?.lesson.id, "12");
  assert.deepEqual(lessons.map(item => item.id), ["12", "10"]);
  assert.equal(featuredLesson([], at("09:00")), null);
});
