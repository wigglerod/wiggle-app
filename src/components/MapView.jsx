import { useState, useEffect, useMemo, Component } from 'react'

const MONTREAL_CENTER = { lat: 45.523, lng: -73.59 }
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || ''

const GROUP_COLORS = {
  unassigned: '#9CA3AF',
  1: '#3B82F6',
  2: '#22C55E',
  3: '#A855F7',
  4: '#F59E0B',
  5: '#EC4899',
}

const GROUP_LABELS = {
  unassigned: 'Unassigned',
  1: 'Group 1',
  2: 'Group 2',
  3: 'Group 3',
  4: 'Group 4',
  5: 'Group 5',
}

function getGroupColor(group) {
  return GROUP_COLORS[group] || GROUP_COLORS.unassigned
}

function getGroupLabel(group) {
  return GROUP_LABELS[group] || `Group ${group}`
}

/**
 * Build a Google Maps directions URL with waypoints.
 */
function buildRouteUrl(addresses) {
  if (!addresses || addresses.length === 0) return null
  if (addresses.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addresses[0])}`
  }
  const origin = encodeURIComponent(addresses[0])
  const destination = encodeURIComponent(addresses[addresses.length - 1])
  const waypoints = addresses
    .slice(1, -1)
    .map((a) => encodeURIComponent(a))
    .join('|')
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=walking`
}

// ── Error Boundary ──────────────────────────────────────────────────
class MapErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// ── Main export ─────────────────────────────────────────────────────
export default function MapView({ events, groups, onDogClick }) {
  // Build markers and detect missing-address dogs
  const { markers, dogsWithoutAddress, groupedAddresses } = useMemo(() => {
    if (!events || events.length === 0) {
      return { markers: [], dogsWithoutAddress: [], groupedAddresses: {} }
    }

    const eventGroupMap = new Map()
    if (groups) {
      try {
        for (const [groupKey, ids] of Object.entries(groups)) {
          if (Array.isArray(ids)) {
            for (const id of ids) {
              eventGroupMap.set(String(id), groupKey)
            }
          }
        }
      } catch {
        // groups had unexpected shape — continue without grouping
      }
    }

    const withAddress = []
    const noAddress = []

    for (const ev of events) {
      const addr = ev.dog?.address || ev.location
      if (addr && addr.trim().length > 0) {
        const group = eventGroupMap.get(String(ev._id)) || 'unassigned'
        withAddress.push({
          event: ev,
          address: addr.trim(),
          group,
          index: withAddress.length + 1,
        })
      } else {
        noAddress.push(ev.displayName || ev.dog?.dog_name || 'Unknown dog')
      }
    }

    const grouped = {}
    for (const m of withAddress) {
      if (!grouped[m.group]) grouped[m.group] = []
      grouped[m.group].push(m.address)
    }

    return { markers: withAddress, dogsWithoutAddress: noAddress, groupedAddresses: grouped }
  }, [events, groups])

  // ── Friendly fallback when no API key ─────────────────────────────
  if (!MAPS_API_KEY) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-4xl">🗺️</span>
          <p className="text-sm font-semibold text-gray-600">Map coming soon!</p>
          <p className="text-xs text-gray-400">Use the organizer to plan your route.</p>
        </div>

        {/* Still show route links */}
        <RouteLinkButtons groupedAddresses={groupedAddresses} />

        {/* Address list */}
        <AddressList markers={markers} onDogClick={onDogClick} />

        {/* Dogs without addresses */}
        <MissingAddressNotes names={dogsWithoutAddress} />
      </div>
    )
  }

  // ── Map with error boundary ───────────────────────────────────────
  const mapFallback = (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
      <span className="text-4xl">🗺️</span>
      <p className="text-sm font-semibold text-gray-600">Map couldn&apos;t load</p>
      <p className="text-xs text-gray-400">Use the route links below instead.</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <MapErrorBoundary fallback={mapFallback}>
        <GoogleMapInner markers={markers} onDogClick={onDogClick} />
      </MapErrorBoundary>

      <RouteLinkButtons groupedAddresses={groupedAddresses} />
      <AddressList markers={markers} onDogClick={onDogClick} />
      <MissingAddressNotes names={dogsWithoutAddress} />
    </div>
  )
}

// ── Google Map (separated so ErrorBoundary can catch it) ────────────
function GoogleMapInner({ markers, onDogClick }) {
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [mapLib, setMapLib] = useState(null)
  const [loadError, setLoadError] = useState(false)

  // Lazy-load the Google Maps library to isolate import failures
  useEffect(() => {
    let cancelled = false
    import('@vis.gl/react-google-maps')
      .then((lib) => { if (!cancelled) setMapLib(lib) })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [])

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <span className="text-4xl">🗺️</span>
        <p className="text-sm font-semibold text-gray-600">Map couldn&apos;t load</p>
        <p className="text-xs text-gray-400">Use the route links below instead.</p>
      </div>
    )
  }

  if (!mapLib) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
        Loading map...
      </div>
    )
  }

  const { APIProvider, Map, AdvancedMarker, InfoWindow } = mapLib

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '350px' }}>
      <APIProvider apiKey={MAPS_API_KEY}>
        <Map
          defaultCenter={MONTREAL_CENTER}
          defaultZoom={13}
          mapId={MAP_ID || undefined}
          gestureHandling="greedy"
          disableDefaultUI={true}
          zoomControl={true}
          style={{ width: '100%', height: '100%' }}
        >
          {markers.map((m) => (
            <AdvancedMarker
              key={m.event._id || m.index}
              position={m.event._geocoded || MONTREAL_CENTER}
              onClick={() => setSelectedEvent(m)}
            >
              <MarkerPin color={getGroupColor(m.group)} label={m.index} />
            </AdvancedMarker>
          ))}

          {selectedEvent && (
            <InfoWindow
              position={selectedEvent.event._geocoded || MONTREAL_CENTER}
              onCloseClick={() => setSelectedEvent(null)}
            >
              <div className="p-1 min-w-[140px]">
                <p className="font-bold text-sm">{selectedEvent.event.displayName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{selectedEvent.address}</p>
                <p className="text-xs mt-1" style={{ color: getGroupColor(selectedEvent.group) }}>
                  {getGroupLabel(selectedEvent.group)}
                </p>
                <button
                  onClick={() => onDogClick?.(selectedEvent.event)}
                  className="mt-2 text-xs text-[#E8634A] font-semibold underline"
                >
                  View profile
                </button>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  )
}

function MarkerPin({ color, label }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg border-2 border-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </div>
      <div className="w-2 h-2 rotate-45 -mt-1" style={{ backgroundColor: color }} />
    </div>
  )
}

function AddressList({ markers, onDogClick }) {
  if (!markers || markers.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {markers.map((m) => (
        <button
          key={m.event._id || m.index}
          onClick={() => onDogClick?.(m.event)}
          className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 text-left active:bg-gray-50 transition-all"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: getGroupColor(m.group) }}
          >
            {m.index}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{m.event.displayName}</p>
            <p className="text-xs text-gray-400 truncate">{m.address}</p>
          </div>
          <span className="text-gray-300 text-sm flex-shrink-0">›</span>
        </button>
      ))}
    </div>
  )
}

function MissingAddressNotes({ names }) {
  if (!names || names.length === 0) return null

  return (
    <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
      <p className="text-xs font-semibold text-amber-700 mb-1">Missing addresses:</p>
      {names.map((name, i) => (
        <p key={i} className="text-xs text-amber-600">{name} has no address on file</p>
      ))}
    </div>
  )
}

function RouteLinkButtons({ groupedAddresses }) {
  if (!groupedAddresses) return null

  const entries = Object.entries(groupedAddresses).filter(
    ([, addrs]) => Array.isArray(addrs) && addrs.length > 0
  )
  if (entries.length === 0) return null

  const allAddresses = entries.flatMap(([, addrs]) => addrs)
  const allUrl = buildRouteUrl(allAddresses)

  return (
    <div className="flex flex-col gap-2">
      {allUrl && allAddresses.length > 0 && (
        <a
          href={allUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#E8634A] text-white text-sm font-bold shadow-sm active:bg-[#d4552d] transition-all"
        >
          🗺️ Start Full Route ({allAddresses.length} stops)
        </a>
      )}

      {entries.length > 1 &&
        entries.map(([group, addrs]) => {
          const url = buildRouteUrl(addrs)
          if (!url) return null
          return (
            <a
              key={group}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold shadow-sm active:bg-gray-50 transition-all"
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getGroupColor(group) }} />
              {getGroupLabel(group)} Route ({addrs.length} stops)
            </a>
          )
        })}
    </div>
  )
}
