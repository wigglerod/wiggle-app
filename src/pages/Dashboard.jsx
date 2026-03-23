import { useState, useEffect, useMemo, useRef, lazy, Suspense, Component } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../components/Header'
import LoadingDog from '../components/LoadingDog'
import BottomTabs from '../components/BottomTabs'
import GroupOrganizer from '../components/GroupOrganizer'
import DogDrawer from '../components/DogDrawer'
import QuickNoteSheet from '../components/QuickNoteSheet'

import { useOwlNotes } from '../lib/useOwlNotes'
import { getCachedDogs, setCachedDogs } from '../lib/useOffline'

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
import { toast } from 'sonner'

let _idCounter = 0
function uid() { return String(++_idCounter) }

function formatDayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const SECTOR_CYCLE = ['both', 'Plateau', 'Laurier']

export default function Dashboard() {
  const { profile, permissions } = useAuth()
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
  const [scheduleLocked, setScheduleLocked] = useState(false)
  const [quickNoteOpen, setQuickNoteOpen] = useState(false)
  const [unassignedCount, setUnassignedCount] = useState(null)
  const [lockWiggle, setLockWiggle] = useState(false)
  const [lockHoldProgress, setLockHoldProgress] = useState(false)
  const [lockTooltip, setLockTooltip] = useState(false)
  const lockHoldTimer = useRef(null)
  const lockTooltipTimer = useRef(null)
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

  // Owl notes
  const { notes: owlNotes, dogNotes: getOwlDogNotes, sectorNotes: getOwlSectorNotes, acknowledgeNote } = useOwlNotes(sector)

  // Load cached dogs instantly, then refresh from Supabase
  useEffect(() => {
    const cached = getCachedDogs()
    if (cached && dogs.length === 0) {
      setDogs(cached)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch dogs + name map
  useEffect(() => {
    async function fetchDogs() {
      const [dogsRes, mapRes] = await Promise.all([
        supabase.from('dogs').select('*').order('dog_name'),
        supabase.from('acuity_name_map').select('acuity_name, dog_name, acuity_email'),
      ])
      const fetchedDogs = dogsRes.error ? [] : dogsRes.data || []
      setDogs(fetchedDogs)
      if (fetchedDogs.length > 0) setCachedDogs(fetchedDogs)
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
            .map((ev) => ({ ...ev, start: new Date(ev.start), end: new Date(ev.end) }))
        }
      } catch {
        // Acuity unavailable
      }

      _idCounter = 0

      // Match ALL events first, then filter by effective sector (dogs.sector overrides Acuity calendar)
      const allMatched = matchEvents(rawEvents, dogs, nameMap)
      const matched = profileSector === 'both'
        ? allMatched
        : allMatched.filter((m) => (m.sectorOverride || m.event.sector) === profileSector)
      const enriched = matched.map(({ event, displayName, breed, dog, matchType, matchMethod, sectorOverride }) => ({
        ...event,
        ...(sectorOverride ? { sector: sectorOverride } : {}),
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

  // Check lock state for the current date/sector
  useEffect(() => {
    if (!activeDate) return
    async function checkLock() {
      const { data } = await supabase
        .from('walk_groups')
        .select('locked')
        .eq('walk_date', activeDate)
        .eq('locked', true)
        .limit(1)
      const locked = data && data.length > 0
      setScheduleLocked(locked)
      if (locked) setActiveTab('map')
    }
    checkLock()
  }, [activeDate, sector, refreshKey])

  function handleScheduleLocked() {
    setScheduleLocked(true)
    // Auto-switch to map view
    setTimeout(() => setActiveTab('map'), 300)
  }

  async function doLock() {
    if (unassignedCount > 0) return
    const { error } = await supabase
      .from('walk_groups')
      .update({ locked: true })
      .eq('walk_date', activeDate)
    if (!error) {
      setScheduleLocked(true)
      setActiveTab('map')
      setLockWiggle(true)
      setTimeout(() => setLockWiggle(false), 600)
      toast('Schedule locked')
    }
  }

  async function doUnlock() {
    const { error } = await supabase
      .from('walk_groups')
      .update({ locked: false })
      .eq('walk_date', activeDate)
    if (!error) {
      setScheduleLocked(false)
      setActiveTab('organizer')
    }
  }

  // Quick tap on lock → show tooltip; unlock is immediate tap
  function handleLockClick() {
    if (scheduleLocked) {
      doUnlock()
      return
    }
    // Show "Hold to lock" tooltip briefly
    setLockTooltip(true)
    clearTimeout(lockTooltipTimer.current)
    lockTooltipTimer.current = setTimeout(() => setLockTooltip(false), 1500)
  }

  // Long-press handlers for lock (admin only, unlocked state)
  function handleLockPointerDown() {
    if (scheduleLocked || unassignedCount > 0) return
    setLockHoldProgress(true)
    lockHoldTimer.current = setTimeout(() => {
      setLockHoldProgress(false)
      doLock()
    }, 1000)
  }

  function handleLockPointerUp() {
    clearTimeout(lockHoldTimer.current)
    setLockHoldProgress(false)
  }

  // Auto-unlock when new unassigned dogs appear while locked
  useEffect(() => {
    if (scheduleLocked && unassignedCount > 0) {
      doUnlock().then(() => {
        toast('Schedule unlocked — new dogs added')
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unassignedCount, scheduleLocked])

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
          {permissions.canSeeAllSectors ? (
            <button
              onClick={handleSectorCycle}
              className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-opacity active:opacity-60 cursor-pointer ${
                sector === 'Plateau' ? 'bg-amber-100 text-amber-700'
                : sector === 'Laurier' ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700'
              }`}
            >
              {sectorEmoji} {sectorLabel}
            </button>
          ) : (
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              sector === 'Plateau' ? 'bg-amber-100 text-amber-700'
              : 'bg-blue-100 text-blue-700'
            }`}>
              {sectorEmoji} {sectorLabel}
            </span>
          )}

          {/* Lock status — visible to everyone, interactive for admin */}
          {!loading && filteredEvents.length > 0 && (() => {
            const canLock = permissions.canLockSchedule
            const disabled = !scheduleLocked && unassignedCount > 0
            const icon = scheduleLocked ? '🔓' : '🔒'

            return (
              <div className="relative">
                {canLock ? (
                  <button
                    onClick={handleLockClick}
                    onPointerDown={!scheduleLocked && !disabled ? handleLockPointerDown : undefined}
                    onPointerUp={handleLockPointerUp}
                    onPointerLeave={handleLockPointerUp}
                    disabled={disabled}
                    className={`h-8 flex items-center justify-center rounded-lg text-sm transition-all gap-1 overflow-hidden relative ${
                      scheduleLocked
                        ? 'bg-gray-800 text-white px-2.5'
                        : disabled
                          ? 'bg-gray-100 text-gray-300 px-2.5 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-600 px-2.5'
                    } ${lockWiggle ? 'animate-wiggle' : ''}`}
                  >
                    {/* Hold-to-lock fill animation */}
                    {lockHoldProgress && (
                      <span className="absolute inset-0 bg-[#E8634A] origin-left animate-lock-fill" />
                    )}
                    <span className="relative z-10">{icon}</span>
                    {!scheduleLocked && unassignedCount > 0 && (
                      <span className="relative z-10 text-[10px] font-medium">{unassignedCount}</span>
                    )}
                  </button>
                ) : (
                  <span className={`h-8 flex items-center justify-center rounded-lg text-sm px-2.5 ${
                    scheduleLocked ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {icon}
                  </span>
                )}
                {/* Hold to lock tooltip */}
                {lockTooltip && !scheduleLocked && (
                  <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-gray-800 text-white px-2 py-0.5 rounded-full z-50">
                    Hold to lock
                  </span>
                )}
              </div>
            )
          })()}

          {!loading && (filteredEvents.length > 0 || scheduleLocked) && (
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

        {/* Owl note banners (sector + all) */}
        {!loading && (() => {
          const bannerNotes = sector === 'both'
            ? owlNotes.filter(n => n.target_type === 'sector' || n.target_type === 'all')
            : getOwlSectorNotes(sector)
          return bannerNotes.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {bannerNotes.map(note => (
                <div key={note.id} className="bg-[#E8634A]/10 border border-[#E8634A]/30 rounded-xl px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">🦉</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#E8634A] leading-snug">{note.note_text}</p>
                      {note.expires_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Daily reminder · Expires {new Date(note.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => acknowledgeNote(note.id)}
                    className="mt-2 w-full py-2 rounded-full bg-[#E8634A] text-white text-sm font-bold active:bg-[#d4552d] min-h-[40px]"
                  >
                    Got it ✓
                  </button>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Lock banner — tap to toggle between organizer/map */}
        {!loading && scheduleLocked && (
          <div className="mb-3">
            <button
              onClick={() => setActiveTab(activeTab === 'map' ? 'organizer' : 'map')}
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm font-semibold text-center select-none active:bg-gray-700"
            >
              🔒 Schedule locked — tap to view {activeTab === 'map' ? 'organizer' : 'map'}
            </button>
          </div>
        )}

        {/* View-only indicator for non-admin users */}
        {!loading && !permissions.canEditGroups && filteredEvents.length > 0 && (
          <div className="mb-2 flex justify-center">
            <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
              {permissions.canLogWalks ? '🐕 Your walks today' : '👀 View only'}
            </span>
          </div>
        )}

        {/* Organizer / Map with slide transition */}
        {!loading && (filteredEvents.length > 0 || scheduleLocked) && (
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === 'organizer' ? (
              <motion.div
                key="organizer"
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4"
              >
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
                      owlDogNotes={owlNotes.filter(n => n.target_type === 'dog')}
                      onLocked={handleScheduleLocked}
                      onUnassignedCount={setUnassignedCount}
                    />
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="map"
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 40, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MapTabBoundary>
                  <Suspense fallback={<div className="flex justify-center py-12"><LoadingDog /></div>}>
                    <MapView
                      events={scheduleLocked ? allEvents : filteredEvents}
                      date={activeDate}
                      sector={scheduleLocked ? 'both' : sector}
                      onDogClick={setSelectedEvent}
                      lockedView={scheduleLocked}
                    />
                  </Suspense>
                </MapTabBoundary>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      <BottomTabs />

      {/* Quick-Note FAB — visible in locked/walking mode */}
      {scheduleLocked && permissions.canLogWalks && (
        <button
          onClick={() => setQuickNoteOpen(true)}
          className="fixed bottom-20 right-4 z-20 w-14 h-14 rounded-full bg-[#E8634A] text-white shadow-lg flex items-center justify-center text-xl active:scale-95 transition-transform"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          📝
        </button>
      )}

      {/* Quick-Note bottom sheet */}
      <AnimatePresence>
        {quickNoteOpen && (
          <QuickNoteSheet
            open={quickNoteOpen}
            onClose={() => setQuickNoteOpen(false)}
            walkingDogs={allEvents.map(ev => ({
              _id: ev._id,
              displayName: ev.displayName,
              dog_name: ev.dog?.dog_name,
              dogId: ev.dog?.id || null,
              groupNum: null,
            }))}
            date={activeDate}
          />
        )}
      </AnimatePresence>

      {/* Dog profile drawer */}
      {selectedEvent && (
        <DogDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDogUpdated={handleDogUpdated}
          owlNotes={selectedEvent.dog?.id ? getOwlDogNotes(selectedEvent.dog.id) : []}
          onAcknowledgeNote={acknowledgeNote}
        />
      )}
    </div>
  )
}
