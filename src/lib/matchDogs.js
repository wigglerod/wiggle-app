import levenshtein from 'fast-levenshtein'

function toTitleCase(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function digitsOnly(str) {
  return (str || '').replace(/\D/g, '')
}

/**
 * Extract the primary dog name from a calendar SUMMARY string.
 * Kept for backward compatibility.
 */
export function extractDogName(summary) {
  const first = (summary || '').trim().split(/\s+/)[0]
  return toTitleCase(first)
}

/**
 * Legacy single-dog matcher. Kept for backward compatibility.
 */
export function matchDog(calendarName, dogs) {
  const normalized = calendarName.toLowerCase().trim()
  const exact = dogs.find((d) => d.dog_name.toLowerCase().trim() === normalized)
  if (exact) return { dog: exact, matchType: 'exact' }

  let best = null
  let bestDist = Infinity
  for (const dog of dogs) {
    const dist = levenshtein.get(normalized, dog.dog_name.toLowerCase().trim())
    if (dist < bestDist) {
      bestDist = dist
      best = dog
    }
  }
  if (bestDist <= 2) return { dog: best, matchType: 'fuzzy' }
  return { dog: null, matchType: 'none' }
}

// ---------------------------------------------------------------------------
// Multi-signal matching system
// ---------------------------------------------------------------------------

// Sector overrides — dogs that always belong to a specific sector
const SECTOR_OVERRIDES = { Paloma: 'Plateau' }

/**
 * Build a name map from Supabase rows.
 * Supports optional acuity_email for email-conditional disambiguation.
 * Returns Map of lowercase_name → Array of { dogName, email (lowercase|null) }
 */
export function buildNameMap(rows) {
  const map = new Map()
  for (const row of rows || []) {
    if (row.acuity_name && row.dog_name) {
      const key = row.acuity_name.toLowerCase().trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push({
        dogName: row.dog_name.trim(),
        email: row.acuity_email?.trim() || null,
      })
    }
  }
  return map
}

/**
 * Look up a name in the name map, optionally filtering by email.
 * Email-specific entries take priority over generic ones.
 */
function lookupNameMap(nameMap, name, eventEmail) {
  const entries = nameMap.get(name.toLowerCase().trim())
  if (!entries) return null
  if (eventEmail) {
    const emailLower = eventEmail.toLowerCase().trim()
    const emailMatch = entries.find((e) => e.email === emailLower)
    if (emailMatch) return emailMatch.dogName
  }
  const generic = entries.find((e) => !e.email)
  return generic ? generic.dogName : null
}

/**
 * Match raw Acuity events against dog profiles using multi-signal matching.
 * May return MORE results than input events (multi-dog households get split).
 *
 * Priority: nameMap → exact name → multi-dog split → email → lastName+sector → phone → fuzzy
 *
 * @param {Array} events  - Raw Acuity events (with email, phone, firstName, lastName)
 * @param {Array} dogs    - All dog profiles from Supabase
 * @param {Map}   nameMap - From buildNameMap()
 * @returns {Array} Array of { event, displayName, breed, dog, matchType, matchMethod }
 */
export function matchEvents(events, dogs, nameMap = new Map()) {
  const results = []
  for (const ev of events) {
    results.push(...matchSingleEvent(ev, dogs, nameMap))
  }
  // Apply sector overrides
  for (const r of results) {
    if (r.dog && SECTOR_OVERRIDES[r.dog.dog_name]) {
      r.sectorOverride = SECTOR_OVERRIDES[r.dog.dog_name]
    }
  }
  return results
}

function matchSingleEvent(ev, dogs, nameMap) {
  const summary = (ev.summary || '').trim()
  if (!summary) return [makeResult(ev, 'Unknown', null, null, 'none', 'none')]

  const words = summary.split(/\s+/)

  // ── 1. MANUAL OVERRIDE MAP (check longest prefix first) ─────────
  for (let len = Math.min(words.length, 5); len >= 1; len--) {
    const candidate = words.slice(0, len).join(' ')
    const mapped = lookupNameMap(nameMap, candidate, ev.email)
    if (mapped) {
      const dog = dogs.find((d) => d.dog_name.toLowerCase() === mapped.toLowerCase())
      const breed = words.slice(len).join(' ') || null
      return [makeResult(ev, mapped, breed, dog || null, dog ? 'exact' : 'none', 'name_map')]
    }
  }

  // ── 2. MULTI-DOG HOUSEHOLD ("X and Y", "X et Y", "X & Y") ──────
  const multiMatch = summary.match(/^(.+?)\s+(?:and|et|&)\s+(.+?)$/i)
  if (multiMatch) {
    const part1 = multiMatch[1].trim()
    const part2 = multiMatch[2].trim()
    const name1 = toTitleCase(part1.split(/\s+/)[0])
    const name2 = toTitleCase(part2.split(/\s+/)[0])

    // First check if the combined name is a single dog entry
    for (const joiner of ['and', 'et', '&']) {
      const combined = `${name1} ${joiner} ${name2}`
      const singleDog = dogs.find((d) => d.dog_name.toLowerCase() === combined.toLowerCase())
      if (singleDog) {
        return [makeResult(ev, singleDog.dog_name, null, singleDog, 'exact', 'dog_name')]
      }
    }

    // Also check full summary as a single dog name
    const fullMatch = dogs.find((d) => d.dog_name.toLowerCase() === summary.toLowerCase())
    if (fullMatch) {
      return [makeResult(ev, fullMatch.dog_name, null, fullMatch, 'exact', 'dog_name')]
    }

    // Split and match individually
    const m1 = matchByName(name1, dogs)
    const m2 = matchByName(name2, dogs)

    if (m1.dog || m2.dog) {
      return [
        makeResult(ev, name1, null, m1.dog, m1.matchType, m1.matchMethod),
        makeResult(ev, name2, null, m2.dog, m2.matchType, m2.matchMethod),
      ]
    }
    // Neither matched by name — fall through to email/phone matching below
  }

  // ── 3. EXACT DOG NAME MATCH ─────────────────────────────────────
  const rawName = extractDogName(summary)
  const breed = words.length > 1 ? words.slice(1).join(' ') : null
  const nameResult = matchByName(rawName, dogs)
  if (nameResult.dog) {
    return [makeResult(ev, rawName, breed, nameResult.dog, nameResult.matchType, nameResult.matchMethod)]
  }

  // ── 4. EMAIL MATCH (supports comma-separated emails in dogs) ───
  if (ev.email) {
    const emailLower = ev.email.toLowerCase().trim()
    const emailMatches = dogs.filter((d) => {
      if (!d.email) return false
      return d.email.toLowerCase().split(',').some((e) => e.trim() === emailLower)
    })
    if (emailMatches.length === 1) {
      return [makeResult(ev, emailMatches[0].dog_name, emailMatches[0].breed, emailMatches[0], 'exact', 'email')]
    }
    if (emailMatches.length > 1) {
      // Multi-dog household — show all dogs for this email
      return emailMatches.map((dog) =>
        makeResult(ev, dog.dog_name, dog.breed, dog, 'exact', 'email_household')
      )
    }
  }

  // ── 5. LAST NAME + SECTOR MATCH ─────────────────────────────────
  if (ev.lastName) {
    const lastLower = ev.lastName.toLowerCase().trim()
    const lastNameMatch = dogs.find(
      (d) =>
        d.owner_last &&
        d.owner_last.toLowerCase().trim() === lastLower &&
        (!ev.sector || !d.sector || d.sector === ev.sector)
    )
    if (lastNameMatch) {
      return [makeResult(ev, lastNameMatch.dog_name, lastNameMatch.breed, lastNameMatch, 'exact', 'owner_last_name')]
    }
  }

  // ── 6. PHONE MATCH (digits only) ───────────────────────────────
  if (ev.phone) {
    const evDigits = digitsOnly(ev.phone)
    if (evDigits.length >= 7) {
      const phoneMatch = dogs.find((d) => d.phone && digitsOnly(d.phone) === evDigits)
      if (phoneMatch) {
        return [makeResult(ev, phoneMatch.dog_name, phoneMatch.breed, phoneMatch, 'exact', 'phone')]
      }
    }
  }

  // ── 7. FUZZY NAME MATCH (Levenshtein ≤ 2) ──────────────────────
  const fuzzyResult = matchByName(rawName, dogs)
  if (fuzzyResult.dog) {
    return [makeResult(ev, rawName, breed, fuzzyResult.dog, fuzzyResult.matchType, fuzzyResult.matchMethod)]
  }

  // ── NO MATCH ────────────────────────────────────────────────────
  return [makeResult(ev, rawName, breed, null, 'none', 'none')]
}

/**
 * Match a single dog name against the dogs list (exact + fuzzy).
 */
function matchByName(name, dogs) {
  const normalized = name.toLowerCase().trim()

  // Exact match
  const exact = dogs.find((d) => d.dog_name.toLowerCase().trim() === normalized)
  if (exact) return { dog: exact, matchType: 'exact', matchMethod: 'dog_name' }

  // Fuzzy match (Levenshtein ≤ 2)
  let best = null
  let bestDist = Infinity
  for (const dog of dogs) {
    const dist = levenshtein.get(normalized, dog.dog_name.toLowerCase().trim())
    if (dist < bestDist) {
      bestDist = dist
      best = dog
    }
  }
  if (bestDist <= 2 && best) return { dog: best, matchType: 'fuzzy', matchMethod: 'fuzzy_name' }

  return { dog: null, matchType: 'none', matchMethod: 'none' }
}

function makeResult(event, displayName, breed, dog, matchType, matchMethod) {
  return { event, displayName, breed, dog, matchType, matchMethod }
}

// ---------------------------------------------------------------------------
// CSV parsing (kept for seed scripts)
// ---------------------------------------------------------------------------

export function parseDogsCSV(csvText) {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line)
    const obj = {}
    headers.forEach((h, i) => {
      obj[headerToKey(h)] = (values[i] || '').trim()
    })
    return obj
  })
}

function headerToKey(header) {
  const map = {
    'Dog Name': 'name',
    'Last Name': 'lastName',
    Address: 'address',
    'Door info': 'doorInfo',
    'Must know': 'mustKnow',
    'Extra info': 'extraInfo',
    Email: 'email',
  }
  return map[header] || header.toLowerCase().replace(/\s+/g, '_')
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
