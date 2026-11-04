// Explicit opt-in, dedicated demo project only. Never rotates passwords or deletes data.
import { createClient } from "@supabase/supabase-js";
import { createDemoData } from "./demo-data.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in ignored .env");
if (process.env.PORTAL_ALLOW_DEMO_SEED !== "yes") throw new Error("Set PORTAL_ALLOW_DEMO_SEED=yes only for a dedicated demo project");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const emails = ["student-a@example.test", "student-b@example.test"];
const ids = new Map<string, string>();
for (let page = 1; page <= 20; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error(`Cannot resolve demo accounts: ${error.code ?? "unknown"}`);
  for (const user of data.users) if (user.email && emails.includes(user.email)) ids.set(user.email, user.id);
  if (ids.size === 2 || data.users.length < 200) break;
}
if (ids.size !== 2) throw new Error("Both existing demo accounts must be present; run the initial seed only in an empty demo project");
// Complete preflight for both accounts before writing any rows.
const profiles = await admin.from("profiles").select("student_id").in("student_id", [...ids.values()]);
if (profiles.error || profiles.data?.length !== 2) throw new Error("Both demo profiles must exist before refreshing data");
for (const [variant, email] of emails.entries()) {
  const demo = createDemoData(ids.get(email)!, variant as 0 | 1);
  const writes = [
    { table: "schedule_entries", run: () => admin.from("schedule_entries").upsert(demo.schedule, { onConflict: "id" }) },
    { table: "grades", run: () => admin.from("grades").upsert(demo.grades, { onConflict: "id" }) },
    { table: "requests", run: () => admin.from("requests").upsert(demo.requests, { onConflict: "id", ignoreDuplicates: true }) },
    { table: "notifications", run: () => admin.from("notifications").upsert(demo.notifications, { onConflict: "id", ignoreDuplicates: true }) },
  ];
  for (const write of writes) {
    const { error } = await write.run();
    if (error) throw new Error(`Cannot refresh demo ${variant ? "B" : "A"} / ${write.table}: ${error.code}`);
  }
}
console.log("Refreshed fictional schedule, grades, request examples and news for A/B. Passwords, existing application states and read markers preserved.");
