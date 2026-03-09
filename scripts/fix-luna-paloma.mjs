import pg from 'pg'
import { readFileSync } from 'fs'

const envText = readFileSync('.env.local', 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2]
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function run() {
  await client.connect()
  console.log('Connected to Supabase\n')

  // ── 1. Fix acuity_email column to be NOT NULL DEFAULT '' ───────────
  console.log('=== Fixing acuity_email column ===')
  await client.query(`ALTER TABLE acuity_name_map ADD COLUMN IF NOT EXISTS acuity_email text`)
  await client.query(`UPDATE acuity_name_map SET acuity_email = '' WHERE acuity_email IS NULL`)
  await client.query(`ALTER TABLE acuity_name_map ALTER COLUMN acuity_email SET DEFAULT ''`)
  await client.query(`ALTER TABLE acuity_name_map ALTER COLUMN acuity_email SET NOT NULL`)
  console.log('Column acuity_email is now NOT NULL DEFAULT empty string')

  // Drop old constraints/indexes
  await client.query(`ALTER TABLE acuity_name_map DROP CONSTRAINT IF EXISTS acuity_name_map_acuity_name_key`)
  await client.query(`DROP INDEX IF EXISTS acuity_name_map_name_email_unique`)
  console.log('Dropped old constraints')

  // Create regular unique constraint
  await client.query(`
    ALTER TABLE acuity_name_map
    ADD CONSTRAINT acuity_name_map_name_email_unique UNIQUE (acuity_name, acuity_email)
  `)
  console.log('Created unique constraint on (acuity_name, acuity_email)')

  // ── 2. Insert Luna email-conditional mappings ──────────────────────
  console.log('\n=== Luna disambiguation ===')
  const lunaEntries = [
    ['Luna', 'Luna GS', 'rgodbout66@gmail.com'],
    ['Luna', 'Luna GS', 'rgodbout@hotmail.com'],
    ['Luna', 'Luna', 'beaudoin.florence23@gmail.com'],
  ]
  for (const [acuityName, dogName, email] of lunaEntries) {
    const res = await client.query(
      `INSERT INTO acuity_name_map (acuity_name, dog_name, acuity_email)
       VALUES ($1, $2, $3)
       ON CONFLICT (acuity_name, acuity_email) DO UPDATE SET dog_name = $2
       RETURNING id`,
      [acuityName, dogName, email]
    )
    console.log(`  ${acuityName} (${email}) -> ${dogName}: ${res.rows.length ? 'OK' : 'exists'}`)
  }

  // ── 3. Verify ─────────────────────────────────────────────────────
  console.log('\n=== Verification ===')
  const maps = await client.query(`SELECT acuity_name, dog_name, acuity_email FROM acuity_name_map ORDER BY acuity_name, acuity_email`)
  for (const m of maps.rows) {
    console.log(`  ${m.acuity_name}${m.acuity_email ? ` (${m.acuity_email})` : ''} -> ${m.dog_name}`)
  }

  await client.end()
  console.log('\nDone!')
}

run().catch((err) => { console.error(err); process.exit(1) })
