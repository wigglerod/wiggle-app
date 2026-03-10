import { useState, useEffect, useMemo, useRef, lazy, Suspense, Component } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../components/Header'
import LoadingDog from '../components/LoadingDog'
import BottomTabs from '../components/BottomTabs'
import GroupOrganizer from '../components/GroupOrganizer'
import DogDrawer from '../components/DogDrawer'

const MapView = lazy(() => import('../components/MapView'))

class MapTabBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-4xl">🗺️</span>
          <p className="text-sm font-semibold text-gray-600">Map coming soon!</p>
          <p className="text-xs text-gray-400">Use the organizer to plan your route.</p>
        </div>
      )
    }
    return this.props.children
  }
}
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { groupEventsByTimeSlot } from '../lib/parseICS'
import { matchEvents, buildNameMap } from '../lib/matchDogs'
import { extractDoorCode } from '../lib/extractDoorCode'

let _idCounter = 0
function uid() { return String(++_idCounter) }

function formatDayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const SECTOR_CYCLE = ['both', 'Plateau', 'Laurier']

export default function Dashboard() {
  const { profile } = useAuth()
  const [dogs, setDogs] = useState([])
  const [nameMap, setNameMap] = useState(new Map())
  const [dogsReady, setDogsReady] = useState(false)
  const [allEvents, setAllEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [activeTab, setActiveTab] = useState('organizer')
  const [refreshKey, setRefreshKey] = useState(0)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDay, setSelectedDay] = useState('today')
  const [sectorFilter, setSectorFilter] = useState(null)
  const touchStartY = useRef(0)
  const isPulling = useRef(false)

  const PULL_THRESHOLD = 64
  const PULL_MAX = 90

  const { today, tomorrow } = useMemo(() => {
    const now = new Date()
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
    const tom = new Date(now)
    tom.setDate(tom.getDate() + 1)
    const tomorrowStr = tom.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
    return { today: todayStr, tomorrow: tomorrowStr }
  }, [])

  const activeDate = selectedDay === 'today' ? today : tomorrow
  const profileSector = profile?.sector || 'both'
  const sector = sectorFilter || profileSector

  // Fetch dogs + name map
  useEffect(() => {
    async function fetchDogs() {
      const [dogsRes, mapRes] = await Promise.all([
        supabase.from('dogs').select('*').order('dog_name'),
        supabase.from('acuity_name_map').select('acuity_name, dog_name, acuity_email'),
      ])
      setDogs(dogsRes.error ? [] : dogsRes.data || [])
      setNameMap(buildNameMap(mapRes.data))
      setDogsReady(true)
    }
    fetchDogs()
  }, [refreshKey])

  // Fetch schedule from Acuity
  useEffect(() => {
    if (!dogsReady) return

    setLoading(true)

    async function buildSchedule() {
      let rawEvents = []

      try {
        const res = await fetch(`/api/acuity?date=${activeDate}`)
        if (res.ok) {
          const acuityEvents = await res.json()
          rawEvents = acuityEvents
            .filter((ev) => profileSector === 'both' || ev.sector === profileSector)
            .map((ev) => ({ ...ev, start: new Date(ev.start), end: new Date(ev.end) }))
        }
      } catch {
        // Acuity unavailable
      }

      _idCounter = 0

      const matched = matchEvents(rawEvents, dogs, nameMap)
      const enriched = matched.map(({ event, displayName, breed, dog, matchType, matchMethod }) => ({
        ...event,
        _id: uid(),
        displayName,
        breed,
        dog,
        matchType,
        matchMethod,
        calendarDoorCode: extractDoorCode(event.description),
      }))

      // Deduplicate: same dog.id → keep first occurrence only, hide TBD placeholders
      const seen = new Set()
      const deduped = enriched.filter((ev) => {
        if (ev.displayName && /TBD/i.test(ev.displayName)) return false
        if (!ev.dog?.id) return true
        if (seen.has(ev.dog.id)) return false
        seen.add(ev.dog.id)
        return true
      })

      setAllEvents(deduped)
      setLoading(false)
    }

    buildSchedule()
  }, [dogsReady, dogs, nameMap, activeDate, profileSector])

  // Filter by local sector selection
  const filteredEvents = useMemo(() => {
    if (sector === 'both') return allEvents
    return allEvents.filter((ev) => (ev.sector || 'Plateau') === sector)
  }, [allEvents, sector])

  const timeGroups = useMemo(() => groupEventsByTimeSlot(filteredEvents), [filteredEvents])

  // Split events by sector if showing all
  const sectorEvents = useMemo(() => {
    if (sector !== 'both') return { [sector]: filteredEvents }
    const map = {}
    for (const ev of filteredEvents) {
      const s = ev.sector || 'Plateau'
      if (!map[s]) map[s] = []
      map[s].push(ev)
    }
    return map
  }, [filteredEvents, sector])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync derived UI flag
  useEffect(() => { if (!loading) setRefreshing(false) }, [loading])

  function handleTouchStart(e) {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }

  function handleTouchMove(e) {
    if (!isPulling.current) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) {
      setPullY(Math.min(delta * 0.45, PULL_MAX))
    } else {
      isPulling.current = false
      setPullY(0)
    }
  }

  function handleTouchEnd() {
    if (!isPulling.current) return
    isPulling.current = false
    if (pullY >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true)
      setLoading(true)
      setDogsReady(false)
      setRefreshKey((k) => k + 1)
    }
    setPullY(0)
    touchStartY.current = 0
  }

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

  function handleDayToggle() {
    setSelectedDay((prev) => (prev === 'today' ? 'tomorrow' : 'today'))
    setAllEvents([])
  }

  function handleSectorCycle() {
    if (profileSector !== 'both') return
    setSectorFilter((prev) => {
      const current = prev || 'both'
      const idx = SECTOR_CYCLE.indexOf(current)
      return SECTOR_CYCLE[(idx + 1) % SECTOR_CYCLE.length]
    })
  }

  const sectorEmoji = sector === 'Plateau' ? '🟡' : sector === 'Laurier' ? '🔵' : ''
  const sectorLabel = sector === 'both' ? 'All Sectors' : sector

  return (
    <div
      className="min-h-screen bg-[#FFF4F1] pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Header />

      {/* Date line: tappable date · sector badge · map icon */}
      <div className="px-4 pt-2 pb-1 max-w-lg mx-auto flex items-center justify-between">
        <button
          onClick={handleDayToggle}
          className="text-sm font-semibold text-gray-700 active:opacity-60 transition-opacity"
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={selectedDay}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1"
            >
              {selectedDay === 'today' ? 'Today' : 'Tomorrow'} &middot; {formatDayLabel(activeDate)}
              <svg className="w-3 h-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </motion.span>
          </AnimatePresence>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={profileSector === 'both' ? handleSectorCycle : undefined}
            className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-opacity ${
              sector === 'Plateau' ? 'bg-amber-100 text-amber-700'
              : sector === 'Laurier' ? 'bg-blue-100 text-blue-700'
              : 'bg-purple-100 text-purple-700'
            } ${profileSector === 'both' ? 'active:opacity-60 cursor-pointer' : ''}`}
          >
            {sectorEmoji} {sectorLabel}
          </button>

          {!loading && filteredEvents.length > 0 && (
            <button
              onClick={() => setActiveTab((t) => (t === 'map' ? 'organizer' : 'map'))}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all ${
                activeTab === 'map'
                  ? 'bg-[#E8634A] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 active:bg-gray-200'
              }`}
            >
              🗺️
            </button>
          )}
        </div>
      </div>

      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: refreshing ? 88 : pullY }}
      >
        {(pullY > 8 || refreshing) && (
          <LoadingDog text={refreshing ? 'Wiggling...' : pullY >= PULL_THRESHOLD ? 'Release!' : 'Pull to refresh...'} />
        )}
      </div>

      <main className="px-4 py-2 max-w-lg mx-auto">
        {/* Roster summary */}
        {!loading && filteredEvents.length > 0 && (
          <p className="text-xs text-gray-400 font-medium mb-3">
            {filteredEvents.length} {filteredEvents.length === 1 ? 'dog' : 'dogs'}
            {timeGroups.length > 0 && ` \u00b7 ${timeGroups.length} time slots`}
          </p>
        )}

        {loading && !refreshing && (
          <div className="flex justify-center py-20">
            <LoadingDog />
          </div>
        )}

        {!loading && filteredEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl">🐾</span>
            <p className="text-lg font-semibold text-gray-600">
              No walks {selectedDay === 'today' ? 'today' : 'tomorrow'}
            </p>
            <p className="text-sm text-gray-400">
              {selectedDay === 'today' ? 'Enjoy your day off!' : 'Nothing scheduled yet.'}
            </p>
          </div>
        )}

        {/* Organizer */}
        {!loading && filteredEvents.length > 0 && activeTab === 'organizer' && (
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
                  date={activeDate}
                  sector={sectorName}
                  onDogClick={setSelectedEvent}
                />
              </div>
            ))}
          </div>
        )}

        {/* Map */}
        {!loading && filteredEvents.length > 0 && activeTab === 'map' && (
          <MapTabBoundary>
            <Suspense fallback={<div className="flex justify-center py-12"><LoadingDog /></div>}>
              <MapView
                events={filteredEvents}
                date={activeDate}
                sector={sector}
                onDogClick={setSelectedEvent}
              />
            </Suspense>
          </MapTabBoundary>
        )}
      </main>

      <BottomTabs />

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
