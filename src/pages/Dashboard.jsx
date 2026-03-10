import { useState, useEffect, useMemo, useRef, lazy, Suspense, Component } from 'react'
import { motion } from 'framer-motion'
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
  const touchStartY = useRef(0)
  const isPulling = useRef(false)

  const PULL_THRESHOLD = 64
  const PULL_MAX = 90

  // Calculate today and tomorrow dates
  const { today, tomorrow } = useMemo(() => {
    const now = new Date()
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
    const tom = new Date(now)
    tom.setDate(tom.getDate() + 1)
    const tomorrowStr = tom.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
    return { today: todayStr, tomorrow: tomorrowStr }
  }, [])

  const activeDate = selectedDay === 'today' ? today : tomorrow

  const sector = profile?.sector || 'both'
  const effectiveSector = sector === 'both' ? 'Plateau' : sector

  // Fetch dogs + name map — re-runs on pull-to-refresh
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

  // Fetch schedule from Acuity — re-runs when date or dogs change
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
            .filter((ev) => sector === 'both' || ev.sector === sector)
            .map((ev) => ({ ...ev, start: new Date(ev.start), end: new Date(ev.end) }))
        }
      } catch {
        // Acuity unavailable
      }

      // Reset ID counter so IDs are consistent per date
      _idCounter = 0

      // Enrich events with multi-signal dog matching
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

      setAllEvents(enriched)
      setLoading(false)
    }

    buildSchedule()
  }, [dogsReady, dogs, nameMap, activeDate, sector])

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

  // Clear refreshing indicator once loading finishes
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

  function handleDaySwitch(day) {
    if (day === selectedDay) return
    setSelectedDay(day)
    setAllEvents([])
  }

  return (
    <div
      className="min-h-screen bg-[#FFF4F1] pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Header date={activeDate} />

      {/* Today / Tomorrow toggle — directly below header */}
      <div className="px-4 pt-3 pb-1 max-w-lg mx-auto">
        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-100 gap-1">
          {[
            { key: 'today', label: `📅 Today · ${formatDayLabel(today)}` },
            { key: 'tomorrow', label: `📅 Tomorrow · ${formatDayLabel(tomorrow)}` },
          ].map((day) => (
            <button
              key={day.key}
              onClick={() => handleDaySwitch(day.key)}
              className={`relative flex-1 py-3 rounded-lg text-xs font-semibold transition-all min-h-[48px] ${
                selectedDay === day.key
                  ? 'text-white'
                  : 'text-gray-500 active:bg-gray-50'
              }`}
            >
              {selectedDay === day.key && (
                <motion.div
                  layoutId="dayToggle"
                  className="absolute inset-0 bg-[#E8634A] rounded-lg shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{day.label}</span>
            </button>
          ))}
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

      <main className="px-4 py-4 max-w-lg mx-auto">
        {/* Organizer / Map pill toggle */}
        {!loading && allEvents.length > 0 && (
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-100 mb-4">
            {['organizer', 'map'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize min-h-[40px] ${
                  activeTab === tab
                    ? 'bg-[#E8634A] text-white shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {tab === 'organizer' ? '📋 Organizer' : '🗺️ Map'}
              </button>
            ))}
          </div>
        )}

        {/* Progress banner */}
        {!loading && allEvents.length > 0 && (
          <div className="mb-4 bg-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm border border-gray-100">
            <span className="text-sm text-gray-500">
              {selectedDay === 'today' ? "Today\u2019s" : "Tomorrow\u2019s"} roster
            </span>
            <span className="text-sm font-bold text-[#E8634A]">
              {allEvents.length} {allEvents.length === 1 ? 'dog' : 'dogs'}
              {timeGroups.length > 0 && ` · ${timeGroups.length} time slots`}
            </span>
          </div>
        )}

        {loading && !refreshing && (
          <div className="flex justify-center py-20">
            <LoadingDog />
          </div>
        )}

        {!loading && allEvents.length === 0 && (
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
                  date={activeDate}
                  sector={sectorName}
                  onDogClick={setSelectedEvent}
                />
              </div>
            ))}
          </div>
        )}

        {/* Map Tab */}
        {!loading && allEvents.length > 0 && activeTab === 'map' && (
          <MapTabBoundary>
            <Suspense fallback={<div className="flex justify-center py-12"><LoadingDog /></div>}>
              <MapView
                events={allEvents}
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
