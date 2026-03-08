#!/usr/bin/env node
/**
 * Wiggle — Create test user accounts + walk logs
 * Usage: node scripts/create-test-users.mjs
 * Requires: DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

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

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env.local')
  process.exit(1)
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TEST_USERS = [
  { email: 'rodrigo@wiggledogwalks.com',   password: 'WiggleTest2026!', role: 'admin',          full_name: 'Rodrigo Galvan' },
  { email: 'gen@wiggledogwalks.com',        password: 'WiggleTest2026!', role: 'admin',          full_name: 'Gen' },
  { email: 'wigglepro@wiggledogwalks.com',  password: 'WiggleTest2026!', role: 'senior_walker',  full_name: 'Wiggle Pro' },
  { email: 'pupwalker@wiggledogwalks.com',  password: 'WiggleTest2026!', role: 'junior_walker',  full_name: 'Pup Walker' },
]

async function createUserViaAPI(email, password) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (err.msg?.includes('already been registered') || err.message?.includes('already been registered')) {
      console.log(`    ${email} already exists, skipping creation`)
      // Fetch existing user ID
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, {
        headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY },
      })
      if (listRes.ok) {
        const { users } = await listRes.json()
        const existing = users.find(u => u.email === email)
        return existing?.id || null
      }
      return null
    }
    console.warn(`    Failed to create ${email}:`, err.msg || err.message || res.status)
    return null
  }
  const data = await res.json()
  return data.id
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected to Supabase Postgres\n')

  try {
    // -----------------------------------------------------------------------
    // STEP 1: Create test users
    // -----------------------------------------------------------------------
    console.log('STEP 1 — Creating test users...')

    if (!SERVICE_ROLE_KEY) {
      console.log('  No SUPABASE_SERVICE_ROLE_KEY found — creating users directly in DB')
      console.log('  Note: Users created this way may need auth signup via the app')
    }

    const userIds = {}

    for (const u of TEST_USERS) {
      let userId = null

      if (SERVICE_ROLE_KEY) {
        userId = await createUserViaAPI(u.email, u.password)
      }

      if (userId) {
        // Upsert profile
        await client.query(`
          INSERT INTO profiles (id, email, full_name, role)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET role = $4, full_name = $3
        `, [userId, u.email, u.full_name, u.role])
        userIds[u.email] = userId
        console.log(`  ✓ ${u.email} → ${u.role} (${u.full_name})`)
      } else if (!SERVICE_ROLE_KEY) {
        // Without API, just update existing profiles
        const { rowCount } = await client.query(`
          UPDATE profiles SET role = $1, full_name = $2 WHERE email = $3
        `, [u.role, u.full_name, u.email])
        if (rowCount > 0) {
          console.log(`  ✓ ${u.email} → ${u.role} (updated existing)`)
          const { rows } = await client.query(`SELECT id FROM profiles WHERE email = $1`, [u.email])
          if (rows[0]) userIds[u.email] = rows[0].id
        } else {
          console.log(`  ⚠ ${u.email} — no existing profile found, sign up via app first`)
        }
      }
    }

    // -----------------------------------------------------------------------
    // STEP 2: Insert test walk logs
    // -----------------------------------------------------------------------
    console.log('\nSTEP 2 — Creating test walk logs...')

    const today = new Date().toISOString().split('T')[0]

    // Get some dogs for test logs
    const { rows: dogs } = await client.query(`
      SELECT id, dog_name, sector FROM dogs ORDER BY dog_name LIMIT 10
    `)

    const plateauDog = dogs.find(d => d.sector === 'Plateau')
    const laurierDog = dogs.find(d => d.sector === 'Laurier')
    const plateauDog2 = dogs.find(d => d.sector === 'Plateau' && d.id !== plateauDog?.id)

    const proId = userIds['wigglepro@wiggledogwalks.com']
    const pupId = userIds['pupwalker@wiggledogwalks.com']

    if (proId && plateauDog && laurierDog) {
      // Wiggle Pro: 2 completed walks
      await client.query(`
        INSERT INTO walk_logs (walker_id, dog_id, walk_date, status, notes)
        VALUES ($1, $2, $3, 'completed', 'Great walk! Very energetic today.')
        ON CONFLICT DO NOTHING
      `, [proId, plateauDog.id, today])
      console.log(`  ✓ Wiggle Pro walked ${plateauDog.dog_name} (Plateau)`)

      await client.query(`
        INSERT INTO walk_logs (walker_id, dog_id, walk_date, status, notes)
        VALUES ($1, $2, $3, 'completed', 'Nice calm walk in the park.')
        ON CONFLICT DO NOTHING
      `, [proId, laurierDog.id, today])
      console.log(`  ✓ Wiggle Pro walked ${laurierDog.dog_name} (Laurier)`)
    } else {
      console.log('  ⚠ Could not create Wiggle Pro walk logs (missing user or dogs)')
    }

    if (pupId && plateauDog2) {
      // Pup Walker: 1 completed walk
      await client.query(`
        INSERT INTO walk_logs (walker_id, dog_id, walk_date, status, notes)
        VALUES ($1, $2, $3, 'completed', 'First walk with this pup — went great!')
        ON CONFLICT DO NOTHING
      `, [pupId, plateauDog2.id, today])
      console.log(`  ✓ Pup Walker walked ${plateauDog2.dog_name} (Plateau)`)
    } else {
      console.log('  ⚠ Could not create Pup Walker walk logs (missing user or dogs)')
    }

    // -----------------------------------------------------------------------
    // Verify
    // -----------------------------------------------------------------------
    console.log('\nVerification:')
    const { rows: profiles } = await client.query(
      `SELECT email, role, full_name FROM profiles ORDER BY role, email`
    )
    for (const p of profiles) {
      console.log(`  ${p.email} → ${p.role} (${p.full_name || 'no name'})`)
    }

    const { rows: logCount } = await client.query(
      `SELECT count(*)::int AS total FROM walk_logs WHERE walk_date = $1`, [today]
    )
    console.log(`  Walk logs today: ${logCount[0].total}`)

  } finally {
    await client.end()
    console.log('\nDone.')
  }
}

main().catch(err => {
  console.error('Script failed:', err.message)
  process.exit(1)
})
