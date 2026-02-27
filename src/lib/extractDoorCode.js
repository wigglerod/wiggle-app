const DOOR_KEYWORDS = /\b(lock|code|lockbox|door|entry|access|gate|key)\b/i
const CODE_PATTERN = /\b\d{4,6}\b/g

/**
 * If the description mentions door/lock keywords or contains a 4–6 digit code,
 * return the extracted code string (or the full relevant sentence).
 * Returns null if nothing relevant found.
 */
export function extractDoorCode(description) {
  if (!description) return null

  const hasDoorKeyword = DOOR_KEYWORDS.test(description)
  const codes = description.match(CODE_PATTERN)

  if (!hasDoorKeyword && !codes) return null

  // If there are numeric codes, return them joined
  if (codes && codes.length > 0) {
    if (hasDoorKeyword) {
      // Try to find the sentence containing the code
      const sentences = description.split(/[.\n]+/)
      for (const sentence of sentences) {
        if (DOOR_KEYWORDS.test(sentence) && CODE_PATTERN.test(sentence)) {
          CODE_PATTERN.lastIndex = 0 // reset regex
          return sentence.trim()
        }
      }
      CODE_PATTERN.lastIndex = 0
    }
    return codes.join(' / ')
  }

  // Has keyword but no numeric code — return the relevant sentence
  const sentences = description.split(/[.\n]+/)
  for (const sentence of sentences) {
    if (DOOR_KEYWORDS.test(sentence)) {
      return sentence.trim()
    }
  }

  return null
}
