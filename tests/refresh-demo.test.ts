import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";

const root = new URL("../", import.meta.url);
function run(url = "", allow = "yes") {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/refresh-demo.ts"], {
      cwd: root, env: { ...process.env, SUPABASE_URL: url, SUPABASE_SECRET_KEY: "fixture-only-secret", PORTAL_ALLOW_DEMO_SEED: allow },
    });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, output }));
  });
}
test("demo refresh preserves identities and state when repeated; missing profile stops all writes", async () => {
  const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
  const rows = new Map<string, Map<string, Record<string, unknown>>>();
  let writes = 0, incomplete = false;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, "http://fixture.invalid");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/admin/users" && req.method === "GET") {
      res.end(JSON.stringify({ users: ids.map((id, i) => ({ id, email: `student-${i ? "b" : "a"}@example.test` })) })); return;
    }
    if (url.pathname === "/rest/v1/profiles") {
      res.end(JSON.stringify(ids.slice(0, incomplete ? 1 : 2).map(student_id => ({ student_id })))); return;
    }
    if (req.method !== "POST" || !/^\/rest\/v1\/(schedule_entries|grades|requests|notifications)$/.test(url.pathname)) {
      res.writeHead(404); res.end("{}"); return;
    }
    let body = ""; for await (const chunk of req) body += chunk;
    const table = url.pathname.split("/").at(-1)!;
    if (!rows.has(table)) rows.set(table, new Map());
    const target = rows.get(table)!;
    const preserve = String(req.headers.prefer).includes("resolution=ignore-duplicates");
    for (const row of JSON.parse(body)) if (!preserve || !target.has(row.id)) target.set(row.id, row);
    writes++;
    res.writeHead(201); res.end();
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  try {
    const first = await run(url); assert.equal(first.code, 0, first.output);
    assert.equal(rows.get("schedule_entries")?.size, 28);
    assert.equal(rows.get("grades")?.size, 18);
    assert.equal(rows.get("requests")?.size, 4);
    assert.equal(rows.get("notifications")?.size, 6);
    const request = [...rows.get("requests")!.values()][0]; request.status = "in_review";
    const notification = [...rows.get("notifications")!.values()][0]; notification.read_at = "2026-11-04T12:00:00Z";
    const second = await run(url); assert.equal(second.code, 0, second.output);
    assert.equal(rows.get("schedule_entries")?.size, 28);
    assert.equal(rows.get("requests")!.get(String(request.id))!.status, "in_review");
    assert.equal(rows.get("notifications")!.get(String(notification.id))!.read_at, "2026-11-04T12:00:00Z");
    incomplete = true;
    const before = writes;
    assert.notEqual((await run(url)).code, 0);
    assert.equal(writes, before);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
test("refresh refuses missing configuration and missing dedicated-demo opt-in", async () => {
  assert.notEqual((await run()).code, 0);
  const denied = await run("http://127.0.0.1:1", "no");
  assert.notEqual(denied.code, 0);
  assert.match(denied.output, /dedicated demo project/);
});
