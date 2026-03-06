import { useState, useEffect, useMemo } from 'react'
import Header from '../components/Header'
import LoadingDog from '../components/LoadingDog'
import BottomTabs from '../components/BottomTabs'
import GroupOrganizer from '../components/GroupOrganizer'
import MapView from '../components/MapView'
import DogDrawer from '../components/DogDrawer'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { groupEventsByTimeSlot } from '../lib/parseICS'
import { extractDogName, matchDog } from '../lib/matchDogs'
import { extractDoorCode } from '../lib/extractDoorCode'
import { useWalkGroups } from '../lib/useWalkGroups'

let _idCounter = 0
function uid() { return String(++_idCounter) }

export default function Dashboard() {
  const { profile } = useAuth()
  const [dogs, setDogs] = useState([])
  const [dogsReady, setDogsReady] = useState(false)
  const [allEvents, setAllEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [activeTab, setActiveTab] = useState('organizer')

  const today = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  }, [])

  const sector = profile?.sector || 'both'
  const effectiveSector = sector === 'both' ? 'Plateau' : sector

  // Fetch dogs
  useEffect(() => {
    async function fetchDogs() {
      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) {
        console.warn('Failed to fetch dogs:', error.message)
        setDogs([])
      } else {
        setDogs(data || [])
      }
      setDogsReady(true)
    }
    fetchDogs()
  }, [])

  // Fetch schedule from Acuity
  useEffect(() => {
    if (!dogsReady) return

    async function buildSchedule() {
      let rawEvents = []

      try {
        const res = await fetch(`/api/acuity?date=${today}`)
        if (res.ok) {
          const acuityEvents = await res.json()
          rawEvents = acuityEvents
            .filter((ev) => sector === 'both' || ev.sector === sector)
            .map((ev) => ({ ...ev, start: new Date(ev.start), end: new Date(ev.end) }))
        }
      } catch {
        // Acuity unavailable
      }

      // Enrich events with dog matching
      const enriched = rawEvents.map((ev) => {
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

      setAllEvents(enriched)
      setLoading(false)
    }

    buildSchedule()
  }, [dogsReady, dogs, today, sector])

  // Walk groups hook (for passing to MapView)
  const { groups } = useWalkGroups(allEvents, today, effectiveSector)

  // Group events by time slot for display purposes
  const timeGroups = useMemo(() => groupEventsByTimeSlot(allEvents), [allEvents])

  // Split events by sector if user sees 'both'
  const sectorEvents = useMemo(() => {
    if (sector !== 'both') return { [sector]: allEvents }
    const map = {}
    for (const ev of allEvents) {
      const s = ev.sector || 'Plateau'
      if (!map[s]) map[s] = []
      map[s].push(ev)
    }
    return map
  }, [allEvents, sector])

  function handleDogUpdated(updatedDog) {
    setDogs((prev) => prev.map((d) => (d.id === updatedDog.id ? updatedDog : d)))
    setAllEvents((prev) =>
      prev.map((ev) =>
        ev.dog?.id === updatedDog.id ? { ...ev, dog: updatedDog } : ev
      )
    )
    setSelectedEvent((prev) =>
      prev?.dog?.id === updatedDog.id ? { ...prev, dog: updatedDog } : prev
    )
  }

  return (
    <div className="min-h-screen bg-[#FFF4F1] pb-20">
      <Header date={today} />

      <main className="px-4 py-4 max-w-lg mx-auto">
        {/* Progress banner */}
        {!loading && allEvents.length > 0 && (
          <div className="mb-4 bg-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm border border-gray-100">
            <span className="text-sm text-gray-500">Today&apos;s roster</span>
            <span className="text-sm font-bold text-[#E8634A]">
              {allEvents.length} {allEvents.length === 1 ? 'dog' : 'dogs'}
              {timeGroups.length > 0 && ` · ${timeGroups.length} time slots`}
            </span>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <LoadingDog />
          </div>
        )}

        {!loading && allEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl">🐾</span>
            <p className="text-lg font-semibold text-gray-600">No walks today</p>
            <p className="text-sm text-gray-400">Enjoy your day off!</p>
          </div>
        )}

        {/* Organizer Tab */}
        {!loading && allEvents.length > 0 && activeTab === 'organizer' && (
          <div className="flex flex-col gap-4">
            {Object.entries(sectorEvents).map(([sectorName, events]) => (
              <div key={sectorName}>
                {sector === 'both' && (
                  <h2 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${sectorName === 'Plateau' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                    {sectorName}
                  </h2>
                )}
                <GroupOrganizer
                  events={events}
                  date={today}
                  sector={sectorName}
                  onDogClick={setSelectedEvent}
                />
              </div>
            ))}
          </div>
        )}

        {/* Map Tab */}
        {!loading && allEvents.length > 0 && activeTab === 'map' && (
          <MapView
            events={allEvents}
            groups={groups}
            onDogClick={setSelectedEvent}
          />
        )}
      </main>

      {/* Bottom tabs */}
      <BottomTabs active={activeTab} onChange={setActiveTab} />

      {/* Dog profile drawer */}
      {selectedEvent && (
        <DogDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDogUpdated={handleDogUpdated}
        />
      )}
    </div>
  )
}
