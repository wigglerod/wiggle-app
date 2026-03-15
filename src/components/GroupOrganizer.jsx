import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import DogChip from './DogChip'
import { useWalkGroups } from '../lib/useWalkGroups'
import { useAuth } from '../context/AuthContext'
import confetti from 'canvas-confetti'

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

// ── Sortable wrapper for desktop DnD (between-group) ─────────────────
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

// ── Sortable wrapper for within-group reorder ────────────────────────
// Uses handle-only drag: only the grip handle triggers drag
function ReorderableSortableItem({ id, children, canEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
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
    >
      {typeof children === 'function'
        ? children({ isDragging, handleRef: setActivatorNodeRef, handleListeners: canEdit ? listeners : {} })
        : children}
    </div>
  )
}

// ── Shared group header (long-press to rename) ─────────────────────
function GroupHeader({ groupKey, groupName, count, onRename, isTarget, onTargetTap, selectedDogName }) {
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const isUnassigned = groupKey === 'unassigned'
  const lpTimer = useRef(null)

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

  function handlePointerDown() {
    if (isUnassigned || !onRename) return
    lpTimer.current = setTimeout(startEdit, 500)
  }
  function handlePointerUp() {
    if (lpTimer.current) clearTimeout(lpTimer.current)
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
          <span
            onPointerDown={!isUnassigned ? handlePointerDown : undefined}
            onPointerUp={!isUnassigned ? handlePointerUp : undefined}
            onPointerCancel={!isUnassigned ? handlePointerUp : undefined}
            className={`text-sm font-bold text-gray-700 text-left truncate ${!isUnassigned ? 'select-none' : ''}`}
          >
            {displayName}
          </span>
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

// ── Mobile group with tap-to-assign + within-group reorder ──────────
// ── Unassigned chip with tap + long-press support ────────────────────
function UnassignedChip({ ev, id, selectedId, canEdit, onDogTap, onDogClick, onLongPress, owlDogIdSet }) {
  const timerRef = useRef(null)
  const didLongPress = useRef(false)

  function handlePointerDown(e) {
    if (!onLongPress || !canEdit) return
    didLongPress.current = false
    const rect = e.currentTarget.getBoundingClientRect()
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress(ev, { x: Math.min(rect.left + rect.width / 2, window.innerWidth - 120), y: rect.bottom + 4 })
    }, 500)
  }
  function handlePointerUp() { if (timerRef.current) clearTimeout(timerRef.current) }
  function handlePointerMove() { if (timerRef.current) clearTimeout(timerRef.current) }
  function handleClick() {
    if (didLongPress.current) { didLongPress.current = false; return }
    canEdit ? onDogTap?.(ev) : onDogClick?.(ev)
  }

  const hasOwl = ev.dog?.id && owlDogIdSet?.has(ev.dog.id)

  return (
    <button
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerMove={handlePointerMove}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all h-9 select-none
        ${selectedId === id
          ? 'bg-[#E8634A] text-white shadow-md wiggle'
          : 'bg-white text-gray-700 border border-gray-200 shadow-sm active:scale-[0.97]'
        }
      `}
    >
      {hasOwl && <span className="owl-bounce text-xs">🦉</span>}
      <span className="truncate max-w-[140px]">{ev.displayName}</span>
      <span
        onClick={(e) => { e.stopPropagation(); onDogClick?.(ev) }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] flex-shrink-0 ${
          selectedId === id ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-400'
        }`}
      >i</span>
    </button>
  )
}

function MobileGroup({
  groupKey, eventIds, eventsMap, onDogClick, selectedId, onDogTap,
  onLongPress, groupName, onRename, isTarget, onTargetTap, canEdit,
  isAdmin, onReorder, owlDogIdSet,
}) {
  const isUnassigned = groupKey === 'unassigned'
  const { color, accent } = isUnassigned
    ? { color: 'bg-gray-100', accent: 'border-gray-300' }
    : groupColor(Number(groupKey))

  // For numbered groups, use array order as-is (that IS the pickup order)
  // For unassigned, sort by start time
  const sortedItems = useMemo(() => {
    if (!isUnassigned) {
      return eventIds.map(String)
    }
    return [...eventIds]
      .sort((a, b) => {
        const evA = eventsMap.get(String(a))
        const evB = eventsMap.get(String(b))
        if (!evA || !evB) return 0
        return new Date(evA.start) - new Date(evB.start)
      })
      .map(String)
  }, [eventIds, eventsMap, isUnassigned])

  const selectedDogName = selectedId ? eventsMap.get(selectedId)?.displayName : null

  // Within-group reorder DnD (only for numbered groups)
  const [reorderActiveId, setReorderActiveId] = useState(null)
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const reorderSensors = useSensors(touchSensor, pointerSensor)

  function handleReorderDragStart(event) {
    setReorderActiveId(String(event.active.id))
  }

  function handleReorderDragEnd(event) {
    const { active, over } = event
    setReorderActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = sortedItems.indexOf(String(active.id))
    const newIndex = sortedItems.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(sortedItems, oldIndex, newIndex)
    onReorder?.(Number(groupKey), newOrder)
  }

  const reorderActiveEvent = reorderActiveId ? eventsMap.get(reorderActiveId) : null

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

      {isUnassigned ? (
        <div className="flex flex-wrap gap-1.5">
          {sortedItems.length === 0 && (
            <p className="text-xs text-gray-400 italic py-2 w-full text-center">All dogs assigned</p>
          )}
          {sortedItems.map((id) => {
            const ev = eventsMap.get(id)
            if (!ev) return null
            return (
              <UnassignedChip
                key={id}
                ev={ev}
                id={id}
                selectedId={selectedId}
                canEdit={canEdit}
                onDogTap={onDogTap}
                onDogClick={onDogClick}
                onLongPress={onLongPress}
                owlDogIdSet={owlDogIdSet}
              />
            )
          })}
        </div>
      ) : canEdit ? (
        <DndContext
          sensors={reorderSensors}
          collisionDetection={closestCenter}
          onDragStart={handleReorderDragStart}
          onDragEnd={handleReorderDragEnd}
        >
          <SortableContext items={sortedItems} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {sortedItems.length === 0 && !isTarget && (
                <p className="text-xs text-gray-400 italic py-2 w-full text-center">
                  Tap a dog, then tap here to assign
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
                {sortedItems.map((id, index) => {
                  const ev = eventsMap.get(id)
                  if (!ev) return null
                  return (
                    <ReorderableSortableItem key={id} id={id} canEdit={canEdit}>
                      {({ isDragging, handleRef, handleListeners }) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: isDragging || reorderActiveId === id ? 0.5 : 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex items-center gap-1.5">
                            {/* Grip handle */}
                            <span
                              ref={handleRef}
                              {...handleListeners}
                              className="text-gray-300 text-sm cursor-grab active:cursor-grabbing flex-shrink-0 select-none px-0.5"
                              style={{ touchAction: 'none' }}
                            >
                              ⠿
                            </span>
                            <div className="flex-1 min-w-0">
                              <DogChip
                                event={ev}
                                onInfoClick={onDogClick}
                                onTap={onDogTap}
                                onLongPress={onLongPress}
                                isSelected={selectedId === id}
                                isAdmin={isAdmin}
                                hasOwlNote={ev.dog?.id && owlDogIdSet?.has(ev.dog.id)}
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </ReorderableSortableItem>
                  )
                })}
              </AnimatePresence>
            </div>
          </SortableContext>
          <DragOverlay>
            {reorderActiveEvent ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white text-gray-700 border border-[#E8634A] shadow-xl ring-2 ring-[#E8634A]/20">
                <span className="text-base">🐕</span>
                {reorderActiveEvent.displayName}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedItems.length === 0 && !isTarget && (
            <p className="text-xs text-gray-400 italic py-2 w-full text-center">
              No dogs assigned
            </p>
          )}
          <AnimatePresence mode="popLayout">
            {sortedItems.map((id, index) => {
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
                    onTap={onDogClick}
                    isSelected={selectedId === id}
                    isAdmin={isAdmin}
                    hasOwlNote={ev.dog?.id && owlDogIdSet?.has(ev.dog.id)}
                  />
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ── Desktop droppable group (DnD) ───────────────────────────────────
function DesktopGroup({
  groupKey, eventIds, eventsMap, onDogClick, activeId, groupName,
  onRename, canEdit, isAdmin, onReorder, owlDogIdSet,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: String(groupKey) })
  const isUnassigned = groupKey === 'unassigned'
  const { color, accent } = isUnassigned
    ? { color: 'bg-gray-100', accent: 'border-gray-300' }
    : groupColor(Number(groupKey))

  // For numbered groups, use array order as-is (pickup order)
  // For unassigned, sort by start time
  const sortedItems = useMemo(() => {
    if (!isUnassigned) {
      return eventIds.map(String)
    }
    return [...eventIds]
      .sort((a, b) => {
        const evA = eventsMap.get(String(a))
        const evB = eventsMap.get(String(b))
        if (!evA || !evB) return 0
        return new Date(evA.start) - new Date(evB.start)
      })
      .map(String)
  }, [eventIds, eventsMap, isUnassigned])

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
        {isUnassigned ? (
          <div className="flex flex-wrap gap-1.5">
            {sortedItems.length === 0 && (
              <p className="text-xs text-gray-400 italic py-2 w-full text-center">All dogs assigned</p>
            )}
            {sortedItems.map((id) => {
              const ev = eventsMap.get(id)
              if (!ev) return null
              return (
                <SortableItem key={id} id={id} canEdit={canEdit}>
                  {({ isDragging }) => (
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium h-9 select-none
                      ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                      ${isDragging || activeId === id ? 'opacity-50' : ''}
                      bg-white text-gray-700 border border-gray-200 shadow-sm
                    `}>
                      <span className="truncate max-w-[140px]">{ev.displayName}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDogClick?.(ev) }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="w-4 h-4 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-[9px] flex-shrink-0"
                      >i</button>
                    </div>
                  )}
                </SortableItem>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedItems.length === 0 && (
              <p className="text-xs text-gray-400 italic py-2 w-full text-center">
                Drag dogs here
              </p>
            )}
            {sortedItems.map((id, index) => {
              const ev = eventsMap.get(id)
              if (!ev) return null
              return (
                <SortableItem key={id} id={id} canEdit={canEdit}>
                  {({ isDragging }) => (
                    <div className="flex items-center gap-1.5">
                      {canEdit && (
                        <span className="text-gray-300 text-sm cursor-grab active:cursor-grabbing flex-shrink-0 select-none px-0.5">
                          ⠿
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <DogChip
                          event={ev}
                          onInfoClick={onDogClick}
                          onTap={onDogClick}
                          showDragHandle={false}
                          isDragging={isDragging || activeId === id}
                          isAdmin={isAdmin}
                          hasOwlNote={ev.dog?.id && owlDogIdSet?.has(ev.dog.id)}
                        />
                      </div>
                    </div>
                  )}
                </SortableItem>
              )
            })}
          </div>
        )}
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
export default function GroupOrganizer({ events, date, sector, onDogClick, owlDogNotes = [] }) {
  const { canEdit, isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const { groups, groupNums, groupNames, moveEvent, addGroup, renameGroup, reorderGroup, loaded, lastSaved } =
    useWalkGroups(events, date, sector)

  const eventsMap = useMemo(() => {
    const m = new Map()
    for (const ev of events) m.set(String(ev._id), ev)
    return m
  }, [events])

  // Set of dog IDs that have owl notes
  const owlDogIdSet = useMemo(() => {
    const s = new Set()
    for (const n of owlDogNotes) if (n.target_dog_id) s.add(n.target_dog_id)
    return s
  }, [owlDogNotes])

  // ── Confetti tracking ─────────────────────────────────────────────
  const confettiFiredRef = useRef(false)

  useEffect(() => {
    if (!loaded) return
    const totalDogs = events.length
    const unassignedCount = (groups.unassigned || []).length
    if (totalDogs > 0 && unassignedCount === 0) {
      if (!confettiFiredRef.current) {
        confettiFiredRef.current = true
        // Fire confetti burst for 2 seconds
        const end = Date.now() + 2000
        const frame = () => {
          confetti({
            particleCount: 3,
            angle: 60 + Math.random() * 60,
            spread: 55,
            origin: { x: Math.random(), y: Math.random() * 0.6 },
            colors: ['#E8634A', '#FFD700', '#4CAF50', '#2196F3', '#9C27B0'],
          })
          if (Date.now() < end) requestAnimationFrame(frame)
        }
        frame()
      }
    } else {
      // Reset so confetti fires again next time all dogs are assigned
      confettiFiredRef.current = false
    }
  }, [loaded, events.length, groups.unassigned])

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
    }
    setLongPressMenu(null)
  }

  // ── Handle within-group reorder ────────────────────────────────
  const handleReorder = useCallback(
    (groupNum, newOrderedIds) => {
      reorderGroup?.(groupNum, newOrderedIds)
    },
    [reorderGroup]
  )

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
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    const fromGroup = findGroup(activeIdStr)
    const toGroup = resolveTargetGroup(over.id)

    if (fromGroup !== null && toGroup !== null) {
      if (fromGroup === toGroup && fromGroup !== 'unassigned') {
        // Within-group reorder on desktop
        const currentItems = (groups[fromGroup] || []).map(String)
        const oldIndex = currentItems.indexOf(activeIdStr)
        const newIndex = currentItems.indexOf(overIdStr)
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const newOrder = arrayMove(currentItems, oldIndex, newIndex)
          handleReorder(fromGroup, newOrder)
        }
      } else if (fromGroup !== toGroup) {
        moveEvent(activeIdStr, fromGroup, toGroup)
      }
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
        {/* Unassigned pool — collapse when empty */}
        {(groups.unassigned || []).length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-1">✓ All dogs assigned</p>
        ) : (
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
            onReorder={handleReorder}
            owlDogIdSet={owlDogIdSet}
          />
        )}

        {/* Numbered groups -- always show 1-3, hide 4+ if empty unless assigning */}
        {groupNums.filter(num => num <= 3 || (groups[num] || []).length > 0 || selectedId !== null).map((num) => (
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
            onReorder={handleReorder}
            owlDogIdSet={owlDogIdSet}
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

        {lastSaved && (
          <p className="text-center text-[10px] text-gray-300 pt-1">
            Last saved {lastSaved.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
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
        {/* Unassigned pool — collapse when empty */}
        {(groups.unassigned || []).length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-1">✓ All dogs assigned</p>
        ) : (
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
            onReorder={handleReorder}
            owlDogIdSet={owlDogIdSet}
          />
        )}

        {groupNums.filter(num => num <= 3 || (groups[num] || []).length > 0 || activeId !== null).map((num) => (
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
            onReorder={handleReorder}
            owlDogIdSet={owlDogIdSet}
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

        {lastSaved && (
          <p className="text-center text-[10px] text-gray-300 pt-1">
            Last saved {lastSaved.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
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
