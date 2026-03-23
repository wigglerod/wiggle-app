import { memo, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const ALERT_KEYWORDS = /reactive|aggressive|bite|careful|alarm|conflict|warning|danger|vet|medication|allergy/i

function DogPhoto({ dog, displayName, size = 24 }) {
  if (dog?.photo_url) {
    return (
      <img
        src={dog.photo_url}
        alt={displayName}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  const letter = (displayName || dog?.dog_name || '?')[0].toUpperCase()
  const colors = ['#E8634A', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899']
  const bg = colors[letter.charCodeAt(0) % colors.length]
  return (
    <span
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.45 }}
    >
      {letter}
    </span>
  )
}

const DogChip = memo(function DogChip({
  event, onInfoClick, isSelected, onTap, isDragging,
  hasOwlNote, owlNote, hasConflict, hasAltAddress,
  routeNum, showHandle, handleListeners, handleAttributes, handleRef,
}) {
  const { isAdmin } = useAuth()
  const [owlExpanded, setOwlExpanded] = useState(false)
  const isMissing = !event.dog
  const hasAlert = event.dog && (
    (event.dog.must_know && ALERT_KEYWORDS.test(event.dog.must_know)) ||
    (event.dog.notes && ALERT_KEYWORDS.test(event.dog.notes))
  )

  const dog = event.dog
  const address = dog?.address || null
  const doorCode = dog?.door_code || event.calendarDoorCode || null

  // Truncate address to street portion
  const shortAddress = address
    ? address.split(',')[0].trim()
    : null

  return (
    <div>
      <div
        className={`
          flex items-center gap-1.5 rounded-[10px] text-[13px] font-medium
          select-none transition-all min-h-[48px]
          ${isDragging
            ? 'scale-[1.03] border-2 border-[#E8634A] bg-white opacity-95 shadow-lg ring-2 ring-[#E8634A]/20'
            : hasConflict
              ? 'border-2 border-red-500 bg-red-50 text-gray-700 shadow-sm ring-1 ring-red-300 chip-3d-red'
              : isSelected
                ? 'border-2 border-[#E8634A] bg-[#FFF4F1] shadow-lg ring-2 ring-[#E8634A]/20 chip-selected'
                : isMissing
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 chip-3d-amber'
                  : 'bg-white text-gray-700 border border-gray-200/80 shadow-sm chip-3d'
          }
        `}
      >
        {/* Drag handle -- only in numbered groups */}
        {showHandle ? (
          <div
            ref={handleRef}
            {...(handleListeners || {})}
            {...(handleAttributes || {})}
            className="flex flex-col items-center justify-center gap-[2px] w-8 h-full min-h-[48px] flex-shrink-0 cursor-grab active:cursor-grabbing touch-none rounded-l-[10px]"
            style={{ touchAction: 'none' }}
          >
            <span className="block w-3 h-[2px] bg-gray-300 rounded-full" />
            <span className="block w-3 h-[2px] bg-gray-300 rounded-full" />
            <span className="block w-3 h-[2px] bg-gray-300 rounded-full" />
          </div>
        ) : (
          <div className="w-2 flex-shrink-0" />
        )}

        {/* Route number */}
        {routeNum != null && (
          <span className="text-[10px] text-gray-400 font-semibold w-4 text-center flex-shrink-0">
            {routeNum}
          </span>
        )}

        {/* Dog photo or letter initial */}
        {isMissing && isAdmin ? (
          <span className="text-base flex-shrink-0">&#9888;&#65039;</span>
        ) : (
          <DogPhoto dog={dog} displayName={event.displayName} size={24} />
        )}

        {/* Level dot */}
        {dog && (
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              dog.level === 3 ? 'bg-red-500' : dog.level === 2 ? 'bg-yellow-400' : 'bg-green-500'
            }`}
            title={dog.level === 3 ? 'Extra Care' : dog.level === 2 ? 'Caution' : 'Chill'}
          />
        )}

        {/* Name + address column */}
        <div className="flex flex-col flex-1 min-w-0 py-2" onClick={() => onTap?.(event)}>
          <span className="truncate text-[12px] font-medium leading-tight">
            {event.displayName}
          </span>
          {shortAddress && (
            <span
              className="text-[10px] text-[#185FA5] truncate leading-tight mt-0.5 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onInfoClick?.(event) }}
            >
              {shortAddress} &#8250;
            </span>
          )}
        </div>

        {isMissing && !isAdmin && (
          <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-[6px] font-medium">New</span>
        )}

        {hasAltAddress && <span className="text-[10px] flex-shrink-0 text-amber-500" title="Alt address today">&#128205;</span>}
        {hasAlert && <span className="text-[10px] text-gray-400 font-medium flex-shrink-0">!</span>}

        {/* Door code badge */}
        {doorCode && (
          <span className="text-[10px] font-semibold text-[#185FA5] bg-[#E6F1FB] px-1.5 py-0.5 rounded-[6px] flex-shrink-0">
            #{doorCode}
          </span>
        )}

        {/* Owl indicator -- small circle, tap to expand */}
        {hasOwlNote && (
          <button
            onClick={(e) => { e.stopPropagation(); setOwlExpanded(prev => !prev) }}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 mr-1"
            style={{ backgroundColor: '#FAEEDA' }}
          >
            <span className="text-[11px] leading-none">&#129417;</span>
          </button>
        )}

        {/* Spacer when no owl and no address (keeps consistent right padding) */}
        {!hasOwlNote && !doorCode && <div className="w-1 flex-shrink-0" />}
      </div>

      {/* Expanded owl note */}
      {hasOwlNote && owlExpanded && owlNote && (
        <div className="mx-2 mt-1 mb-1 px-3 py-2 rounded-lg text-[11px] leading-snug"
          style={{ backgroundColor: '#FAEEDA' }}
        >
          <span className="mr-1">&#129417;</span>
          <span className="text-gray-700">{owlNote.note_text}</span>
          <span className="text-gray-400 ml-1">
            from {owlNote.created_by_name || 'Team'}
            {owlNote.created_at && ` \u00b7 ${new Date(owlNote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          </span>
        </div>
      )}
    </div>
  )
})

export { DogPhoto }
export default DogChip
