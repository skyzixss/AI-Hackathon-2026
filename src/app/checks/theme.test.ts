import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Exercise the actual pre-paint script, including environments blocking storage.
const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
function boot(stored: string | null, prefersLight: boolean, blocked = false) {
  const root = { dataset: {} as { theme?: string } };
  const meta = { content: "" };
  runInNewContext(script, {
    localStorage: { getItem: () => { if (blocked) throw new Error("Blocked"); return stored; } },
    window: { matchMedia: () => ({ matches: prefersLight }) },
    document: { documentElement: root, querySelector: () => meta },
  });
  return { theme: root.dataset.theme, color: meta.content };
}
test("saved appearance wins over the system before rendering", () => {
  assert.deepEqual(boot("dark", true), { theme: "dark", color: "#0d1119" });
  assert.deepEqual(boot("light", false), { theme: "light", color: "#f4f6f9" });
});
test("invalid or unavailable storage falls back to the system without crashing", () => {
  assert.equal(boot("unexpected-value", true).theme, "light");
  assert.equal(boot(null, false).theme, "dark");
  assert.equal(boot(null, true, true).theme, "light");
  assert.equal(boot(null, false, true).theme, "dark");
});
