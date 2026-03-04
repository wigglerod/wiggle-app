import { useState, useMemo } from 'react'
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps'

const MONTREAL_CENTER = { lat: 45.5230, lng: -73.5900 }
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || ''

const GROUP_COLORS = {
  unassigned: '#9CA3AF',
  1: '#3B82F6',
  2: '#22C55E',
  3: '#A855F7',
}

const GROUP_LABELS = {
  unassigned: 'Unassigned',
  1: 'Group 1',
  2: 'Group 2',
  3: 'Group 3',
}

/**
 * Build a Google Maps directions URL with waypoints.
 * Opens turn-by-turn navigation on mobile.
 */
function buildRouteUrl(addresses) {
  if (addresses.length === 0) return null
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

function MarkerPin({ color, label }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg border-2 border-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </div>
      <div
        className="w-2 h-2 rotate-45 -mt-1"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}

export default function MapView({ events, groups, onDogClick }) {
  const [selectedEvent, setSelectedEvent] = useState(null)

  // Build markers: events that have an address and geocodable location
  const markers = useMemo(() => {
    if (!events || events.length === 0) return []

    // Find which group each event belongs to
    const eventGroupMap = new Map()
    if (groups) {
      for (const [groupKey, ids] of Object.entries(groups)) {
        for (const id of ids) {
          eventGroupMap.set(String(id), groupKey)
        }
      }
    }

    return events
      .filter((ev) => {
        const addr = ev.dog?.address || ev.location
        return addr && addr.trim().length > 0
      })
      .map((ev, idx) => {
        const group = eventGroupMap.get(String(ev._id)) || 'unassigned'
        return {
          event: ev,
          address: ev.dog?.address || ev.location,
          group,
          index: idx + 1,
        }
      })
  }, [events, groups])

  // Group addresses for route buttons
  const groupedAddresses = useMemo(() => {
    const result = {}
    for (const m of markers) {
      if (!result[m.group]) result[m.group] = []
      result[m.group].push(m.address)
    }
    return result
  }, [markers])

  if (!MAPS_API_KEY) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
        <span className="text-4xl">🗺️</span>
        <p className="text-sm font-semibold text-gray-600">Google Maps API key not configured</p>
        <p className="text-xs text-gray-400">
          Add VITE_GOOGLE_MAPS_API_KEY to your .env file.
          {MAP_ID ? '' : ' Also add VITE_GOOGLE_MAPS_MAP_ID for advanced markers.'}
        </p>
        {/* Still show route links without the map */}
        {Object.entries(groupedAddresses).length > 0 && (
          <div className="w-full mt-4">
            <RouteLinkButtons groupedAddresses={groupedAddresses} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '350px' }}>
        <APIProvider apiKey={MAPS_API_KEY}>
          <Map
            defaultCenter={MONTREAL_CENTER}
            defaultZoom={13}
            mapId={MAP_ID}
            gestureHandling="greedy"
            disableDefaultUI={true}
            zoomControl={true}
            style={{ width: '100%', height: '100%' }}
          >
            {markers.map((m) => (
              <AdvancedMarker
                key={m.event._id}
                position={m.event._geocoded || MONTREAL_CENTER}
                onClick={() => setSelectedEvent(m)}
              >
                <MarkerPin
                  color={GROUP_COLORS[m.group] || GROUP_COLORS.unassigned}
                  label={m.index}
                />
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
                  <p className="text-xs mt-1" style={{ color: GROUP_COLORS[selectedEvent.group] }}>
                    {GROUP_LABELS[selectedEvent.group]}
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

      {/* Route buttons */}
      <RouteLinkButtons groupedAddresses={groupedAddresses} />

      {/* Address list */}
      <div className="flex flex-col gap-2">
        {markers.map((m) => (
          <button
            key={m.event._id}
            onClick={() => onDogClick?.(m.event)}
            className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 text-left active:bg-gray-50 transition-all"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: GROUP_COLORS[m.group] || GROUP_COLORS.unassigned }}
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
    </div>
  )
}

function RouteLinkButtons({ groupedAddresses }) {
  const entries = Object.entries(groupedAddresses).filter(
    ([, addrs]) => addrs.length > 0
  )
  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {/* All addresses route */}
      {(() => {
        const allAddresses = entries.flatMap(([, addrs]) => addrs)
        const url = buildRouteUrl(allAddresses)
        if (!url || allAddresses.length === 0) return null
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#E8634A] text-white text-sm font-bold shadow-sm active:bg-[#d4552d] transition-all"
          >
            🗺️ Start Full Route ({allAddresses.length} stops)
          </a>
        )
      })()}

      {/* Per-group routes */}
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
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: GROUP_COLORS[group] || GROUP_COLORS.unassigned }}
              />
              {GROUP_LABELS[group] || `Group ${group}`} Route ({addrs.length} stops)
            </a>
          )
        })}
    </div>
  )
}
