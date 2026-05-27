import { createClient } from '@supabase/supabase-js'
import { expect } from '@playwright/test'

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || '').replace(/^["']|["']$/g, '')
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^["']|["']$/g, '')

if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL must be set in .env.local')
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')

export const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const TEST_WALKERS = {
  a: {
    email: 'test_walker_plateau_a@wiggledogwalks.com',
    password: 'WiggleTest2026!',
    full_name: 'Test Walker A',
    sector: 'Plateau',
    role: 'senior_walker',
  },
  b: {
    email: 'test_walker_plateau_b@wiggledogwalks.com',
    password: 'WiggleTest2026!',
    full_name: 'Test Walker B',
    sector: 'Plateau',
    role: 'senior_walker',
  },
}

export async function ensureTestWalker(walker) {
  // Look up by email. supabase auth-admin has no findByEmail, so we list (limited).
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  let user = list?.users?.find((u) => u.email === walker.email)
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: walker.email,
      password: walker.password,
      email_confirm: true,
      user_metadata: { full_name: walker.full_name },
    })
    if (created.error) throw new Error(`createUser: ${created.error.message}`)
    user = created.data.user
  } else {
    // Reset password (idempotent — known test password).
    const upd = await admin.auth.admin.updateUserById(user.id, {
      password: walker.password,
      email_confirm: true,
    })
    if (upd.error) throw new Error(`updateUserById: ${upd.error.message}`)
  }

  // Ensure profile row matches.
  const { error: upsertErr } = await admin
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: walker.email,
        full_name: walker.full_name,
        role: walker.role,
        sector: walker.sector,
      },
      { onConflict: 'id' },
    )
  if (upsertErr) throw new Error(`profiles upsert: ${upsertErr.message}`)
  return user.id
}

// Sign in via the supabase REST endpoint to grab a fresh session, then inject
// it into the page's localStorage. Bypasses the Login UI entirely, which
// turned out to be the dominant source of test flakiness — the React form
// re-render race made `fill + click + waitFor(Schedule)` unreliable under load.
//
// The supabase JS client reads the session from localStorage on init, so
// when we then navigate to / the AuthContext resolves immediately and
// ProtectedRoute renders Dashboard without a round-trip to /login.
export async function loginAs(page, walker) {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/^["']|["']$/g, '')
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').replace(/^["']|["']$/g, '')
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!projectRef) throw new Error('cannot extract project ref from VITE_SUPABASE_URL')

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: walker.email, password: walker.password }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`supabase auth failed for ${walker.email}: ${res.status} ${body}`)
  }
  const session = await res.json()

  // Hit the app once to establish origin (localStorage is keyed by origin).
  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  // Seed the supabase JS client storage with our session.
  const storageKey = `sb-${projectRef}-auth-token`
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value))
  }, { key: storageKey, value: session })

  // Navigate to / — supabase JS client reads session from localStorage on init,
  // AuthContext resolves immediately, ProtectedRoute renders Dashboard.
  await page.goto('/')
  await page.getByRole('button', { name: 'Schedule' }).waitFor({ state: 'visible', timeout: 20_000 })
}

export async function clearOwlNotesForDog(dogId) {
  await admin.from('owl_notes').delete().eq('target_dog_id', dogId)
}

export async function pickPlateauDog() {
  const { data, error } = await admin
    .from('dogs')
    .select('id, dog_name, sector')
    .eq('sector', 'Plateau')
    .limit(50)
  if (error) throw new Error(`pickPlateauDog: ${error.message}`)
  if (!data || data.length === 0) throw new Error('no Plateau dogs found')
  // Pick a stable one — sort by name and grab the first.
  data.sort((a, b) => a.dog_name.localeCompare(b.dog_name))
  return data[0]
}

export async function getMaxGroupNum(walkDate, sector) {
  const { data, error } = await admin
    .from('walk_groups')
    .select('group_num')
    .eq('walk_date', walkDate)
    .eq('sector', sector)
    .order('group_num', { ascending: false })
    .limit(1)
  if (error) throw new Error(`getMaxGroupNum: ${error.message}`)
  return data?.[0]?.group_num ?? 0
}

export function todayInToronto() {
  // 'en-CA' formats as YYYY-MM-DD.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' })
  return fmt.format(new Date())
}

export function yesterdayInToronto() {
  const now = new Date()
  now.setUTCHours(now.getUTCHours() - 24)
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' })
  return fmt.format(now)
}

export async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
