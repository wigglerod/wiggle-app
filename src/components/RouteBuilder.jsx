import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatTime } from '../lib/parseICS'

function SortableRouteItem({ event, index }) {
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
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
  }

  const address = event.dog?.address || event.location || ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 bg-white rounded-xl border p-3 ${
        isDragging ? 'border-[#E8634A] shadow-lg ring-2 ring-[#E8634A]/20 z-50' : 'border-gray-200'
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center w-8 h-8 text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <span className="text-lg">⠿</span>
      </div>

      {/* Number */}
      <div className="w-7 h-7 rounded-full bg-[#E8634A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{event.displayName}</p>
        {address && (
          <p className="text-xs text-gray-400 truncate">{address}</p>
        )}
      </div>

      {/* Sector badge */}
      {event.sector && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
          event.sector === 'Plateau'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-[#FDEBE7] text-[#E8634A]'
        }`}>
          {event.sector}
        </span>
      )}
    </div>
  )
}

function timeSlotKey(group) {
  return `${group.startTime.toISOString()}_${group.endTime.toISOString()}`
}

export default function RouteBuilder({ group, onClose }) {
  const { user } = useAuth()
  const [orderedEvents, setOrderedEvents] = useState(group.events)
  const [activeId, setActiveId] = useState(null)

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  const walkDate = group.startTime.toISOString().split('T')[0]
  const slotKey = timeSlotKey(group)

  // Load saved order on mount
  useEffect(() => {
    if (!user) return
    async function loadOrder() {
      const { data } = await supabase
        .from('route_orders')
        .select('event_order')
        .eq('walk_date', walkDate)
        .eq('time_slot', slotKey)
        .eq('user_id', user.id)
        .single()

      if (data?.event_order?.length > 0) {
        const orderMap = new Map()
        data.event_order.forEach((id, idx) => orderMap.set(id, idx))

        const sorted = [...group.events].sort((a, b) => {
          const aIdx = orderMap.get(String(a._id)) ?? 999
          const bIdx = orderMap.get(String(b._id)) ?? 999
          return aIdx - bIdx
        })
        setOrderedEvents(sorted)
      }
    }
    loadOrder()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveOrder(events) {
    if (!user) return
    const eventOrder = events.map((ev) => String(ev._id))
    const { error } = await supabase.from('route_orders').upsert(
      {
        walk_date: walkDate,
        time_slot: slotKey,
        user_id: user.id,
        event_order: eventOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'walk_date,time_slot,user_id' }
    )
    if (error) toast.error('Failed to save route order')
  }

  function handleDragStart(event) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    setOrderedEvents((prev) => {
      const oldIndex = prev.findIndex((ev) => String(ev._id) === String(active.id))
      const newIndex = prev.findIndex((ev) => String(ev._id) === String(over.id))
      const next = arrayMove(prev, oldIndex, newIndex)
      saveOrder(next)
      return next
    })
  }

  function resetOrder() {
    setOrderedEvents(group.events)
    saveOrder(group.events)
  }

  function openGoogleMaps() {
    const addresses = orderedEvents
      .map((ev) => ev.dog?.address || ev.location)
      .filter(Boolean)
      .map((addr) => {
        const normalized = addr.trim()
        if (!/montr[eé]al/i.test(normalized)) {
          return `${normalized}, Montréal, QC`
        }
        return normalized
      })

    if (addresses.length === 0) {
      toast.error('No addresses available for route')
      return
    }

    const url = `https://www.google.com/maps/dir/${addresses.map((a) => encodeURIComponent(a)).join('/')}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const activeEvent = activeId
    ? orderedEvents.find((ev) => String(ev._id) === activeId)
    : null
  const addressCount = orderedEvents.filter((ev) => ev.dog?.address || ev.location).length

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-up panel */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFF4F1] rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200 z-10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="px-5 pb-8 pt-2 overflow-y-auto flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Route Builder</h2>
            <p className="text-sm text-gray-400">
              {formatTime(group.startTime)} – {formatTime(group.endTime)}
            </p>
          </div>
          <p className="text-xs text-gray-400 mb-4">Drag to set your pickup order</p>

          {/* Sortable list */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedEvents.map((ev) => String(ev._id))}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2 mb-4">
                {orderedEvents.map((ev, i) => (
                  <SortableRouteItem key={ev._id} event={ev} index={i} />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeEvent ? (
                <div className="flex items-center gap-3 bg-white rounded-xl border border-[#E8634A] p-3 shadow-xl ring-2 ring-[#E8634A]/20">
                  <div className="w-8 h-8 flex items-center justify-center text-gray-300 flex-shrink-0">
                    <span className="text-lg">⠿</span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#E8634A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    •
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{activeEvent.displayName}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Reset order */}
          <div className="flex justify-center mb-4">
            <button
              onClick={resetOrder}
              className="text-sm text-gray-400 underline active:text-gray-600"
            >
              Reset order
            </button>
          </div>

          {/* Go button */}
          <button
            onClick={openGoogleMaps}
            disabled={addressCount === 0}
            className="w-full py-3.5 rounded-full bg-[#E8634A] text-white font-bold text-base shadow-sm active:bg-[#d4552d] disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[52px] flex items-center justify-center gap-2"
          >
            🗺️ Go! ({addressCount} {addressCount === 1 ? 'stop' : 'stops'})
          </button>
        </div>
      </motion.div>
    </>
  )
}
