import { memo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const ALERT_KEYWORDS = /reactive|aggressive|bite|careful|alarm|conflict|warning|danger|vet|medication|allergy/i

const DogChip = memo(function DogChip({
  event, onInfoClick, isSelected, onTap, isDragging,
  hasOwlNote, hasConflict, hasAltAddress,
  routeNum, showHandle, handleListeners, handleAttributes, handleRef,
}) {
  const { isAdmin } = useAuth()
  const isMissing = !event.dog
  const hasAlert = event.dog && (
    (event.dog.must_know && ALERT_KEYWORDS.test(event.dog.must_know)) ||
    (event.dog.notes && ALERT_KEYWORDS.test(event.dog.notes))
  )

  return (
    <div
      className={`
        flex items-center gap-1.5 rounded-xl text-sm font-medium
        select-none transition-all min-h-[48px]
        ${isDragging
          ? 'scale-[1.03] border-2 border-[#E8634A] bg-white opacity-95 shadow-lg ring-2 ring-[#E8634A]/20'
          : hasConflict
            ? 'border-2 border-red-500 bg-red-50 text-gray-700 shadow-sm ring-1 ring-red-300 chip-3d-red'
            : isSelected
              ? 'border-2 border-[#E8634A] bg-[#FFF4F1] shadow-lg ring-2 ring-[#E8634A]/20 chip-selected'
              : isMissing
                ? 'bg-amber-50 text-amber-700 border border-amber-200 chip-3d-amber'
                : 'bg-white text-gray-700 border border-gray-200 shadow-sm chip-3d'
        }
      `}
    >
      {/* Drag handle — only in numbered groups */}
      {showHandle ? (
        <div
          ref={handleRef}
          {...(handleListeners || {})}
          {...(handleAttributes || {})}
          className="flex flex-col items-center justify-center gap-[2px] w-8 h-full min-h-[48px] flex-shrink-0 cursor-grab active:cursor-grabbing touch-none rounded-l-xl"
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
        <span className="text-[11px] text-gray-400 font-semibold w-4 text-center flex-shrink-0">
          {routeNum}
        </span>
      )}

      {/* Dog photo/emoji */}
      {event.dog?.photo_url ? (
        <img src={event.dog.photo_url} alt={event.displayName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
      ) : (
        <span className="text-base flex-shrink-0">{isMissing && isAdmin ? '⚠️' : '🐕'}</span>
      )}

      {/* Level dot */}
      {event.dog && (
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            event.dog.level === 3 ? 'bg-red-500' : event.dog.level === 2 ? 'bg-yellow-400' : 'bg-green-500'
          }`}
          title={event.dog.level === 3 ? 'Extra Care' : event.dog.level === 2 ? 'Caution' : 'Chill'}
        />
      )}

      {/* Dog name — tappable area */}
      <span
        className="truncate flex-1 py-3"
        onClick={() => onTap?.(event)}
      >
        {event.displayName}
      </span>

      {isMissing && !isAdmin && (
        <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">New</span>
      )}

      {hasAltAddress && <span className="text-xs flex-shrink-0 text-amber-500" title="Alt address today">📍</span>}
      {hasOwlNote && <span className="text-sm flex-shrink-0 owl-bounce" title="Owl note">🦉</span>}
      {hasAlert && <span className="text-[10px] text-gray-400 font-medium">!</span>}

      {/* Info button — 28px circle */}
      <button
        onClick={(e) => { e.stopPropagation(); onInfoClick?.(event) }}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 border border-gray-200/60 text-gray-500 text-xs font-semibold flex-shrink-0 active:scale-[0.92] active:bg-gray-200 transition-transform mr-2"
      >
        i
      </button>
    </div>
  )
})

export default DogChip
