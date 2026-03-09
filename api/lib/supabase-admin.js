import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client using service role key (server-side only).
 * Bypasses RLS for cron jobs and admin operations.
 */
export function getAdminClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}
