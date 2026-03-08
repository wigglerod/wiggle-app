import { useState, useMemo } from 'react'
import LoadingDog from './LoadingDog'
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
import { useAuth } from '../context/AuthContext'

// Color cycle for numbered groups — repeats if > 6 groups
const GROUP_COLORS = [
  { color: 'bg-blue-50',   accent: 'border-blue-400'   },
  { color: 'bg-green-50',  accent: 'border-green-400'  },
  { color: 'bg-purple-50', accent: 'border-purple-400' },
  { color: 'bg-amber-50',  accent: 'border-amber-400'  },
  { color: 'bg-rose-50',   accent: 'border-rose-400'   },
  { color: 'bg-teal-50',   accent: 'border-teal-400'   },
]

function groupColor(groupNum) {
  return GROUP_COLORS[(groupNum - 1) % GROUP_COLORS.length]
}

function DroppableGroup({ groupKey, eventIds, eventsMap, onDogClick, activeId, groupName, onRename }) {
  const { setNodeRef, isOver } = useDroppable({ id: String(groupKey) })
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const isUnassigned = groupKey === 'unassigned'
  const { color, accent } = isUnassigned
    ? { color: 'bg-gray-100', accent: 'border-gray-300' }
    : groupColor(Number(groupKey))

  const displayName = isUnassigned
    ? 'Unassigned'
    : (groupName || `Group ${groupKey}`)

  // Sort items by appointment start time — earliest first
  const sortedItems = useMemo(() => {
    return [...eventIds]
      .sort((a, b) => {
        const evA = eventsMap.get(String(a))
        const evB = eventsMap.get(String(b))
        if (!evA || !evB) return 0
        return new Date(evA.start) - new Date(evB.start)
      })
      .map(String)
  }, [eventIds, eventsMap])

  function startEdit() {
    setNameInput(groupName || `Group ${groupKey}`)
    setEditing(true)
  }

  function commitEdit() {
    setEditing(false)
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== (groupName || `Group ${groupKey}`)) {
      onRename(trimmed)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 border-dashed p-3 transition-all min-h-[80px]
        ${accent} ${color}
        ${isOver ? 'ring-2 ring-[#E8634A]/40 border-[#E8634A] scale-[1.01]' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        {/* Group name — tap to rename (numbered groups only) */}
        {!isUnassigned && editing ? (
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="text-sm font-bold text-gray-700 bg-transparent border-b border-[#E8634A] outline-none flex-1 mr-2 min-w-0"
          />
        ) : (
          <button
            onClick={isUnassigned ? undefined : startEdit}
            className={`text-sm font-bold text-gray-700 text-left flex items-center gap-1 ${!isUnassigned ? 'active:opacity-60' : 'cursor-default'}`}
          >
            {displayName}
            {!isUnassigned && (
              <svg className="w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Z"/>
              </svg>
            )}
          </button>
        )}

        <span className="text-xs text-gray-400 bg-white/70 px-2 py-0.5 rounded-full flex-shrink-0">
          {sortedItems.length} {sortedItems.length === 1 ? 'dog' : 'dogs'}
        </span>
      </div>

      <SortableContext items={sortedItems} strategy={verticalListSortingStrategy}>
        <div className="flex flex-wrap gap-2">
          {sortedItems.length === 0 && (
            <p className="text-xs text-gray-400 italic py-2 w-full text-center">
              Drag dogs here
            </p>
          )}
          {sortedItems.map((id) => {
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
  const { canEdit } = useAuth()
  const { groups, groupNums, groupNames, moveEvent, addGroup, renameGroup, loaded } =
    useWalkGroups(events, date, sector)
  const [activeId, setActiveId] = useState(null)

  const eventsMap = useMemo(() => {
    const m = new Map()
    for (const ev of events) {
      m.set(String(ev._id), ev)
    }
    return m
  }, [events])

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(...(canEdit ? [pointerSensor, touchSensor] : []))

  // Set of all valid droppable group keys (as strings)
  const groupKeySet = useMemo(
    () => new Set(['unassigned', ...groupNums.map(String)]),
    [groupNums]
  )

  function findGroup(id) {
    const strId = String(id)
    if ((groups.unassigned || []).includes(strId)) return 'unassigned'
    for (const n of groupNums) {
      if ((groups[n] || []).includes(strId)) return n
    }
    return null
  }

  function resolveTargetGroup(overId) {
    const overStr = String(overId)
    if (groupKeySet.has(overStr)) {
      return overStr === 'unassigned' ? 'unassigned' : Number(overStr)
    }
    return findGroup(overId)
  }

  function handleDragStart(event) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const fromGroup = findGroup(String(active.id))
    const toGroup = resolveTargetGroup(over.id)

    if (fromGroup !== null && toGroup !== null && fromGroup !== toGroup) {
      moveEvent(String(active.id), fromGroup, toGroup)
    }
  }

  function handleDragOver(event) {
    const { active, over } = event
    if (!over) return

    const fromGroup = findGroup(String(active.id))
    const toGroup = resolveTargetGroup(over.id)

    if (fromGroup !== null && toGroup !== null && fromGroup !== toGroup) {
      moveEvent(String(active.id), fromGroup, toGroup)
    }
  }

  if (!loaded) {
    return (
      <div className="flex justify-center py-8">
        <LoadingDog />
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
          onDogClick={(ev) => onDogClick({ ...ev, _groupKey: 'unassigned', _groupName: 'Unassigned' })}
          activeId={activeId}
          groupName={null}
          onRename={null}
        />

        {/* Numbered groups */}
        {groupNums.map((num) => (
          <DroppableGroup
            key={num}
            groupKey={String(num)}
            eventIds={groups[num] || []}
            eventsMap={eventsMap}
            onDogClick={(ev) => onDogClick({ ...ev, _groupKey: num, _groupName: groupNames[num] || `Group ${num}` })}
            activeId={activeId}
            groupName={groupNames[num] || null}
            onRename={(name) => renameGroup(num, name)}
          />
        ))}

        {/* Add group button — only for users who can edit */}
        {canEdit && (
          <button
            onClick={addGroup}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#E8634A]/40 py-3 text-sm font-semibold text-[#E8634A] active:bg-[#E8634A]/5 transition-colors"
          >
            <span className="w-6 h-6 rounded-full bg-[#E8634A] text-white flex items-center justify-center text-base leading-none">+</span>
            Add Group
          </button>
        )}
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
