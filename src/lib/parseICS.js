import ICAL from 'ical.js'

const TIMEZONE = 'America/Toronto'

/**
 * Format a date as YYYY-MM-DD in the Toronto timezone.
 */
function toTorontoDateString(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/**
 * Parse an ICS text string and return all events (including expanded recurring)
 * that fall on the given targetDate (a JS Date or 'YYYY-MM-DD' string).
 *
 * Returns array of: { summary, location, description, start, end, sector }
 */
export function getEventsForDate(icsText, targetDate, sector = '') {
  const targetStr =
    typeof targetDate === 'string'
      ? targetDate
      : toTorontoDateString(targetDate)

  let jcal
  try {
    jcal = ICAL.parse(icsText)
  } catch (e) {
    console.error('ICS parse error:', e)
    return []
  }

  const comp = new ICAL.Component(jcal)
  const vevents = comp.getAllSubcomponents('vevent')
  const results = []

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent)

    if (event.isRecurring()) {
      // Build an expansion window: targetDate only
      const targetDT = ICAL.Time.fromDateString(targetStr)
      const nextDay = targetDT.clone()
      nextDay.adjust(1, 0, 0, 0)

      const expand = new ICAL.RecurExpansion({
        component: vevent,
        dtstart: event.startDate,
      })

      let next
      let safety = 0
      while ((next = expand.next()) && safety < 500) {
        safety++
        if (next.compare(nextDay) >= 0) break
        if (toTorontoDateString(next.toJSDate()) === targetStr) {
          const duration = event.duration
          const endTime = next.clone()
          endTime.addDuration(duration)
          results.push(buildEvent(event, next.toJSDate(), endTime.toJSDate(), sector))
        }
      }
    } else {
      const startDate = event.startDate.toJSDate()
      const endDate = event.endDate.toJSDate()
      if (toTorontoDateString(startDate) === targetStr) {
        results.push(buildEvent(event, startDate, endDate, sector))
      }
    }
  }

  return results
}

function buildEvent(event, startJS, endJS, sector) {
  return {
    summary: (event.summary || '').trim(),
    location: (event.location || '').trim(),
    description: (event.description || '').trim(),
    start: startJS,
    end: endJS,
    sector,
  }
}

/**
 * Group events that share the same start+end time into walk groups.
 * Returns array of: { startTime, endTime, events: [...] }
 */
export function groupEventsByTimeSlot(events) {
  const map = new Map()

  for (const ev of events) {
    const key = `${ev.start.getTime()}-${ev.end.getTime()}`
    if (!map.has(key)) {
      map.set(key, { startTime: ev.start, endTime: ev.end, events: [] })
    }
    map.get(key).events.push(ev)
  }

  return Array.from(map.values()).sort((a, b) => a.startTime - b.startTime)
}

/**
 * Format a JS Date to "10:00 AM" in Toronto timezone.
 */
export function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
