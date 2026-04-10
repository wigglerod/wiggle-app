// scripts/create-walker.js
// The foundation for "Add a Walker" — usable from CLI today,
// wrappable behind a Studio API endpoint tomorrow.
//
// Creates a Supabase auth user and updates their auto-generated
// profile row with real walker details. Idempotent: safe to re-run
// on an email that already exists — it will update instead of fail.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ifhniwjdrsswgemmqddn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment.');
  console.error('   Add it to your .env file or export it before running.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Create (or update) a Wiggle walker.
 *
 * @param {Object} walker
 * @param {string} walker.full_name   - e.g. "Sam"
 * @param {string} walker.email       - e.g. "sam@wiggledogwalks.com"
 * @param {string} walker.password    - initial password (walker should change)
 * @param {string} walker.role        - 'admin' | 'senior_walker' | 'junior_walker'
 * @param {string} walker.sector      - 'Plateau' | 'Laurier' | 'both'
 * @param {string} walker.schedule    - e.g. "Thu, Fri"
 * @returns {Promise<{ id: string, created: boolean, profile: object }>}
 */
export async function createWalker({ full_name, email, password, role, sector, schedule }) {
  // Validate inputs up front — fail loud, not silent.
  if (!full_name || !email || !password || !role || !sector) {
    throw new Error('Missing required fields: full_name, email, password, role, sector');
  }
  if (!['admin', 'senior_walker', 'junior_walker'].includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  if (!['Plateau', 'Laurier', 'both'].includes(sector)) {
    throw new Error(`Invalid sector: ${sector}`);
  }

  // Step 1: Check if the auth user already exists (idempotency).
  const { data: existingList, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw new Error(`Failed to list users: ${listErr.message}`);

  const existing = existingList.users.find(u => u.email === email);
  let userId;
  let created = false;

  if (existing) {
    console.log(`ℹ️  Auth user already exists for ${email} — will update profile.`);
    userId = existing.id;
  } else {
    // Step 2: Create the auth user. The on_auth_user_created trigger
    // will auto-insert a row into profiles with default role/sector.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip verification email
      user_metadata: { full_name },
    });
    if (error) throw new Error(`Failed to create auth user: ${error.message}`);
    userId = data.user.id;
    created = true;
    console.log(`✅ Auth user created: ${email} (${userId})`);
  }

  // Step 3: Update the profile row with real walker details.
  // This overwrites whatever defaults the trigger set.
  const { data: profile, error: updErr } = await admin
    .from('profiles')
    .update({ full_name, role, sector, schedule, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (updErr) throw new Error(`Failed to update profile: ${updErr.message}`);
  console.log(`✅ Profile updated: ${full_name} · ${role} · ${sector} · ${schedule || 'no schedule'}`);

  // Step 4: Verify the login works by signing in as the new user.
  // Uses a separate client with the anon key — proves the creds are valid
  // end-to-end, not just that the rows exist.
  const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const anonClient = ANON_KEY
    ? createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    : null;
  if (anonClient) {
    const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) {
      console.warn(`⚠️  Login test FAILED: ${signInErr.message}`);
    } else {
      console.log(`✅ Login test PASSED — ${email} can sign in.`);
      await anonClient.auth.signOut();
    }
  } else {
    console.warn('⚠️  SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY not set — skipping login test.');
  }

  return { id: userId, created, profile };
}

// ─── CLI entry point ─────────────────────────────────────────────
// Run directly: node scripts/create-walker.js
// Edit the walker object below or wire up argv parsing later.
if (import.meta.url === `file://${process.argv[1]}`) {
  const sam = {
    full_name: 'Sam',
    email: 'sam@wiggledogwalks.com',
    password: 'WiggleSam2026!',
    role: 'senior_walker',
    sector: 'Plateau',
    schedule: 'Thu, Fri',
  };

  createWalker(sam)
    .then(result => {
      console.log('\n🐾 Done. Walker ready:');
      console.log(JSON.stringify(result.profile, null, 2));
    })
    .catch(err => {
      console.error('\n❌ Failed:', err.message);
      process.exit(1);
    });
}
