import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Vector backend, baked in as the default.
 *
 * These are deliberately *not* env-var-only. Vite inlines `import.meta.env.*` at
 * build time, so a missing or wrongly-scoped variable produces a bundle that
 * silently has no backend — a clean build that boots to a setup card. For two
 * values that are public by design, that failure mode costs more than the
 * configurability is worth.
 *
 * Both are safe to ship in the bundle: the publishable key is readable by anyone
 * who opens devtools on the deployed site, whatever we do here. The security
 * boundary is row-level security in Postgres — every table restricts access to
 * `user_id = auth.uid()` — not the secrecy of this string. A service-role key or
 * any third-party API key would NOT be safe here; those belong in Supabase Edge
 * Function secrets.
 */
const DEFAULT_SUPABASE_URL = 'https://esfxrnqwkulqhxwgyezb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_3Qdg3jcVnNugh6lOMLmyog_h-Z5LmjG';

/** Env vars still win, so a fork can point at its own project without a code edit. */
const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

/**
 * True when the app has a backend to talk to. With defaults in place this is
 * always true, but the check stays so a fork that blanks the constants gets the
 * setup card rather than a white screen.
 */
export const isConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
