import { useState, useEffect, useMemo, useRef } from 'react'
import Header from '../components/Header'
import LoadingDog from '../components/LoadingDog'
import BottomTabs from '../components/BottomTabs'
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

function torontoDate(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
}

export default function Schedule() {
  const { profile } = useAuth()
  const [dogs, setDogs] = useState([])
  const [dogsReady, setDogsReady] = useState(false)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [logGroup, setLogGroup] = useState(null)
  const [loggedIds, setLoggedIds] = useState(new Set())
  const [refreshKey, setRefreshKey] = useState(0)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dayOffset, setDayOffset] = useState(0) // 0 = today, 1 = tomorrow
  const touchStartY = useRef(0)
  const isPulling = useRef(false)

  const PULL_THRESHOLD = 64
  const PULL_MAX = 90

  const selectedDate = useMemo(() => torontoDate(dayOffset), [dayOffset])

  // Fetch dogs from Supabase — re-runs on pull-to-refresh
  useEffect(() => {
    async function fetchDogs() {
      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .order('dog_name')

      if (error) {
        console.warn('Failed to fetch dogs from Supabase:', error.message)
        setDogs([])
      } else {
        setDogs(data || [])
      }
      setDogsReady(true)
    }
    fetchDogs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  // Fetch schedule from Acuity and build walk groups
  useEffect(() => {
    if (!dogsReady) return

    async function buildSchedule() {
      const sector = profile?.sector || 'both'
      let allEvents = []

      try {
        const res = await fetch(`/api/acuity?date=${selectedDate}`)
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
  }, [dogsReady, dogs, selectedDate, profile])

  function switchDay(offset) {
    if (offset === dayOffset) return
    setDayOffset(offset)
    setLoading(true)
    setGroups([])
    setLoggedIds(new Set())
  }

  function handleLogged(ids) {
    setLoggedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }

  function handleDogUpdated(updatedDog) {
    setDogs((prev) => prev.map((d) => (d.id === updatedDog.id ? updatedDog : d)))
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        events: g.events.map((ev) =>
          ev.dog?.id === updatedDog.id ? { ...ev, dog: updatedDog } : ev
        ),
      }))
    )
    setSelectedEvent((prev) =>
      prev?.dog?.id === updatedDog.id ? { ...prev, dog: updatedDog } : prev
    )
  }

  // Clear refreshing indicator once loading finishes
  useEffect(() => {
    if (!loading) setRefreshing(false)
  }, [loading])

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

  const totalWalks = groups.reduce((sum, g) => sum + g.events.length, 0)
  const loggedCount = groups.reduce(
    (sum, g) => sum + g.events.filter((ev) => loggedIds.has(ev._id)).length,
    0
  )

  const dayLabel = dayOffset === 0 ? "Today's" : "Tomorrow's"

  return (
    <div
      className="min-h-screen bg-[#FFF4F1]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Header date={selectedDate} />

      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: refreshing ? 88 : pullY }}
      >
        {(pullY > 8 || refreshing) && (
          <LoadingDog text={refreshing ? 'Wiggling...' : pullY >= PULL_THRESHOLD ? 'Release!' : 'Pull to refresh...'} />
        )}
      </div>

      <main className="px-4 py-4 pb-24 max-w-lg mx-auto">
        {/* Today / Tomorrow toggle */}
        <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-200">
          {[{ label: 'Today', offset: 0 }, { label: 'Tomorrow', offset: 1 }].map(({ label, offset }) => (
            <button
              key={offset}
              onClick={() => switchDay(offset)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                dayOffset === offset
                  ? 'bg-[#E8634A] text-white shadow-sm'
                  : 'text-gray-500 active:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Progress banner */}
        {!loading && totalWalks > 0 && (
          <div className="mb-4 bg-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm border border-gray-100">
            <span className="text-sm text-gray-500">{dayLabel} walks</span>
            <span className="text-sm font-bold text-[#E8634A]">
              {loggedCount}/{totalWalks} logged
            </span>
          </div>
        )}

        {loading && !refreshing && (
          <div className="flex justify-center py-20">
            <LoadingDog />
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl">🐾</span>
            <p className="text-lg font-semibold text-gray-600">
              No walks {dayOffset === 0 ? 'today' : 'tomorrow'}
            </p>
            <p className="text-sm text-gray-400">
              {dayOffset === 0 ? 'Enjoy your day off!' : 'Nothing scheduled yet'}
            </p>
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

      <BottomTabs />
    </div>
  )
}
