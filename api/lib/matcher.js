import levenshtein from 'fast-levenshtein'

/**
 * Server-side multi-signal dog matcher.
 * Mirrors the logic in src/lib/matchDogs.js for use in cron jobs / API routes.
 */

function toTitleCase(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function digitsOnly(str) {
  return (str || '').replace(/\D/g, '')
}

function extractDogName(summary) {
  const first = (summary || '').trim().split(/\s+/)[0]
  return toTitleCase(first)
}

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

// Sector overrides — dogs that always belong to a specific sector
const SECTOR_OVERRIDES = { Paloma: 'Plateau' }

/**
 * Match events against dogs. Returns array of match results.
 * Each result: { event, displayName, dog, matchType, matchMethod, sectorOverride? }
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
  if (!summary) return [{ event: ev, displayName: 'Unknown', dog: null, matchType: 'none', matchMethod: 'none' }]

  const words = summary.split(/\s+/)

  // 1. Manual override map
  for (let len = Math.min(words.length, 5); len >= 1; len--) {
    const candidate = words.slice(0, len).join(' ')
    const mapped = lookupNameMap(nameMap, candidate, ev.email)
    if (mapped) {
      const dog = dogs.find((d) => d.dog_name.toLowerCase() === mapped.toLowerCase())
      return [{ event: ev, displayName: mapped, dog: dog || null, matchType: dog ? 'exact' : 'none', matchMethod: 'name_map' }]
    }
  }

  // 2. Multi-dog household
  const multiMatch = summary.match(/^(.+?)\s+(?:and|et|&)\s+(.+?)$/i)
  if (multiMatch) {
    const name1 = toTitleCase(multiMatch[1].trim().split(/\s+/)[0])
    const name2 = toTitleCase(multiMatch[2].trim().split(/\s+/)[0])

    for (const joiner of ['and', 'et', '&']) {
      const combined = `${name1} ${joiner} ${name2}`
      const singleDog = dogs.find((d) => d.dog_name.toLowerCase() === combined.toLowerCase())
      if (singleDog) {
        return [{ event: ev, displayName: singleDog.dog_name, dog: singleDog, matchType: 'exact', matchMethod: 'dog_name' }]
      }
    }

    const fullMatch = dogs.find((d) => d.dog_name.toLowerCase() === summary.toLowerCase())
    if (fullMatch) {
      return [{ event: ev, displayName: fullMatch.dog_name, dog: fullMatch, matchType: 'exact', matchMethod: 'dog_name' }]
    }

    const m1 = matchByName(name1, dogs)
    const m2 = matchByName(name2, dogs)
    if (m1.dog || m2.dog) {
      return [
        { event: ev, displayName: name1, dog: m1.dog, matchType: m1.matchType, matchMethod: m1.matchMethod },
        { event: ev, displayName: name2, dog: m2.dog, matchType: m2.matchType, matchMethod: m2.matchMethod },
      ]
    }
  }

  // 3. Exact dog name
  const rawName = extractDogName(summary)
  const nameResult = matchByName(rawName, dogs)
  if (nameResult.dog) {
    return [{ event: ev, displayName: rawName, dog: nameResult.dog, matchType: nameResult.matchType, matchMethod: nameResult.matchMethod }]
  }

  // 4. Email match
  if (ev.email) {
    const emailLower = ev.email.toLowerCase().trim()
    const emailMatches = dogs.filter((d) => d.email && d.email.toLowerCase().trim() === emailLower)
    if (emailMatches.length === 1) {
      return [{ event: ev, displayName: emailMatches[0].dog_name, dog: emailMatches[0], matchType: 'exact', matchMethod: 'email' }]
    }
    if (emailMatches.length > 1) {
      return emailMatches.map((dog) => ({
        event: ev, displayName: dog.dog_name, dog, matchType: 'exact', matchMethod: 'email_household',
      }))
    }
  }

  // 5. Last name + sector
  if (ev.lastName) {
    const lastLower = ev.lastName.toLowerCase().trim()
    const lastNameMatch = dogs.find(
      (d) => d.owner_last && d.owner_last.toLowerCase().trim() === lastLower
        && (!ev.sector || !d.sector || d.sector === ev.sector)
    )
    if (lastNameMatch) {
      return [{ event: ev, displayName: lastNameMatch.dog_name, dog: lastNameMatch, matchType: 'exact', matchMethod: 'owner_last_name' }]
    }
  }

  // 6. Phone match
  if (ev.phone) {
    const evDigits = digitsOnly(ev.phone)
    if (evDigits.length >= 7) {
      const phoneMatch = dogs.find((d) => d.phone && digitsOnly(d.phone) === evDigits)
      if (phoneMatch) {
        return [{ event: ev, displayName: phoneMatch.dog_name, dog: phoneMatch, matchType: 'exact', matchMethod: 'phone' }]
      }
    }
  }

  // 7. Fuzzy match
  const fuzzyResult = matchByName(rawName, dogs)
  if (fuzzyResult.dog) {
    return [{ event: ev, displayName: rawName, dog: fuzzyResult.dog, matchType: fuzzyResult.matchType, matchMethod: fuzzyResult.matchMethod }]
  }

  return [{ event: ev, displayName: rawName, dog: null, matchType: 'none', matchMethod: 'none' }]
}

function matchByName(name, dogs) {
  const normalized = name.toLowerCase().trim()
  const exact = dogs.find((d) => d.dog_name.toLowerCase().trim() === normalized)
  if (exact) return { dog: exact, matchType: 'exact', matchMethod: 'dog_name' }

  let best = null
  let bestDist = Infinity
  for (const dog of dogs) {
    const dist = levenshtein.get(normalized, dog.dog_name.toLowerCase().trim())
    if (dist < bestDist) { bestDist = dist; best = dog }
  }
  if (bestDist <= 2 && best) return { dog: best, matchType: 'fuzzy', matchMethod: 'fuzzy_name' }
  return { dog: null, matchType: 'none', matchMethod: 'none' }
}
