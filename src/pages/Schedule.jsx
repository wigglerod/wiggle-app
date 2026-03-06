import { useState, useEffect, useMemo } from 'react'
import Header from '../components/Header'
import LoadingDog from '../components/LoadingDog'
import WalkCard from '../components/WalkCard'
import DogDrawer from '../components/DogDrawer'
import WalkLogModal from '../components/WalkLogModal'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { groupEventsByTimeSlot } from '../lib/parseICS'
import { extractDogName, matchDog } from '../lib/matchDogs'
import { extractDoorCode } from '../lib/extractDoorCode'

let _idCounter = 0
function uid() { return ++_idCounter }

export default function Schedule() {
  const { profile } = useAuth()
  const [dogs, setDogs] = useState([])
  const [dogsReady, setDogsReady] = useState(false)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [logGroup, setLogGroup] = useState(null)
  const [loggedIds, setLoggedIds] = useState(new Set())

  const today = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  }, [])

  // Fetch dogs from Supabase (single source of truth)
  useEffect(() => {
    async function fetchDogs() {
      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) {
        console.warn('Failed to fetch dogs from Supabase:', error.message)
        setDogs([])
      } else {
        setDogs(data || [])
      }
      setDogsReady(true)
    }
    fetchDogs()
  }, [])

  // Fetch schedule from Acuity and build walk groups
  useEffect(() => {
    if (!dogsReady) return

    async function buildSchedule() {
      const sector = profile?.sector || 'both'
      let allEvents = []

      try {
        const res = await fetch(`/api/acuity?date=${today}`)
        if (res.ok) {
          const acuityEvents = await res.json()
          allEvents = acuityEvents
            .filter((ev) => sector === 'both' || ev.sector === sector)
            .map((ev) => ({ ...ev, start: new Date(ev.start), end: new Date(ev.end) }))
        }
      } catch {
        // Acuity unavailable
      }

      // Enrich events with dog matching (against Supabase dogs)
      const enriched = allEvents.map((ev) => {
        const rawName = extractDogName(ev.summary)
        const { dog, matchType } = matchDog(rawName, dogs)
        const calendarDoorCode = extractDoorCode(ev.description)
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

      const grouped = groupEventsByTimeSlot(enriched)
      setGroups(grouped)
      setLoading(false)
    }

    buildSchedule()
  }, [dogsReady, dogs, today, profile])

  function handleLogged(ids) {
    setLoggedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }

  function handleDogUpdated(updatedDog) {
    // Update the dog in local state so drawer and cards reflect changes immediately
    setDogs((prev) => prev.map((d) => (d.id === updatedDog.id ? updatedDog : d)))
    // Also update the dog reference in any group events
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        events: g.events.map((ev) =>
          ev.dog?.id === updatedDog.id ? { ...ev, dog: updatedDog } : ev
        ),
      }))
    )
    // Update the selected event if it's the one being edited
    setSelectedEvent((prev) =>
      prev?.dog?.id === updatedDog.id ? { ...prev, dog: updatedDog } : prev
    )
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
        {!loading && totalWalks > 0 && (
          <div className="mb-4 bg-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm border border-gray-100">
            <span className="text-sm text-gray-500">Today's walks</span>
            <span className="text-sm font-bold text-[#E8634A]">
              {loggedCount}/{totalWalks} logged
            </span>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <LoadingDog />
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl">🐾</span>
            <p className="text-lg font-semibold text-gray-600">No walks today</p>
            <p className="text-sm text-gray-400">Enjoy your day off!</p>
          </div>
        )}

        {!loading && groups.length > 0 && (
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
        <DogDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDogUpdated={handleDogUpdated}
        />
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
