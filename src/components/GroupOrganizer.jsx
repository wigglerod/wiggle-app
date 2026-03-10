import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import LoadingDog from './LoadingDog'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import DogChip from './DogChip'
import { useWalkGroups } from '../lib/useWalkGroups'
import { useAuth } from '../context/AuthContext'

// Color cycle for numbered groups
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

// ── Sortable wrapper for desktop DnD ────────────────────────────────
function SortableItem({ id, children, canEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !canEdit })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'none',
      }}
      {...attributes}
      {...(canEdit ? listeners : {})}
    >
      {typeof children === 'function' ? children({ isDragging }) : children}
    </div>
  )
}

// ── Shared group header ─────────────────────────────────────────────
function GroupHeader({ groupKey, groupName, count, onRename, isTarget, onTargetTap, selectedDogName }) {
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const isUnassigned = groupKey === 'unassigned'
  const { color, accent } = isUnassigned
    ? { color: 'bg-gray-100', accent: 'border-gray-300' }
    : groupColor(Number(groupKey))

  const displayName = isUnassigned ? 'Unassigned' : (groupName || `Group ${groupKey}`)

  function startEdit() {
    setNameInput(groupName || `Group ${groupKey}`)
    setEditing(true)
  }
  function commitEdit() {
    setEditing(false)
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== (groupName || `Group ${groupKey}`)) {
      onRename?.(trimmed)
    }
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
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
            className={`text-sm font-bold text-gray-700 text-left flex items-center gap-1 truncate ${!isUnassigned ? 'active:opacity-60' : 'cursor-default'}`}
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
          {count} {count === 1 ? 'dog' : 'dogs'}
        </span>
      </div>

      {/* Tap target when dog is selected */}
      {isTarget && (
        <button
          onClick={onTargetTap}
          className="ml-2 px-3 py-1.5 rounded-full bg-[#E8634A] text-white text-xs font-bold active:bg-[#d4552d] transition-all min-h-[36px] animate-pulse"
        >
          + Add here
        </button>
      )}
    </div>
  )
}

// ── Mobile group with tap-to-assign ─────────────────────────────────
function MobileGroup({ groupKey, eventIds, eventsMap, onDogClick, selectedId, onDogTap, onLongPress, groupName, onRename, isTarget, onTargetTap, canEdit, isAdmin }) {
  const isUnassigned = groupKey === 'unassigned'
  const { color, accent } = isUnassigned
    ? { color: 'bg-gray-100', accent: 'border-gray-300' }
    : groupColor(Number(groupKey))

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

  const selectedDogName = selectedId ? eventsMap.get(selectedId)?.displayName : null

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-3 transition-all min-h-[80px]
        ${accent} ${color}
        ${isTarget ? 'ring-2 ring-[#E8634A]/40 border-[#E8634A] scale-[1.01]' : ''}
      `}
    >
      <GroupHeader
        groupKey={groupKey}
        groupName={groupName}
        count={sortedItems.length}
        onRename={onRename}
        isTarget={isTarget}
        onTargetTap={onTargetTap}
        selectedDogName={selectedDogName}
      />

      <div className="flex flex-col gap-2">
        {sortedItems.length === 0 && !isTarget && (
          <p className="text-xs text-gray-400 italic py-2 w-full text-center">
            {canEdit ? 'Tap a dog, then tap a group to assign' : 'No dogs assigned'}
          </p>
        )}
        {isTarget && sortedItems.length === 0 && (
          <button
            onClick={onTargetTap}
            className="w-full py-4 rounded-xl border-2 border-dashed border-[#E8634A]/30 text-sm text-[#E8634A] font-medium active:bg-[#E8634A]/5 transition-all min-h-[48px]"
          >
            Tap to add {selectedDogName || 'dog'} here
          </button>
        )}
        <AnimatePresence mode="popLayout">
          {sortedItems.map((id) => {
            const ev = eventsMap.get(id)
            if (!ev) return null
            return (
              <motion.div
                key={id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <DogChip
                  event={ev}
                  onInfoClick={onDogClick}
                  onTap={canEdit ? onDogTap : onDogClick}
                  onLongPress={canEdit ? onLongPress : undefined}
                  isSelected={selectedId === id}
                  isAdmin={isAdmin}
                />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Desktop droppable group (DnD) ───────────────────────────────────
function DesktopGroup({ groupKey, eventIds, eventsMap, onDogClick, activeId, groupName, onRename, canEdit, isAdmin }) {
  const { setNodeRef, isOver } = useDroppable({ id: String(groupKey) })
  const isUnassigned = groupKey === 'unassigned'
  const { color, accent } = isUnassigned
    ? { color: 'bg-gray-100', accent: 'border-gray-300' }
    : groupColor(Number(groupKey))

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

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 border-dashed p-3 transition-all min-h-[80px]
        ${accent} ${color}
        ${isOver ? 'ring-2 ring-[#E8634A]/40 border-[#E8634A] scale-[1.01]' : ''}
      `}
    >
      <GroupHeader
        groupKey={groupKey}
        groupName={groupName}
        count={sortedItems.length}
        onRename={onRename}
      />

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
              <SortableItem key={id} id={id} canEdit={canEdit}>
                {({ isDragging }) => (
                  <DogChip
                    event={ev}
                    onInfoClick={onDogClick}
                    onTap={onDogClick}
                    showDragHandle={canEdit}
                    isDragging={isDragging || activeId === id}
                    isAdmin={isAdmin}
                  />
                )}
              </SortableItem>
            )
          })}
        </div>
      </SortableContext>
    </div>
  )
}

// ── Long-press popup menu ───────────────────────────────────────────
function LongPressMenu({ position, groupNums, groupNames, currentGroup, onMove, onClose }) {
  // Adjust position to stay on screen
  const menuStyle = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - 280),
    left: Math.max(8, Math.min(position.x - 96, window.innerWidth - 200)),
    zIndex: 60,
  }

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        style={menuStyle}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 w-48 overflow-hidden"
      >
        <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Move to...</p>
        {groupNums.map((num) => (
          <button
            key={num}
            onClick={() => onMove(num)}
            disabled={currentGroup === num}
            className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors min-h-[48px] flex items-center gap-2
              ${currentGroup === num ? 'text-gray-300 cursor-default' : 'text-gray-700 active:bg-[#FFF4F1]'}
            `}
          >
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${groupColor(num).accent.replace('border-', 'bg-')}`} />
            {groupNames[num] || `Group ${num}`}
            {currentGroup === num && <span className="text-xs text-gray-300 ml-auto">current</span>}
          </button>
        ))}
        <div className="border-t border-gray-100 mt-1 pt-1">
          <button
            onClick={() => onMove('unassigned')}
            disabled={currentGroup === 'unassigned'}
            className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors min-h-[48px] flex items-center gap-2
              ${currentGroup === 'unassigned' ? 'text-gray-300 cursor-default' : 'text-gray-700 active:bg-[#FFF4F1]'}
            `}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" />
            Unassigned
            {currentGroup === 'unassigned' && <span className="text-xs text-gray-300 ml-auto">current</span>}
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ── Main export ─────────────────────────────────────────────────────
export default function GroupOrganizer({ events, date, sector, onDogClick }) {
  const { canEdit, isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const { groups, groupNums, groupNames, moveEvent, addGroup, renameGroup, loaded } =
    useWalkGroups(events, date, sector)

  const eventsMap = useMemo(() => {
    const m = new Map()
    for (const ev of events) m.set(String(ev._id), ev)
    return m
  }, [events])

  // ── Mobile tap-to-assign state ──────────────────────────────────
  const [selectedId, setSelectedId] = useState(null)
  const [longPressMenu, setLongPressMenu] = useState(null)

  function findGroup(id) {
    const strId = String(id)
    if ((groups.unassigned || []).includes(strId)) return 'unassigned'
    for (const n of groupNums) {
      if ((groups[n] || []).includes(strId)) return n
    }
    return null
  }

  function handleDogTap(event) {
    const id = String(event._id)
    setSelectedId((prev) => (prev === id ? null : id))
    setLongPressMenu(null)
  }

  function handleGroupTap(targetGroup) {
    if (!selectedId) return
    const fromGroup = findGroup(selectedId)
    if (fromGroup === null || fromGroup === targetGroup) {
      setSelectedId(null)
      return
    }
    moveEvent(selectedId, fromGroup, targetGroup)
    setSelectedId(null)
    toast.success('Dog moved!')
  }

  function handleLongPress(event, pos) {
    setSelectedId(null)
    setLongPressMenu({
      dogId: String(event._id),
      fromGroup: findGroup(String(event._id)),
      x: pos.x,
      y: pos.y,
    })
  }

  function handleLongPressMove(targetGroup) {
    if (!longPressMenu) return
    const { dogId, fromGroup } = longPressMenu
    if (fromGroup !== targetGroup) {
      moveEvent(dogId, fromGroup, targetGroup)
      toast.success('Dog moved!')
    }
    setLongPressMenu(null)
  }

  // ── Desktop DnD state ───────────────────────────────────────────
  const [activeId, setActiveId] = useState(null)
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const sensors = useSensors(...(canEdit && !isMobile ? [pointerSensor] : []))

  const groupKeySet = useMemo(
    () => new Set(['unassigned', ...groupNums.map(String)]),
    [groupNums]
  )

  function resolveTargetGroup(overId) {
    const overStr = String(overId)
    if (groupKeySet.has(overStr)) return overStr === 'unassigned' ? 'unassigned' : Number(overStr)
    return findGroup(overId)
  }

  function handleDragStart(event) { setActiveId(String(event.active.id)) }

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

  // Check if we have a selected dog (for tap mode targets)
  const selectedGroup = selectedId ? findGroup(selectedId) : null

  // Helper to enrich dog click events with group info
  function enrichDogClick(ev, groupKey) {
    const gName = groupKey === 'unassigned' ? 'Unassigned' : (groupNames[groupKey] || `Group ${groupKey}`)
    onDogClick({ ...ev, _groupKey: groupKey, _groupName: gName })
  }

  // ── Render ────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col gap-3">
        {/* Unassigned pool */}
        <MobileGroup
          groupKey="unassigned"
          eventIds={groups.unassigned || []}
          eventsMap={eventsMap}
          onDogClick={(ev) => enrichDogClick(ev, 'unassigned')}
          selectedId={selectedId}
          onDogTap={handleDogTap}
          onLongPress={handleLongPress}
          groupName={null}
          onRename={null}
          isTarget={selectedId !== null && selectedGroup !== 'unassigned'}
          onTargetTap={() => handleGroupTap('unassigned')}
          canEdit={canEdit}
          isAdmin={isAdmin}
        />

        {/* Numbered groups */}
        {groupNums.map((num) => (
          <MobileGroup
            key={num}
            groupKey={String(num)}
            eventIds={groups[num] || []}
            eventsMap={eventsMap}
            onDogClick={(ev) => enrichDogClick(ev, num)}
            selectedId={selectedId}
            onDogTap={handleDogTap}
            onLongPress={handleLongPress}
            groupName={groupNames[num] || null}
            onRename={(name) => renameGroup(num, name)}
            isTarget={selectedId !== null && selectedGroup !== num}
            onTargetTap={() => handleGroupTap(num)}
            canEdit={canEdit}
            isAdmin={isAdmin}
          />
        ))}

        {/* Add group button */}
        {canEdit && (
          <button
            onClick={addGroup}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#E8634A]/40 py-3 text-sm font-semibold text-[#E8634A] active:bg-[#E8634A]/5 transition-colors min-h-[48px]"
          >
            <span className="w-6 h-6 rounded-full bg-[#E8634A] text-white flex items-center justify-center text-base leading-none">+</span>
            Add Group
          </button>
        )}

        {/* Long-press popup menu */}
        <AnimatePresence>
          {longPressMenu && (
            <LongPressMenu
              position={{ x: longPressMenu.x, y: longPressMenu.y }}
              groupNums={groupNums}
              groupNames={groupNames}
              currentGroup={longPressMenu.fromGroup}
              onMove={handleLongPressMove}
              onClose={() => setLongPressMenu(null)}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── Desktop DnD mode ──────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-3">
        <DesktopGroup
          groupKey="unassigned"
          eventIds={groups.unassigned || []}
          eventsMap={eventsMap}
          onDogClick={(ev) => enrichDogClick(ev, 'unassigned')}
          activeId={activeId}
          groupName={null}
          onRename={null}
          canEdit={canEdit}
          isAdmin={isAdmin}
        />

        {groupNums.map((num) => (
          <DesktopGroup
            key={num}
            groupKey={String(num)}
            eventIds={groups[num] || []}
            eventsMap={eventsMap}
            onDogClick={(ev) => enrichDogClick(ev, num)}
            activeId={activeId}
            groupName={groupNames[num] || null}
            onRename={(name) => renameGroup(num, name)}
            canEdit={canEdit}
            isAdmin={isAdmin}
          />
        ))}

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
