import { createClient } from '@supabase/supabase-js';

export function createPortalClient(url: string, publishableKey: string) {
  if (!/^https?:\/\//.test(url) || !publishableKey.startsWith('sb_publishable_')) {
    throw new Error('Configure Supabase URL and publishable key. Never use a secret key in the browser.');
  }
  return createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}
export type PortalClient = ReturnType<typeof createPortalClient>;
