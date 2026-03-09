import { useState, useEffect, useMemo, Component } from 'react'
import { supabase } from '../lib/supabase'

const GROUP_COLORS = ['#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#EC4899', '#14B8A6']

function getGroupColor(groupNum) {
  return GROUP_COLORS[(groupNum - 1) % GROUP_COLORS.length]
}

function buildRouteUrl(addresses) {
  if (!addresses || addresses.length === 0) return null
  const withCity = addresses.map((a) =>
    a.toLowerCase().includes('montréal') || a.toLowerCase().includes('montreal')
      ? a
      : `${a}, Montréal, QC`
  )
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

// ── Error Boundary ──────────────────────────────────────────────────
class MapErrorBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

// ── Main export ─────────────────────────────────────────────────────
export default function MapView({ events, date, sector, onDogClick }) {
  const [walkGroups, setWalkGroups] = useState([])
  const [loaded, setLoaded] = useState(false)

  // Load walk_groups for today (all sectors)
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

    // Track which event _ids are assigned to a walk group
    const assignedIds = new Set()

    // Determine which sectors to show
    const sectorOrder = sector === 'both' ? ['Plateau', 'Laurier'] : [sector]
    const sectionsOut = []

    for (const sectorName of sectorOrder) {
      // Get walk_groups for this sector, sorted by group_num
      const sectorGroups = walkGroups
        .filter((wg) => wg.sector === sectorName)
        .sort((a, b) => a.group_num - b.group_num)

      const groupCards = []

      for (const wg of sectorGroups) {
        const dogs = []
        const noAddr = []

        for (const id of wg.dog_ids || []) {
          const ev = eventsMap.get(String(id))
          if (!ev) continue
          assignedIds.add(String(id))
          const addr = ev.dog?.address || ev.location
          if (addr && addr.trim()) {
            dogs.push({ event: ev, address: addr.trim() })
          } else {
            noAddr.push(ev.displayName || ev.dog?.dog_name || 'Unknown')
          }
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

    // Unassigned events (not in any walk_group)
    const unassignedOut = []
    const noAddrOut = []

    for (const ev of events) {
      if (assignedIds.has(String(ev._id))) continue
      // Filter by sector if needed
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
        <p className="text-xs text-gray-400">Use the Organizer tab to drag dogs into groups.</p>
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
        {/* Sector sections */}
        {sections.map((sec) => (
          <SectorSection
            key={sec.sectorName}
            sectorName={sec.sectorName}
            groups={sec.groups}
            showHeader={sector === 'both'}
            onDogClick={onDogClick}
          />
        ))}

        {/* Unassigned dogs */}
        {unassigned.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">⚠️</span>
              <h3 className="text-sm font-bold text-gray-500">
                Not yet grouped ({unassigned.length} {unassigned.length === 1 ? 'dog' : 'dogs'})
              </h3>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {unassigned.map((d, i) => (
                <DogRow key={d.event._id || i} dog={d} index={i + 1} onDogClick={onDogClick} />
              ))}
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
      </div>
    </MapErrorBoundary>
  )
}

// ── Sector section ──────────────────────────────────────────────────
function SectorSection({ sectorName, groups, showHeader, onDogClick }) {
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
        <GroupCard key={g.groupNum} group={g} onDogClick={onDogClick} />
      ))}
    </div>
  )
}

// ── Group card with route button + dog list ─────────────────────────
function GroupCard({ group, onDogClick }) {
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
        {routeUrl && (
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
