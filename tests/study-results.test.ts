import { test } from "node:test";
import assert from "node:assert/strict";
import { isDebt, gradeTone, numericAverage } from "../src/features/studies/grade-model.ts";
import type { Grade } from "../src/api/portal.ts";

test("debts are negative published results, not an absent or unknown result", () => {
  for (const value of ["2", " Не зачтено ", "Незачтено", "Незачёт", "неудовлетворительно"]) {
    assert.equal(isDebt(value), true);
    assert.equal(gradeTone(value), "negative");
  }
  for (const value of ["3", "4", "5", "Зачтено", "", "Ожидается"]) assert.equal(isDebt(value), false);
});
test("averages include a failed numeric result but never turn credits into numbers", () => {
  const grades = ["5", "4", "2", "Зачтено", "Не зачтено"].map(result => ({ result }) as Grade);
  assert.equal(numericAverage(grades), "3,7");
  assert.equal(numericAverage(grades.slice(3)), "—");
  assert.equal(numericAverage([]), "—");
});
