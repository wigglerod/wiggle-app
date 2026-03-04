import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export default function DogChip({ event, onClick, isDragging: externalDrag }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(event._id) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || externalDrag ? 0.5 : 1,
    touchAction: 'none',
  }

  const isMissing = !event.dog
  const hasAlert = event.dog?.must_know

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
        cursor-grab active:cursor-grabbing select-none transition-shadow
        ${isMissing
          ? 'bg-amber-50 text-amber-700 border border-amber-200'
          : hasAlert
          ? 'bg-red-50 text-red-700 border border-red-200'
          : 'bg-white text-gray-700 border border-gray-200 shadow-sm'
        }
        ${isDragging ? 'shadow-lg ring-2 ring-[#E8634A]/30 z-50' : ''}
      `}
    >
      {/* Drag handle dots */}
      <span className="text-gray-300 text-xs mr-0.5">⠿</span>

      {/* Dog photo or emoji */}
      {event.dog?.photo_url ? (
        <img
          src={event.dog.photo_url}
          alt={event.displayName}
          className="w-6 h-6 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <span className="text-base flex-shrink-0">{isMissing ? '⚠️' : '🐕'}</span>
      )}

      <span className="truncate max-w-[120px]">{event.displayName}</span>

      {hasAlert && <span className="text-xs">!</span>}

      {/* Tap for info */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick?.(event)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="ml-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xs flex-shrink-0 active:bg-gray-200"
      >
        i
      </button>
    </div>
  )
}
