import levenshtein from 'fast-levenshtein'

/**
 * Extract the primary dog name from a calendar SUMMARY string.
 * "Indie lab" → "Indie", "cedar" → "Cedar", "Cleo golden" → "Cleo"
 */
export function extractDogName(summary) {
  const first = summary.trim().split(/\s+/)[0]
  return toTitleCase(first)
}

function toTitleCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Match a dog name (from calendar) against a list of dog profiles.
 * Returns: { dog, matchType } where matchType is 'exact' | 'fuzzy' | 'none'
 */
export function matchDog(calendarName, dogs) {
  const normalized = calendarName.toLowerCase().trim()

  // 1. Exact match (case-insensitive)
  const exact = dogs.find((d) => d.dog_name.toLowerCase().trim() === normalized)
  if (exact) return { dog: exact, matchType: 'exact' }

  // 2. Fuzzy match (Levenshtein distance ≤ 2)
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

/**
 * Parse the dogs CSV text into an array of dog objects.
 */
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

// Simple CSV line parser (handles basic cases, no nested quotes)
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
