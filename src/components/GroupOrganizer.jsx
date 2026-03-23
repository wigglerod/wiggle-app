import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import LoadingDog from './LoadingDog'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DogChip, { DogPhoto } from './DogChip'
import GroupCreationSheet from './GroupCreationSheet'
import QuickNoteSheet from './QuickNoteSheet'
import { usePickups } from '../lib/usePickups'
import { useWalkGroups } from '../lib/useWalkGroups'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useAltAddressDogIds } from '../lib/useAltAddress'

// ── Done groups persistence (localStorage) ──────────────────────────
function getDoneKey(date, sector) { return `doneGroups_${date}_${sector}` }

function getDoneGroups(date, sector) {
  try {
    const raw = localStorage.getItem(getDoneKey(date, sector))
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function setDoneGroups(date, sector, doneSet) {
  localStorage.setItem(getDoneKey(date, sector), JSON.stringify([...doneSet]))
}

// ── Swipeable wrapper (CSS transitions only) ─────────────────────────
function SwipeableGroup({ groupNum, onDone, children }) {
  const startX = useRef(null)
  const currentX = useRef(0)
  const containerRef = useRef(null)
  const [offset, setOffset] = useState(0)
  const [revealed, setRevealed] = useState(false)

  function handleTouchStart(e) {
    startX.current = e.touches[0].clientX
    currentX.current = offset
  }

  function handleTouchMove(e) {
    if (startX.current === null) return
    const dx = e.touches[0].clientX - startX.current
    const next = Math.min(0, Math.max(-120, currentX.current + dx))
    setOffset(next)
  }

  function handleTouchEnd() {
    startX.current = null
    if (offset < -60) {
      setRevealed(true)
      setOffset(-100)
    } else {
      setRevealed(false)
      setOffset(0)
    }
  }

  function handleDone() {
    setOffset(-window.innerWidth)
    setTimeout(() => onDone(groupNum), 300)
  }

  function handleCancel() {
    setRevealed(false)
    setOffset(0)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 flex items-center justify-end bg-emerald-500 rounded-2xl">
        {revealed ? (
          <div className="flex items-center gap-2 pr-3">
            <button onClick={handleDone} className="px-4 py-2 rounded-xl bg-white text-emerald-700 text-sm font-bold active:bg-emerald-50">
              ✓ Done
            </button>
            <button onClick={handleCancel} className="px-3 py-2 rounded-xl text-white/80 text-xs font-medium active:text-white">
              Cancel
            </button>
          </div>
        ) : (
          <span className="pr-6 text-white text-sm font-semibold">✓ Done</span>
        )}
      </div>
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: startX.current !== null ? 'none' : 'transform 0.3s ease',
        }}
        className="relative z-10"
      >
        {children}
      </div>
    </div>
  )
}

// ── Swipeable dog row (locked mode) — left=pickup, right=note ────
function SwipeableDogRow({ ev, pickupTime, onPickup, onNoteSwipe, onDogClick, owlDogIdSet, owlDogNotesMap, routeNum }) {
  const startX = useRef(null)
  const [offset, setOffset] = useState(0)

  const isPickedUp = !!pickupTime
  const timeStr = pickupTime
    ? new Date(pickupTime).toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' })
    : null

  function handleTouchStart(e) {
    if (isPickedUp) return
    startX.current = e.touches[0].clientX
  }

  function handleTouchMove(e) {
    if (startX.current === null) return
    const dx = e.touches[0].clientX - startX.current
    setOffset(Math.max(-120, Math.min(120, dx)))
  }

  function handleTouchEnd() {
    if (startX.current === null) return
    startX.current = null
    if (offset < -80) {
      // Swipe left → pickup
      try { navigator.vibrate?.(10) } catch {}
      onPickup(ev)
      setOffset(0)
    } else if (offset > 80) {
      // Swipe right → note
      try { navigator.vibrate?.(10) } catch {}
      onNoteSwipe(ev)
      setOffset(0)
    } else {
      setOffset(0)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-[10px]">
      {/* Left backdrop — pickup (green) */}
      <div className="absolute inset-0 flex items-center justify-end rounded-[10px]" style={{ backgroundColor: '#0F6E56' }}>
        <span className="pr-4 text-white text-[12px] font-semibold">&#10003; Done</span>
      </div>
      {/* Right backdrop — note (coral) */}
      <div className="absolute inset-0 flex items-center justify-start rounded-[10px] bg-[#E8634A]">
        <span className="pl-4 text-white text-[12px] font-semibold">Note &#9998;</span>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: startX.current !== null ? 'none' : 'transform 0.3s ease',
        }}
        className="relative z-10"
      >
        <div className={isPickedUp ? 'opacity-50' : ''}>
          <DogChip
            event={ev}
            onInfoClick={onDogClick}
            hasOwlNote={ev.dog?.id && owlDogIdSet?.has(ev.dog.id)}
            owlNote={ev.dog?.id ? owlDogNotesMap?.get(ev.dog.id) : null}
            routeNum={routeNum}
            showHandle={false}
            pickedUpTime={timeStr}
          />
        </div>
      </div>
    </div>
  )
}

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

// ── Hold-to-lock button for per-group lock ────────────────────────
function LockButton({ onLock }) {
  const timer = useRef(null)
  const [filling, setFilling] = useState(false)

  function handlePointerDown() {
    setFilling(true)
    timer.current = setTimeout(() => {
      setFilling(false)
      try { navigator.vibrate?.(20) } catch {}
      onLock()
    }, 1000)
  }
  function handlePointerUp() {
    clearTimeout(timer.current)
    setFilling(false)
  }

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="relative w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-sm overflow-hidden flex-shrink-0 active:bg-gray-200"
      title="Hold to lock"
    >
      {filling && <span className="absolute inset-0 bg-[#E8634A] origin-left animate-lock-fill" />}
      <span className="relative z-10 text-[13px]">&#128274;</span>
    </button>
  )
}

// ── Link picker with mode + stagger selection ───────────────────────
function LinkPicker({ groupKey, allGroupNums, allGroupNames, eventsMap, groupDogIds, onLink, onClose }) {
  const [step, setStep] = useState('group') // 'group' | 'mode' | 'stagger'
  const [targetNum, setTargetNum] = useState(null)

  function handleSelectGroup(n) {
    setTargetNum(n)
    setStep('mode')
  }

  function handleSideBySide() {
    onLink(targetNum, null)
  }

  function handleStaggerAt(dogIndex) {
    onLink(targetNum, dogIndex)
  }

  // Dogs in the current group (for stagger picker: "start Group B at which dog in Group A?")
  const currentDogIds = (groupDogIds?.[Number(groupKey)] || []).map(String)

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onClose() }} />
      <div className="absolute right-2 top-8 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[180px] max-h-[320px] overflow-y-auto">
        {step === 'group' && (
          <>
            <p className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wide">Link with</p>
            {(allGroupNums || []).filter(n => String(n) !== groupKey).map(n => (
              <button
                key={n}
                onClick={() => handleSelectGroup(n)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 active:bg-gray-50"
              >
                {allGroupNames?.[n] || `Group ${n}`}
              </button>
            ))}
          </>
        )}

        {step === 'mode' && (
          <>
            <p className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wide">Link mode</p>
            <button
              onClick={handleSideBySide}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-700 active:bg-gray-50 flex items-center gap-2"
            >
              <span className="w-5 h-5 rounded bg-[#185FA5]/10 text-[#185FA5] flex items-center justify-center text-[10px] font-bold">||</span>
              Side by side
            </button>
            <button
              onClick={() => setStep('stagger')}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-700 active:bg-gray-50 flex items-center gap-2"
            >
              <span className="w-5 h-5 rounded bg-[#185FA5]/10 text-[#185FA5] flex items-center justify-center text-[10px] font-bold">/</span>
              Staggered
            </button>
          </>
        )}

        {step === 'stagger' && (
          <>
            <p className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wide">Start at which dog?</p>
            {currentDogIds.map((id, idx) => {
              const ev = eventsMap?.get(id)
              if (!ev) return null
              return (
                <button
                  key={id}
                  onClick={() => handleStaggerAt(idx + 1)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 active:bg-gray-50 flex items-center gap-2"
                >
                  <span className="text-[10px] text-gray-400 w-4">{idx + 1}</span>
                  {ev.displayName}
                </button>
              )
            })}
          </>
        )}
      </div>
    </>
  )
}

// ── Shared group header (long-press to rename) ─────────────────────
function GroupHeader({
  groupKey, groupName, count, onRename, isTarget, onTargetTap, selectedDogName, isLocked,
  walkerNames, walkerIds, isOwnGroup, canAssign, availableWalkers, onAddWalker, onRemoveWalker, onLockGroup,
  linkedGroupNum, linkedLinkId, onLinkGroup, onUnlinkGroup, groupNums: allGroupNums, groupNames: allGroupNames,
}) {
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showWalkerPicker, setShowWalkerPicker] = useState(false)
  const [showLinkPicker, setShowLinkPicker] = useState(false)
  const isUnassigned = groupKey === 'unassigned'
  const lpTimer = useRef(null)

  const displayName = isUnassigned ? 'Unassigned' : (groupName || `Group ${groupKey}`)
  const names = walkerNames || []
  const ids = walkerIds || []

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
    <div
      className={`relative flex items-center justify-between mb-2 rounded-lg px-2 py-1.5 -mx-1 transition-all cursor-pointer ${
        isTarget ? 'group-target-pulse' : ''
      }`}
      onClick={isTarget ? onTargetTap : undefined}
    >
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
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
            className={`text-[13px] font-medium text-left truncate ${!isUnassigned ? 'select-none' : ''} ${
              isTarget ? 'text-[#E8634A]' : 'text-gray-700'
            }`}
          >
            {displayName}
          </span>
        )}

        {/* Walker name badges */}
        {!isUnassigned && names.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {names.map((name, i) => (
              <span
                key={ids[i]}
                onClick={canAssign ? (e) => { e.stopPropagation(); setShowWalkerPicker(true) } : undefined}
                className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                  ids[i] && isOwnGroup ? 'bg-[#E8634A]/15 text-[#E8634A]' : 'bg-gray-200 text-gray-600'
                } ${canAssign ? 'cursor-pointer active:opacity-70' : ''}`}
              >
                {name}
              </span>
            ))}
          </div>
        )}

        {/* Assign walker button */}
        {!isUnassigned && names.length === 0 && canAssign && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowWalkerPicker(true) }}
            className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium flex-shrink-0 active:bg-gray-200"
          >
            + walker
          </button>
        )}

        {/* Linked group indicator */}
        {!isUnassigned && linkedGroupNum && (
          <span
            onClick={canAssign ? (e) => { e.stopPropagation(); onUnlinkGroup?.(linkedLinkId) } : undefined}
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${canAssign ? 'cursor-pointer active:opacity-60' : ''}`}
            style={{ backgroundColor: '#185FA5', color: 'white' }}
            title={canAssign ? 'Tap to unlink' : `Linked with Group ${linkedGroupNum}`}
          >
            &#128279; {linkedGroupNum}
          </span>
        )}

        {/* Link button */}
        {!isUnassigned && !linkedGroupNum && canAssign && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowLinkPicker(true) }}
            className="text-[10px] text-gray-300 flex-shrink-0 active:text-gray-500"
          >
            🔗
          </button>
        )}

        {/* Per-group lock button (hold 1s to lock) */}
        {!isUnassigned && onLockGroup && count > 0 && (
          <LockButton onLock={onLockGroup} />
        )}

        <span className="text-xs text-gray-400 bg-white/70 px-2 py-0.5 rounded-full flex-shrink-0">
          {count} {count === 1 ? 'dog' : 'dogs'}
        </span>
      </div>

      {isTarget && selectedDogName && (
        <span className="ml-2 text-xs text-[#E8634A] font-medium flex-shrink-0 animate-pulse">
          + {selectedDogName}
        </span>
      )}

      {/* Walker picker dropdown */}
      {showWalkerPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowWalkerPicker(false) }} />
          <div className="absolute right-2 top-8 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[160px] max-h-[240px] overflow-y-auto">
            {ids.length > 0 && (
              <div className="px-3 py-1.5 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Assigned</p>
                {ids.map((id, i) => (
                  <div key={id} className="flex items-center justify-between py-1">
                    <span className="text-sm font-semibold text-[#E8634A]">{names[i]}</span>
                    <button
                      onClick={() => { onRemoveWalker?.(Number(groupKey), id) }}
                      className="text-gray-300 active:text-red-500 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="px-3 pt-1.5 pb-0.5 text-[10px] text-gray-400 uppercase tracking-wide">
              {ids.length > 0 ? 'Add co-walker' : 'Assign walker'}
            </p>
            {availableWalkers?.filter(w => !ids.includes(w.id)).map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  onAddWalker?.(Number(groupKey), w.id)
                  if (ids.length > 0) setShowWalkerPicker(false)
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 active:bg-gray-50 transition-colors"
              >
                {w.full_name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Link picker dropdown — enhanced with mode selection */}
      {showLinkPicker && (
        <LinkPicker
          groupKey={groupKey}
          allGroupNums={allGroupNums}
          allGroupNames={allGroupNames}
          eventsMap={eventsMap}
          groupDogIds={groupDogIds}
          onLink={(targetNum, syncPos) => { onLinkGroup?.(Number(groupKey), targetNum, syncPos); setShowLinkPicker(false) }}
          onClose={() => setShowLinkPicker(false)}
        />
      )}
    </div>
  )
}

// ── Sortable dog chip with handle-only DnD ─────────────────────────
function SortableDogChip({ id, ev, onInfoClick, onTap, isSelected, owlDogIdSet, owlDogNotesMap, conflictDogIds, altAddressDogIds, routeNum, canDrag }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !canDrag })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <DogChip
        event={ev}
        onInfoClick={onInfoClick}
        onTap={onTap}
        isSelected={isSelected}
        isDragging={isDragging}
        hasOwlNote={ev.dog?.id && owlDogIdSet?.has(ev.dog.id)}
        owlNote={ev.dog?.id ? owlDogNotesMap?.get(ev.dog.id) : null}
        hasConflict={conflictDogIds?.has(id)}
        hasAltAddress={ev.dog?.id && altAddressDogIds?.has(ev.dog.id)}
        routeNum={routeNum}
        showHandle={true}
        handleListeners={listeners}
        handleAttributes={attributes}
        handleRef={setActivatorNodeRef}
      />
    </div>
  )
}

// ── Unassigned chip (pill style, no handle) ────────────────────────
function UnassignedChip({ ev, id, selectedId, onDogTap, onDogClick, owlDogIdSet }) {
  const hasOwl = ev.dog?.id && owlDogIdSet?.has(ev.dog.id)

  return (
    <div className="inline-flex items-center">
      <button
        onClick={() => onDogTap?.(ev)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all h-9 select-none
          ${selectedId === id
            ? 'bg-[#E8634A] text-white shadow-md chip-selected'
            : 'bg-white text-gray-700 border border-gray-200 shadow-sm chip-3d active:scale-[0.97]'
          }
        `}
      >
        {hasOwl && <span className="owl-bounce text-[10px]" style={{ lineHeight: 1 }}>&#129417;</span>}
        <DogPhoto dog={ev.dog} displayName={ev.displayName} size={20} />
        <span className="truncate max-w-[120px] text-[12px]">{ev.displayName}</span>
      </button>
    </div>
  )
}

// ── Long-press popup menu (with dog names + new group) ─────────────
function LongPressMenu({ position, dogName, groupNums, groupNames, groups, eventsMap, currentGroup, onMove, onNewGroup, onClose }) {
  const menuStyle = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - 320),
    left: Math.max(8, Math.min(position.x - 108, window.innerWidth - 224)),
    zIndex: 60,
  }

  function getDogNames(groupKey) {
    const ids = groups[groupKey] || []
    return ids.slice(0, 4).map(id => {
      const ev = eventsMap.get(String(id))
      return ev?.displayName || '?'
    }).join(', ') + (ids.length > 4 ? ` +${ids.length - 4}` : '')
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
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 w-56 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-1.5">
          <p className="text-xs font-semibold text-gray-500">Move <span className="text-[#E8634A]">{dogName}</span> to...</p>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {groupNums.map((num) => {
          const dogNames = getDogNames(num)
          return (
            <button
              key={num}
              onClick={() => onMove(num)}
              disabled={currentGroup === num}
              className={`w-full text-left px-4 py-2.5 transition-colors min-h-[44px] flex flex-col
                ${currentGroup === num ? 'text-gray-300 cursor-default' : 'text-gray-700 active:bg-[#FFF4F1]'}
              `}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${groupColor(num).accent.replace('border-', 'bg-')}`} />
                {groupNames[num] || `Group ${num}`}
                {currentGroup === num && <span className="text-xs text-gray-300 ml-auto">current</span>}
              </span>
              {dogNames && currentGroup !== num && (
                <span className="text-[11px] text-gray-400 ml-4 truncate">{dogNames}</span>
              )}
            </button>
          )
        })}

        <div className="border-t border-gray-100 mt-1 pt-1">
          <button
            onClick={() => onMove('unassigned')}
            disabled={currentGroup === 'unassigned'}
            className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] flex items-center gap-2
              ${currentGroup === 'unassigned' ? 'text-gray-300 cursor-default' : 'text-gray-700 active:bg-[#FFF4F1]'}
            `}
          >
            <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
            Unassigned
            {currentGroup === 'unassigned' && <span className="text-xs text-gray-300 ml-auto">current</span>}
          </button>
        </div>

        {/* + New group — ghost option */}
        <div className="border-t border-gray-100 mt-1 pt-1">
          <button
            onClick={() => onNewGroup?.()}
            className="w-full text-left px-4 py-2.5 text-sm font-medium text-[#E8634A]/60 active:bg-[#FFF4F1] transition-colors min-h-[44px] flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl mx-2 mb-1"
            style={{ width: 'calc(100% - 16px)' }}
          >
            <span className="w-5 h-5 rounded-full bg-[#E8634A]/10 text-[#E8634A]/60 flex items-center justify-center text-xs leading-none font-bold">+</span>
            New group
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ── Mobile group ──────────────────────────────────────────────────
function MobileGroup({
  groupKey, eventIds, eventsMap, onDogClick, selectedId, onDogTap,
  groupName, onRename, isTarget, onTargetTap, selectedDogName,
  onReorder, owlDogIdSet, isLocked, conflictDogIds, hasConflict,
  walkerNames, walkerIds, isOwnGroup, canAssign, availableWalkers, onAddWalker, onRemoveWalker,
  linkedGroupNum, linkedLinkId, onLinkGroup, onUnlinkGroup, groupNums: allGroupNums, groupNames: allGroupNames,
  altAddressDogIds, owlDogNotesMap, onLockGroup, lockInfo, eventsMap: parentEventsMap, allGroups,
}) {
  const isUnassigned = groupKey === 'unassigned'
  const { color, accent } = isUnassigned
    ? { color: 'bg-gray-100', accent: 'border-gray-300' }
    : groupColor(Number(groupKey))

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

  // Within-group reorder DnD (handle-only, numbered groups only)
  const [reorderActiveId, setReorderActiveId] = useState(null)
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  const reorderSensors = useSensors(touchSensor, pointerSensor)

  function handleReorderDragStart(event) {
    setReorderActiveId(String(event.active.id))
    try { navigator.vibrate?.(10) } catch {}
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
    try { navigator.vibrate?.(10) } catch {}
  }

  const reorderActiveEvent = reorderActiveId ? eventsMap.get(reorderActiveId) : null

  // Route summary
  const routeSummary = !isUnassigned && sortedItems.length > 1
    ? sortedItems.map(id => eventsMap.get(id)?.displayName).filter(Boolean).join(' → ')
    : null

  return (
    <div
      className={`rounded-[14px] border-2 border-dashed p-2.5 transition-all min-h-[80px]
        ${hasConflict ? 'sos-flash' : `${accent} ${color}`}
        ${isTarget ? 'group-target-pulse' : ''}
        ${isOwnGroup && !isTarget ? 'ring-2 ring-[#E8634A]/20' : ''}
      `}
    >
      <GroupHeader
        groupKey={groupKey}
        groupName={groupName}
        count={sortedItems.length}
        onRename={isLocked ? null : onRename}
        isTarget={isTarget}
        onTargetTap={onTargetTap}
        selectedDogName={selectedDogName}
        isLocked={isLocked}
        walkerNames={walkerNames}
        walkerIds={walkerIds}
        isOwnGroup={isOwnGroup}
        canAssign={canAssign}
        availableWalkers={availableWalkers}
        onAddWalker={onAddWalker}
        onRemoveWalker={onRemoveWalker}
        linkedGroupNum={linkedGroupNum}
        linkedLinkId={linkedLinkId}
        onLinkGroup={onLinkGroup}
        onUnlinkGroup={onUnlinkGroup}
        groupNums={allGroupNums}
        groupNames={allGroupNames}
        onLockGroup={onLockGroup}
        eventsMap={parentEventsMap || eventsMap}
        groupDogIds={allGroups}
      />

      {isUnassigned ? (
        <div className="flex flex-wrap gap-1.5">
          {sortedItems.length === 0 && (
            <p className="text-xs text-gray-400 italic py-2 w-full text-center">All dogs assigned</p>
          )}
          {(() => {
            let dividerShown = false
            return sortedItems.map((id) => {
              const ev = eventsMap.get(id)
              if (!ev) return null
              const startHour = ev.start ? new Date(ev.start).getHours() : 0
              const showDivider = !dividerShown && startHour >= 12
              if (showDivider) dividerShown = true
              return (
                <React.Fragment key={id}>
                  {showDivider && sortedItems.length > 1 && (
                    <div className="w-full flex items-center gap-2 py-1.5">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">12 PM</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}
                  <UnassignedChip
                    ev={ev}
                    id={id}
                    selectedId={selectedId}
                    onDogTap={onDogTap}
                    onDogClick={onDogClick}
                    owlDogIdSet={owlDogIdSet}
                  />
                </React.Fragment>
              )
            })
          })()}
        </div>
      ) : (
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
                {sortedItems.map((id, idx) => {
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
                      <SortableDogChip
                        id={id}
                        ev={ev}
                        onInfoClick={onDogClick}
                        onTap={onDogTap}
                        isSelected={selectedId === id}
                        owlDogIdSet={owlDogIdSet}
                        owlDogNotesMap={owlDogNotesMap}
                        conflictDogIds={conflictDogIds}
                        altAddressDogIds={altAddressDogIds}
                        routeNum={idx + 1}
                        canDrag={true}
                      />
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </SortableContext>
          <DragOverlay>
            {reorderActiveEvent ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-medium bg-white text-gray-700 border-2 border-[#E8634A] shadow-xl ring-2 ring-[#E8634A]/20 scale-105">
                <DogPhoto dog={reorderActiveEvent.dog} displayName={reorderActiveEvent.displayName} size={24} />
                {reorderActiveEvent.displayName}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Route summary */}
      {routeSummary && (
        <p className="text-[10px] text-gray-400 mt-2 truncate px-1">
          Route: {routeSummary}
        </p>
      )}
    </div>
  )
}

// ── Main export ─────────────────────────────────────────────────────
export default function GroupOrganizer({ events, date, sector, onDogClick, owlDogNotes = [], onAnyGroupLocked }) {
  const { canEdit, isAdmin, permissions, user } = useAuth()
  const {
    groups, groupNums, groupNames, walkerAssignments, groupLinks, groupLocks,
    moveEvent, addGroup, renameGroup, reorderGroup,
    assignWalker, addWalker, removeWalker, linkGroups, unlinkGroups,
    loaded, lastSaved, lockGroup, unlockGroup,
  } = useWalkGroups(events, date, sector)

  const anyGroupLocked = Object.keys(groupLocks).length > 0

  // Report lock state to parent
  useEffect(() => { onAnyGroupLocked?.(anyGroupLocked) }, [anyGroupLocked, onAnyGroupLocked])

  // Pickup tracking (walking mode)
  const { pickups, markPickup } = usePickups(date)

  // Quick note sheet for swipe-right on a dog
  const [swipeNoteDog, setSwipeNoteDog] = useState(null)

  // Available walkers for this sector + today
  const [availableWalkers, setAvailableWalkers] = useState([])
  useEffect(() => {
    if (!sector) return
    async function fetchWalkers() {
      let query = supabase
        .from('profiles')
        .select('id, full_name, sector, schedule')
        .in('role', ['senior_walker', 'admin'])
        .order('full_name')
      if (sector !== 'both') {
        query = query.or(`sector.eq.${sector},sector.eq.both`)
      }
      const { data } = await query
      if (!data) return

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const todayDay = dayNames[new Date().getDay()]
      const working = data.filter((w) => {
        if (!w.schedule) return true
        return w.schedule.includes(todayDay)
      })
      setAvailableWalkers(working)
    }
    fetchWalkers()
  }, [sector])

  // Walker name lookup map
  const walkerNameMap = useMemo(() => {
    const map = {}
    for (const w of availableWalkers) map[w.id] = w.full_name
    return map
  }, [availableWalkers])

  // Done groups state (localStorage-backed)
  const [doneGroupNums, setDoneGroupNums] = useState(new Set())

  useEffect(() => {
    if (date && sector) setDoneGroupNums(getDoneGroups(date, sector))
  }, [date, sector])

  const markGroupDone = useCallback((num) => {
    setDoneGroupNums(prev => {
      const next = new Set([...prev, num])
      setDoneGroups(date, sector, next)
      return next
    })
  }, [date, sector])

  const undoGroupDone = useCallback((num) => {
    setDoneGroupNums(prev => {
      const next = new Set([...prev])
      next.delete(num)
      setDoneGroups(date, sector, next)
      return next
    })
  }, [date, sector])

  // Conflict detection state
  const [conflicts, setConflicts] = useState([])
  const [dismissedConflictKeys, setDismissedConflictKeys] = useState(new Set())

  useEffect(() => {
    async function loadConflicts() {
      const { data, error } = await supabase.from('dog_conflicts').select('*')
      if (error) console.error('[conflicts] load failed:', error)
      if (data) setConflicts(data)
    }
    loadConflicts()
  }, [])

  const eventsMap = useMemo(() => {
    const m = new Map()
    for (const ev of events) m.set(String(ev._id), ev)
    return m
  }, [events])

  // Set of dog IDs with alt address today
  const allDogIds = useMemo(() => events.map(ev => ev.dog?.id).filter(Boolean), [events])
  const altAddressDogIds = useAltAddressDogIds(allDogIds)

  // Set of dog IDs that have owl notes + map to note data
  const owlDogIdSet = useMemo(() => {
    const s = new Set()
    for (const n of owlDogNotes) if (n.target_dog_id) s.add(n.target_dog_id)
    return s
  }, [owlDogNotes])

  const owlDogNotesMap = useMemo(() => {
    const m = new Map()
    for (const n of owlDogNotes) if (n.target_dog_id) m.set(n.target_dog_id, n)
    return m
  }, [owlDogNotes])

  // ── Compute active conflicts from current group state ──────────────
  const activeConflicts = useMemo(() => {
    if (conflicts.length === 0) return []
    const result = []
    for (const num of groupNums) {
      const dogIds = (groups[num] || []).map(String)
      for (let i = 0; i < dogIds.length; i++) {
        for (let j = i + 1; j < dogIds.length; j++) {
          const ev1 = eventsMap.get(dogIds[i])
          const ev2 = eventsMap.get(dogIds[j])
          if (!ev1 || !ev2) continue
          const name1 = (ev1.dog?.dog_name || ev1.displayName).toLowerCase()
          const name2 = (ev2.dog?.dog_name || ev2.displayName).toLowerCase()
          for (const c of conflicts) {
            const pair = [c.dog_1_name.toLowerCase(), c.dog_2_name.toLowerCase()]
            if (pair.includes(name1) && pair.includes(name2)) {
              result.push({
                dog1Name: ev1.dog?.dog_name || ev1.displayName,
                dog2Name: ev2.dog?.dog_name || ev2.displayName,
                dog1Id: dogIds[i],
                dog2Id: dogIds[j],
                reason: c.reason,
                groupNum: num,
              })
            }
          }
        }
      }
    }
    return result
  }, [conflicts, groupNums, groups, eventsMap])

  const visibleConflicts = activeConflicts.filter(c => {
    const key = [c.dog1Id, c.dog2Id].sort().join('-')
    return !dismissedConflictKeys.has(key)
  })

  const conflictGroupNums = new Set(visibleConflicts.map(c => c.groupNum))
  const conflictDogIds = new Set(visibleConflicts.flatMap(c => [c.dog1Id, c.dog2Id]))

  // ── Tap-to-assign state (Gesture 1) ────────────────────────────
  const [selectedId, setSelectedId] = useState(null)

  // ── Long-press popup state (Gesture 2) ─────────────────────────
  const [longPressMenu, setLongPressMenu] = useState(null)
  const holdTimer = useRef(null)
  const touchStartY = useRef(0)
  const isScrolling = useRef(false)

  // ── Group creation sheet state ────────────────────────────────
  const [creationSheetOpen, setCreationSheetOpen] = useState(false)
  const [pendingMoveDog, setPendingMoveDog] = useState(null) // { dogId, fromGroup } when triggered from long-press

  function findGroup(id) {
    const strId = String(id)
    if ((groups.unassigned || []).includes(strId)) return 'unassigned'
    for (const n of groupNums) {
      if ((groups[n] || []).includes(strId)) return n
    }
    return null
  }

  // Gesture 1: Quick tap a dog
  function handleDogTap(event) {
    const id = String(event._id)
    // Check if this dog's group is locked
    const dogGroup = findGroup(id)
    if (dogGroup !== 'unassigned' && dogGroup !== null && groupLocks[dogGroup]) return
    setSelectedId((prev) => (prev === id ? null : id))
    setLongPressMenu(null)
  }

  // Gesture 1: Tap a group header to move selected dog there
  function handleGroupTap(targetGroup) {
    if (targetGroup !== 'unassigned' && groupLocks[targetGroup]) return
    if (!selectedId) return
    const fromGroup = findGroup(selectedId)
    if (fromGroup === null || fromGroup === targetGroup) {
      setSelectedId(null)
      return
    }

    const ev = eventsMap.get(selectedId)
    const targetName = targetGroup === 'unassigned' ? 'Unassigned' : (groupNames[targetGroup] || `Group ${targetGroup}`)
    moveEvent(selectedId, fromGroup, targetGroup)
    setSelectedId(null)
    try { navigator.vibrate?.(20) } catch {}
    toast(`Moved ${ev?.displayName || 'dog'} to ${targetName}`)
  }

  // Gesture 2: Long hold on a dog chip — shows popup group picker
  function handleTouchStartOnChip(event, chipEvent) {
    touchStartY.current = event.touches[0].clientY
    isScrolling.current = false
    const rect = event.currentTarget.getBoundingClientRect()
    holdTimer.current = setTimeout(() => {
      if (!isScrolling.current) {
        try { navigator.vibrate?.(10) } catch {}
        setSelectedId(null)
        setLongPressMenu({
          dogId: String(chipEvent._id),
          dogName: chipEvent.displayName,
          fromGroup: findGroup(String(chipEvent._id)),
          x: Math.min(rect.left + rect.width / 2, window.innerWidth - 120),
          y: rect.bottom + 4,
        })
      }
    }, 500)
  }

  function handleTouchMoveOnChip(event) {
    if (Math.abs(event.touches[0].clientY - touchStartY.current) > 10) {
      isScrolling.current = true
      clearTimeout(holdTimer.current)
    }
  }

  function handleTouchEndOnChip() {
    clearTimeout(holdTimer.current)
  }

  function handleLongPressMove(targetGroup) {
    if (!longPressMenu) return
    const { dogId, fromGroup } = longPressMenu
    if (fromGroup !== targetGroup) {
      const ev = eventsMap.get(dogId)
      const targetName = targetGroup === 'unassigned' ? 'Unassigned' : (groupNames[targetGroup] || `Group ${targetGroup}`)
      moveEvent(dogId, fromGroup, targetGroup)
      try { navigator.vibrate?.(20) } catch {}
      toast(`Moved ${ev?.displayName || 'dog'} to ${targetName}`)
    }
    setLongPressMenu(null)
  }

  function handleLongPressNewGroup() {
    if (!longPressMenu) return
    setPendingMoveDog({ dogId: longPressMenu.dogId, fromGroup: longPressMenu.fromGroup })
    setLongPressMenu(null)
    setCreationSheetOpen(true)
  }

  function handleCreateGroup(name, walkerIds) {
    const newNum = addGroup(name, walkerIds)
    // If triggered from long-press, auto-move the dog
    if (pendingMoveDog) {
      const { dogId, fromGroup } = pendingMoveDog
      setTimeout(() => {
        moveEvent(dogId, fromGroup, newNum)
        const ev = eventsMap.get(dogId)
        toast(`Moved ${ev?.displayName || 'dog'} to ${name || `Group ${newNum}`}`)
      }, 100)
      setPendingMoveDog(null)
    }
  }

  // Deselect on background tap
  function handleBackgroundTap(e) {
    if (e.target === e.currentTarget) {
      setSelectedId(null)
    }
  }

  // ── Handle within-group reorder ────────────────────────────────
  const handleReorder = useCallback(
    (groupNum, newOrderedIds) => {
      reorderGroup?.(groupNum, newOrderedIds)
    },
    [reorderGroup]
  )

  if (!loaded) {
    return (
      <div className="flex justify-center py-8">
        <LoadingDog />
      </div>
    )
  }

  const selectedGroup = selectedId ? findGroup(selectedId) : null
  const selectedDogName = selectedId ? eventsMap.get(selectedId)?.displayName : null

  function enrichDogClick(ev, groupKey) {
    const gName = groupKey === 'unassigned' ? 'Unassigned' : (groupNames[groupKey] || `Group ${groupKey}`)
    onDogClick({ ...ev, _groupKey: groupKey, _groupName: gName })
  }

  // SOS conflict banner
  const sosBanner = visibleConflicts.length > 0 && (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="bg-red-600 text-white px-4 py-3 shadow-2xl sos-banner-pulse"
      >
        {visibleConflicts.map((c) => {
          const key = [c.dog1Id, c.dog2Id].sort().join('-')
          return (
            <div key={key} className="flex flex-col gap-1 mb-2 last:mb-0">
              <p className="text-sm font-bold">
                🚨 CONFLICT: {c.dog1Name} and {c.dog2Name} cannot be in the same group!
              </p>
              {c.reason && <p className="text-xs opacity-80">{c.reason}</p>}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => {
                    const groupDogs = (groups[c.groupNum] || []).map(String)
                    const idx1 = groupDogs.indexOf(c.dog1Id)
                    const idx2 = groupDogs.indexOf(c.dog2Id)
                    const dogToMove = idx2 > idx1 ? c.dog2Id : c.dog1Id
                    moveEvent(dogToMove, c.groupNum, 'unassigned')
                  }}
                  className="px-3 py-1.5 rounded-full bg-white text-red-600 text-xs font-bold active:bg-red-50"
                >
                  Fix it
                </button>
                <button
                  onClick={() => {
                    setDismissedConflictKeys(prev => new Set([...prev, key]))
                  }}
                  className="px-3 py-1.5 rounded-full bg-red-700 text-white text-xs font-bold active:bg-red-800"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )
        })}
      </motion.div>
    </div>
  )

  // Walker props helper for group cards
  function walkerProps(num) {
    const wIds = walkerAssignments[num] || []
    const names = wIds.map(id => walkerNameMap[id]).filter(Boolean)
    const groupKey = `${date}_${sector}_${num}`
    const linkedTo = groupLinks.find(l => l.group_a_key === groupKey || l.group_b_key === groupKey)
    const linkedGroupNum = linkedTo
      ? Number((linkedTo.group_a_key === groupKey ? linkedTo.group_b_key : linkedTo.group_a_key).split('_').pop())
      : null
    return {
      walkerNames: names,
      walkerIds: wIds,
      isOwnGroup: wIds.includes(user?.id),
      canAssign: permissions.canEditGroups && !groupLocks[num],
      availableWalkers,
      onAddWalker: addWalker,
      onRemoveWalker: removeWalker,
      linkedGroupNum,
      linkedLinkId: linkedTo?.id || null,
      linkedSyncPosition: linkedTo?.sync_position ?? null,
      onLinkGroup: linkGroups,
      onUnlinkGroup: unlinkGroups,
      groupNums,
      groupNames,
    }
  }

  // ── Collapsed locked group (other walker's group) ───────────────
  function CollapsedLockedGroup({ num, gName, lockInfo, dogIds, eventsMap: em, wp, pickups: pk, onDogClick }) {
    const [expanded, setExpanded] = useState(false)
    const pickedCount = dogIds.filter(id => { const ev = em.get(id); return ev?.dog?.id && pk[ev.dog.id] }).length
    return (
      <div key={num} className="rounded-[14px] border border-gray-200 overflow-hidden" style={{ opacity: 0.7 }}>
        <button
          onClick={() => setExpanded(p => !p)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-left active:bg-gray-50"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[12px]">&#128274;</span>
            <span className="text-[12px] font-medium text-gray-700 truncate">{gName}</span>
            {wp.walkerNames?.map((name, i) => (
              <span key={wp.walkerIds[i]} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 font-semibold">{name}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-gray-400">{pickedCount}/{dogIds.length} dogs</span>
            <span className="text-[10px] text-gray-300">{expanded ? '\u25B2' : '\u25BC'}</span>
          </div>
        </button>
        {lockInfo?.locked_by_name && (
          <p className="text-[10px] text-gray-400 px-3 pb-1">locked by {lockInfo.locked_by_name}</p>
        )}
        {expanded && (
          <div className="px-3 pb-2.5 flex flex-col gap-1">
            {dogIds.map((id, idx) => {
              const ev = em.get(id)
              if (!ev) return null
              const dogPk = ev.dog?.id ? pk[ev.dog.id] : null
              const timeStr = dogPk?.time ? new Date(dogPk.time).toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' }) : null
              return (
                <div key={id} className={`flex items-center gap-2 text-[11px] py-1 ${dogPk ? 'opacity-50' : ''}`}>
                  <span className="text-gray-400 w-4 text-center">{idx + 1}</span>
                  <DogPhoto dog={ev.dog} displayName={ev.displayName} size={20} />
                  <span className={`flex-1 truncate ${dogPk ? 'line-through text-gray-400' : 'text-gray-700'}`}>{ev.displayName}</span>
                  {timeStr && <span className="text-emerald-600 text-[10px]">{timeStr}</span>}
                  {ev.dog?.address && (
                    <span className="text-[10px] text-[#185FA5] truncate max-w-[100px] cursor-pointer" onClick={() => onDogClick(ev)}>
                      {ev.dog.address.split(',')[0]} &#8250;
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Render a single group (locked or unlocked) ──────────────────
  function renderSingleGroup(num) {
    const isGroupLocked = !!groupLocks[num]
    const lockInfo = groupLocks[num]
    const dogIds = (groups[num] || []).map(String)
    const isDone = doneGroupNums.has(num)
    const gName = groupNames[num] || `Group ${num}`
    const { color, accent } = groupColor(num)
    const wp = walkerProps(num)
    const wIds = walkerAssignments[num] || []
    const isOwn = wIds.includes(user?.id) || wIds.length === 0
    const isOtherLocked = isGroupLocked && !isOwn

    // Other walker's locked group — collapsed with tap-to-expand
    if (isOtherLocked) {
      return <CollapsedLockedGroup key={num} num={num} gName={gName} lockInfo={lockInfo} dogIds={dogIds} eventsMap={eventsMap} wp={wp} pickups={pickups} onDogClick={(ev) => enrichDogClick(ev, num)} />
    }

    if (isGroupLocked) {
      const total = dogIds.length
      const pickedCount = dogIds.filter(id => { const ev = eventsMap.get(id); return ev?.dog?.id && pickups[ev.dog.id] }).length
      const allPickedUp = total > 0 && pickedCount === total
      let elapsed = null
      if (allPickedUp || isDone) {
        const times = dogIds.map(id => { const ev = eventsMap.get(id); return ev?.dog?.id && pickups[ev.dog.id]?.time ? new Date(pickups[ev.dog.id].time).getTime() : null }).filter(Boolean)
        if (times.length > 0) elapsed = Math.round((Math.max(...times) - Math.min(...times)) / 60000)
      }
      if (allPickedUp || isDone) {
        return (
          <div key={num} className="rounded-[14px] border border-gray-200 px-4 py-3 flex items-center justify-between" style={{ opacity: 0.45 }}>
            <span className="text-[12px] font-medium text-emerald-600">&#10003; {gName} &middot; {elapsed || 0} min</span>
            <span className="text-[10px] text-gray-400">{total} dogs</span>
          </div>
        )
      }
      return (
        <SwipeableGroup key={num} groupNum={num} onDone={markGroupDone}>
          <div className={`rounded-[14px] border-2 border-solid p-2.5 ${accent} ${color}`}>
            <div className="flex items-center justify-between mb-1 px-1">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[13px] font-medium text-gray-700">{gName}</span>
                {wp.walkerNames?.map((name, i) => (
                  <span key={wp.walkerIds[i]} className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                    wp.walkerIds[i] === user?.id ? 'bg-[#E8634A]/15 text-[#E8634A]' : 'bg-gray-200 text-gray-600'
                  }`}>{name}</span>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-gray-400">{pickedCount}/{total}</span>
                <button onClick={() => unlockGroup(num)} className="text-sm active:scale-90 transition-transform">&#128275;</button>
              </div>
            </div>
            {lockInfo?.locked_by_name && <p className="text-[10px] text-gray-400 px-1 mb-2">locked by {lockInfo.locked_by_name}</p>}
            {groupNums.filter(n => groupLocks[n]).indexOf(num) === 0 && (
              <p className="text-center text-[10px] text-gray-300 py-0.5 mb-1">&#8592; swipe = picked up | swipe &#8594; = note</p>
            )}
            <div className="flex flex-col gap-1.5">
              {dogIds.map((id, idx) => {
                const ev = eventsMap.get(id)
                if (!ev) return null
                const dogPickup = ev.dog?.id ? pickups[ev.dog.id] : null
                return (
                  <SwipeableDogRow key={id} ev={ev} pickupTime={dogPickup?.time}
                    onPickup={(ev) => markPickup(ev.dog?.id, ev.displayName)}
                    onNoteSwipe={(ev) => setSwipeNoteDog({ _id: ev._id, displayName: ev.displayName, dog_name: ev.dog?.dog_name, dogId: ev.dog?.id || null, photo_url: ev.dog?.photo_url || null, groupNum: num })}
                    onDogClick={(ev) => enrichDogClick(ev, num)} owlDogIdSet={owlDogIdSet} owlDogNotesMap={owlDogNotesMap} routeNum={idx + 1}
                  />
                )
              })}
            </div>
          </div>
        </SwipeableGroup>
      )
    }

    // Unlocked
    return (
      <div key={num} className="relative" style={!isOwn && wIds.length > 0 ? { opacity: 0.7 } : undefined}>
        {isDone && (
          <div className="absolute inset-0 bg-white/60 rounded-2xl z-20 flex items-center justify-center gap-3">
            <span className="text-emerald-600 font-bold text-sm">&#10003; Done</span>
            <button onClick={() => undoGroupDone(num)} className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-semibold active:bg-gray-50 shadow-sm">Undo</button>
          </div>
        )}
        <div className={isDone ? 'opacity-40 pointer-events-none' : ''}>
          <MobileGroup
            groupKey={String(num)} eventIds={groups[num] || []} eventsMap={eventsMap}
            onDogClick={(ev) => enrichDogClick(ev, num)} selectedId={selectedId} onDogTap={handleDogTap}
            selectedDogName={selectedDogName} groupName={groupNames[num] || null}
            onRename={(name) => renameGroup(num, name)}
            isTarget={selectedId !== null && selectedGroup !== num && !groupLocks[num]}
            onTargetTap={() => handleGroupTap(num)} onReorder={handleReorder}
            owlDogIdSet={owlDogIdSet} owlDogNotesMap={owlDogNotesMap} isLocked={false}
            conflictDogIds={conflictDogIds} hasConflict={conflictGroupNums.has(num)}
            altAddressDogIds={altAddressDogIds}
            onLockGroup={() => { if (dogIds.length > 0) lockGroup(num) }}
            lockInfo={lockInfo} allGroups={groups}
            {...wp}
          />
        </div>
      </div>
    )
  }

  // ── Dog chip wrapper with long-hold gesture ──────────────────────
  function DogChipWithGestures({ ev, id, groupKey }) {
    return (
      <div
        onTouchStart={(e) => handleTouchStartOnChip(e, ev)}
        onTouchMove={handleTouchMoveOnChip}
        onTouchEnd={handleTouchEndOnChip}
      >
        <DogChip
          event={ev}
          onInfoClick={(ev) => enrichDogClick(ev, groupKey)}
          onTap={handleDogTap}
          isSelected={selectedId === id}
          hasOwlNote={ev.dog?.id && owlDogIdSet?.has(ev.dog.id)}
          owlNote={ev.dog?.id ? owlDogNotesMap?.get(ev.dog.id) : null}
          hasConflict={conflictDogIds?.has(id)}
          hasAltAddress={ev.dog?.id && altAddressDogIds?.has(ev.dog.id)}
          showHandle={false}
        />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3" onClick={handleBackgroundTap}>
      {sosBanner}

      {/* Unassigned pool */}
      {(groups.unassigned || []).length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-1">&#10003; All dogs assigned</p>
      ) : (
        <>
          {anyGroupLocked && (groups.unassigned || []).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 font-medium">
              {(groups.unassigned || []).length} dog{(groups.unassigned || []).length > 1 ? 's' : ''} still unassigned
            </div>
          )}
          <MobileGroup
            groupKey="unassigned"
            eventIds={groups.unassigned || []}
            eventsMap={eventsMap}
            onDogClick={(ev) => enrichDogClick(ev, 'unassigned')}
            selectedId={selectedId}
            onDogTap={handleDogTap}
            selectedDogName={selectedDogName}
            groupName={null}
            onRename={null}
            isTarget={selectedId !== null && selectedGroup !== 'unassigned'}
            onTargetTap={() => handleGroupTap('unassigned')}
            onReorder={handleReorder}
            owlDogIdSet={owlDogIdSet}
            owlDogNotesMap={owlDogNotesMap}
            altAddressDogIds={altAddressDogIds}
            isLocked={false}
            conflictDogIds={conflictDogIds}
            hasConflict={false}
          />
        </>
      )}

      {/* ── Progress bar (when any locked groups with current walker) ─── */}
      {(() => {
        const myLockedNums = groupNums.filter(n => groupLocks[n] && ((walkerAssignments[n] || []).includes(user?.id) || (walkerAssignments[n] || []).length === 0))
        if (myLockedNums.length < 2) return null

        // Compute pickup info for progress dots
        const progressInfo = {}
        for (const num of myLockedNums) {
          const ids = (groups[num] || []).map(String)
          const total = ids.length
          const pickedCount = ids.filter(id => { const ev = eventsMap.get(id); return ev?.dog?.id && pickups[ev.dog.id] }).length
          progressInfo[num] = { allDone: total > 0 && pickedCount === total }
        }

        return (
          <div className="flex items-center justify-center gap-1 py-2">
            {myLockedNums.map((num, idx) => {
              const isDone = progressInfo[num]?.allDone || doneGroupNums.has(num)
              const isCurrent = !isDone && (idx === 0 || myLockedNums.slice(0, idx).every(n => progressInfo[n]?.allDone || doneGroupNums.has(n)))
              return (
                <React.Fragment key={num}>
                  {idx > 0 && <div className={`h-[3px] w-6 rounded-full ${isDone || isCurrent ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isDone ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-[#E8634A] text-white' : 'bg-gray-200 text-gray-500'
                  }`}>{isDone ? '\u2713' : num}</div>
                </React.Fragment>
              )
            })}
          </div>
        )
      })()}

      {/* ── Groups — each renders based on its own lock state ─── */}
      {(() => {
        const renderedNums = new Set()
        return groupNums.filter(num => num <= 3 || (groups[num] || []).length > 0 || selectedId !== null).map((num) => {
        if (renderedNums.has(num)) return null
        // Check if this group is linked to another
        const groupKey = `${date}_${sector}_${num}`
        const link = groupLinks.find(l => l.group_a_key === groupKey || l.group_b_key === groupKey)
        const partnerNum = link ? Number((link.group_a_key === groupKey ? link.group_b_key : link.group_a_key).split('_').pop()) : null
        const isGroupA = link ? link.group_a_key === groupKey : false
        const syncPos = link?.sync_position ?? null

        // If linked to a partner, render them together
        if (partnerNum && !renderedNums.has(partnerNum)) {
          renderedNums.add(num)
          renderedNums.add(partnerNum)
          const groupA = isGroupA ? num : partnerNum
          const groupB = isGroupA ? partnerNum : num

          const renderGroupCard = (n) => renderSingleGroup(n)
          const offsetPx = syncPos ? syncPos * 52 : 0 // ~52px per dog row including gap

          if (!syncPos) {
            // Side by side
            return (
              <div key={`link-${num}-${partnerNum}`} className="flex gap-0 items-stretch">
                <div className="flex-1 min-w-0" style={{ borderRadius: '14px 0 0 14px', overflow: 'hidden' }}>
                  {renderGroupCard(groupA)}
                </div>
                <div className="w-[3px] flex-shrink-0 my-5" style={{ backgroundColor: '#185FA5' }} />
                <div className="flex-1 min-w-0" style={{ borderRadius: '0 14px 14px 0', overflow: 'hidden' }}>
                  {renderGroupCard(groupB)}
                </div>
              </div>
            )
          } else {
            // Staggered — on mobile, vertical with connector
            return (
              <div key={`link-${num}-${partnerNum}`} className="flex gap-0 items-start">
                <div className="flex-1 min-w-0">
                  {renderGroupCard(groupA)}
                </div>
                <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: '#185FA5', marginTop: offsetPx, height: Math.max(80, 200 - offsetPx) }} />
                <div className="flex-1 min-w-0" style={{ marginTop: offsetPx }}>
                  {renderGroupCard(groupB)}
                </div>
              </div>
            )
          }
        }

        // Render a single group (used both standalone and in linked pairs)
        return renderSingleGroup(num)
      })
      })()}

      {/* ── End of day celebration ── */}
      {(() => {
        const myLockedNums = groupNums.filter(n => groupLocks[n] && ((walkerAssignments[n] || []).includes(user?.id) || (walkerAssignments[n] || []).length === 0))
        if (myLockedNums.length === 0) return null
        const allDone = myLockedNums.every(n => {
          const ids = (groups[n] || []).map(String)
          return ids.length > 0 && ids.every(id => { const ev = eventsMap.get(id); return ev?.dog?.id && pickups[ev.dog.id] }) || doneGroupNums.has(n)
        })
        if (!allDone) return null
        const totalDogs = myLockedNums.reduce((s, n) => s + (groups[n] || []).length, 0)
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-4xl">&#128062; &#128062; &#128062;</p>
            <p className="text-lg font-bold text-gray-800">All walks done!</p>
            <p className="text-[13px] text-gray-500">{myLockedNums.length} group{myLockedNums.length > 1 ? 's' : ''} &middot; {totalDogs} dog{totalDogs > 1 ? 's' : ''}</p>
            <div className="bg-gray-50 rounded-[14px] px-6 py-4 text-center mt-2">
              <p className="text-[13px] text-gray-400">See you tomorrow!</p>
            </div>
          </div>
        )
      })()}

      {canEdit && (
        <button
          onClick={() => { setPendingMoveDog(null); setCreationSheetOpen(true) }}
          className="flex items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[#E8634A]/40 py-3 text-[13px] font-semibold text-[#E8634A] active:bg-[#E8634A]/5 transition-colors min-h-[48px]"
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

      {/* Long-press popup menu (Gesture 2) */}
      <AnimatePresence>
        {longPressMenu && (
          <LongPressMenu
            position={{ x: longPressMenu.x, y: longPressMenu.y }}
            dogName={longPressMenu.dogName}
            groupNums={groupNums}
            groupNames={groupNames}
            groups={groups}
            eventsMap={eventsMap}
            currentGroup={longPressMenu.fromGroup}
            onMove={handleLongPressMove}
            onNewGroup={handleLongPressNewGroup}
            onClose={() => setLongPressMenu(null)}
          />
        )}
      </AnimatePresence>

      {/* Group creation sheet */}
      <AnimatePresence>
        {creationSheetOpen && (
          <GroupCreationSheet
            open={creationSheetOpen}
            onClose={() => { setCreationSheetOpen(false); setPendingMoveDog(null) }}
            onCreate={handleCreateGroup}
            availableWalkers={availableWalkers}
            nextGroupNum={Math.max(...groupNums, 0) + 1}
          />
        )}
      </AnimatePresence>

      {/* Quick note from swipe-right */}
      <AnimatePresence>
        {swipeNoteDog && (
          <QuickNoteSheet
            open={!!swipeNoteDog}
            onClose={() => setSwipeNoteDog(null)}
            walkingDogs={[]}
            date={date}
            preSelectedDog={swipeNoteDog}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
