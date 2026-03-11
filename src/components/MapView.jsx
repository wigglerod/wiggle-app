import { useState, useEffect, useMemo, useRef, Component } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { APIProvider, Map as GoogleMap, Marker, useMapsLibrary } from '@vis.gl/react-google-maps'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const MONTREAL_CENTER = { lat: 45.5231, lng: -73.5828 }
const GROUP_COLORS = ['#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#EC4899', '#14B8A6']

function getGroupColor(groupNum) {
  return GROUP_COLORS[(groupNum - 1) % GROUP_COLORS.length]
}

// Geocode cache — persists across re-renders, avoids repeat API calls
const geocodeCache = new Map()

function markerSvg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/></svg>`
}

function markerIcon(color) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg(color))}`
}

function buildRouteUrl(addresses) {
  if (!addresses || addresses.length === 0) return null
  const withCity = addresses.map((a) => {
    const lower = a.toLowerCase()
    if (lower.includes('montréal') || lower.includes('montreal')) return `${a}, Canada`
    return `${a}, Montréal, QC, Canada`
  })
  if (withCity.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(withCity[0])}`
  }
  const origin = encodeURIComponent(withCity[0])
  const destination = encodeURIComponent(withCity[withCity.length - 1])
  const waypoints = withCity
    .slice(1, -1)
    .map((a) => encodeURIComponent(a))
    .join('|')
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=walking`
}

// Preserve dog_ids order from walk_groups (pickup order set in organizer)
function orderedDogs(dogIds, eventsMap) {
  const dogs = []
  const noAddr = []
  for (const id of [...new Set(dogIds || [])]) {
    const ev = eventsMap.get(String(id))
    if (!ev) continue
    const addr = ev.dog?.address || ev.location
    if (addr && addr.trim()) {
      dogs.push({ event: ev, address: addr.trim() })
    } else {
      noAddr.push(ev.displayName || ev.dog?.dog_name || 'Unknown')
    }
  }
  return { dogs, noAddr }
}

// ── Error Boundary ──────────────────────────────────────────────────
class MapErrorBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

// ── Interactive Google Map with geocoded markers ────────────────────
function MapWithMarkers({ allDogs, groupLegend, onDogClick }) {
  const geocodingLib = useMapsLibrary('geocoding')
  const [markers, setMarkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Stable key so we only re-geocode when addresses actually change
  const addressKey = useMemo(
    () => allDogs.map((d) => d.address).sort().join('|'),
    [allDogs]
  )

  useEffect(() => {
    if (!geocodingLib || allDogs.length === 0) return
    setLoading(true)

    const gc = new geocodingLib.Geocoder()

    async function geocodeAll() {
      const results = await Promise.all(
        allDogs.map(async (dog) => {
          const lower = dog.address.toLowerCase()
          const addr = lower.includes('montréal') || lower.includes('montreal')
            ? `${dog.address}, Canada`
            : `${dog.address}, Montréal, QC, Canada`

          if (geocodeCache.has(addr)) {
            return { ...dog, ...geocodeCache.get(addr) }
          }

          try {
            const { results: geo } = await gc.geocode({ address: addr })
            const loc = geo?.[0]?.geometry?.location
            if (loc) {
              const coords = { lat: loc.lat(), lng: loc.lng() }
              geocodeCache.set(addr, coords)
              return { ...dog, ...coords }
            }
          } catch {
            // Individual geocode failure — skip this dog
          }
          return null
        })
      )

      const valid = results.filter(Boolean)
      setMarkers(valid)
      setLoading(false)
    }

    geocodeAll().catch(() => {
      setError(true)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodingLib, addressKey])

  if (error) return null

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm mb-4">
      <GoogleMap
        defaultCenter={MONTREAL_CENTER}
        defaultZoom={14}
        style={{ width: '100%', height: '260px' }}
        gestureHandling="cooperative"
        disableDefaultUI
        zoomControl
      >
        {markers.map((m, i) => (
          <Marker
            key={m.event._id || i}
            position={{ lat: m.lat, lng: m.lng }}
            icon={markerIcon(m.color)}
            title={m.event.displayName}
            onClick={() => onDogClick?.(m.event)}
          />
        ))}
      </GoogleMap>

      {/* Loading indicator */}
      {loading && allDogs.length > 0 && (
        <div className="bg-gray-50 px-3 py-1.5 text-xs text-gray-400 text-center">
          Placing pins on map...
        </div>
      )}

      {/* Group color legend */}
      {!loading && markers.length > 0 && groupLegend.length > 0 && (
        <div className="bg-gray-50 px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 justify-center">
          {groupLegend.map((g) => (
            <span key={g.name} className="flex items-center gap-1 text-xs text-gray-500">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: g.color }}
              />
              {g.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main export ─────────────────────────────────────────────────────
export default function MapView({ events, date, sector, onDogClick }) {
  const [walkGroups, setWalkGroups] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [longPressMenu, setLongPressMenu] = useState(null)
  const lpTimer = useRef(null)
  const didLongPress = useRef(false)

  // Load walk_groups for today
  useEffect(() => {
    if (!date) return
    async function load() {
      const query = supabase
        .from('walk_groups')
        .select('*')
        .eq('walk_date', date)
      if (sector && sector !== 'both') {
        query.eq('sector', sector)
      }
      const { data } = await query
      setWalkGroups(data || [])
      setLoaded(true)
    }
    load()
  }, [date, sector])

  // Build event lookup
  const eventsMap = useMemo(() => {
    const m = new Map()
    for (const ev of events || []) {
      m.set(String(ev._id), ev)
    }
    return m
  }, [events])

  // Build the sector → group → dogs hierarchy
  const { sections, unassigned, dogsWithoutAddress } = useMemo(() => {
    if (!events || events.length === 0 || !loaded) {
      return { sections: [], unassigned: [], dogsWithoutAddress: [] }
    }

    const assignedIds = new Set()
    const sectorOrder = sector === 'both' ? ['Plateau', 'Laurier'] : [sector]
    const sectionsOut = []

    for (const sectorName of sectorOrder) {
      const sectorGroups = walkGroups
        .filter((wg) => wg.sector === sectorName)
        .sort((a, b) => a.group_num - b.group_num)

      const groupCards = []

      for (const wg of sectorGroups) {
        // Use dog_ids order (pickup order from organizer)
        const { dogs, noAddr } = orderedDogs(wg.dog_ids, eventsMap)
        for (const d of dogs) assignedIds.add(String(d.event._id))
        for (const id of [...new Set(wg.dog_ids || [])]) {
          const ev = eventsMap.get(String(id))
          if (ev) assignedIds.add(String(id))
        }

        // Skip empty groups
        if (dogs.length === 0 && noAddr.length === 0) continue

        groupCards.push({
          groupNum: wg.group_num,
          groupName: wg.group_name || `Group ${wg.group_num}`,
          dogs,
          noAddr,
        })
      }

      if (groupCards.length > 0) {
        sectionsOut.push({ sectorName, groups: groupCards })
      }
    }

    // Unassigned events
    const unassignedOut = []
    const noAddrOut = []

    for (const ev of events) {
      if (assignedIds.has(String(ev._id))) continue
      const evSector = ev.dog?.sector || ev.sector
      if (sector !== 'both' && evSector && evSector !== sector) continue
      const addr = ev.dog?.address || ev.location
      if (addr && addr.trim()) {
        unassignedOut.push({ event: ev, address: addr.trim() })
      } else {
        noAddrOut.push(ev.displayName || ev.dog?.dog_name || 'Unknown')
      }
    }

    return { sections: sectionsOut, unassigned: unassignedOut, dogsWithoutAddress: noAddrOut }
  }, [events, walkGroups, eventsMap, loaded, sector])

  // Collect all dogs with group colors for the interactive map
  const { allMapDogs, groupLegend } = useMemo(() => {
    const dogs = []
    const legend = []

    for (const sec of sections) {
      for (const group of sec.groups) {
        const color = getGroupColor(group.groupNum)
        legend.push({ name: group.groupName, color })
        for (const dog of group.dogs) {
          dogs.push({ ...dog, color, groupName: group.groupName })
        }
      }
    }
    for (const dog of unassigned) {
      dogs.push({ ...dog, color: '#9CA3AF', groupName: 'Not grouped' })
    }

    return { allMapDogs: dogs, groupLegend: legend }
  }, [sections, unassigned])

  function handleChipTap(ev) {
    if (didLongPress.current) { didLongPress.current = false; return }
    const id = String(ev._id)
    setSelectedId(prev => prev === id ? null : id)
  }

  function handleLPDown(ev, e) {
    didLongPress.current = false
    const rect = e.currentTarget.getBoundingClientRect()
    lpTimer.current = setTimeout(() => {
      didLongPress.current = true
      setLongPressMenu({
        dogId: String(ev._id),
        event: ev,
        x: Math.min(rect.left + rect.width / 2, window.innerWidth - 120),
        y: rect.bottom + 4,
      })
    }, 500)
  }
  function handleLPUp() { if (lpTimer.current) clearTimeout(lpTimer.current) }
  function handleLPMove() { if (lpTimer.current) clearTimeout(lpTimer.current) }

  async function handleLPMenuAssign(groupNum, sectorName) {
    if (!longPressMenu) return
    const wg = walkGroups.find(w => w.group_num === groupNum && w.sector === sectorName)
    if (!wg) return
    const newDogIds = [...(wg.dog_ids || []), longPressMenu.dogId]
    const { error } = await supabase.from('walk_groups')
      .update({ dog_ids: newDogIds, updated_at: new Date().toISOString() })
      .eq('walk_date', date)
      .eq('group_num', groupNum)
      .eq('sector', sectorName)
    if (error) { toast.error('Failed to assign dog'); return }
    setWalkGroups(prev => prev.map(w =>
      w.group_num === groupNum && w.sector === sectorName ? { ...w, dog_ids: newDogIds } : w
    ))
    setLongPressMenu(null)
    toast.success('✓ Saved')
  }

  async function assignToGroup(groupNum, sectorName) {
    if (!selectedId) return
    const wg = walkGroups.find(w => w.group_num === groupNum && w.sector === sectorName)
    if (!wg) return
    const newDogIds = [...(wg.dog_ids || []), selectedId]
    const { error } = await supabase.from('walk_groups')
      .update({ dog_ids: newDogIds, updated_at: new Date().toISOString() })
      .eq('walk_date', date)
      .eq('group_num', groupNum)
      .eq('sector', sectorName)
    if (error) { toast.error('Failed to assign dog'); return }
    setWalkGroups(prev => prev.map(w =>
      w.group_num === groupNum && w.sector === sectorName ? { ...w, dog_ids: newDogIds } : w
    ))
    setSelectedId(null)
    toast.success('✓ Saved')
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
        Loading routes...
      </div>
    )
  }

  const hasContent = sections.length > 0 || unassigned.length > 0

  if (!hasContent && dogsWithoutAddress.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
        <span className="text-4xl">🗺️</span>
        <p className="text-sm font-semibold text-gray-600">No dogs assigned to groups yet</p>
        <p className="text-xs text-gray-400">Use the Organizer tab to assign dogs to groups.</p>
      </div>
    )
  }

  return (
    <MapErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-4xl">🗺️</span>
          <p className="text-sm font-semibold text-gray-600">Map couldn&apos;t load</p>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Interactive Google Map */}
        {GOOGLE_MAPS_KEY && allMapDogs.length > 0 && (
          <MapErrorBoundary fallback={null}>
            <APIProvider apiKey={GOOGLE_MAPS_KEY}>
              <MapWithMarkers
                allDogs={allMapDogs}
                groupLegend={groupLegend}
                onDogClick={onDogClick}
              />
            </APIProvider>
          </MapErrorBoundary>
        )}

        {/* Sector sections */}
        {sections.map((sec) => (
          <SectorSection
            key={sec.sectorName}
            sectorName={sec.sectorName}
            groups={sec.groups}
            showHeader={sector === 'both'}
            onDogClick={onDogClick}
            selectedId={selectedId}
            onAssign={(groupNum) => assignToGroup(groupNum, sec.sectorName)}
          />
        ))}

        {/* Unassigned dogs — compact assignable chips */}
        {unassigned.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-gray-500">
              Not yet grouped ({unassigned.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {unassigned.map((d) => {
                const id = String(d.event._id)
                return (
                  <button
                    key={id}
                    onClick={() => handleChipTap(d.event)}
                    onPointerDown={(e) => handleLPDown(d.event, e)}
                    onPointerUp={handleLPUp}
                    onPointerCancel={handleLPUp}
                    onPointerMove={handleLPMove}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all h-9 select-none
                      ${selectedId === id
                        ? 'bg-[#E8634A] text-white shadow-md wiggle'
                        : 'bg-white text-gray-700 border border-gray-200 shadow-sm active:scale-[0.97]'
                      }
                    `}
                  >
                    <span className="truncate max-w-[140px]">{d.event.displayName}</span>
                    <span
                      onClick={(e) => { e.stopPropagation(); onDogClick?.(d.event) }}
                      className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] flex-shrink-0 ${
                        selectedId === id ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-400'
                      }`}
                    >i</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Dogs without addresses */}
        {dogsWithoutAddress.length > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">Missing addresses:</p>
            {dogsWithoutAddress.map((name, i) => (
              <p key={i} className="text-xs text-amber-600">{name} has no address on file</p>
            ))}
          </div>
        )}
        {/* Long-press popup menu */}
        <AnimatePresence>
          {longPressMenu && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setLongPressMenu(null)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'fixed',
                  top: Math.min(longPressMenu.y, window.innerHeight - 280),
                  left: Math.max(8, Math.min(longPressMenu.x - 96, window.innerWidth - 200)),
                  zIndex: 60,
                }}
                className="bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 w-48 overflow-hidden"
              >
                <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Move to...</p>
                {sections.map(sec => sec.groups.map(g => (
                  <button
                    key={`${sec.sectorName}-${g.groupNum}`}
                    onClick={() => handleLPMenuAssign(g.groupNum, sec.sectorName)}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 active:bg-[#FFF4F1] min-h-[48px] flex items-center gap-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getGroupColor(g.groupNum) }} />
                    {g.groupName}
                    {sector === 'both' && <span className="text-xs text-gray-400 ml-auto">{sec.sectorName}</span>}
                  </button>
                )))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </MapErrorBoundary>
  )
}

// ── Sector section ──────────────────────────────────────────────────
function SectorSection({ sectorName, groups, showHeader, onDogClick, selectedId, onAssign }) {
  return (
    <div className="flex flex-col gap-3">
      {showHeader && (
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              sectorName === 'Plateau' ? 'bg-amber-400' : 'bg-blue-400'
            }`}
          />
          <h2 className="text-sm font-bold text-gray-700">{sectorName}</h2>
        </div>
      )}

      {groups.map((g) => (
        <GroupCard key={g.groupNum} group={g} onDogClick={onDogClick} selectedId={selectedId} onAssign={() => onAssign?.(g.groupNum)} />
      ))}
    </div>
  )
}

// ── Group card with route button + dog list ─────────────────────────
function GroupCard({ group, onDogClick, selectedId, onAssign }) {
  const addresses = group.dogs.map((d) => d.address)
  const routeUrl = buildRouteUrl(addresses)
  const color = getGroupColor(group.groupNum)

  return (
    <div className="flex flex-col gap-0">
      {/* Group header + Start Route */}
      <div className="flex items-center justify-between bg-white rounded-t-2xl border border-gray-200 border-b-0 px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-bold text-gray-700">{group.groupName}</span>
          <span className="text-xs text-gray-400">
            ({group.dogs.length} {group.dogs.length === 1 ? 'dog' : 'dogs'})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedId && (
            <button
              onClick={onAssign}
              className="px-3 py-1.5 rounded-lg bg-[#E8634A] text-white text-xs font-bold active:bg-[#d4552d] transition-all shadow-sm animate-pulse"
            >
              + Add here
            </button>
          )}
          {routeUrl && !selectedId && (
            <a
              href={routeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E8634A] text-white text-xs font-bold active:bg-[#d4552d] transition-all shadow-sm"
            >
              🗺️ Start Route
            </a>
          )}
        </div>
      </div>

      {/* Dog list */}
      <div className="bg-white rounded-b-2xl border border-gray-200 shadow-sm overflow-hidden">
        {group.dogs.map((d, i) => (
          <DogRow key={d.event._id || i} dog={d} index={i + 1} onDogClick={onDogClick} color={color} />
        ))}
        {group.noAddr.map((name, i) => (
          <div key={`noaddr-${i}`} className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-50">
            <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold flex-shrink-0">
              ?
            </span>
            <span className="text-sm text-gray-400 italic">{name} — no address on file</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Single dog row ──────────────────────────────────────────────────
function DogRow({ dog, index, onDogClick, color }) {
  return (
    <button
      onClick={() => onDogClick?.(dog.event)}
      className={`flex items-center gap-3 px-4 py-2.5 text-left active:bg-gray-50 transition-all w-full ${
        index > 1 ? 'border-t border-gray-50' : ''
      }`}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: color || '#9CA3AF' }}
      >
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{dog.event.displayName}</p>
        <p className="text-xs text-gray-400 truncate">{dog.address}</p>
      </div>
      <span className="text-gray-300 text-sm flex-shrink-0">›</span>
    </button>
  )
}
