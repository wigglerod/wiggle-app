import { useRef } from 'react'
import { useAuth } from '../context/AuthContext'

export default function DogChip({ event, onInfoClick, isSelected, onTap, onLongPress, showDragHandle, isDragging }) {
  const { isAdmin } = useAuth()
  const isMissing = !event.dog
  const hasAlert = event.dog?.notes
  const timerRef = useRef(null)
  const didLongPress = useRef(false)

  function handlePointerDown(e) {
    if (!onLongPress) return
    didLongPress.current = false
    const rect = e.currentTarget.getBoundingClientRect()
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress(event, { x: Math.min(rect.left + rect.width / 2, window.innerWidth - 120), y: rect.bottom + 4 })
    }, 500)
  }

  function handlePointerUp() {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  function handlePointerMove() {
    // Cancel long-press if finger moves (prevents accidental triggers during scroll)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  function handleClick() {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    onTap?.(event)
  }

  return (
    <div
      onClick={handleClick}
      onPointerDown={onLongPress ? handlePointerDown : undefined}
      onPointerUp={onLongPress ? handlePointerUp : undefined}
      onPointerCancel={onLongPress ? handlePointerUp : undefined}
      onPointerMove={onLongPress ? handlePointerMove : undefined}
      className={`
        flex items-center gap-2 px-3 rounded-xl text-sm font-medium
        select-none transition-all min-h-[48px]
        ${showDragHandle ? 'cursor-grab active:cursor-grabbing py-2' : 'cursor-pointer active:scale-[0.98] py-3'}
        ${isDragging ? 'opacity-50' : ''}
        ${isSelected
          ? 'border-2 border-[#E8634A] shadow-lg ring-2 ring-[#E8634A]/20 bg-white wiggle'
          : isMissing
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : hasAlert
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-white text-gray-700 border border-gray-200 shadow-sm'
        }
      `}
    >
      {showDragHandle && <span className="text-gray-300 text-xs mr-0.5">⠿</span>}

      {event.dog?.photo_url ? (
        <img src={event.dog.photo_url} alt={event.displayName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
      ) : (
        <span className="text-base flex-shrink-0">{isMissing && isAdmin ? '⚠️' : '🐕'}</span>
      )}

      <span className="truncate flex-1">{event.displayName}</span>

      {/* "New" badge for unmatched dogs — only non-admin sees this */}
      {isMissing && !isAdmin && (
        <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">New</span>
      )}

      {hasAlert && <span className="text-xs text-red-500 font-bold">!</span>}

      {/* Info button */}
      <button
        onClick={(e) => { e.stopPropagation(); onInfoClick?.(event) }}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xs flex-shrink-0 active:bg-gray-200"
      >
        i
      </button>
    </div>
  )
}
