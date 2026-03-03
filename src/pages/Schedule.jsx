import { useState, useMemo } from 'react'
import Header from '../components/Header'
import WalkCard from '../components/WalkCard'
import DogDrawer from '../components/DogDrawer'
import WalkLogModal from '../components/WalkLogModal'
import { useAuth } from '../context/useAuth'
import { getEventsForDate, groupEventsByTimeSlot } from '../lib/parseICS'
import { extractDogName, matchDog, parseDogsCSV } from '../lib/matchDogs'
import { extractDoorCode } from '../lib/extractDoorCode'

// Dev mode: import ICS and CSV as raw text
import plateauICS from '../data/plateau.ics?raw'
import laurierICS from '../data/laurier.ics?raw'
import dogsCSVRaw from '../data/dogs.csv?raw'

let _idCounter = 0
function uid() { return ++_idCounter }

export default function Schedule() {
  const { profile } = useAuth()
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [logGroup, setLogGroup] = useState(null)
  const [loggedIds, setLoggedIds] = useState(new Set())

  const today = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  }, [])

  // Parse dog CSV once (static data)
  const dogs = useMemo(() => parseDogsCSV(dogsCSVRaw), [])

  // Parse ICS files and build groups from dogs + profile
  const groups = useMemo(() => {
    if (dogs.length === 0) return []

    const sector = profile?.sector || 'both'
    let allEvents = []

    if (sector === 'Plateau' || sector === 'both') {
      const evs = getEventsForDate(plateauICS, today, 'Plateau')
      allEvents = allEvents.concat(evs)
    }
    if (sector === 'Laurier' || sector === 'both') {
      const evs = getEventsForDate(laurierICS, today, 'Laurier')
      allEvents = allEvents.concat(evs)
    }

    // Enrich events with dog matching
    const enriched = allEvents.map((ev) => {
      const rawName = extractDogName(ev.summary)
      const { dog, matchType } = matchDog(rawName, dogs)
      const calendarDoorCode = extractDoorCode(ev.description)

      // Extract breed (words after first word in summary)
      const parts = ev.summary.trim().split(/\s+/)
      const breed = parts.length > 1 ? parts.slice(1).join(' ') : null

      return {
        ...ev,
        _id: uid(),
        displayName: rawName,
        breed,
        dog,
        matchType,
        calendarDoorCode,
      }
    })

    return groupEventsByTimeSlot(enriched)
  }, [dogs, today, profile])

  function handleLogged(ids) {
    setLoggedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }

  const totalWalks = groups.reduce((sum, g) => sum + g.events.length, 0)
  const loggedCount = groups.reduce(
    (sum, g) => sum + g.events.filter((ev) => loggedIds.has(ev._id)).length,
    0
  )

  return (
    <div className="min-h-screen bg-[#FFF4F1]">
      <Header date={today} />

      <main className="px-4 py-4 pb-24 max-w-lg mx-auto">
        {/* Progress banner */}
        {totalWalks > 0 && (
          <div className="mb-4 bg-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm border border-gray-100">
            <span className="text-sm text-gray-500">Today's walks</span>
            <span className="text-sm font-bold text-[#E8634A]">
              {loggedCount}/{totalWalks} logged
            </span>
          </div>
        )}

        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl">🐾</span>
            <p className="text-lg font-semibold text-gray-600">No walks today</p>
            <p className="text-sm text-gray-400">Enjoy your day off!</p>
          </div>
        )}

        {groups.length > 0 && (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <WalkCard
                key={`${group.startTime.getTime()}-${group.endTime.getTime()}`}
                group={group}
                loggedIds={loggedIds}
                onDogClick={setSelectedEvent}
                onLogWalk={setLogGroup}
              />
            ))}
          </div>
        )}
      </main>

      {/* Dog profile drawer */}
      {selectedEvent && (
        <DogDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {/* Walk log modal */}
      {logGroup && (
        <WalkLogModal
          group={logGroup}
          onClose={() => setLogGroup(null)}
          onLogged={handleLogged}
        />
      )}
    </div>
  )
}
