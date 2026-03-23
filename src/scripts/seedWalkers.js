/**
 * One-time seed script: creates 9 walker auth accounts + matching profiles.
 *
 * Usage:  node src/scripts/seedWalkers.js
 *
 * Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (or as environment variables).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Parse .env.local manually (no dotenv dependency)
const __dirname = dirname(fileURLToPath(import.meta.url))
const envFile = readFileSync(resolve(__dirname, '../../.env.local'), 'utf-8')
for (const line of envFile.split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.*?)["']?$/)
  if (match) process.env[match[1]] ??= match[2]
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const walkers = [
  {
    email: 'rod_galvan@hotmail.com',
    password: 'rodWiggle1',
    full_name: 'Rodrigo',
    role: 'admin',
    sector: 'both',
    schedule: 'Wed Plateau, Fri Plateau',
  },
  {
    email: 'gen-vg@outlook.com',
    password: 'genWiggle1',
    full_name: 'Gen',
    role: 'admin',
    sector: 'both',
    schedule: 'Updates daily',
  },
  {
    email: 'megan@wiggledogwalks.com',
    password: 'meganWiggle1',
    full_name: 'Megan',
    role: 'senior_walker',
    sector: 'Plateau',
    schedule: 'Mon, Thu',
  },
  {
    email: 'solene@wiggledogwalks.com',
    password: 'soleneWiggle1',
    full_name: 'Solene',
    role: 'senior_walker',
    sector: 'Plateau',
    schedule: 'Tue, Wed, Thu',
  },
  {
    email: 'chloe@wiggledogwalks.com',
    password: 'chloeWiggle1',
    full_name: 'Chloe',
    role: 'senior_walker',
    sector: 'Plateau',
    schedule: 'Mon, Tue, Fri',
  },
  {
    email: 'amanda@wiggledogwalks.com',
    password: 'amandaWiggle1',
    full_name: 'Amanda',
    role: 'senior_walker',
    sector: 'Laurier',
    schedule: 'Mon, Tue, Wed, Thu',
  },
  {
    email: 'belen@wiggledogwalks.com',
    password: 'belenWiggle1',
    full_name: 'Belen',
    role: 'senior_walker',
    sector: 'Laurier',
    schedule: 'Mon, Thu, Fri',
  },
  {
    email: 'amelie@wiggledogwalks.com',
    password: 'amelieWiggle1',
    full_name: 'Amelie',
    role: 'senior_walker',
    sector: 'Laurier',
    schedule: 'Tue, Wed',
  },
  {
    email: 'maeva@wiggledogwalks.com',
    password: 'maevaWiggle1',
    full_name: 'Maeva',
    role: 'senior_walker',
    sector: 'Laurier',
    schedule: 'Fri',
  },
]

async function seed() {
  console.log('Seeding walker accounts...\n')

  // Fetch all existing auth users once
  const { data: { users: allUsers } } = await supabase.auth.admin.listUsers()

  for (const w of walkers) {
    const existing = allUsers.find((u) => u.email === w.email)

    let userId
    if (existing) {
      userId = existing.id
      console.log(`  SKIP auth  ${w.email} (already exists: ${userId})`)
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: w.email,
        password: w.password,
        email_confirm: true,
      })
      if (error) {
        console.error(`  FAIL auth  ${w.email}: ${error.message}`)
        continue
      }
      userId = data.user.id
      console.log(`  OK   auth  ${w.email} -> ${userId}`)
    }

    // Upsert profile row (match on id)
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        email: w.email,
        full_name: w.full_name,
        role: w.role,
        sector: w.sector,
        schedule: w.schedule,
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      console.error(`  FAIL profile ${w.email}: ${profileError.message}`)
    } else {
      console.log(`  OK   profile ${w.email}`)
    }
  }

  // Print final state
  console.log('\n--- All profiles ---')
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, sector, schedule')
    .order('created_at')
  profiles.forEach((p) =>
    console.log(`  ${p.full_name?.padEnd(12)} ${p.email?.padEnd(35)} ${p.role?.padEnd(15)} ${p.sector ?? 'all'}  ${p.schedule ?? ''}`)
  )

  console.log(`\nTotal profiles: ${profiles.length}`)
}

seed().catch(console.error)
