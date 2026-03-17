import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import Header from '../components/Header'
import LoadingDog from '../components/LoadingDog'
import BottomTabs from '../components/BottomTabs'
import WalkCard from '../components/WalkCard'
import DogDrawer from '../components/DogDrawer'
import WalkLogModal from '../components/WalkLogModal'
import RouteBuilder from '../components/RouteBuilder'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { groupEventsByTimeSlot } from '../lib/parseICS'
import { matchEvents, buildNameMap } from '../lib/matchDogs'
import { extractDoorCode } from '../lib/extractDoorCode'
import { useOwlNotes } from '../lib/useOwlNotes'
import { getCachedDogs, setCachedDogs } from '../lib/useOffline'

let _idCounter = 0
function uid() { return ++_idCounter }

function torontoDate(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
}

function SkeletonWalkCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 skeleton-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-gray-200 rounded-full" />
        <div className="h-4 w-28 bg-gray-200 rounded-lg" />
        <div className="h-5 w-14 bg-gray-100 rounded-full" />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="h-9 w-20 bg-gray-100 rounded-full" />
        <div className="h-9 w-24 bg-gray-100 rounded-full" />
        <div className="h-9 w-18 bg-gray-100 rounded-full" />
      </div>
      <div className="h-12 w-full bg-gray-100 rounded-full" />
    </div>
  )
}

export default function Schedule() {
  const { profile, isAdmin, user } = useAuth()
  const [dogs, setDogs] = useState([])
  const [nameMap, setNameMap] = useState(new Map())
  const [dogsReady, setDogsReady] = useState(false)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [logGroup, setLogGroup] = useState(null)
  const [routeGroup, setRouteGroup] = useState(null)
  const [loggedIds, setLoggedIds] = useState(new Set())
  const [refreshKey, setRefreshKey] = useState(0)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dayOffset, setDayOffset] = useState(0)
  const [dailyNote, setDailyNote] = useState(null)
  const [noteInput, setNoteInput] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteEditing, setNoteEditing] = useState(false)
  const touchStartY = useRef(0)
  const isPulling = useRef(false)

  const sector = profile?.sector || 'both'
  const { notes: owlNotes, sectorNotes: getOwlSectorNotes, dogNotes: getOwlDogNotes, acknowledgeNote } = useOwlNotes(sector)

  const PULL_THRESHOLD = 64
  const PULL_MAX = 90

  const selectedDate = useMemo(() => torontoDate(dayOffset), [dayOffset])

  // Load cached dogs instantly
  useEffect(() => {
    const cached = getCachedDogs()
    if (cached && dogs.length === 0) {
      setDogs(cached)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  useEffect(() => {
    async function fetchNote() {
      const { data } = await supabase
        .from('daily_notes')
        .select('*')
        .eq('note_date', selectedDate)
        .single()
      setDailyNote(data || null)
      if (data) setNoteInput(data.note_text)
      else setNoteInput('')
      setNoteEditing(false)
    }
    fetchNote()
  }, [selectedDate, refreshKey])

  async function saveDailyNote() {
    if (!noteInput.trim()) return
    setNoteSaving(true)
    const { data, error } = await supabase
      .from('daily_notes')
      .upsert({
        note_date: selectedDate,
        note_text: noteInput.trim(),
        created_by: user?.id,
      }, { onConflict: 'note_date' })
      .select()
      .single()
    setNoteSaving(false)
    if (!error && data) {
      setDailyNote(data)
      setNoteEditing(false)
    }
  }

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
            .map((ev) => ({ ...ev, start: new Date(ev.start), end: new Date(ev.end) }))
        }
      } catch {
        // Acuity unavailable
      }

      // Match ALL events first, then filter by effective sector (allows overrides like Paloma → Plateau)
      const allMatched = matchEvents(allEvents, dogs, nameMap)
      const matched = sector === 'both'
        ? allMatched
        : allMatched.filter((m) => (m.sectorOverride || m.event.sector) === sector)
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

      // Log matches (fire-and-forget)
      const logs = matched
        .filter((m) => m.matchMethod !== 'none')
        .map((m) => ({
          acuity_name: m.event.summary || m.displayName,
          matched_dog: m.dog?.dog_name || null,
          match_method: m.matchMethod,
          walk_date: selectedDate,
        }))
      if (logs.length > 0) {
        supabase.from('match_log').upsert(logs, { onConflict: 'acuity_name,walk_date' })
          .then(({ error }) => { if (error) console.error('[match_log] upsert failed:', error) })
      }

      const filtered = enriched.filter((ev) => !/TBD/i.test(ev.displayName || ''))
      const grouped = groupEventsByTimeSlot(filtered)
      setGroups(grouped)
      setLoading(false)
    }

    buildSchedule()
  }, [dogsReady, dogs, nameMap, selectedDate, profile])

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
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: refreshing ? 88 : pullY }}
      >
        {(pullY > 8 || refreshing) && (
          <LoadingDog text={refreshing ? 'Wiggling...' : pullY >= PULL_THRESHOLD ? 'Release!' : 'Pull to refresh...'} />
        )}
      </div>

      <main className="px-4 py-4 pb-24 max-w-lg mx-auto">
        {/* Today / Tomorrow toggle with animated pill */}
        <div className="relative flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-200">
          {[{ label: 'Today', offset: 0 }, { label: 'Tomorrow', offset: 1 }].map(({ label, offset }) => (
            <button
              key={offset}
              onClick={() => switchDay(offset)}
              className="relative flex-1 py-2 rounded-lg text-sm font-semibold z-[1] min-h-[40px]"
            >
              {dayOffset === offset && (
                <motion.div
                  layoutId="day-pill"
                  className="absolute inset-0 bg-[#E8634A] rounded-lg shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className={`relative z-[2] ${dayOffset === offset ? 'text-white' : 'text-gray-500'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Note of the Day */}
        {isAdmin && !dailyNote && !noteEditing && (
          <button
            onClick={() => setNoteEditing(true)}
            className="w-full mb-4 py-3 rounded-full border-2 border-dashed border-[#E8634A]/30 text-[#E8634A] text-sm font-semibold active:bg-[#FFF4F1] transition-colors min-h-[48px]"
          >
            + Add Note of the Day
          </button>
        )}

        {noteEditing && isAdmin && (
          <div className="mb-4 bg-white rounded-xl border border-[#E8634A]/30 p-4 shadow-sm">
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Write a note for the team..."
              rows={2}
              aria-label="Note of the Day"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#E8634A] resize-none mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setNoteEditing(false); setNoteInput(dailyNote?.note_text || '') }}
                className="flex-1 py-2.5 rounded-full bg-gray-100 text-gray-600 text-sm font-semibold min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={saveDailyNote}
                disabled={noteSaving || !noteInput.trim()}
                className="flex-1 py-2.5 rounded-full bg-[#E8634A] text-white text-sm font-bold disabled:opacity-50 min-h-[44px] active:bg-[#d4552d]"
              >
                {noteSaving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        )}

        {dailyNote && !noteEditing && (
          <div
            className="mb-4 bg-[#E8634A] text-white rounded-xl px-4 py-3 shadow-sm"
            onClick={isAdmin ? () => { setNoteInput(dailyNote.note_text); setNoteEditing(true) } : undefined}
          >
            <div className="flex items-start gap-2">
              <span className="text-base flex-shrink-0 mt-0.5">📣</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-0.5">Note of the Day</p>
                <p className="text-sm font-medium leading-snug">{dailyNote.note_text}</p>
              </div>
              {isAdmin && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 opacity-60 flex-shrink-0 mt-0.5">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Owl note banners */}
        {(() => {
          const bannerNotes = sector === 'both'
            ? owlNotes.filter(n => n.target_type === 'sector' || n.target_type === 'all')
            : getOwlSectorNotes(sector)
          return bannerNotes.length > 0 && (
            <div className="flex flex-col gap-2 mb-4">
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

        {/* Progress banner */}
        {!loading && totalWalks > 0 && (
          <div className="mb-4 bg-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm border border-gray-100">
            <span className="text-sm text-gray-500">{dayLabel} walks</span>
            <span className="text-sm font-bold text-[#E8634A]">
              {loggedCount}/{totalWalks} logged
            </span>
          </div>
        )}

        {/* Skeleton loading */}
        {loading && !refreshing && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <SkeletonWalkCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <LoadingDog text={dayOffset === 0
              ? 'No adventures today! Time for belly rubs 🐾'
              : 'Nothing scheduled yet'
            } />
          </div>
        )}

        {/* Walk cards with staggered entrance */}
        {!loading && groups.length > 0 && (
          <div className="flex flex-col gap-3">
            {groups.map((group, i) => (
              <motion.div
                key={`${group.startTime.getTime()}-${group.endTime.getTime()}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
              >
                <WalkCard
                  group={group}
                  loggedIds={loggedIds}
                  onDogClick={setSelectedEvent}
                  onLogWalk={setLogGroup}
                  onStartRoute={setRouteGroup}
                />
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {selectedEvent && (
        <DogDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDogUpdated={handleDogUpdated}
          owlNotes={selectedEvent.dog?.id ? getOwlDogNotes(selectedEvent.dog.id) : []}
          onAcknowledgeNote={acknowledgeNote}
        />
      )}

      {logGroup && (
        <WalkLogModal
          group={logGroup}
          onClose={() => setLogGroup(null)}
          onLogged={handleLogged}
        />
      )}

      {routeGroup && (
        <RouteBuilder
          group={routeGroup}
          onClose={() => setRouteGroup(null)}
        />
      )}

      <BottomTabs />
    </div>
  )
}
