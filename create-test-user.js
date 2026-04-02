import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ifhniwjdrsswgemmqddn.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local create-test-user.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const EMAIL = 'test@wiggledogwalks.com'
const PASSWORD = 'WiggleTest2026!'

async function main() {
  // 1. Create auth user
  console.log('Creating auth user...')
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      console.log('Auth user already exists, fetching...')
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const existing = users.find(u => u.email === EMAIL)
      if (!existing) { console.error('Could not find existing user'); process.exit(1) }
      console.log('Found user:', existing.id)

      // Update password to ensure it's correct
      await supabase.auth.admin.updateUser(existing.id, { password: PASSWORD })
      console.log('Password updated.')

      // Ensure profile exists
      await ensureProfile(existing.id)
      return
    }
    console.error('Auth error:', authError.message)
    process.exit(1)
  }

  const userId = authData.user.id
  console.log('Created auth user:', userId)

  // 2. Insert profile
  await ensureProfile(userId)
}

async function ensureProfile(userId) {
  console.log('Checking profile...')
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (existing) {
    console.log('Profile already exists.')
  } else {
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      email: EMAIL,
      full_name: 'Test Walker',
      role: 'senior_walker',
      sector: 'Plateau',
    })
    if (error) { console.error('Profile insert error:', error.message); process.exit(1) }
    console.log('Profile created.')
  }

  // Verify
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
  console.log('\nVerification:')
  console.log('  Auth user ID:', userId)
  console.log('  Email:', profile.email)
  console.log('  Name:', profile.full_name)
  console.log('  Role:', profile.role)
  console.log('  Sector:', profile.sector)
  console.log('\nDone. Sign in with:')
  console.log('  Email:', EMAIL)
  console.log('  Password:', PASSWORD)
}

main()
