import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True when the app has been given a backend. When false the UI shows a setup
 * card instead of white-screening on a failed client construction.
 */
export const isConfigured = Boolean(url && anonKey);

/**
 * The anon key is safe in the bundle *only* because row-level security stands
 * behind it. Never add a service-role key or a third-party API key here — those
 * belong in Supabase Edge Function secrets.
 */
export const supabase: SupabaseClient = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
