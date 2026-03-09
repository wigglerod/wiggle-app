import { getAdminClient } from '../lib/supabase-admin.js'
import { fetchAcuityRange } from '../lib/acuity-fetch.js'
import { matchEvents, buildNameMap } from '../lib/matcher.js'

/**
 * Monday Final Verification — runs every Monday at 10:00 AM Toronto (2 PM UTC).
 * Re-runs all checks, compares against the 9 AM results, and posts final status.
 */
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = getAdminClient()

  try {
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)

    const monStr = toDateStr(monday)
    const friStr = toDateStr(friday)
    const todayStr = toDateStr(now)

    // ── 1. Fetch and match ────────────────────────────────────────────
    const events = await fetchAcuityRange(monStr, friStr)

    const [dogsRes, mapRes, groupsRes] = await Promise.all([
      supabase.from('dogs').select('*').order('dog_name'),
      supabase.from('acuity_name_map').select('acuity_name, dog_name, acuity_email'),
      supabase.from('walk_groups').select('*').eq('walk_date', todayStr),
    ])

    const dogs = dogsRes.data || []
    const nameMap = buildNameMap(mapRes.data)
    const walkGroups = groupsRes.data || []

    const matched = matchEvents(events, dogs, nameMap)
    const issues = []

    // ── 2. Run all checks (same as schedule-check) ───────────────────

    // Unmatched
    const unmatched = matched.filter((m) => m.matchType === 'none')
    for (const u of unmatched) {
      issues.push({
        type: 'unmatched',
        severity: 'warning',
        message: `Unmatched: "${u.event.summary}" (${u.event.email || 'no email'})`,
      })
    }

    // Group size
    for (const wg of walkGroups) {
      if (wg.dog_ids && wg.dog_ids.length > 10) {
        issues.push({
          type: 'group_size',
          severity: 'warning',
          message: `Group ${wg.group_num} (${wg.sector}) has ${wg.dog_ids.length} dogs (max 10)`,
        })
      }
    }

    // Household splits
    const householdPairs = [
      ['Django', 'Dali'], ['Otis', 'Nico'], ['Dante', 'Enzo OG'],
      ['Loupette', 'Luna'], ['Romeo', 'Miyagi'],
    ]
    for (const [dog1Name, dog2Name] of householdPairs) {
      const dog1 = dogs.find((d) => d.dog_name.toLowerCase().includes(dog1Name.toLowerCase()))
      const dog2 = dogs.find((d) => d.dog_name.toLowerCase().includes(dog2Name.toLowerCase()))
      if (!dog1 || !dog2) continue
      const g1 = walkGroups.find((g) => g.dog_ids?.includes(String(dog1.id)))
      const g2 = walkGroups.find((g) => g.dog_ids?.includes(String(dog2.id)))
      if (g1 && g2 && (g1.group_num !== g2.group_num || g1.sector !== g2.sector)) {
        issues.push({
          type: 'household_split',
          severity: 'info',
          message: `Household split: ${dog1.dog_name} / ${dog2.dog_name}`,
        })
      }
    }

    // Sector mismatch (skip overrides — name_map/email matches are authoritative)
    const skipSectorMethods = new Set(['email', 'email_household', 'name_map'])
    for (const m of matched.filter((m) => m.matchType !== 'none')) {
      if (m.dog?.sector && m.event.sector && m.dog.sector !== m.event.sector
          && !skipSectorMethods.has(m.matchMethod)) {
        issues.push({
          type: 'sector_mismatch',
          severity: 'warning',
          message: `Sector mismatch: ${m.dog.dog_name} (${m.dog.sector} ≠ ${m.event.sector})`,
        })
      }
    }

    // ── 3. Compare against 9 AM results ───────────────────────────────
    const { data: morningCheck } = await supabase
      .from('schedule_checks')
      .select('*')
      .eq('check_date', todayStr)
      .eq('check_time', '9am')
      .single()

    const morningIssues = morningCheck?.issues_found || 0
    const resolved = morningIssues - issues.length
    const newIssues = Math.max(0, issues.length - morningIssues)

    // ── 4. Write verification results ─────────────────────────────────
    const status = issues.length > 0 ? 'issues' : 'clear'
    const slots = new Set(matched.map((m) => m.event.start)).size

    const details = {
      week: `${monStr} to ${friStr}`,
      totalDogs: matched.length,
      unmatchedDogs: unmatched.length,
      timeSlots: slots,
      issues,
      comparison: {
        morningIssues,
        currentIssues: issues.length,
        resolved,
        newIssues,
      },
    }

    await supabase.from('schedule_checks').upsert(
      {
        check_date: todayStr,
        check_time: '10am',
        status,
        issues_found: issues.length,
        details,
      },
      { onConflict: 'check_date,check_time' }
    )

    // ── 5. Update daily note ──────────────────────────────────────────
    let noteText
    if (issues.length === 0) {
      noteText = `✅ Schedule verified and locked! Let's wiggle this week! 🐕 (${matched.length} dogs, ${slots} time slots)`
    } else {
      const issueList = issues.slice(0, 3).map((i) => i.message).join('; ')
      noteText = `⚠️ ${issues.length} issue${issues.length !== 1 ? 's' : ''} still open — ${issueList}${issues.length > 3 ? ` (+${issues.length - 3} more)` : ''}`
      if (resolved > 0) noteText += ` (${resolved} resolved since 9 AM)`
    }

    await supabase.from('daily_notes').upsert(
      {
        note_date: todayStr,
        note_text: noteText,
        created_by: '00000000-0000-0000-0000-000000000000',
      },
      { onConflict: 'note_date' }
    )

    return res.json({ status, issues_found: issues.length, details })
  } catch (err) {
    return res.status(500).json({ error: 'Schedule verification failed', message: err.message })
  }
}

function toDateStr(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
}
