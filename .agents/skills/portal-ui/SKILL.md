---
name: portal-ui
description: Build or integrate student portal screens for studies, requests and notifications using the shared SDK.
---

Read docs/product.md, docs/api-contract.md and docs/team-plan.md.
Use portalApi from src/api/portal.ts and one createPortalClient instance.
Do not replace server reads with localStorage data in the demonstrable product.
Clear previous student data on sign-out and auth-state changes, cancel/ignore stale
requests, and do not render cached A data after B signs in.
Treat empty, loading, error and expired-session states separately. A failed
write must not show success. Disable repeated submit while it is pending.
Display Moscow time; convert date-range boundaries to UTC before schedule queries.
Verify 360 px, keyboard navigation, labels and the unofficial-concept notice.
Only claim browser checks actually run. Respect file ownership in team-plan.md;
coordinate dependency and shared SDK changes instead of replacing root files.
