#!/usr/bin/env node
/**
 * match_check.mjs — One-off script to check Acuity → Dog matching problems
 * for the week of March 9-13, 2026.
 *
 * Outputs ONLY problems to ~/Desktop/match_check.txt
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// ── Set env vars before importing modules that need them ──────────────
process.env.ACUITY_USER_ID = '36214691'
process.env.ACUITY_API_KEY = 'b38a6e8e197aad3d450d87e2715a6ee1'

const SUPABASE_URL = 'https://ifhniwjdrsswgemmqddn.supabase.co'
// Use service_role key to bypass RLS for this admin check script
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmaG5pd2pkcnNzd2dlbW1xZGRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIxNjU5MSwiZXhwIjoyMDg3NzkyNTkxfQ.4W7JSOWULKEr8yYTcGuWGJVzECfAL0mtfAHdHLdE9CA'

// ── Import matcher and acuity fetcher ─────────────────────────────────
const { buildNameMap, matchEvents } = await import('../api/lib/matcher.js')
const { fetchAcuityDate } = await import('../api/lib/acuity-fetch.js')

// ── Dates ─────────────────────────────────────────────────────────────
const DAYS = [
  { date: '2026-03-09', label: 'Monday March 9' },
  { date: '2026-03-10', label: 'Tuesday March 10' },
  { date: '2026-03-11', label: 'Wednesday March 11' },
  { date: '2026-03-12', label: 'Thursday March 12' },
  { date: '2026-03-13', label: 'Friday March 13' },
]

// ── Fetch Supabase data ───────────────────────────────────────────────
async function supabaseGet(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*${query}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!res.ok) {
    throw new Error(`Supabase ${table} fetch failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching dogs from Supabase...')
  const dogs = await supabaseGet('dogs', '&order=dog_name')
  console.log(`  → ${dogs.length} dogs loaded`)

  console.log('Fetching acuity_name_map from Supabase...')
  const nameMapRows = await supabaseGet('acuity_name_map')
  console.log(`  → ${nameMapRows.length} name map entries loaded`)

  const nameMap = buildNameMap(nameMapRows)

  // Collect all known emails from dogs table (handle comma-separated)
  const dogEmails = new Set()
  for (const d of dogs) {
    if (d.email) {
      for (const e of d.email.toLowerCase().split(',')) {
        dogEmails.add(e.trim())
      }
    }
  }

  // Fetch per-day to avoid Acuity's 100-result pagination limit
  const eventsByDate = new Map()
  let totalAppts = 0
  for (const day of DAYS) {
    console.log(`Fetching Acuity appointments for ${day.label}...`)
    const events = await fetchAcuityDate(day.date)
    eventsByDate.set(day.date, events)
    totalAppts += events.length
    console.log(`  → ${events.length} appointments`)
  }
  console.log(`  → ${totalAppts} total appointments fetched across all days`)

  // Collect all unique Acuity emails for the "new emails" check
  const acuityEmails = new Set()

  const output = []
  output.push('=' .repeat(70))
  output.push('  WIGGLE MATCH CHECK — Week of March 9-13, 2026')
  output.push('  Generated: ' + new Date().toLocaleString())
  output.push('='.repeat(70))
  output.push('')

  let totalProblems = 0

  for (const day of DAYS) {
    const events = eventsByDate.get(day.date) || []
    if (events.length === 0) continue

    // Run matcher
    const results = matchEvents(events, dogs, nameMap)

    // Collect emails (split comma-separated)
    for (const ev of events) {
      if (ev.email) {
        for (const e of ev.email.toLowerCase().split(',')) {
          acuityEmails.add(e.trim())
        }
      }
    }

    // Find problems
    const problems = []

    for (const r of results) {
      const ev = r.event

      // UNMATCHED
      if (r.matchMethod === 'none') {
        problems.push(
          `  ⚠️  UNMATCHED: "${ev.summary}" — ${ev.email || 'no email'} | ${ev.phone || 'no phone'} | Sector: ${ev.sector || '?'}`
        )
        continue
      }

      // FUZZY ONLY
      if (r.matchMethod === 'fuzzy_name') {
        problems.push(
          `  🔀 FUZZY ONLY: "${r.displayName}" → matched "${r.dog?.dog_name}" (might be wrong) | ${ev.email || ''}`
        )
        continue
      }

      // OWNER NAME (booked under owner's name, not dog's name)
      if ((r.matchMethod === 'email' || r.matchMethod === 'email_household') &&
          ev.firstName && r.dog &&
          ev.firstName.toLowerCase().trim() !== r.dog.dog_name.toLowerCase().trim()) {
        problems.push(
          `  👤 OWNER NAME: Booked as "${ev.firstName}" → matched dog "${r.dog.dog_name}" (via ${r.matchMethod}) | ${ev.email || ''}`
        )
      }

      // MISSING PROFILE (dog matched but no address)
      if (r.dog && (!r.dog.address || r.dog.address.trim() === '')) {
        problems.push(
          `  🐕 MISSING PROFILE: "${r.dog.dog_name}" has no address | ${ev.email || ''}`
        )
      }
    }

    if (problems.length > 0) {
      output.push('─'.repeat(70))
      output.push(`  ${day.label} — ${events.length} appointments, ${problems.length} problems`)
      output.push('─'.repeat(70))
      for (const p of problems) {
        output.push(p)
      }
      output.push('')
      totalProblems += problems.length
    }
  }

  // ── New Emails Check ────────────────────────────────────────────────
  const newEmails = [...acuityEmails].filter(e => !dogEmails.has(e)).sort()
  if (newEmails.length > 0) {
    output.push('─'.repeat(70))
    output.push(`  📧 NEW EMAILS — ${newEmails.length} Acuity emails not found in dogs table`)
    output.push('─'.repeat(70))
    for (const email of newEmails) {
      output.push(`  • ${email}`)
    }
    output.push('')
    totalProblems += newEmails.length
  }

  // ── Summary ─────────────────────────────────────────────────────────
  output.push('='.repeat(70))
  if (totalProblems === 0) {
    output.push('  ✅ No problems found! All appointments matched cleanly.')
  } else {
    output.push(`  TOTAL: ${totalProblems} problems found`)
  }
  output.push('='.repeat(70))

  const text = output.join('\n') + '\n'
  const outPath = join(homedir(), 'Desktop', 'match_check_v3.txt')
  writeFileSync(outPath, text, 'utf-8')
  console.log(`\nResults written to ${outPath}`)
  console.log(text)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
