import { getAdminClient } from '../lib/supabase-admin.js'
import { fetchAcuityRange } from '../lib/acuity-fetch.js'
import { matchEvents, buildNameMap } from '../lib/matcher.js'

/**
 * Monday Morning Check — runs every Monday at 9:00 AM Toronto (1 PM UTC).
 * Pulls all Acuity appointments for the current week, runs the intelligent
 * matcher, checks scheduling rules, and writes results + daily note.
 */
export default async function handler(req, res) {
  // Verify cron authorization (Vercel sends this header for cron invocations)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = getAdminClient()
  const issues = []
  const stats = { totalDogs: 0, totalSlots: 0, matchedCount: 0, unmatchedCount: 0 }

  try {
    // ── 1. Determine Mon–Fri of this week ─────────────────────────────
    const now = new Date()
    const day = now.getDay() // 0=Sun, 1=Mon
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)

    const monStr = toDateStr(monday)
    const friStr = toDateStr(friday)
    const todayStr = toDateStr(now)

    // ── 2. Fetch Acuity appointments for the week ─────────────────────
    const events = await fetchAcuityRange(monStr, friStr)
    if (events.length === 0) {
      return writeResults(supabase, todayStr, '9am', 'clear', 0,
        { message: 'No appointments found for this week', events: 0 },
        '✅ No appointments scheduled this week. Enjoy the break! 🐾',
        res
      )
    }

    // ── 3. Load dogs + name map ───────────────────────────────────────
    const [dogsRes, mapRes, groupsRes] = await Promise.all([
      supabase.from('dogs').select('*').order('dog_name'),
      supabase.from('acuity_name_map').select('acuity_name, dog_name'),
      supabase.from('walk_groups').select('*').eq('walk_date', todayStr),
    ])

    const dogs = dogsRes.data || []
    const nameMap = buildNameMap(mapRes.data)
    const walkGroups = groupsRes.data || []

    // ── 4. Run matching ───────────────────────────────────────────────
    const matched = matchEvents(events, dogs, nameMap)
    const unmatched = matched.filter((m) => m.matchType === 'none')
    const matchedOk = matched.filter((m) => m.matchType !== 'none')

    stats.totalDogs = matched.length
    stats.matchedCount = matchedOk.length
    stats.unmatchedCount = unmatched.length

    // Group by time slot
    const slots = new Map()
    for (const m of matched) {
      const key = m.event.start
      if (!slots.has(key)) slots.set(key, [])
      slots.get(key).push(m)
    }
    stats.totalSlots = slots.size

    // ── 5. Check rules ────────────────────────────────────────────────

    // Rule: Unmatched Acuity names
    for (const u of unmatched) {
      issues.push({
        type: 'unmatched',
        severity: 'warning',
        message: `Unmatched: "${u.event.summary}" (${u.event.email || 'no email'})`,
      })
    }

    // Rule: No group > 10 dogs
    for (const wg of walkGroups) {
      if (wg.dog_ids && wg.dog_ids.length > 10) {
        issues.push({
          type: 'group_size',
          severity: 'warning',
          message: `Group ${wg.group_num} (${wg.sector}) has ${wg.dog_ids.length} dogs (max 10)`,
        })
      }
    }

    // Rule: Multi-dog households should be in same group
    const householdPairs = [
      ['Django', 'Dali'],
      ['Otis', 'Nico'],
      ['Dante', 'Enzo OG'],
      ['Loupette', 'Luna'],
      ['Romeo', 'Miyagi'],
    ]
    for (const [dog1Name, dog2Name] of householdPairs) {
      const dog1 = dogs.find((d) => d.dog_name.toLowerCase().includes(dog1Name.toLowerCase()))
      const dog2 = dogs.find((d) => d.dog_name.toLowerCase().includes(dog2Name.toLowerCase()))
      if (!dog1 || !dog2) continue

      // Find which walk group each is in
      const group1 = walkGroups.find((g) => g.dog_ids?.includes(String(dog1.id)))
      const group2 = walkGroups.find((g) => g.dog_ids?.includes(String(dog2.id)))

      if (group1 && group2 && (group1.group_num !== group2.group_num || group1.sector !== group2.sector)) {
        issues.push({
          type: 'household_split',
          severity: 'info',
          message: `Household split: ${dog1.dog_name} (Group ${group1.group_num}) and ${dog2.dog_name} (Group ${group2.group_num})`,
        })
      }
    }

    // Rule: Dogs in correct sector
    for (const m of matchedOk) {
      if (m.dog?.sector && m.event.sector && m.dog.sector !== m.event.sector) {
        issues.push({
          type: 'sector_mismatch',
          severity: 'warning',
          message: `Sector mismatch: ${m.dog.dog_name} is ${m.dog.sector} but booked under ${m.event.sector}`,
        })
      }
    }

    // Rule: Check dog notes for known conflict keywords
    const conflictKeywords = /aggressive|reactive|no contact|avoid|separate|cannot be with|don't mix/i
    for (const m of matchedOk) {
      if (m.dog?.notes && conflictKeywords.test(m.dog.notes)) {
        issues.push({
          type: 'dog_notes_flag',
          severity: 'info',
          message: `Note flagged for ${m.dog.dog_name}: has behavioural notes — verify group placement`,
        })
      }
    }

    // ── 6. Write results ──────────────────────────────────────────────
    const status = issues.length > 0 ? 'issues' : 'clear'
    const details = {
      week: `${monStr} to ${friStr}`,
      totalAppointments: events.length,
      matchedDogs: stats.matchedCount,
      unmatchedDogs: stats.unmatchedCount,
      timeSlots: stats.totalSlots,
      issues,
    }

    const noteText = status === 'clear'
      ? `✅ Schedule looking good! ${stats.totalDogs} dogs across ${stats.totalSlots} time slots this week.`
      : `🔍 Schedule Check (9 AM): ${issues.length} issue${issues.length !== 1 ? 's' : ''} found — ${issues.slice(0, 3).map((i) => i.message).join('; ')}${issues.length > 3 ? ` (+${issues.length - 3} more)` : ''}`

    return writeResults(supabase, todayStr, '9am', status, issues.length, details, noteText, res)
  } catch (err) {
    return res.status(500).json({ error: 'Schedule check failed', message: err.message })
  }
}

async function writeResults(supabase, date, checkTime, status, issuesFound, details, noteText, res) {
  // Write to schedule_checks
  await supabase.from('schedule_checks').upsert(
    {
      check_date: date,
      check_time: checkTime,
      status,
      issues_found: issuesFound,
      details,
    },
    { onConflict: 'check_date,check_time' }
  )

  // Write daily note
  await supabase.from('daily_notes').upsert(
    {
      note_date: date,
      note_text: noteText,
      created_by: '00000000-0000-0000-0000-000000000000', // system user
    },
    { onConflict: 'note_date' }
  )

  return res.json({ status, issues_found: issuesFound, details })
}

function toDateStr(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
}
