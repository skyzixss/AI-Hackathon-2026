// Opt-in admin script for an existing isolated demo project. No Auth/password changes.
import { createClient } from "@supabase/supabase-js";
import { demoTuition } from "./demo-data.ts";

if (process.env.PORTAL_ALLOW_DEMO_SEED !== "yes") throw new Error("Dedicated demo project opt-in required");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Configure server-only Supabase variables in ignored .env");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const emails = ["student-a@example.test", "student-b@example.test"];
const ids = new Map<string, string>();
for (let page = 1; page <= 20; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error("Cannot resolve existing demo accounts");
  for (const user of data.users) if (user.email && emails.includes(user.email)) ids.set(user.email, user.id);
  if (ids.size === 2 || data.users.length < 200) break;
}
if (ids.size !== 2) throw new Error("Both existing demo accounts required");
const profiles = await admin.from("profiles").select("student_id").in("student_id", [...ids.values()]);
if (profiles.error || profiles.data?.length !== 2) throw new Error("Both existing demo profiles required");
const rows = emails.flatMap((email, variant) => demoTuition(ids.get(email)!, variant as 0 | 1));
// Never overwrite a paid invoice or reset a receipt when run again.
const { error } = await admin.from("tuition_charges").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
if (error) throw new Error("Cannot seed tuition; review/apply the dedicated demo schema first");
console.log("Fictional tuition invoices prepared for A/B; existing invoice states preserved.");
