/**
 * Shared Acuity API utilities for server-side use.
 */

function getAcuityAuth() {
  const userId = process.env.ACUITY_USER_ID
  const apiKey = process.env.ACUITY_API_KEY
  if (!userId || !apiKey) return null
  return Buffer.from(`${userId}:${apiKey}`).toString('base64')
}

function getFormField(appt, pattern) {
  if (!appt.forms) return null
  for (const form of appt.forms) {
    for (const val of form.values || []) {
      if (pattern.test(val.name) && val.value) return val.value.trim()
    }
  }
  return null
}

function parseAppointment(appt) {
  const dogName = getFormField(appt, /dog\s*name|pet\s*name/i) || appt.firstName || ''
  const breed = getFormField(appt, /breed/i) || ''
  const summary = (breed ? `${dogName} ${breed}` : dogName).trim()
  const doorInfo = getFormField(appt, /door|code|key|lock|access|entry/i) || ''
  const description = [appt.notes, doorInfo].filter(Boolean).join('\n')

  const start = new Date(appt.datetime)
  const durationMin = parseInt(appt.duration, 10) || 60
  const end = new Date(start.getTime() + durationMin * 60000)

  return {
    summary,
    location: appt.location || '',
    description: description.trim(),
    clientNotes: (appt.notes || '').trim(),
    ownerName: [appt.firstName, appt.lastName].filter(Boolean).join(' '),
    email: (appt.email || '').trim(),
    phone: (appt.phone || '').trim(),
    firstName: (appt.firstName || '').trim(),
    lastName: (appt.lastName || '').trim(),
    start: start.toISOString(),
    end: end.toISOString(),
    sector: appt.calendar || '',
  }
}

/**
 * Fetch Acuity appointments for a single date (YYYY-MM-DD).
 * Returns parsed event objects.
 */
export async function fetchAcuityDate(date) {
  const auth = getAcuityAuth()
  if (!auth) return []

  const res = await fetch(
    `https://acuityscheduling.com/api/v1/appointments?minDate=${date}&maxDate=${date}&canceled=false`,
    { headers: { Authorization: `Basic ${auth}` } }
  )
  if (!res.ok) {
    console.error('[acuity-fetch] API returned', res.status, res.statusText, 'for date', date)
    return []
  }

  const appointments = await res.json()
  return appointments.map(parseAppointment)
}

/**
 * Fetch Acuity appointments for a date range (inclusive).
 * Returns all parsed events across all dates.
 */
export async function fetchAcuityRange(startDate, endDate) {
  const auth = getAcuityAuth()
  if (!auth) return []

  const res = await fetch(
    `https://acuityscheduling.com/api/v1/appointments?minDate=${startDate}&maxDate=${endDate}&canceled=false`,
    { headers: { Authorization: `Basic ${auth}` } }
  )
  if (!res.ok) {
    console.error('[acuity-fetch] API returned', res.status, res.statusText, 'for range', startDate, '-', endDate)
    return []
  }

  const appointments = await res.json()
  return appointments.map(parseAppointment)
}
