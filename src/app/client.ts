import { createPortalClient } from "../lib/supabase.ts";
import { portalApi } from "../api/portal.ts";
import { createTuitionApi } from "../features/payments/api.ts";

// One client for the lifetime of the SPA. No credentials or fallback demo data.
function connect() {
  try {
    const client = createPortalClient(
      import.meta.env.VITE_SUPABASE_URL ?? "",
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
    );
    return { client, api: portalApi(client), tuitionApi: createTuitionApi(client) };
  } catch {
    return null;
  }
}
export const connection = connect();
export type Api = ReturnType<typeof portalApi>;
