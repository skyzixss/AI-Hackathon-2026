import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, moscowDay, scheduleRange, weekStart } from "./dates.ts";

test("today is the Moscow date across the UTC midnight boundary", () => {
  assert.equal(moscowDay(new Date("2026-11-04T21:30:00Z")), "2026-11-05");
  assert.deepEqual(scheduleRange("2026-11-05", "day"), {
    start: "2026-11-05",
    from: "2026-11-04T21:00:00.000Z",
    to: "2026-11-05T21:00:00.000Z",
  });
});
test("weeks start Monday, end exclusively, and cross year boundaries", () => {
  assert.equal(weekStart("2027-01-03"), "2026-12-28");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.deepEqual(scheduleRange("2027-01-03", "week"), {
    start: "2026-12-28",
    from: "2026-12-27T21:00:00.000Z",
    to: "2027-01-03T21:00:00.000Z",
  });
});
