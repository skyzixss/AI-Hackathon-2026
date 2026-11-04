import { test } from "node:test";
import assert from "node:assert/strict";
import { errorMessage } from "../errors.ts";

test("PostgREST auth errors remain distinct from network failures without status", () => {
  for (const error of [
    { code: "PGRST301" },
    { code: "PGRST303" },
    { code: "42501" },
    { status: 401 },
    { status: 403 },
  ]) {
    assert.match(errorMessage(error), /Сессия истекла/);
  }
  assert.match(
    errorMessage(new TypeError("Failed to fetch")),
    /Проверьте соединение/,
  );
  assert.match(
    errorMessage({ code: "XX000", message: "private diagnostic" }),
    /Проверьте соединение/,
  );
  assert.doesNotMatch(
    errorMessage({ message: "private diagnostic" }),
    /private diagnostic/,
  );
});
