export default async function handler(req, res) {
  const { date } = req.query

  const userId = process.env.ACUITY_USER_ID
  const apiKey = process.env.ACUITY_API_KEY

  if (!userId || !apiKey) {
    return res.status(501).json({ error: 'Acuity not configured' })
  }

  const auth = Buffer.from(`${userId}:${apiKey}`).toString('base64')
  const headers = { Authorization: `Basic ${auth}` }

  try {
    const apptRes = await fetch(
      `https://acuityscheduling.com/api/v1/appointments?minDate=${date}&maxDate=${date}&canceled=false`,
      { headers }
    )

    if (!apptRes.ok) {
      return res.status(502).json({ error: 'Acuity API error', status: apptRes.status })
    }

    const appointments = await apptRes.json()

    const events = appointments.map((appt) => {
      // Dog name: check intake form fields first, then fall back to firstName
      const dogName = getFormField(appt, /dog\s*name|pet\s*name/i) || appt.firstName || ''
      const breed = getFormField(appt, /breed/i) || ''
      const summary = breed ? `${dogName} ${breed}` : dogName

      // Description: combine notes + any door/access form fields
      const doorInfo = getFormField(appt, /door|code|key|lock|access|entry/i) || ''
      const description = [appt.notes, doorInfo].filter(Boolean).join('\n')

      const start = new Date(appt.datetime)
      const durationMin = parseInt(appt.duration, 10) || 60
      const end = new Date(start.getTime() + durationMin * 60000)

      return {
        summary: summary.trim(),
        location: appt.location || '',
        description: description.trim(),
        start: start.toISOString(),
        end: end.toISOString(),
        sector: appt.calendar || '',
      }
    })

    res.json(events)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch from Acuity', message: err.message })
  }
}

/** Search Acuity intake form fields by name pattern. */
function getFormField(appt, pattern) {
  if (!appt.forms) return null
  for (const form of appt.forms) {
    for (const val of form.values || []) {
      if (pattern.test(val.name) && val.value) {
        return val.value.trim()
      }
    }
  }
  return null
}
