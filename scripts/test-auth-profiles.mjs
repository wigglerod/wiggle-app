// Quick script to sign-in and test if authenticated profiles reads work
// Run: node scripts/test-auth-profiles.mjs
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const envPath = resolve(ROOT, '.env.local')
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const val = match[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  }
}
loadEnv()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// Sign in as a walker to test authenticated access
const email = 'rod_galvan@hotmail.com'
const password = process.argv[2]

if (!password) {
  console.error('Usage: node scripts/test-auth-profiles.mjs <password>')
  process.exit(1)
}

async function main() {
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signInErr) {
    console.error('Sign-in failed:', signInErr.message)
    process.exit(1)
  }
  console.log('Signed in as', email)

  // Test Laurier query
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, sector')
    .or('sector.eq.Laurier,and(sector.eq.both,full_name.ilike.Rodrigo%)')
    .not('full_name', 'is', null)
    .not('full_name', 'in', '(Gen,Wiggle Pro,Pup Walker)')
    .order('full_name')

  if (error) {
    console.error('Query error:', error)
    console.log('\n⚠️  RLS is blocking authenticated reads too. Run scripts/add-profiles-rls.sql in the Supabase SQL editor.')
  } else if (!data || data.length === 0) {
    console.log('Result: empty array — either no matching profiles or RLS blocking')
    console.log('\n⚠️  Run scripts/add-profiles-rls.sql in the Supabase SQL editor.')
  } else {
    console.log('\n✅ Laurier walker query works! Got:')
    data.forEach(w => console.log(`  - ${w.full_name} (${w.sector}, ${w.role})`))
  }

  await supabase.auth.signOut()
}
main()
