---
name: portal-data
description: Change the student portal Supabase schema, access policies, SDK or demo provisioning. Use for backend work in this repository.
---

Read docs/architecture.md, docs/api-contract.md and the assigned Issue first.
Ownership is auth.uid(), never a caller-supplied student id or user_metadata.
All public data tables need RLS, explicit grants, and indexed owner columns.
Students may insert only requests(kind,body) and update only notifications(read_at).
Keep notification creation atomic with the request. Do not move internal trigger
functions to the exposed public schema or make them client-callable.
Run npm run check, npm test and npm run test:db for policy changes.
Distinguish PostgreSQL role tests from real Auth/REST tests. An access-token
check cannot be replaced with UI filtering. Preserve the hosted migration history.
No privileged Supabase keys in browser configuration; use publishable key + user JWT.
Provider APIs change: verify relevant current Supabase docs before changing integration.
