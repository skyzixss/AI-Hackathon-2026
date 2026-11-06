import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { demoTuition } from "../src/features/payments/backend/demo-data.ts";
import { money, tuitionSummary } from "../src/features/payments/model.ts";
import { createTuitionApi } from "../src/features/payments/api.ts";
import { createPortalClient } from "../src/lib/supabase.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
test("tuition totals distinguish upcoming, overdue and settled invoices; fixture IDs stay stable", () => {
  const now = new Date("2026-11-04T09:00:00Z");
  const a = demoTuition(A, 0, now), b = demoTuition(B, 1, now);
  const summary = tuitionSummary(a, "2026-11-04");
  assert.equal(summary.balance, 9000000); assert.equal(summary.paidTotal, 4500000);
  assert.equal(summary.next?.due_on, "2026-11-15"); assert.equal(summary.overdue, 0);
  assert.equal(tuitionSummary(a, "2026-11-16").overdue, 1);
  assert.equal(tuitionSummary(a, "2026-11-15").overdue, 0);
  assert.equal(tuitionSummary(b, "2026-11-04").balance, 0);
  assert.equal(tuitionSummary(b, "2026-11-04").next, null);
  assert.equal(tuitionSummary([], "2026-11-04").paidTotal, 0);
  assert.deepEqual(a.map(x => x.id), demoTuition(A, 0, new Date("2026-12-04Z")).map(x => x.id));
  assert.ok(a.every(x => !b.some(y => y.id === x.id)));
  assert.match(money(4500000), /45\s000/); assert.match(money(4512), /45,12/);
});

test("tuition lists show newest dates first without changing the next unpaid invoice or input", () => {
  const base = demoTuition(A, 0, new Date("2026-11-04T09:00:00Z"))[0];
  const charges = [
    { ...base, id: "dec", due_on: "2026-12-15", paid_at: null, payment_reference: null },
    { ...base, id: "oct", due_on: "2026-10-15", paid_at: "2026-11-06T11:30:00+03:00" },
    { ...base, id: "sep", due_on: "2026-09-15", paid_at: "2026-11-06T09:00:00Z" },
    { ...base, id: "nov", due_on: "2026-11-15", paid_at: "2026-11-06T09:00:00Z" },
    { ...base, id: "aug", due_on: "2026-08-15", paid_at: null, payment_reference: null },
  ];
  const original = structuredClone(charges);
  const summary = tuitionSummary(charges, "2026-11-06");
  assert.deepEqual(summary.schedule.map(x => x.id), ["dec", "nov", "oct", "sep", "aug"]);
  assert.deepEqual(summary.paid.map(x => x.id), ["nov", "sep", "oct"]);
  assert.equal(summary.next?.id, "aug");
  assert.equal(summary.balance, 9000000);
  assert.equal(summary.paidTotal, 13500000);
  assert.equal(summary.overdue, 1);
  assert.deepEqual(charges, original);
});

test("tuition SDK sends only invoice ID, rejects invalid/unconfirmed writes and propagates errors", async () => {
  const charge = demoTuition(A, 0, new Date("2026-11-04Z"))[1];
  let mode = "list", calls = 0;
  const server = http.createServer(async (req, res) => {
    calls++; let input = ""; for await (const chunk of req) input += chunk;
    res.setHeader("Content-Type", "application/json");
    if (mode === "error") { res.statusCode = 403; res.end(JSON.stringify({ message: "Invoice unavailable", code: "42501" })); return; }
    if (mode === "list") { assert.match(req.url!, /tuition_charges/); res.end(JSON.stringify([charge])); return; }
    assert.equal(req.url, "/rest/v1/rpc/complete_demo_tuition_payment");
    assert.equal(req.method, "POST"); assert.deepEqual(JSON.parse(input), { charge_id: charge.id });
    res.end(JSON.stringify(mode === "unconfirmed" ? charge : { ...charge, paid_at: "2026-11-04T10:00:00Z", payment_reference: "DEMO-RECEIPT" }));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address() as { port: number };
  const api = createTuitionApi(createPortalClient(`http://127.0.0.1:${address.port}`, "sb_publishable_fictional"));
  try {
    assert.equal((await api.charges())[0].id, charge.id);
    const before = calls; await assert.rejects(api.payDemo("not-an-invoice")); assert.equal(calls, before);
    mode = "unconfirmed"; await assert.rejects(api.payDemo(charge.id), /not confirmed/);
    mode = "paid"; assert.equal((await api.payDemo(charge.id)).payment_reference, "DEMO-RECEIPT");
    mode = "error"; await assert.rejects(api.payDemo(charge.id)); await assert.rejects(api.charges());
  } finally { server.close(); await once(server, "close"); }
});
