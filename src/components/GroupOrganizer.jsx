import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import DogChip from './DogChip'
import { useWalkGroups } from '../lib/useWalkGroups'

const GROUP_LABELS = {
  unassigned: { label: 'Unassigned', color: 'bg-gray-100', accent: 'border-gray-300' },
  1: { label: 'Group 1', color: 'bg-blue-50', accent: 'border-blue-400' },
  2: { label: 'Group 2', color: 'bg-green-50', accent: 'border-green-400' },
  3: { label: 'Group 3', color: 'bg-purple-50', accent: 'border-purple-400' },
}

function DroppableGroup({ groupKey, eventIds, eventsMap, onDogClick, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupKey })
  const config = GROUP_LABELS[groupKey]
  const items = eventIds.map(String)

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 border-dashed p-3 transition-all min-h-[80px]
        ${config.accent} ${config.color}
        ${isOver ? 'ring-2 ring-[#E8634A]/40 border-[#E8634A] scale-[1.01]' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-700">{config.label}</h3>
        <span className="text-xs text-gray-400 bg-white/70 px-2 py-0.5 rounded-full">
          {items.length} {items.length === 1 ? 'dog' : 'dogs'}
        </span>
      </div>

      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="flex flex-wrap gap-2">
          {items.length === 0 && (
            <p className="text-xs text-gray-400 italic py-2 w-full text-center">
              Drag dogs here
            </p>
          )}
          {items.map((id) => {
            const ev = eventsMap.get(id)
            if (!ev) return null
            return (
              <DogChip
                key={id}
                event={ev}
                onClick={onDogClick}
                isDragging={activeId === id}
              />
            )
          })}
        </div>
      </SortableContext>
    </div>
  )
}

export default function GroupOrganizer({ events, date, sector, onDogClick }) {
  const { groups, moveEvent, loaded } = useWalkGroups(events, date, sector)
  const [activeId, setActiveId] = useState(null)

  // Build a map of eventId -> event for quick lookup
  const eventsMap = useMemo(() => {
    const m = new Map()
    for (const ev of events) {
      m.set(String(ev._id), ev)
    }
    return m
  }, [events])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  function findGroup(id) {
    const strId = String(id)
    for (const key of ['unassigned', 1, 2, 3]) {
      if ((groups[key] || []).includes(strId)) return key
    }
    return null
  }

  function handleDragStart(event) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeIdStr = String(active.id)
    const fromGroup = findGroup(activeIdStr)

    // Determine target group: if dropped on a group container, use that;
    // if dropped on another chip, find what group that chip is in
    let toGroup = null

    // Check if over.id is a group key
    if (['unassigned', '1', '2', '3'].includes(String(over.id))) {
      toGroup = over.id === 'unassigned' ? 'unassigned' : Number(over.id)
    } else {
      // Dropped on another chip — find its group
      toGroup = findGroup(over.id)
    }

    if (fromGroup !== null && toGroup !== null && fromGroup !== toGroup) {
      moveEvent(activeIdStr, fromGroup, toGroup)
    }
  }

  function handleDragOver(event) {
    const { active, over } = event
    if (!over) return

    const activeIdStr = String(active.id)
    const fromGroup = findGroup(activeIdStr)

    let toGroup = null
    if (['unassigned', '1', '2', '3'].includes(String(over.id))) {
      toGroup = over.id === 'unassigned' ? 'unassigned' : Number(over.id)
    } else {
      toGroup = findGroup(over.id)
    }

    if (fromGroup !== null && toGroup !== null && fromGroup !== toGroup) {
      moveEvent(activeIdStr, fromGroup, toGroup)
    }
  }

  if (!loaded) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-[#E8634A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const activeEvent = activeId ? eventsMap.get(activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-3">
        {/* Unassigned pool */}
        <DroppableGroup
          groupKey="unassigned"
          eventIds={groups.unassigned || []}
          eventsMap={eventsMap}
          onDogClick={onDogClick}
          activeId={activeId}
        />

        {/* Groups 1-3 */}
        {[1, 2, 3].map((num) => (
          <DroppableGroup
            key={num}
            groupKey={String(num)}
            eventIds={groups[num] || []}
            eventsMap={eventsMap}
            onDogClick={onDogClick}
            activeId={activeId}
          />
        ))}
      </div>

      {/* Drag overlay — floating chip following cursor */}
      <DragOverlay>
        {activeEvent ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white text-gray-700 border border-[#E8634A] shadow-xl ring-2 ring-[#E8634A]/20">
            <span className="text-base">🐕</span>
            {activeEvent.displayName}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
