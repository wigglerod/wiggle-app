import { useState, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import Header from '../components/Header'
import LoadingDog from '../components/LoadingDog'
import BottomTabs from '../components/BottomTabs'
import GroupOrganizer from '../components/GroupOrganizer'
import DogDrawer from '../components/DogDrawer'
import WeeklyView from '../components/WeeklyView'

import { useOwlNotes } from '../lib/useOwlNotes'
import { getCachedDogs, setCachedDogs } from '../lib/useOffline'

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
  const { profile, permissions } = useAuth()
  const [dogs, setDogs] = useState([])
  const [nameMap, setNameMap] = useState(new Map())
  const [dogsReady, setDogsReady] = useState(false)
  const [allEvents, setAllEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDay, setSelectedDay] = useState('today')
  const [customDate, setCustomDate] = useState(null)
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('wiggle_viewMode') || 'today' } catch { return 'today' }
  })
  const [sectorFilter, setSectorFilter] = useState(null)
  const [anyGroupLocked, setAnyGroupLocked] = useState(false)
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

  const activeDate = customDate || (selectedDay === 'today' ? today : tomorrow)
  const profileSector = profile?.sector || 'both'
  const sector = sectorFilter || profileSector

  // Persist view state
  useEffect(() => { try { localStorage.setItem('wiggle_viewMode', viewMode) } catch {} }, [viewMode])

  // Owl notes
  const { notes: owlNotes, sectorNotes: getOwlSectorNotes, acknowledgeNote } = useOwlNotes(sector)

  // Load cached dogs instantly, then refresh from Supabase
  useEffect(() => {
    const cached = getCachedDogs()
    if (cached && dogs.length === 0) setDogs(cached)
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
          rawEvents = acuityEvents.map((ev) => ({ ...ev, start: new Date(ev.start), end: new Date(ev.end) }))
        }
      } catch {}

      _idCounter = 0
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

  // Filter by sector
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!loading) setRefreshing(false) }, [loading])

  // Pull-to-refresh
  function handleTouchStart(e) {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }
  function handleTouchMove(e) {
    if (!isPulling.current) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) setPullY(Math.min(delta * 0.45, PULL_MAX))
    else { isPulling.current = false; setPullY(0) }
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
    setAllEvents((prev) => prev.map((ev) => ev.dog?.id === updatedDog.id ? { ...ev, dog: updatedDog } : ev))
    setSelectedEvent((prev) => prev?.dog?.id === updatedDog.id ? { ...prev, dog: updatedDog } : prev)
  }

  function handleDayToggle() {
    setSelectedDay((prev) => (prev === 'today' ? 'tomorrow' : 'today'))
    setCustomDate(null)
    setAllEvents([])
  }

  function handleWeekDaySelect(dateStr) {
    setCustomDate(dateStr)
    setViewMode('today')
    setAllEvents([])
  }

  function handleSectorCycle() {
    if (profileSector !== 'both') return
    const cycle = ['both', 'Plateau', 'Laurier']
    setSectorFilter((prev) => {
      const idx = cycle.indexOf(prev || 'both')
      return cycle[(idx + 1) % cycle.length]
    })
  }

  const sectorEmoji = sector === 'Plateau' ? '\u{1F7E1}' : sector === 'Laurier' ? '\u{1F535}' : ''
  const sectorLabel = sector === 'both' ? 'All Sectors' : sector

  return (
    <div
      className="min-h-screen pb-20"
      style={{ background: '#FFF5F0' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Header />

      {/* Date + Sector + View toggle */}
      <div className="px-4 pt-2 pb-1 max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (viewMode === 'week') setViewMode('today'); else handleDayToggle() }}
            className="text-[13px] font-semibold text-gray-700 active:opacity-60 transition-opacity"
          >
            {viewMode === 'week' ? 'This Week' : customDate && customDate !== today
              ? formatDayLabel(customDate)
              : selectedDay === 'today' ? `Today \u00b7 ${formatDayLabel(today)}` : `Tomorrow \u00b7 ${formatDayLabel(tomorrow)}`
            }
          </button>

          {/* Today / Week pills */}
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={() => { setViewMode('today'); setCustomDate(null); setSelectedDay('today') }}
              style={{
                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                background: viewMode === 'today' ? '#E8634A' : 'transparent',
                color: viewMode === 'today' ? '#fff' : '#888',
                border: viewMode === 'today' ? 'none' : '0.5px solid #ddd',
              }}
            >
              Today
            </button>
            <button
              onClick={() => setViewMode('week')}
              style={{
                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                background: viewMode === 'week' ? '#E8634A' : 'transparent',
                color: viewMode === 'week' ? '#fff' : '#888',
                border: viewMode === 'week' ? 'none' : '0.5px solid #ddd',
              }}
            >
              Week
            </button>
          </div>
        </div>

        {/* Sector badge */}
        {permissions.canViewAllSectors ? (
          <button
            onClick={handleSectorCycle}
            style={{
              fontSize: 12, padding: '2px 8px', borderRadius: 10, fontWeight: 600, cursor: 'pointer',
              background: sector === 'Plateau' ? '#fef3c7' : sector === 'Laurier' ? '#dbeafe' : '#ede9fe',
              color: sector === 'Plateau' ? '#92400e' : sector === 'Laurier' ? '#1e40af' : '#5b21b6',
              border: 'none',
            }}
          >
            {sectorEmoji} {sectorLabel}
          </button>
        ) : (
          <span style={{
            fontSize: 12, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
            background: sector === 'Plateau' ? '#fef3c7' : '#dbeafe',
            color: sector === 'Plateau' ? '#92400e' : '#1e40af',
          }}>
            {sectorEmoji} {sectorLabel}
          </span>
        )}
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
        {/* Stats line */}
        {!loading && filteredEvents.length > 0 && (
          <p style={{ fontSize: 12, color: '#aaa', fontWeight: 500, marginBottom: 8 }}>
            {filteredEvents.length} dog{filteredEvents.length !== 1 ? 's' : ''}
            {timeGroups.length > 0 && ` \u00b7 ${timeGroups.length} time slot${timeGroups.length !== 1 ? 's' : ''}`}
          </p>
        )}

        {viewMode === 'today' && loading && !refreshing && (
          <div className="flex justify-center py-20"><LoadingDog /></div>
        )}

        {viewMode === 'today' && !loading && filteredEvents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 16px' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{'\u{1F43E}'}</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#555', marginBottom: 4 }}>
              No walks {selectedDay === 'today' ? 'today' : 'tomorrow'}
            </p>
            <p style={{ fontSize: 13, color: '#aaa' }}>
              {selectedDay === 'today' ? 'Enjoy your day off!' : 'Nothing scheduled yet.'}
            </p>
          </div>
        )}

        {/* Owl note banners */}
        {!loading && (() => {
          const bannerNotes = sector === 'both'
            ? owlNotes.filter(n => n.target_type === 'sector' || n.target_type === 'all')
            : getOwlSectorNotes(sector)
          return bannerNotes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {bannerNotes.map(note => (
                <div key={note.id} style={{ background: 'rgba(232,99,74,0.1)', border: '1px solid rgba(232,99,74,0.3)', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{'\u{1F989}'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#E8634A', lineHeight: 1.4 }}>{note.note_text}</p>
                      {note.expires_at && (
                        <p style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                          Daily reminder {'\u00b7'} Expires {new Date(note.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => acknowledgeNote(note.id)}
                    style={{ marginTop: 8, width: '100%', padding: 8, borderRadius: 20, background: '#E8634A', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                  >
                    Got it {'\u2713'}
                  </button>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Weekly view */}
        {viewMode === 'week' && (
          <WeeklyView sector={sector} today={today} onSelectDay={handleWeekDaySelect} />
        )}

        {/* Organizer */}
        {viewMode === 'today' && !loading && (filteredEvents.length > 0 || anyGroupLocked) && (
          <div className="flex flex-col gap-4">
            {Object.entries(sectorEvents).map(([sectorName, events]) => (
              <div key={sectorName}>
                {sector === 'both' && (
                  <h2 style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: sectorName === 'Plateau' ? '#f59e0b' : '#3b82f6' }} />
                    {sectorName}
                  </h2>
                )}
                <GroupOrganizer
                  events={events}
                  date={activeDate}
                  sector={sectorName}
                  onDogClick={setSelectedEvent}
                  owlDogNotes={owlNotes.filter(n => n.target_type === 'dog')}
                  onAnyGroupLocked={setAnyGroupLocked}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomTabs />

      {/* Dog profile drawer */}
      {selectedEvent && (
        <DogDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDogUpdated={handleDogUpdated}
          owlNotes={selectedEvent.dog?.id ? owlNotes.filter(n => n.target_type === 'dog' && n.target_dog_id === selectedEvent.dog.id) : []}
          onAcknowledgeNote={acknowledgeNote}
        />
      )}
    </div>
  )
}
