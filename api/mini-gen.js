import { getAdminClient } from './lib/supabase-admin.js'

/**
 * Mini Gen — the first Wiggle agent.
 * Fetches this week's Acuity bookings, resolves names, checks conflicts/capacity/vacations/packages,
 * writes a draft to mini_gen_drafts, and flags issues in walker_notes.
 *
 * POST /api/mini-gen
 * Returns JSON summary of what it did.
 */
export default async function handler(req, res) {
  console.log(`[mini-gen] ${req.method} ${req.url} hit at ${new Date().toISOString()}`)

  // Vercel Cron sends GET — allow it if CRON_SECRET matches
  if (req.method === 'GET') {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(405).json({ error: 'POST only' })
    }
  } else if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  const log = []
  const push = (msg) => { log.push(msg); console.log(`[mini-gen] ${msg}`) }

  // Gen's UUID — Mini Gen writes flags under Gen's identity (admin, sector both)
  const GEN_UUID = 'db94d31c-90b7-410e-9ce1-e8f79a752925'

  try {
    const sb = getAdminClient()
    const today = new Date()
    const body = req.body || {}
    // Allow explicit date override: { monday: 'YYYY-MM-DD', friday: 'YYYY-MM-DD' }
    const { monday, friday } = body.monday && body.friday
      ? { monday: body.monday, friday: body.friday }
      : getWeekRange(today)

    push(`Run date: ${today.toISOString().slice(0, 10)}`)
    push(`Week range: ${monday} → ${friday}`)

    // ================================================================
    // STEP 1 — FETCH ACUITY BOOKINGS (Mon–Fri, both sectors)
    // ================================================================
    push('STEP 1 — Fetching Acuity bookings...')

    const appointments = await fetchAcuityWeek(monday, friday)
    push(`Fetched ${appointments.length} total appointments`)

    // Filter to Plateau + Laurier only (exclude Private and others)
    const PLATEAU_TYPE = 80336576
    const LAURIER_TYPE = 80336804
    const sectorMap = { [PLATEAU_TYPE]: 'Plateau', [LAURIER_TYPE]: 'Laurier' }

    const bookings = appointments
      .filter((a) => sectorMap[a.appointmentTypeID])
      .map((a) => ({
        acuityId: a.id,
        firstName: (a.firstName || '').trim(),
        lastName: (a.lastName || '').trim(),
        ownerName: [a.firstName, a.lastName].filter(Boolean).join(' ').trim(),
        email: (a.email || '').trim().toLowerCase(),
        date: a.datetime.slice(0, 10),
        sector: sectorMap[a.appointmentTypeID],
      }))

    push(`Filtered to ${bookings.length} walk bookings (Plateau + Laurier)`)

    // ================================================================
    // STEP 2 — RESOLVE NAMES
    // ================================================================
    push('STEP 2 — Resolving names...')

    const { data: nameMap } = await sb.from('acuity_name_map').select('acuity_name, dog_name, acuity_email')
    const { data: allDogs } = await sb.from('dogs').select('id, dog_name, sector, owner_first, owner_last')

    const resolved = []   // { dogName, dogUuid, sector, date, ownerName }
    const unresolved = [] // { ownerName, email, date, sector, bestGuess, confidence }

    for (const booking of bookings) {
      const results = resolveName(booking, nameMap || [], allDogs || [])
      for (const result of results) {
        if (result.resolved) {
          resolved.push({
            dogName: result.dogName,
            dogUuid: result.dogUuid,
            sector: booking.sector,
            date: booking.date,
            ownerName: booking.ownerName,
          })
        } else {
          unresolved.push({
            ownerName: booking.ownerName,
            email: booking.email,
            date: booking.date,
            sector: booking.sector,
            bestGuess: result.bestGuess,
            confidence: result.confidence,
          })
        }
      }
    }

    push(`Resolved: ${resolved.length} | Unresolved: ${unresolved.length}`)

    // ================================================================
    // STEP 3 — CHECK CONFLICTS
    // ================================================================
    push('STEP 3 — Checking conflicts...')

    const { data: conflictRows } = await sb.from('dog_conflicts').select('dog_1_name, dog_2_name, reason')
    const conflicts = []

    for (const c of conflictRows || []) {
      // Check each day: are both dogs in the same sector on the same day?
      const days = [...new Set(resolved.map((r) => r.date))]
      for (const day of days) {
        const dogsOnDay = resolved.filter((r) => r.date === day)
        const dog1 = dogsOnDay.find((d) => d.dogName === c.dog_1_name)
        const dog2 = dogsOnDay.find((d) => d.dogName === c.dog_2_name)
        if (dog1 && dog2 && dog1.sector === dog2.sector) {
          conflicts.push({
            date: day,
            sector: dog1.sector,
            dog1: c.dog_1_name,
            dog2: c.dog_2_name,
            reason: c.reason,
          })
        }
      }
    }

    push(`Conflicts found: ${conflicts.length}`)

    // ================================================================
    // STEP 4 — CHECK CAPACITY
    // ================================================================
    push('STEP 4 — Checking capacity...')

    const capacityWarnings = []
    const daySectorCounts = {}

    for (const r of resolved) {
      const key = `${r.date}_${r.sector}`
      daySectorCounts[key] = (daySectorCounts[key] || 0) + 1
    }

    for (const [key, count] of Object.entries(daySectorCounts)) {
      const [date, sector] = key.split('_')
      if (count >= 20) {
        capacityWarnings.push({
          date,
          sector,
          count,
          level: count >= 25 ? 'critical' : 'warn',
        })
      }
    }

    push(`Capacity warnings: ${capacityWarnings.length}`)

    // ================================================================
    // STEP 5 — CHECK VACATIONS
    // ================================================================
    push('STEP 5 — Checking vacations...')

    // Read expected_schedule for dogs that are NOT scheduled this week
    const { data: scheduleRows } = await sb
      .from('expected_schedule')
      .select('dog_name, type, monday, tuesday, wednesday, thursday, friday')

    // Read existing not_walking notes for this week
    const { data: notWalkingRows } = await sb
      .from('walker_notes')
      .select('dog_name, walk_date')
      .eq('note_type', 'not_walking')
      .gte('walk_date', monday)
      .lte('walk_date', friday)

    const notWalkingSet = new Set(
      (notWalkingRows || []).map((r) => `${r.dog_name}_${r.walk_date}`)
    )

    const vacationConflicts = []
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

    for (const r of resolved) {
      // Check if this dog is marked not_walking for this date
      if (notWalkingSet.has(`${r.dogName}_${r.date}`)) {
        vacationConflicts.push({
          date: r.date,
          dogName: r.dogName,
          reason: 'Booked in Acuity but marked not_walking in walker_notes',
        })
        continue
      }

      // Check expected_schedule — if dog has a schedule row, check if they walk on this day
      const sched = (scheduleRows || []).find((s) => s.dog_name === r.dogName)
      if (sched && sched.type === 'regular') {
        const dayOfWeek = new Date(r.date).getDay() // 1=Mon ... 5=Fri
        const dayKey = dayNames[dayOfWeek - 1]
        if (dayKey && sched[dayKey] === false) {
          vacationConflicts.push({
            date: r.date,
            dogName: r.dogName,
            reason: `Booked in Acuity but expected_schedule says no walk on ${dayKey}`,
          })
        }
      }
    }

    push(`Vacation conflicts: ${vacationConflicts.length}`)

    // ================================================================
    // STEP 6 — CHECK PACKAGES (placeholder — Acuity package data TBD)
    // ================================================================
    push('STEP 6 — Checking packages...')

    // Package balance lives in Acuity, not Supabase. The Acuity appointments API
    // does not return package balance. This step is a placeholder until we have
    // a billing/package query endpoint. For now, log and skip.
    const packageWarnings = []
    push('Package check: skipped (no package balance data in current API)')

    // ================================================================
    // STEP 7 — WRITE DRAFT + FLAGS
    // ================================================================
    push('STEP 7 — Writing draft to mini_gen_drafts...')

    // Group resolved dogs by date + sector
    const draftGroups = {}
    for (const r of resolved) {
      const key = `${r.date}_${r.sector}`
      if (!draftGroups[key]) {
        draftGroups[key] = { date: r.date, sector: r.sector, dogNames: [], dogUuids: [] }
      }
      draftGroups[key].dogNames.push(r.dogName)
      draftGroups[key].dogUuids.push(r.dogUuid)
    }

    const runDate = today.toISOString().slice(0, 10)

    // Delete any previous draft for this week (idempotent re-runs)
    await sb
      .from('mini_gen_drafts')
      .delete()
      .eq('run_date', runDate)
      .gte('walk_date', monday)
      .lte('walk_date', friday)

    // Collect all flags for each day+sector
    const flagsByKey = {}
    const addFlag = (date, sector, flag) => {
      const key = `${date}_${sector}`
      if (!flagsByKey[key]) flagsByKey[key] = []
      flagsByKey[key].push(flag)
    }

    for (const u of unresolved) {
      addFlag(u.date, u.sector, { type: 'unresolved', ownerName: u.ownerName, bestGuess: u.bestGuess, confidence: u.confidence })
    }
    for (const c of conflicts) {
      addFlag(c.date, c.sector, { type: 'conflict', dog1: c.dog1, dog2: c.dog2, reason: c.reason })
    }
    for (const w of capacityWarnings) {
      addFlag(w.date, w.sector, { type: 'capacity', count: w.count, level: w.level })
    }
    for (const v of vacationConflicts) {
      // Determine sector from resolved data
      const r = resolved.find((d) => d.dogName === v.dogName && d.date === v.date)
      if (r) addFlag(v.date, r.sector, { type: 'vacation', dogName: v.dogName, reason: v.reason })
    }

    // Write draft rows
    const draftRows = Object.values(draftGroups).map((g) => ({
      run_date: runDate,
      walk_date: g.date,
      sector: g.sector,
      dog_names: g.dogNames,
      dog_uuids: g.dogUuids,
      status: 'pending',
      flags: flagsByKey[`${g.date}_${g.sector}`] || [],
    }))

    // Also write rows for days that have flags but no resolved dogs
    for (const [key, flags] of Object.entries(flagsByKey)) {
      if (!draftGroups[key]) {
        const [date, sector] = key.split('_')
        draftRows.push({
          run_date: runDate,
          walk_date: date,
          sector,
          dog_names: [],
          dog_uuids: [],
          status: 'pending',
          flags,
        })
      }
    }

    let draftWritten = false
    if (draftRows.length > 0) {
      const { error: draftErr } = await sb.from('mini_gen_drafts').insert(draftRows)
      if (draftErr) {
        push(`ERROR writing drafts: ${draftErr.message}`)
      } else {
        draftWritten = true
        push(`Wrote ${draftRows.length} draft rows to mini_gen_drafts`)
      }
    }

    // Write flags to walker_notes (resolver_flag)
    push('Writing flags to walker_notes...')

    // Delete previous resolver_flag rows for this week (idempotent)
    await sb
      .from('walker_notes')
      .delete()
      .eq('note_type', 'resolver_flag')
      .gte('walk_date', monday)
      .lte('walk_date', friday)

    const flagNotes = []

    for (const u of unresolved) {
      flagNotes.push({
        note_type: 'resolver_flag',
        dog_name: u.bestGuess || u.ownerName,
        message: `Unresolved Acuity name: "${u.ownerName}" (email: ${u.email}). Best guess: ${u.bestGuess || 'none'} (${u.confidence})`,
        walk_date: u.date,
        walker_id: GEN_UUID,
        walker_name: 'Mini Gen',
        tags: ['unresolved'],
      })
    }

    for (const c of conflicts) {
      flagNotes.push({
        note_type: 'resolver_flag',
        dog_name: `${c.dog1} + ${c.dog2}`,
        message: `Conflict: ${c.dog1} and ${c.dog2} both booked in ${c.sector}. Reason: ${c.reason}`,
        walk_date: c.date,
        walker_id: GEN_UUID,
        walker_name: 'Mini Gen',
        tags: ['conflict'],
      })
    }

    for (const w of capacityWarnings) {
      flagNotes.push({
        note_type: 'resolver_flag',
        dog_name: `${w.sector} capacity`,
        message: `${w.level.toUpperCase()}: ${w.count} dogs in ${w.sector} on ${w.date}`,
        walk_date: w.date,
        walker_id: GEN_UUID,
        walker_name: 'Mini Gen',
        tags: ['capacity'],
      })
    }

    for (const v of vacationConflicts) {
      flagNotes.push({
        note_type: 'resolver_flag',
        dog_name: v.dogName,
        message: v.reason,
        walk_date: v.date,
        walker_id: GEN_UUID,
        walker_name: 'Mini Gen',
        tags: ['vacation'],
      })
    }

    if (flagNotes.length > 0) {
      const { error: flagErr } = await sb.from('walker_notes').insert(flagNotes)
      if (flagErr) {
        push(`ERROR writing flags: ${flagErr.message}`)
      } else {
        push(`Wrote ${flagNotes.length} flag rows to walker_notes`)
      }
    } else {
      push('No flags to write')
    }

    // ================================================================
    // STEP 8 — RETURN SUMMARY
    // ================================================================
    push('STEP 8 — Done.')

    const summary = {
      run_date: runDate,
      week: `${monday} → ${friday}`,
      resolved: resolved.length,
      unresolved: unresolved.length,
      conflicts: conflicts.length,
      capacity_warnings: capacityWarnings.length,
      vacation_conflicts: vacationConflicts.length,
      package_warnings: packageWarnings.length,
      draft_written: draftWritten,
      draft_rows: draftRows.length,
      flag_rows: flagNotes.length,
      log,
    }

    push(JSON.stringify({ ...summary, log: undefined }, null, 2))
    return res.status(200).json(summary)
  } catch (err) {
    push(`FATAL: ${err.message}`)
    return res.status(500).json({ error: err.message, log })
  }
}

// ================================================================
// HELPERS
// ================================================================

/**
 * Get Monday and Friday dates for the current week.
 */
function getWeekRange(today) {
  const d = new Date(today)
  const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMonday)
  const fri = new Date(mon)
  fri.setDate(mon.getDate() + 4)
  return {
    monday: mon.toISOString().slice(0, 10),
    friday: fri.toISOString().slice(0, 10),
  }
}

/**
 * Fetch all Acuity appointments for a date range.
 * Reuses the same auth pattern as api/acuity.js.
 */
async function fetchAcuityWeek(minDate, maxDate) {
  const userId = process.env.ACUITY_USER_ID
  const apiKey = process.env.ACUITY_API_KEY
  if (!userId || !apiKey) throw new Error('Acuity not configured')

  const auth = Buffer.from(`${userId}:${apiKey}`).toString('base64')
  const url = `https://acuityscheduling.com/api/v1/appointments?minDate=${minDate}&maxDate=${maxDate}&canceled=false&max=500`
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  })

  if (!response.ok) {
    throw new Error(`Acuity API returned ${response.status}`)
  }

  return response.json()
}

/**
 * Resolve an Acuity booking to a dog name + UUID.
 *
 * Lookup key: booking.firstName (Acuity stores owner first name,
 * acuity_name_map.acuity_name stores first name only — not full name).
 *
 * Strategy (in order):
 * 1. Exact match: firstName against acuity_name_map.acuity_name
 *    Returns ALL matching dogs (same-household pairs like Romeo + Miyagi).
 * 2. Email match: booking.email against acuity_name_map.acuity_email
 * 3. Fuzzy match: firstName against dogs.owner_first
 *
 * Always returns an array of results.
 */
function resolveName(booking, nameMap, allDogs) {
  const firstName = booking.firstName.trim().toLowerCase()
  const email = booking.email.trim().toLowerCase()

  // Helper: look up dog UUID from dogs table by dog_name
  const findDog = (dogName) => allDogs.find((d) => d.dog_name === dogName)

  // 1. Exact match — collect ALL dogs for this acuity_name (household pairs)
  const exactMatches = nameMap.filter(
    (m) => m.acuity_name.toLowerCase() === firstName
  )

  if (exactMatches.length >= 1) {
    const results = []
    for (const match of exactMatches) {
      const dog = findDog(match.dog_name)
      if (dog) {
        results.push({ resolved: true, dogName: dog.dog_name, dogUuid: dog.id })
      } else {
        results.push({ resolved: false, bestGuess: match.dog_name, confidence: 'LOW' })
      }
    }
    return results
  }

  // 2. Email match — booking.email against acuity_name_map.acuity_email
  const emailMatch = nameMap.find(
    (m) => m.acuity_email && m.acuity_email.toLowerCase() === email
  )
  if (emailMatch) {
    const dog = findDog(emailMatch.dog_name)
    if (dog) return [{ resolved: true, dogName: dog.dog_name, dogUuid: dog.id }]
    return [{ resolved: false, bestGuess: emailMatch.dog_name, confidence: 'MEDIUM' }]
  }

  // 3. Fuzzy match — firstName against dogs.owner_first
  const ownerMatches = allDogs.filter((d) => {
    const of = (d.owner_first || '').trim().toLowerCase()
    return of && of === firstName
  })
  if (ownerMatches.length === 1) {
    return [{ resolved: false, bestGuess: ownerMatches[0].dog_name, confidence: 'MEDIUM' }]
  }

  // Try dog_name direct match (e.g. booking firstName = "Halloumi")
  const dogNameMatch = allDogs.find((d) => d.dog_name.toLowerCase() === firstName)
  if (dogNameMatch) {
    return [{ resolved: false, bestGuess: dogNameMatch.dog_name, confidence: 'MEDIUM' }]
  }

  // No match at all
  return [{ resolved: false, bestGuess: null, confidence: 'NONE' }]
}
