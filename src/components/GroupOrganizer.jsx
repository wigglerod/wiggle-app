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
  TouchSensor,
  PointerSensor,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DogCard from './DogCard'
import GroupCreationSheet from './GroupCreationSheet'
import QuickNoteSheet from './QuickNoteSheet'
import { usePickups } from '../lib/usePickups'
import { useWalkGroups } from '../lib/useWalkGroups'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useAltAddressDogIds } from '../lib/useAltAddress'

// ── Color palettes ────────────────────────────────────────────────
const groupColors = [
  { border: '#85B7EB', bg: '#f5f9fd' },
  { border: '#5DCAA5', bg: '#f2faf6' },
  { border: '#AFA9EC', bg: '#f6f5fe' },
  { border: '#FAC775', bg: '#fffcf5' },
  { border: '#ED93B1', bg: '#fbeaf0' },
]

const badgeColors = [
  { bg: '#EEEDFE', text: '#534AB7' },
  { bg: '#E1F5EE', text: '#0F6E56' },
  { bg: '#FAECE7', text: '#993C1D' },
  { bg: '#E6F1FB', text: '#185FA5' },
  { bg: '#FAEEDA', text: '#854F0B' },
]

function nameToColor(name) {
  const colors = ['#7F77DD','#378ADD','#BA7517','#1D9E75','#D85A30','#5DCAA5','#534AB7','#993C1D']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function walkerBadgeColor(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return badgeColors[Math.abs(hash) % badgeColors.length]
}

// ── Done groups persistence ───────────────────────────────────────
function getDoneKey(date, sector) { return `doneGroups_${date}_${sector}` }
function getDoneGroups(date, sector) {
  try {
    const raw = localStorage.getItem(getDoneKey(date, sector))
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}
function setDoneGroupsStorage(date, sector, doneSet) {
  localStorage.setItem(getDoneKey(date, sector), JSON.stringify([...doneSet]))
}

// ── Hold-to-lock button ───────────────────────────────────────────
function LockButton({ isLocked, onToggle }) {
  const timer = useRef(null)
  const [filling, setFilling] = useState(false)

  function handlePointerDown() {
    setFilling(true)
    timer.current = setTimeout(() => {
      setFilling(false)
      try { navigator.vibrate?.(20) } catch {}
      onToggle()
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
      onTouchStart={handlePointerDown}
      onTouchEnd={handlePointerUp}
      onTouchCancel={handlePointerUp}
      className="relative w-11 h-11 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 text-sm overflow-hidden flex-shrink-0 active:bg-gray-200"
      title="Hold 1s to toggle lock"
    >
      {filling && <span className="absolute inset-0 bg-[#E8634A] origin-left animate-lock-fill" />}
      <span className="relative z-10 text-[18px]">{isLocked ? '\u{1F513}' : '\u{1F512}'}</span>
    </button>
  )
}

// ── Sortable DogCard wrapper ──────────────────────────────────────
function SortableDogCardWrapper({ id, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {/* Wrap children, passing drag handle ref */}
      <div ref={setActivatorNodeRef} {...listeners} {...attributes}>
        {children}
      </div>
    </div>
  )
}

// ── Long-press popup menu ─────────────────────────────────────────
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
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 w-56 overflow-hidden z-[60]"
      >
        <p className="px-4 py-1.5 text-[10px] font-semibold text-[#888] uppercase tracking-wide">Move to...</p>

        {/* Unassigned */}
        <button
          onClick={() => onMove('unassigned')}
          disabled={currentGroup === 'unassigned'}
          className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] flex items-center gap-2
            ${currentGroup === 'unassigned' ? 'text-gray-300' : 'text-gray-700 active:bg-[#FFF4F1]'}`}
        >
          <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
          Unassigned
        </button>

        {groupNums.map((num) => {
          const color = groupColors[(num - 1) % groupColors.length]
          const dogNames = getDogNames(num)
          return (
            <button
              key={num}
              onClick={() => onMove(num)}
              disabled={currentGroup === num}
              className={`w-full text-left px-4 py-2.5 transition-colors min-h-[44px] flex flex-col
                ${currentGroup === num ? 'text-gray-300' : 'text-gray-700 active:bg-[#FFF4F1]'}`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color.border }} />
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
            onClick={onNewGroup}
            className="w-full text-left px-4 py-2.5 text-sm font-medium text-[#E8634A]/60 active:bg-[#FFF4F1] min-h-[44px] flex items-center gap-2"
          >
            <span className="w-5 h-5 rounded-full bg-[#E8634A]/10 text-[#E8634A] flex items-center justify-center text-xs font-bold">+</span>
            New group
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════
//   MAIN EXPORT
// ══════════════════════════════════════════════════════════════════
export default function GroupOrganizer({ events, date, sector, onDogClick, owlDogNotes = [], onAnyGroupLocked }) {
  const { user, profile, permissions } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const {
    groups, groupNums, groupNames, walkerAssignments, groupLinks, groupLocks,
    moveEvent, addGroup, renameGroup, reorderGroup,
    addWalker, removeWalker, setWalkers, linkGroups, unlinkGroups,
    loaded, lastSaved, lockGroup, unlockGroup,
  } = useWalkGroups(events, date, sector)

  const anyGroupLocked = Object.keys(groupLocks).length > 0
  useEffect(() => { onAnyGroupLocked?.(anyGroupLocked) }, [anyGroupLocked, onAnyGroupLocked])

  // Pickup + return tracking
  const { pickups, markPickup, markReturned, undoPickup, undoReturned, markNotWalking, undoNotWalking } = usePickups(date)

  // Quick note sheet
  const [swipeNoteDog, setSwipeNoteDog] = useState(null)
  const [swipeNoteGroupName, setSwipeNoteGroupName] = useState(null)

  // Walker name and profile lookup
  const [walkerNameMap, setWalkerNameMap] = useState({})
  const [allWalkers, setAllWalkers] = useState([])

  useEffect(() => {
    if (!sector) return
    async function fetchWalkers() {
      // Fetch walkers for current sector:
      //   • All profiles whose sector matches the current sector
      //   • PLUS profiles with sector = 'both' whose full_name starts with 'Rodrigo'
      //   • Exclude null names and known non-walking accounts
      //   • Deduplicate by full_name (Rodrigo has two accounts)
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, sector, schedule')
        .in('role', ['senior_walker', 'admin'])
        .or(`sector.eq.${sector},sector.eq.both`)
        .not('full_name', 'is', null)
        .not('email', 'eq', 'test@wiggledogwalks.com')
        .not('email', 'ilike', 'pupwalker%')
        .order('full_name')
      if (data) {
        // Deduplicate by full_name — keep first occurrence (already ordered)
        const seen = new Set()
        const deduped = data.filter(w => {
          if (seen.has(w.full_name)) return false
          seen.add(w.full_name)
          return true
        })
        setAllWalkers(deduped)
        const map = {}
        for (const w of deduped) map[w.id] = w.full_name
        setWalkerNameMap(map)
      }
    }
    fetchWalkers()
  }, [sector])

  // Done groups state
  const [doneGroupNums, setDoneGroupNums] = useState(new Set())
  useEffect(() => {
    if (date && sector) setDoneGroupNums(getDoneGroups(date, sector))
  }, [date, sector])

  const markGroupDone = useCallback((num) => {
    setDoneGroupNums(prev => {
      const next = new Set([...prev, num])
      setDoneGroupsStorage(date, sector, next)
      return next
    })
  }, [date, sector])

  // Conflict detection
  const [conflicts, setConflicts] = useState([])
  const [dismissedConflictKeys, setDismissedConflictKeys] = useState(new Set())
  useEffect(() => {
    supabase.from('dog_conflicts').select('*').then(({ data }) => { if (data) setConflicts(data) })
  }, [])

  // Key by dog UUID (matches useWalkGroups allEventIds). Fallback to _id.
  const eventsMap = useMemo(() => {
    const m = new Map()
    for (const ev of events) {
      const key = ev.dog?.id || String(ev._id)
      m.set(key, ev)
    }
    return m
  }, [events])

  // Alt address dog IDs
  const allDogIds = useMemo(() => events.map(ev => ev.dog?.id).filter(Boolean), [events])
  const altAddressDogIds = useAltAddressDogIds(allDogIds)

  // Owl note maps
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

  // Active conflicts
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
              result.push({ dog1Name: ev1.displayName, dog2Name: ev2.displayName, dog1Id: dogIds[i], dog2Id: dogIds[j], reason: c.reason, groupNum: num })
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

  // ── Tap-to-assign ──────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState(null)

  // ── Long-press popup ───────────────────────────────────────────
  const [longPressMenu, setLongPressMenu] = useState(null)
  const holdTimer = useRef(null)
  const touchStartY = useRef(0)
  const isScrolling = useRef(false)

  // ── Group creation sheet ───────────────────────────────────────
  const [creationSheetOpen, setCreationSheetOpen] = useState(false)
  const [pendingMoveDog, setPendingMoveDog] = useState(null)

  // ── Link picker ─────────────────────────────────────────────────
  const [linkPickerNum, setLinkPickerNum] = useState(null) // group num being linked

  // ── Merged Interlock / Walker Picker State ──────────────────────
  const [confirmUnlinkId, setConfirmUnlinkId] = useState(null)
  const [walkerPickerNum, setWalkerPickerNum] = useState(null)
  const [walkerPickerSlotIndex, setWalkerPickerSlotIndex] = useState(null)

  function findGroup(id) {
    const strId = String(id)
    if ((groups.unassigned || []).includes(strId)) return 'unassigned'
    for (const n of groupNums) {
      if ((groups[n] || []).includes(strId)) return n
    }
    return null
  }

  function eventKey(ev) { return ev.dog?.id || String(ev._id) }

  function handleDogTap(event) {
    const id = eventKey(event)
    const dogGroup = findGroup(id)
    if (dogGroup !== 'unassigned' && dogGroup !== null && groupLocks[dogGroup]) return
    setSelectedId(prev => (prev === id ? null : id))
    setLongPressMenu(null)
  }

  function handleGroupTap(targetGroup) {
    if (targetGroup !== 'unassigned' && groupLocks[targetGroup]) return
    if (!selectedId) return
    const fromGroup = findGroup(selectedId)
    if (fromGroup === null || fromGroup === targetGroup) { setSelectedId(null); return }
    const dogId = selectedId
    const ev = eventsMap.get(dogId)
    const targetName = targetGroup === 'unassigned' ? 'Unassigned' : (groupNames[targetGroup] || `Group ${targetGroup}`)
    moveEvent(dogId, fromGroup, targetGroup)
    setSelectedId(null)
    try { navigator.vibrate?.(20) } catch {}
    toast(`Moved ${ev?.displayName || 'dog'} to ${targetName}`, {
      action: {
        label: 'Undo',
        onClick: () => moveEvent(dogId, targetGroup, fromGroup),
      },
      duration: 3000,
    })
  }

  // Long-hold gesture on a card
  function handleTouchStartOnCard(e, ev) {
    touchStartY.current = e.touches[0].clientY
    isScrolling.current = false
    const rect = e.currentTarget.getBoundingClientRect()
    holdTimer.current = setTimeout(() => {
      if (!isScrolling.current) {
        try { navigator.vibrate?.(10) } catch {}
        setSelectedId(null)
        setLongPressMenu({
          dogId: eventKey(ev), dogName: ev.displayName,
          fromGroup: findGroup(eventKey(ev)),
          x: Math.min(rect.left + rect.width / 2, window.innerWidth - 120),
          y: rect.bottom + 4,
        })
      }
    }, 500)
  }

  function handleTouchMoveOnCard(e) {
    if (Math.abs(e.touches[0].clientY - touchStartY.current) > 10) {
      isScrolling.current = true
      clearTimeout(holdTimer.current)
    }
  }

  function handleTouchEndOnCard() { clearTimeout(holdTimer.current) }

  function handleLongPressMove(targetGroup) {
    if (!longPressMenu) return
    const { dogId, fromGroup } = longPressMenu
    if (fromGroup !== targetGroup) {
      const ev = eventsMap.get(dogId)
      const targetName = targetGroup === 'unassigned' ? 'Unassigned' : (groupNames[targetGroup] || `Group ${targetGroup}`)
      moveEvent(dogId, fromGroup, targetGroup)
      try { navigator.vibrate?.(20) } catch {}
      toast(`Moved ${ev?.displayName || 'dog'} to ${targetName}`, {
        action: {
          label: 'Undo',
          onClick: () => moveEvent(dogId, targetGroup, fromGroup),
        },
        duration: 3000,
      })
    }
    setLongPressMenu(null)
  }

  function handleLongPressNewGroup() {
    if (!longPressMenu) return
    setPendingMoveDog({ dogId: longPressMenu.dogId, fromGroup: longPressMenu.fromGroup })
    setLongPressMenu(null)
    setCreationSheetOpen(true)
  }

  function handleCreateGroup({ name, walkerIds }) {
    const newNum = addGroup(name, walkerIds)
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

  function handleCycleSlot(groupNum, slotIndex) {
    const currentWIds = walkerAssignments[groupNum] || []
    const filtered = getSortedWalkers(allWalkers, sector, date)
    const otherSlot = slotIndex === 0 ? 1 : 0
    const otherWId = currentWIds[otherSlot] || null
    const sortedIds = filtered.map(w => w.id).filter(id => id !== otherWId)
    const currentId = currentWIds[slotIndex] || null

    // Find next walker in cycle: empty → first → second → ... → last → empty
    let nextId = null
    if (currentId === null) {
      nextId = sortedIds[0] || null
    } else {
      const idx = sortedIds.indexOf(currentId)
      if (idx === -1 || idx === sortedIds.length - 1) {
        nextId = null // cycle back to empty
      } else {
        nextId = sortedIds[idx + 1]
      }
    }

    // Build new walker list: [slot0, slot1]
    const newIds = [...currentWIds]
    while (newIds.length < 2) newIds.push(null)
    newIds[slotIndex] = nextId

    // If both slots are null, clear; otherwise filter nulls from end
    const finalIds = newIds.filter(Boolean)
    setWalkers(groupNum, finalIds)
  }

  function handleBackgroundTap(e) {
    if (e.target === e.currentTarget) setSelectedId(null)
  }

  const handleReorder = useCallback((groupNum, newOrderedIds) => {
    reorderGroup?.(groupNum, newOrderedIds)
  }, [reorderGroup])

  // ── Build Google Maps route URL ──────────────────────────────
  function buildRouteUrl(dogIds) {
    const addresses = []
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    for (const id of dogIds) {
      const ev = eventsMap.get(String(id))
      if (!ev?.dog?.address) continue
      // TODO: check alt addresses from a batch fetch
      const addr = ev.dog.address
      if (addr) addresses.push(addr)
    }
    if (addresses.length === 0) return null
    return 'https://www.google.com/maps/dir/' + addresses.map(a => encodeURIComponent(a)).join('/') + '/'
  }

  // ── Loading state ──────────────────────────────────────────────
  if (!loaded) {
    return <div className="flex justify-center py-8"><LoadingDog /></div>
  }

  const selectedGroup = selectedId ? findGroup(selectedId) : null
  const selectedDogName = selectedId ? eventsMap.get(selectedId)?.displayName : null

  function enrichDogClick(ev, groupKey, dogPickup = null, dogId = null, walkDate = null) {
    const gName = groupKey === 'unassigned' ? 'Unassigned' : (groupNames[groupKey] || `Group ${groupKey}`)
    const dogName = ev.displayName || ev.dog?.dog_name || 'Dog'
    const walkInfo = dogId ? {
      dogId,
      walkDate: walkDate || date,
      pickedUpAt: dogPickup?.pickedUpAt || null,
      returnedAt: dogPickup?.returnedAt || null,
      notWalking: dogPickup?.notWalking || false,
      groupNum: groupKey,
      markPickup: () => markPickup(dogId, dogName),
      markReturned: () => markReturned(dogId, dogName),
      undoPickup: () => undoPickup(dogId),
      undoReturned: () => undoReturned(dogId),
      markNotWalking: () => markNotWalking(dogId, dogName, groupKey),
      undoNotWalking: () => undoNotWalking(dogId),
    } : null
    onDogClick({ ...ev, _groupKey: groupKey, _groupName: gName, _walkInfo: walkInfo })
  }

  // Format a timestamp in Toronto time
  function formatWalkTime(time) {
    if (!time) return null
    return new Date(time).toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' })
  }
  // ── Render a DogCard for an event ──────────────────────────────
  function renderDogCard(ev, id, groupNum, idx, isLocked, isCurrent = false, isCompact = false, interlockOwner = null) {
    const dog = ev.dog || {}
    const dogId = dog.id
    const dogPickup = dogId ? pickups[dogId] : null
    const isPickedUp = !!dogPickup?.pickedUpAt
    const isReturned = !!dogPickup?.returnedAt
    const isNotWalking = !!dogPickup?.notWalking
    const owlNote = dogId ? owlDogNotesMap.get(dogId) : null
    const hasAlt = dogId && altAddressDogIds.has(dogId)
    const gName = groupNames[groupNum] || `Group ${groupNum}`

    return (
      <div
        onTouchStart={(e) => !isLocked && !isCompact && handleTouchStartOnCard(e, ev)}
        onTouchMove={!isLocked && !isCompact ? handleTouchMoveOnCard : undefined}
        onTouchEnd={!isLocked && !isCompact ? handleTouchEndOnCard : undefined}
      >
        <DogCard
          dog={{ id: dogId, dog_name: ev.displayName, photo_url: dog.photo_url, address: dog.address, door_code: dog.door_code, level: dog.level, notes: dog.notes }}
          routeNumber={idx + 1}
          owlNote={owlNote}
          altAddress={hasAlt ? true : null}
          isLocked={isLocked}
          isPickedUp={isPickedUp}
          isReturned={isReturned}
          isNotWalking={isNotWalking}
          isCurrent={isCurrent}
          isCompact={isCompact}
          interlockOwner={interlockOwner}
          pickupTime={formatWalkTime(dogPickup?.pickedUpAt)}
          returnedTime={formatWalkTime(dogPickup?.returnedAt)}
          onSwipeLeft={!isPickedUp ? () => markPickup(dogId, ev.displayName) : undefined}
          onSwipeLeftSecond={isPickedUp && !isReturned ? () => markReturned(dogId, ev.displayName) : undefined}
          onSwipeRight={() => {
            setSwipeNoteDog({ id: dogId, dog_name: dog.dog_name || ev.displayName, photo_url: dog.photo_url })
            setSwipeNoteGroupName(gName)
          }}
          onTapName={() => enrichDogClick(ev, groupNum, dogPickup, dogId, date)}
          onTapAddress={() => enrichDogClick(ev, groupNum)}
          showDragHandle={!isLocked && !isCompact}
        />
      </div>
    )
  }

  // ── SOS conflict banner ────────────────────────────────────────
  const sosBanner = visibleConflicts.length > 0 && (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      <motion.div initial={{ y: -100 }} animate={{ y: 0 }} className="bg-red-600 text-white px-4 py-3 shadow-2xl sos-banner-pulse">
        {visibleConflicts.map(c => {
          const key = [c.dog1Id, c.dog2Id].sort().join('-')
          return (
            <div key={key} className="flex flex-col gap-1 mb-2 last:mb-0">
              <p className="text-sm font-bold">CONFLICT: {c.dog1Name} and {c.dog2Name} cannot be in the same group!</p>
              {c.reason && <p className="text-xs opacity-80">{c.reason}</p>}
              <div className="flex gap-2 mt-1">
                <button onClick={() => {
                  const groupDogs = (groups[c.groupNum] || []).map(String)
                  const idx1 = groupDogs.indexOf(c.dog1Id)
                  const idx2 = groupDogs.indexOf(c.dog2Id)
                  const dogToMove = idx2 > idx1 ? c.dog2Id : c.dog1Id
                  moveEvent(dogToMove, c.groupNum, 'unassigned')
                }} className="px-3 py-1.5 rounded-full bg-white text-red-600 text-xs font-bold">Fix it</button>
                <button onClick={() => setDismissedConflictKeys(prev => new Set([...prev, key]))} className="px-3 py-1.5 rounded-full bg-red-700 text-white text-xs font-bold">Dismiss</button>
              </div>
            </div>
          )
        })}
      </motion.div>
    </div>
  )

  // ── Render a group card ────────────────────────────────────────
  function renderGroup(num, groupIndex, isCompactMode = false) {
    const isGroupLocked = !!groupLocks[num]
    const lockInfo = groupLocks[num]
    const dogIds = (groups[num] || []).map(String)
    const isDone = doneGroupNums.has(num)
    const gName = groupNames[num] || `Group ${num}`
    const color = groupColors[groupIndex % groupColors.length]
    const wIds = walkerAssignments[num] || []
    const wNames = wIds.map(id => walkerNameMap[id]).filter(Boolean)
    const isOwn = wIds.includes(user?.id) || wIds.length === 0
    const isOtherLocked = isGroupLocked && !isOwn && !isAdmin
    const isTarget = selectedId !== null && selectedGroup !== num && !isGroupLocked

    // Pickup and return counts
    const pickedCount = dogIds.filter(id => { const ev = eventsMap.get(id); return ev?.dog?.id && pickups[ev.dog.id]?.pickedUpAt }).length
    const returnedCount = dogIds.filter(id => { const ev = eventsMap.get(id); return ev?.dog?.id && pickups[ev.dog.id]?.returnedAt }).length
    const total = dogIds.length

    // Owl note count for group header badge
    const owlCount = dogIds.filter(id => { const ev = eventsMap.get(id); return ev?.dog?.id && owlDogIdSet.has(ev.dog.id) }).length
    const allPickedUp = total > 0 && pickedCount === total
    const allReturned = total > 0 && returnedCount === total

    // ── DONE state (collapsed) — only when ALL dogs returned home ──
    if ((allReturned || isDone) && isGroupLocked) {
      const pickupTimes = dogIds.map(id => { const ev = eventsMap.get(id); const p = ev?.dog?.id && pickups[ev.dog.id]; return p?.pickedUpAt ? new Date(p.pickedUpAt).getTime() : null }).filter(Boolean)
      const returnTimes = dogIds.map(id => { const ev = eventsMap.get(id); const p = ev?.dog?.id && pickups[ev.dog.id]; return p?.returnedAt ? new Date(p.returnedAt).getTime() : null }).filter(Boolean)
      const elapsed = pickupTimes.length > 0 && returnTimes.length > 0 ? Math.round((Math.max(...returnTimes) - Math.min(...pickupTimes)) / 60000) : 0
      return (
        <DoneGroup
          key={num}
          num={num}
          gName={gName}
          elapsed={elapsed}
          dogIds={dogIds}
          eventsMap={eventsMap}
          pickups={pickups}
          onDogClick={(ev) => {
            const dog = ev.dog || {}
            const dogId = dog.id
            const dogPickup = dogId ? pickups[dogId] : null
            enrichDogClick(ev, num, dogPickup, dogId, date)
          }}
        />
      )
    }

    // ── OTHER WALKER'S LOCKED group (collapsed) ────────────────
    if (isOtherLocked) {
      return <CollapsedGroup key={num} num={num} gName={gName} lockInfo={lockInfo} dogIds={dogIds} eventsMap={eventsMap} wNames={wNames} pickups={pickups} onDogClick={(ev) => enrichDogClick(ev, num)} />
    }

    // ── UPCOMING group (not locked, another walker's, walking mode) ──
    if (anyGroupLocked && !isGroupLocked && !isOwn && wIds.length > 0 && !isAdmin) {
      const dogNames = dogIds.slice(0, 6).map(id => eventsMap.get(id)?.displayName).filter(Boolean).join(', ')
      return (
        <div key={num} style={{
          background: '#fff', border: '2px dashed #ddd', borderRadius: 14,
          padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{gName}</span>
            <span style={{ fontSize: 10, color: '#aaa' }}>{'\u00b7'}</span>
            <span style={{ fontSize: 10, color: '#aaa' }}>{total} dogs</span>
            {wNames.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#534AB7', whiteSpace: 'nowrap' }}>
                {wNames.map(n => n.split(' ')[0]).join(' + ')}
              </span>
            )}
          </div>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 6, fontWeight: 600, background: '#f0ece8', color: '#aaa' }}>Up next</span>
        </div>
      )
    }

    // ── NORMAL group (unlocked or own locked) ──────────────────
    const borderStyle = isGroupLocked ? 'solid' : 'dashed'

    return (
      <div
        key={num}
        style={{
          border: `2px ${borderStyle} ${color.border}`,
          borderRadius: 16,
          padding: 10,
          background: color.bg,
          opacity: !isOwn && wIds.length > 0 && !isAdmin ? 0.7 : 1,
          transition: 'all 0.2s',
        }}
        className={isTarget ? 'group-target-pulse' : conflictGroupNums.has(num) ? 'sos-flash' : ''}
      >
        {/* Group header */}
        <GroupHeader
          gName={gName}
          num={num}
          wNames={wNames}
          wIds={wIds}
          allWalkers={allWalkers}
          date={date}
          sector={sector}
          onCycleSlot={(slotIndex) => handleCycleSlot(num, slotIndex)}
          isLocked={isGroupLocked}
          lockInfo={lockInfo}
          dogCount={total}
          pickedCount={pickedCount}
          isTarget={isTarget}
          selectedDogName={selectedDogName}
          onTargetTap={() => handleGroupTap(num)}
          onRename={(name) => !isGroupLocked && renameGroup(num, name)}
          isLinked={!!groupLinks.find(l => l.group_a_key === `${date}_${sector}_${num}` || l.group_b_key === `${date}_${sector}_${num}`)}
          onLinkTap={() => setLinkPickerNum(num)}
          statusBadge={
            isGroupLocked && allReturned ? 'done'
            : isGroupLocked ? 'walking'
            : !isGroupLocked && anyGroupLocked ? 'upnext'
            : null
          }
          owlCount={owlCount}
        />

        {/* Swipe hint bar (first locked group only) */}
        {isGroupLocked && groupNums.filter(n => groupLocks[n]).indexOf(num) === 0 && (
          <SwipeHintBar />
        )}

        {/* Dogs */}
        {isGroupLocked ? (
          // Locked: DogCards with swipe, no DnD
          (() => {
            const firstUnpickedIdx = dogIds.findIndex(id => {
              const ev = eventsMap.get(id)
              // "current" = first dog not yet picked up and not returned
              return ev?.dog?.id && !pickups[ev.dog.id]?.pickedUpAt
            })
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dogIds.map((id, idx) => {
                  const ev = eventsMap.get(id)
                  if (!ev) return null
                  return <div key={id}>{renderDogCard(ev, id, num, idx, true, idx === firstUnpickedIdx, isCompactMode)}</div>
                })}
              </div>
            )
          })()
        ) : (
          // Unlocked: DogCards with DnD reorder
          <GroupDndZone
            dogIds={dogIds}
            eventsMap={eventsMap}
            renderDogCard={(ev, id, idx) => renderDogCard(ev, id, num, idx, false)}
            onReorder={(newOrder) => handleReorder(num, newOrder)}
            isTarget={isTarget}
            selectedDogName={selectedDogName}
            onTargetTap={() => handleGroupTap(num)}
          />
        )}

        {/* Route summary */}
        {dogIds.length > 1 && (
          <p style={{ fontSize: 9, color: '#aaa', padding: '4px 0 0', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Route: {dogIds.map(id => eventsMap.get(id)?.displayName).filter(Boolean).join(' > ')}
          </p>
        )}

        {/* Start Route button (locked only, not all picked up) */}
        {isGroupLocked && !allPickedUp && dogIds.length > 0 && (
          <button
            onClick={() => {
              const url = buildRouteUrl(dogIds)
              if (url) window.open(url, '_blank')
              else toast('No addresses found for this group')
            }}
            style={{ width: '100%', padding: 7, borderRadius: 8, background: 'linear-gradient(180deg, #E8634A 0%, #d4552d 100%)', color: '#fff', border: 'none', borderBottom: '3px solid #b8461f', fontSize: 11, fontWeight: 600, marginTop: 6, cursor: 'pointer', boxShadow: '0 4px 12px rgba(232,99,74,0.35)', textAlign: 'center' }}
            className="active:translate-y-[2px] active:shadow-none"
          >
            {pickedCount === 0 ? 'Start Route' : `Continue route (${total - pickedCount} left)`}
          </button>
        )}
      </div>
    )
  }

  // ── Render merged interlock ──────────────────────────────────────────
  function renderMergedInterlock(groupA, groupB, syncPos, linkId) {
    const aDogs = (groups[groupA] || []).map(String)
    const bDogs = (groups[groupB] || []).map(String)

    // Zipper logic
    const combinedDogs = []
    const maxIdx = Math.max(aDogs.length, bDogs.length + syncPos)
    for (let i = 0; i < maxIdx; i++) {
      if (i < aDogs.length) combinedDogs.push({ type: 'A', dogId: aDogs[i] })
      if (i >= syncPos && (i - syncPos) < bDogs.length) {
        combinedDogs.push({ type: 'B', dogId: bDogs[i - syncPos] })
      }
    }

    const walkerIdsA = walkerAssignments[groupA] || []
    const walkerIdsB = walkerAssignments[groupB] || []
    const nameA = walkerIdsA.map(id => walkerNameMap[id]).filter(Boolean).map(n => n.split(' ')[0]).join(' + ') || 'Walker A'
    const nameB = walkerIdsB.map(id => walkerNameMap[id]).filter(Boolean).map(n => n.split(' ')[0]).join(' + ') || 'Walker B'

    const totalDogs = aDogs.length + bDogs.length
    const isDoneA = doneGroupNums.has(groupA)
    const isDoneB = doneGroupNums.has(groupB)

    return (
      <div key={`merged-${groupA}-${groupB}`} style={{ border: '2.5px solid #AFA9EC', borderRadius: 16, overflow: 'hidden', marginBottom: 10, background: '#FAF7F4' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 8px', background: '#EEEDFE', borderBottom: '1.5px solid #AFA9EC' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D2926' }}>Groups {groupA} + {groupB}</div>
            <div style={{ fontSize: 10, color: '#8C857E', marginTop: 1 }}>Interlocked · {totalDogs} dogs</div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span 
              onClick={() => setConfirmUnlinkId(linkId)}
              style={{ fontSize: 10, color: '#B5AFA8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginRight: 6 }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>&times;</span> Unlink
            </span>
            <button 
              onClick={() => { setWalkerPickerNum(groupA); setWalkerPickerSlotIndex(0) }}
              style={{ fontSize: 9, padding: '3px 8px', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEEDFE', color: '#534AB7', border: '1.5px solid #AFA9EC', cursor: 'pointer' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#AFA9EC' }} />
              {nameA}
            </button>
            <button 
              onClick={() => { setWalkerPickerNum(groupB); setWalkerPickerSlotIndex(0) }}
              style={{ fontSize: 9, padding: '3px 8px', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FAECE7', color: '#E8634A', border: '1.5px solid #E8634A', cursor: 'pointer' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8634A' }} />
              {nameB}
            </button>
          </div>
        </div>

        {confirmUnlinkId === linkId && (
          <div style={{ background: '#fff', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #AFA9EC' }}>
            <span style={{ fontSize: 13, color: '#E8634A', fontWeight: 600 }}>Split into 2 groups?</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => { unlinkGroups(linkId); setConfirmUnlinkId(null) }}
                style={{ padding: '5px 14px', background: '#E8634A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >Yes</button>
              <button 
                onClick={() => setConfirmUnlinkId(null)}
                style={{ padding: '5px 14px', background: '#F0ECE8', color: '#8C857E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >Cancel</button>
            </div>
          </div>
        )}

        <MergedDndZone 
          combinedDogs={combinedDogs} 
          eventsMap={eventsMap} 
          renderDogCard={(ev, id, gNum, idx, type) => renderDogCard(ev, id, gNum, idx, false, false, true, type)}
          onDragEnd={(oldIdx, newIdx) => {
            const draggedItem = combinedDogs[oldIdx]
            const overItem = combinedDogs[newIdx]

            if (draggedItem.type === overItem.type) {
              const groupNum = draggedItem.type === 'A' ? groupA : groupB
              const dogIdsStr = draggedItem.type === 'A' ? aDogs : bDogs
              const dOld = dogIdsStr.indexOf(draggedItem.dogId)
              const dNew = dogIdsStr.indexOf(overItem.dogId)
              const newItems = arrayMove(dogIdsStr, dOld, dNew)
              reorderGroup(groupNum, newItems)
            } else {
              const fromGroupNum = draggedItem.type === 'A' ? groupA : groupB
              const toGroupNum = overItem.type === 'A' ? groupA : groupB
              
              const fromDogIds = draggedItem.type === 'A' ? [...aDogs] : [...bDogs]
              const toDogIds = overItem.type === 'A' ? [...aDogs] : [...bDogs]

              const dOld = fromDogIds.indexOf(draggedItem.dogId)
              if (dOld !== -1) fromDogIds.splice(dOld, 1)

              const dNew = toDogIds.indexOf(overItem.dogId)
              if (dNew !== -1) toDogIds.splice(dNew, 0, draggedItem.dogId)

              reorderGroup(fromGroupNum, fromDogIds)
              reorderGroup(toGroupNum, toDogIds)
            }
          }}
        />

        <div style={{ display: 'flex', gap: 14, padding: '4px 12px 8px', fontSize: 9, color: '#B5AFA8', alignItems: 'center', borderTop: '1px solid #E8E4E0' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 8, borderRadius: 3, flexShrink: 0, background: '#EEEDFE', border: '1px solid #AFA9EC' }} />
            {nameA}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 8, borderRadius: 3, flexShrink: 0, background: '#FAECE7', border: '1px solid #E8634A' }} />
            {nameB}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 8, color: '#D5CFC8' }}>left = {nameA} · right = {nameB}</span>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════
  //   RENDER
  // ══════════════════════════════════════════════════════════════
  // ── Lock all / Unlock all handlers ──────────────────────────
  const unassignedCount = (groups.unassigned || []).length
  const groupsWithDogs = groupNums.filter(n => (groups[n] || []).length > 0)
  const showLockButton = !anyGroupLocked && groupsWithDogs.length > 0

  async function handleLockAll() {
    if (!user) return
    for (const num of groupNums) {
      const dogIds = groups[num] || []
      if (dogIds.length === 0) continue
      lockGroup(num)
    }
  }

  function handleUnlockAll() {
    for (const num of groupNums) {
      if (groupLocks[num]) {
        unlockGroup(num)
      }
    }
  }

  // Who locked? (first lock info found)
  const firstLockInfo = Object.values(groupLocks)[0]
  const lockedByName = firstLockInfo?.locked_by_name || 'Walker'

  return (
    <div className="flex flex-col gap-3" onClick={handleBackgroundTap}>
      {sosBanner}

      {/* Walking mode banner (locked state) */}
      {anyGroupLocked && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#E1F5EE',
          borderRadius: 12,
          border: '1px solid #bbf7d0',
          marginBottom: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{'\u{1F512}'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F6E56' }}>
              Walking mode — locked by {lockedByName}
            </span>
          </div>
          <button onClick={handleUnlockAll} style={{
            fontSize: 11, fontWeight: 600, padding: '4px 12px',
            borderRadius: 8, background: '#fff', color: '#0F6E56',
            border: '1px solid #bbf7d0', cursor: 'pointer',
          }}>
            Unlock
          </button>
        </div>
      )}

      {/* Collapsible map */}
      <CollapsibleMap
        events={events}
        groups={groups}
        groupNums={groupNums}
        groupNames={groupNames}
        eventsMap={eventsMap}
        date={date}
        sector={sector}
        onDogClick={onDogClick}
      />

      {/* Unassigned pool */}
      <UnassignedPool
        eventIds={groups.unassigned || []}
        eventsMap={eventsMap}
        selectedId={selectedId}
        owlDogIdSet={owlDogIdSet}
        onDogTap={handleDogTap}
        onDogClick={(ev) => enrichDogClick(ev, 'unassigned')}
        isTarget={selectedId !== null && selectedGroup !== 'unassigned'}
        onTargetTap={() => handleGroupTap('unassigned')}
        anyGroupLocked={anyGroupLocked}
        onLongHold={(ev, pos) => {
          setSelectedId(null)
          setLongPressMenu({
            dogId: eventKey(ev), dogName: ev.displayName,
            fromGroup: 'unassigned',
            x: Math.min(pos.x, window.innerWidth - 120),
            y: pos.y,
          })
        }}
      />

      {/* Groups (with linked pair support) */}
      {(() => {
        const renderedNums = new Set()
        const visibleNums = groupNums.filter(num => num <= 3 || (groups[num] || []).length > 0 || selectedId !== null)
        return visibleNums.map((num, idx) => {
          if (renderedNums.has(num)) return null
          // Check if linked
          const groupKey = `${date}_${sector}_${num}`
          const link = groupLinks.find(l => l.group_a_key === groupKey || l.group_b_key === groupKey)
          const partnerNum = link ? Number((link.group_a_key === groupKey ? link.group_b_key : link.group_a_key).split('_').pop()) : null

          if (partnerNum && visibleNums.includes(partnerNum) && !renderedNums.has(partnerNum)) {
            renderedNums.add(num)
            renderedNums.add(partnerNum)
            const isGroupA = link.group_a_key === groupKey
            const groupA = isGroupA ? num : partnerNum
            const groupB = isGroupA ? partnerNum : num
            const syncPos = link.sync_position ?? 0
            const offsetPx = syncPos > 0 ? syncPos * 45 : 0

            return renderMergedInterlock(groupA, groupB, syncPos, link.id)
          }

          renderedNums.add(num)
          return renderGroup(num, idx)
        })
      })()}

      {/* Lock All Groups button */}
      {showLockButton && (
        <button
          onClick={unassignedCount > 0 ? undefined : handleLockAll}
          style={{
            width: '100%',
            padding: 16,
            borderRadius: 12,
            background: 'linear-gradient(180deg, #E8634A 0%, #d4552d 100%)',
            color: '#fff',
            border: 'none',
            borderBottom: '3px solid #b8461f',
            fontSize: 15,
            fontWeight: 700,
            cursor: unassignedCount > 0 ? 'default' : 'pointer',
            boxShadow: '0 4px 12px rgba(232,99,74,0.35)',
            marginTop: 8,
            marginBottom: 8,
            opacity: unassignedCount > 0 ? 0.4 : 1,
            pointerEvents: unassignedCount > 0 ? 'none' : 'auto',
          }}
        >
          {unassignedCount > 0
            ? `Assign ${unassignedCount} dog${unassignedCount > 1 ? 's' : ''} to lock`
            : '\u{1F512} Lock All Groups \u2014 Start Walking'}
        </button>
      )}

      {/* + Add group button */}
      {!anyGroupLocked && (
        <button
          onClick={() => { setPendingMoveDog(null); setCreationSheetOpen(true) }}
          style={{
            border: '2px dashed rgba(232,99,74,0.25)', borderRadius: 14, padding: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'transparent', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#E8634A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 12, color: '#E8634A', fontWeight: 600 }}>Add group</span>
        </button>
      )}

      {lastSaved && (
        <p style={{ textAlign: 'center', fontSize: 10, color: '#d1cdc8', paddingTop: 8, letterSpacing: '0.02em' }}>
          Last saved {lastSaved.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>
      )}

      {/* Long-press popup */}
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

      {/* Link picker */}
      <AnimatePresence>
        {linkPickerNum !== null && (
          <LinkPicker
            sourceNum={linkPickerNum}
            sourceName={groupNames[linkPickerNum] || `Group ${linkPickerNum}`}
            groupNums={groupNums}
            groupNames={groupNames}
            groupLinks={groupLinks}
            groups={groups}
            eventsMap={eventsMap}
            date={date}
            sector={sector}
            onLink={(targetNum, syncPos) => { linkGroups(linkPickerNum, targetNum, syncPos); setLinkPickerNum(null) }}
            onUnlink={(linkId) => { unlinkGroups(linkId); setLinkPickerNum(null) }}
            onClose={() => setLinkPickerNum(null)}
          />
        )}
      </AnimatePresence>

      {/* Group creation sheet */}
      <AnimatePresence>
        {creationSheetOpen && (
          <GroupCreationSheet
            isOpen={creationSheetOpen}
            onClose={() => { setCreationSheetOpen(false); setPendingMoveDog(null) }}
            onCreateGroup={handleCreateGroup}
            sector={sector}
            walkDate={date}
          />
        )}
      </AnimatePresence>

      {/* Quick note from swipe-right */}
      <AnimatePresence>
        {swipeNoteDog && (
          <QuickNoteSheet
            isOpen={!!swipeNoteDog}
            onClose={() => setSwipeNoteDog(null)}
            dog={swipeNoteDog}
            groupName={swipeNoteGroupName}
            walkDate={date}
            walkerId={user?.id}
            walkerName={profile?.full_name || 'Walker'}
          />
        )}
      </AnimatePresence>

      {/* Walker picker sheet */}
      <AnimatePresence>
        {walkerPickerNum !== null && (
          <WalkerPickerSheet
            allWalkers={allWalkers}
            date={date}
            onSelect={(walkerId) => {
              const currentWIds = [...(walkerAssignments[walkerPickerNum] || [])]
              currentWIds[walkerPickerSlotIndex] = walkerId
              setWalkers(walkerPickerNum, currentWIds.filter(Boolean))
              setWalkerPickerNum(null)
              setWalkerPickerSlotIndex(null)
            }}
            onClose={() => { setWalkerPickerNum(null); setWalkerPickerSlotIndex(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
//   SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════

// ── Swipe hint bar ─────────────────────────────────────────────────
function SwipeHintBar() {
  const divStyle = {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '5px 4px', gap: 3,
  }
  const arrowStyle = { fontSize: 13, color: '#B5AFA8', fontWeight: 700, lineHeight: 1 }
  const labelStyle = { fontSize: 11, color: '#8C857E', fontWeight: 500 }
  const dividerStyle = { width: 1, alignSelf: 'stretch', background: '#E8E4E0', flexShrink: 0 }

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      background: '#F0ECE8', borderRadius: 10, border: '1px solid #E8E4E0',
      marginBottom: 8, overflow: 'hidden',
    }}>
      <div style={divStyle}>
        <span style={arrowStyle}>←</span>
        <span style={labelStyle}>pick up</span>
      </div>
      <div style={dividerStyle} />
      <div style={divStyle}>
        <span style={arrowStyle}>←</span>
        <span style={labelStyle}>back home</span>
      </div>
      <div style={dividerStyle} />
      <div style={divStyle}>
        <span style={labelStyle}>tap name</span>
        <span style={arrowStyle}>→</span>
        <span style={labelStyle}>profile</span>
      </div>
    </div>
  )
}



// ── Sort walkers: scheduled today first, then others, alphabetical within each ─
function getSortedWalkers(allWalkers, sector, date) {
  const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })

  return [...allWalkers]
    .filter(w => {
      if (!w.full_name) return false
      if (!['senior_walker', 'admin'].includes(w.role)) return false
      if (w.sector !== sector && w.sector !== 'both') return false
      return true
    })
    .sort((a, b) => {
      const aToday = a.schedule && a.schedule.includes(dayName)
      const bToday = b.schedule && b.schedule.includes(dayName)
      if (aToday && !bToday) return -1
      if (!aToday && bToday) return 1
      const aFirst = a.full_name.split(' ')[0]
      const bFirst = b.full_name.split(' ')[0]
      return aFirst.localeCompare(bFirst)
    })
}

// ── Group header ──────────────────────────────────────────────────
function GroupHeader({ gName, num, wNames, wIds, allWalkers, date, sector, onCycleSlot, onOpenPicker, isLocked, lockInfo, dogCount, pickedCount, isTarget, selectedDogName, onTargetTap, onRename, isLinked, onLinkTap, statusBadge, owlCount = 0 }) {
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const lpTimer = useRef(null)

  function startEdit() {
    setNameInput(gName)
    setEditing(true)
  }
  function commitEdit() {
    setEditing(false)
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== gName) onRename?.(trimmed)
  }

  const walkerNameMap = useMemo(() => {
    const m = {}
    for (const w of allWalkers) m[w.id] = (w.full_name || '').split(' ')[0]
    return m
  }, [allWalkers])

  function renderSlot(slotIndex) {
    const wId = wIds[slotIndex]
    const name = wId ? (walkerNameMap[wId] || 'Walker') : null
    const isAssigned = !!wId

    // Locked: only show assigned slots
    if (isLocked && !isAssigned) return null

    return (
      <button
        key={slotIndex}
        onClick={(e) => {
          e.stopPropagation()
          if (!isLocked) {
             if (onOpenPicker) onOpenPicker(slotIndex)
             else onCycleSlot(slotIndex)
          }
        }}
        style={{
          fontSize: 9,
          padding: '2px 7px',
          borderRadius: 8,
          fontWeight: isAssigned ? 600 : 400,
          background: isAssigned ? '#534AB7' : 'transparent',
          color: isAssigned ? '#fff' : '#B5AFA8',
          border: isAssigned ? '1px solid #534AB7' : '1px dashed #AFA9EC',
          cursor: isLocked ? 'default' : 'pointer',
          minHeight: 28,
          minWidth: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
      >
        {isAssigned ? name : '+ walker'}
      </button>
    )
  }

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}
      onClick={isTarget ? onTargetTap : undefined}
      className={isTarget ? 'cursor-pointer' : ''}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
            style={{ fontSize: 13, fontWeight: 600, border: 'none', borderBottom: '1px solid #E8634A', outline: 'none', background: 'transparent', flex: 1, minWidth: 0 }}
          />
        ) : (
          <span
            onClick={(e) => {
              if (!isTarget && !isLocked) {
                e.stopPropagation()
                lpTimer.current = setTimeout(startEdit, 500)
              }
            }}
            onPointerUp={() => clearTimeout(lpTimer.current)}
            onPointerLeave={() => clearTimeout(lpTimer.current)}
            style={{ fontSize: 13, fontWeight: 600, color: isTarget ? '#E8634A' : '#333', cursor: isLocked ? 'default' : 'pointer' }}
          >
            {gName}
          </span>
        )}

        {/* Walker slots */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
          {renderSlot(0)}
          {renderSlot(1)}
        </div>

        {/* Locked by badge */}
        {isLocked && lockInfo?.locked_by_name && (
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, fontWeight: 600, background: '#E1F5EE', color: '#0F6E56', whiteSpace: 'nowrap' }}>
            locked by {lockInfo.locked_by_name}
          </span>
        )}

        {/* Linked badge */}
        {isLinked && (
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, fontWeight: 600, background: '#E6F1FB', color: '#185FA5', whiteSpace: 'nowrap' }}>
            linked
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {isTarget && selectedDogName && (
          <span style={{ fontSize: 11, color: '#E8634A', fontWeight: 500 }} className="animate-pulse">+ {selectedDogName}</span>
        )}
        {statusBadge === 'walking' && (
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 6, fontWeight: 600, background: '#FAECE7', color: '#993C1D' }}>Walking</span>
        )}
        {statusBadge === 'done' && (
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 6, fontWeight: 600, background: '#E1F5EE', color: '#0F6E56' }}>Done</span>
        )}
        {statusBadge === 'upnext' && (
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 6, fontWeight: 600, background: '#f0ece8', color: '#aaa' }}>Up next</span>
        )}
        {owlCount > 0 && (
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, fontWeight: 600, background: '#FFFBF0', color: '#C4851C', border: '1px solid #F0C76E', whiteSpace: 'nowrap' }}>
            🦉 {owlCount}
          </span>
        )}
        <span style={{ fontSize: 11, color: '#bbb' }}>
          {isLocked ? `${pickedCount}/${dogCount}` : `${dogCount} dogs`}
        </span>
        {!isLocked && onLinkTap && (
          <button onClick={(e) => { e.stopPropagation(); onLinkTap() }} style={{ fontSize: 12, padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.4 }}>
            {'\u{1F517}'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Unassigned pool ───────────────────────────────────────────────
function UnassignedPool({ eventIds, eventsMap, selectedId, owlDogIdSet, onDogTap, onDogClick, isTarget, onTargetTap, anyGroupLocked, onLongHold }) {
  const sortedIds = useMemo(() => {
    return [...eventIds]
      .sort((a, b) => {
        const evA = eventsMap.get(String(a))
        const evB = eventsMap.get(String(b))
        if (!evA || !evB) return 0
        return new Date(evA.start) - new Date(evB.start)
      })
      .map(String)
  }, [eventIds, eventsMap])

  if (sortedIds.length === 0) {
    return <p style={{ fontSize: 12, textAlign: 'center', padding: '4px 0' }}><span style={{ color: '#0F6E56', marginRight: 4 }}>{'\u2713'}</span><span style={{ color: '#aaa' }}>All dogs assigned</span></p>
  }

  return (
    <>
      {anyGroupLocked && sortedIds.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '6px 10px', fontSize: 12, color: '#92400e', fontWeight: 500 }}>
          {sortedIds.length} dog{sortedIds.length > 1 ? 's' : ''} still unassigned
        </div>
      )}
      <div
        style={{ border: '2px dashed #D3D1C7', borderRadius: 16, padding: 10, background: '#f8f8f6' }}
        onClick={isTarget ? onTargetTap : undefined}
        className={isTarget ? 'group-target-pulse cursor-pointer' : ''}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Unassigned</span>
          <span style={{ fontSize: 11, color: '#aaa' }}>{sortedIds.length}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {sortedIds.map(id => {
            const ev = eventsMap.get(id)
            if (!ev) return null
            const dog = ev.dog || {}
            const photoUrl = dog.photo_url || null
            const initial = (ev.displayName || '?').charAt(0).toUpperCase()
            const bgColor = nameToColor(ev.displayName || '')
            const isSelected = selectedId === id
            const hasOwl = dog.id && owlDogIdSet?.has(dog.id)

            let pillHoldTimer = null
            return (
              <button
                key={id}
                onClick={() => onDogTap(ev)}
                onTouchStart={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  pillHoldTimer = setTimeout(() => {
                    onLongHold?.(ev, { x: rect.left + rect.width / 2, y: rect.bottom + 4 })
                  }, 500)
                }}
                onTouchEnd={() => clearTimeout(pillHoldTimer)}
                onTouchMove={() => clearTimeout(pillHoldTimer)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, padding: '4px 8px', borderRadius: 10,
                  background: isSelected ? '#E8634A' : '#fff',
                  color: isSelected ? '#fff' : '#1a1a1a',
                  border: isSelected ? '2px solid #E8634A' : '0.5px solid #e0dcd8',
                  borderBottom: isSelected ? '2.5px solid #d4552d' : '2px solid #d5d2cc',
                  cursor: 'pointer', fontWeight: 500,
                  transition: 'all 0.15s',
                }}
              >
                {hasOwl && <span style={{ fontSize: 10 }}>{'\u{1F989}'}</span>}
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                  background: photoUrl ? '#f5f5f5' : bgColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {photoUrl ? (
                    <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>{initial}</span>
                  )}
                </div>
                {ev.displayName}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Group DnD zone (unlocked groups) ──────────────────────────────
function GroupDndZone({ dogIds, eventsMap, renderDogCard, onReorder, isTarget, selectedDogName, onTargetTap }) {
  const sortedItems = useMemo(() => dogIds.map(String), [dogIds])
  const [activeId, setActiveId] = useState(null)
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  const sensors = useSensors(touchSensor, pointerSensor)

  function handleDragStart(event) {
    setActiveId(String(event.active.id))
    try { navigator.vibrate?.(10) } catch {}
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = sortedItems.indexOf(String(active.id))
    const newIndex = sortedItems.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(sortedItems, oldIndex, newIndex))
    try { navigator.vibrate?.(10) } catch {}
  }

  const activeEvent = activeId ? eventsMap.get(activeId) : null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedItems} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sortedItems.length === 0 && !isTarget && (
            <p style={{ fontSize: 12, color: '#bbb', textAlign: 'center', padding: '16px 8px', fontStyle: 'italic' }}>Tap a dog above, then tap here</p>
          )}
          {isTarget && sortedItems.length === 0 && (
            <button onClick={onTargetTap} style={{
              width: '100%', padding: 12, borderRadius: 10, border: '2px dashed rgba(232,99,74,0.3)',
              background: 'transparent', fontSize: 12, color: '#E8634A', fontWeight: 500, cursor: 'pointer',
            }}>
              Tap to add {selectedDogName || 'dog'} here
            </button>
          )}
          {sortedItems.map((id, idx) => {
            const ev = eventsMap.get(id)
            if (!ev) return null
            return (
              <SortableDogCardWrapper key={id} id={id}>
                {renderDogCard(ev, id, idx)}
              </SortableDogCardWrapper>
            )
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeEvent ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 10,
            background: '#fff', border: '2px solid #E8634A', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            fontSize: 12, fontWeight: 500,
          }}>
            {activeEvent.displayName}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ── Merged group DnD zone ──────────────────────────────────────────────
function MergedDndZone({ combinedDogs, eventsMap, renderDogCard, onDragEnd }) {
  const stringItems = useMemo(() => combinedDogs.map(d => String(d.dogId)), [combinedDogs])

  const [activeId, setActiveId] = useState(null)
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  const sensors = useSensors(touchSensor, pointerSensor)

  function handleDragStart(event) {
    setActiveId(String(event.active.id))
    try { navigator.vibrate?.(10) } catch {}
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = stringItems.indexOf(String(active.id))
    const newIndex = stringItems.indexOf(String(over.id))
    onDragEnd(oldIndex, newIndex)
    try { navigator.vibrate?.(10) } catch {}
  }

  const activeEvent = activeId ? eventsMap.get(activeId) : null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={stringItems} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 8px 6px' }}>
          {combinedDogs.map((item, idx) => {
            const ev = eventsMap.get(item.dogId)
            if (!ev) return null
            return (
              <SortableDogCardWrapper key={item.dogId} id={item.dogId}>
                {renderDogCard(ev, item.dogId, item.type === 'A' ? 0 : 1, idx, item.type)}
              </SortableDogCardWrapper>
            )
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeEvent ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 10,
            background: '#fff', border: '2px solid #E8634A', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            fontSize: 12, fontWeight: 500,
          }}>
            {activeEvent.displayName}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ── Done group (tappable recap) ─────────────────────────────────
function DoneGroup({ num, gName, elapsed, dogIds, eventsMap, pickups, onDogClick }) {
  const [expanded, setExpanded] = useState(false)
  const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' }) : null

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', background: '#f0ece8', border: '0.5px solid #e0dcd8' }}>
      <button onClick={() => setExpanded(p => !p)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        opacity: expanded ? 0.7 : 0.45,
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#0F6E56' }}>
          {'\u2713'} {gName} {'\u00b7'} {elapsed >= 60 ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}min` : `${elapsed} min`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 6, fontWeight: 600, background: '#E1F5EE', color: '#0F6E56' }}>Done</span>
          <span style={{ fontSize: 10, color: '#bbb' }}>{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>
      {expanded && (
        <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {dogIds.map((id, idx) => {
            const ev = eventsMap.get(id)
            if (!ev) return null
            const dog = ev.dog || {}
            const dogPk = dog.id ? pickups[dog.id] : null
            const isNotWalking = !!dogPk?.notWalking
            const isReturned = !!dogPk?.returnedAt
            const isPickedUp = !!dogPk?.pickedUpAt
            const pickupStr = fmt(dogPk?.pickedUpAt)
            const returnStr = fmt(dogPk?.returnedAt)

            let indicator, nameColor, nameDecoration, decoColor, timeLabel
            if (isNotWalking) {
              indicator = { symbol: '\u2717', color: '#C4851C' }
              nameColor = '#C4851C'
              nameDecoration = 'line-through'
              decoColor = '#C4851C'
              timeLabel = null
            } else if (isReturned) {
              indicator = { symbol: '\u2713', color: '#0F6E56' }
              nameColor = '#534AB7'
              nameDecoration = 'none'
              decoColor = '#534AB7'
              timeLabel = pickupStr && returnStr ? `${pickupStr} \u2192 ${returnStr}` : null
            } else if (isPickedUp) {
              indicator = { symbol: '\u2713', color: '#0F6E56' }
              nameColor = '#534AB7'
              nameDecoration = 'line-through'
              decoColor = '#534AB7'
              timeLabel = pickupStr || null
            } else {
              indicator = { symbol: String(idx + 1), color: '#aaa' }
              nameColor = '#534AB7'
              nameDecoration = 'none'
              decoColor = '#534AB7'
              timeLabel = null
            }

            return (
              <div key={id} style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '3px 0',
                background: isNotWalking ? '#FDF3E3' : 'transparent',
                borderRadius: isNotWalking ? 6 : 0,
                paddingLeft: isNotWalking ? 4 : 0,
                paddingRight: isNotWalking ? 4 : 0,
              }}>
                <span style={{ color: indicator.color, width: 14, textAlign: 'center', fontWeight: 700, fontSize: 10 }}>
                  {indicator.symbol}
                </span>
                <span
                  onClick={(e) => { e.stopPropagation(); onDogClick(ev) }}
                  style={{
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textDecoration: nameDecoration, textDecorationColor: decoColor,
                    color: nameColor, borderBottom: '1px dashed #AFA9EC', cursor: 'pointer',
                  }}
                >{ev.displayName}</span>
                {isNotWalking && (
                  <span style={{ fontSize: 9, color: '#C4851C', fontWeight: 600, flexShrink: 0 }}>Not walking</span>
                )}
                {timeLabel && (
                  <span style={{ fontSize: 9, color: '#0F6E56', fontWeight: 500, flexShrink: 0 }}>{timeLabel}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Collapsed locked group (other walker's) ───────────────────────
function CollapsedGroup({ num, gName, lockInfo, dogIds, eventsMap, wNames, pickups, onDogClick }) {
  const [expanded, setExpanded] = useState(false)
  const pickedCount = dogIds.filter(id => { const ev = eventsMap.get(id); return ev?.dog?.id && pickups[ev.dog.id] }).length

  return (
    <div style={{ borderRadius: 14, border: '1px solid #e0dcd8', overflow: 'hidden', opacity: 0.5 }}>
      <button onClick={() => setExpanded(p => !p)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 12 }}>{'\u{1F512}'}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#555' }}>{gName}</span>
          {wNames.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, color: '#534AB7', whiteSpace: 'nowrap' }}>
              {wNames.map(n => n.split(' ')[0]).join(' + ')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: '#aaa' }}>{pickedCount}/{dogIds.length} dogs</span>
          <span style={{ fontSize: 10, color: '#ccc' }}>{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>
      {lockInfo?.locked_by_name && (
        <p style={{ fontSize: 10, color: '#aaa', padding: '0 12px 4px' }}>locked by {lockInfo.locked_by_name}</p>
      )}
      {expanded && (
        <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {dogIds.map((id, idx) => {
            const ev = eventsMap.get(id)
            if (!ev) return null
            const dog = ev.dog || {}
            const dogPk = dog.id ? pickups[dog.id] : null
            const timeStr = dogPk?.time ? new Date(dogPk.time).toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' }) : null
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '2px 0', opacity: dogPk ? 0.5 : 1 }}>
                <span style={{ color: '#aaa', width: 14, textAlign: 'center' }}>{idx + 1}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); onDogClick(ev) }}
                  style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: dogPk ? 'line-through' : 'none', textDecorationColor: '#534AB7', color: '#534AB7', borderBottom: '1px dashed #AFA9EC', cursor: 'pointer' }}
                >{ev.displayName}</span>
                {timeStr && <span style={{ fontSize: 10, color: '#0F6E56' }}>{timeStr}</span>}
                {dog.address && (
                  <span onClick={() => onDogClick(ev)} style={{ fontSize: 10, color: '#185FA5', cursor: 'pointer', flexShrink: 0 }}>
                    {dog.address.split(',')[0]} {'\u203A'}
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

// ── Collapsible map ───────────────────────────────────────────────
const LazyMapView = React.lazy(() => import('./MapView'))

function CollapsibleMap({ events, groups, groupNums, groupNames, eventsMap, date, sector, onDogClick }) {
  const [expanded, setExpanded] = useState(false)

  const pinCount = useMemo(() => {
    let count = 0
    for (const ev of events || []) {
      if (ev.dog?.address) count++
    }
    return count
  }, [events])

  if (pinCount === 0) return null

  return (
    <div style={{ marginBottom: 4 }}>
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          style={{
            width: '100%', background: 'linear-gradient(135deg, #f5f0eb 0%, #ede8e3 100%)', borderRadius: 12, border: '0.5px solid #e0dcd8',
            padding: '0 10px', height: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 10, color: '#bbb' }}>
            Map: {pinCount} pin{pinCount !== 1 ? 's' : ''} {'\u00b7'} tap to expand
          </span>
        </button>
      ) : (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '0.5px solid #e0dcd8' }}>
          <div style={{ height: 200 }}>
            <React.Suspense fallback={<div style={{ height: 200, background: '#e8e5e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 11, color: '#aaa' }}>Loading map...</span></div>}>
              <LazyMapView events={events} date={date} sector={sector} onDogClick={onDogClick} />
            </React.Suspense>
          </div>
          {/* Group legend */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '6px 8px', background: '#fff' }}>
            {groupNums.slice(0, 5).map((num, idx) => {
              const color = groupColors[idx % groupColors.length]
              return (
                <span key={num} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#888' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color.border, flexShrink: 0 }} />
                  {groupNames[num] || `Group ${num}`}
                </span>
              )
            })}
          </div>
          <button onClick={() => setExpanded(false)} style={{ width: '100%', padding: 4, background: '#f8f6f4', border: 'none', cursor: 'pointer', fontSize: 9, color: '#aaa' }}>
            collapse
          </button>
        </div>
      )}
    </div>
  )
}

// ── Link picker ───────────────────────────────────────────────────
function LinkPicker({ sourceNum, sourceName, groupNums, groupNames, groupLinks, groups, eventsMap, date, sector, onLink, onUnlink, onClose }) {
  const [step, setStep] = useState('group') // 'group' | 'mode' | 'stagger'
  const [targetNum, setTargetNum] = useState(null)

  // Check if already linked
  const sourceKey = `${date}_${sector}_${sourceNum}`
  const existingLink = groupLinks.find(l => l.group_a_key === sourceKey || l.group_b_key === sourceKey)

  function handleSelectGroup(n) {
    setTargetNum(n)
    setStep('mode')
  }

  function handleSideBySide() {
    onLink(targetNum, 0)
  }

  function handleStaggerAt(dogIndex) {
    onLink(targetNum, dogIndex)
  }

  const sourceDogIds = (groups[sourceNum] || []).map(String)

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        className="fixed bottom-0 left-0 right-0 z-[101] bg-white shadow-2xl pb-[env(safe-area-inset-bottom)]"
        style={{ borderRadius: '16px 16px 0 0', padding: 16, maxHeight: '60vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 2 }} />
        </div>

        {existingLink ? (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{sourceName} is linked</p>
            <button
              onClick={() => onUnlink(existingLink.id)}
              style={{ width: '100%', padding: 12, borderRadius: 10, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Unlink groups
            </button>
          </>
        ) : step === 'group' ? (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Link {sourceName} with...</p>
            {groupNums.filter(n => n !== sourceNum).map(n => {
              const color = groupColors[(n - 1) % groupColors.length]
              return (
                <button key={n} onClick={() => handleSelectGroup(n)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: '#1a1a1a' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: color.border, flexShrink: 0 }} />
                  {groupNames[n] || `Group ${n}`}
                </button>
              )
            })}
          </>
        ) : step === 'mode' ? (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Link mode</p>
            <button onClick={handleSideBySide}
              style={{ width: '100%', padding: 12, borderRadius: 10, background: '#f5f9fd', border: '1px solid #85B7EB', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: 8 }}>
              Side by side
            </button>
            <button onClick={() => setStep('stagger')}
              style={{ width: '100%', padding: 12, borderRadius: 10, background: '#f5f9fd', border: '1px solid #85B7EB', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Staggered
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Start at which dog?</p>
            {sourceDogIds.map((id, idx) => {
              const ev = eventsMap.get(id)
              if (!ev) return null
              return (
                <button key={id} onClick={() => handleStaggerAt(idx + 1)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                  <span style={{ fontSize: 10, color: '#aaa', width: 16 }}>{idx + 1}</span>
                  {ev.displayName}
                </button>
              )
            })}
          </>
        )}
      </motion.div>
    </>
  )
}

// ── Walker picker sheet ───────────────────────────────────────────────────
function WalkerPickerSheet({ allWalkers, date, onSelect, onClose }) {
  const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' }) // "Mon", "Tue"
  
  const scheduledWalkers = []
  const otherWalkers = []

  const filteredWalkers = allWalkers.filter(w => ['senior_walker', 'admin'].includes(w.role))

  for (const w of filteredWalkers) {
    if (w.schedule && w.schedule.includes(dayName)) {
      scheduledWalkers.push(w)
    } else {
      otherWalkers.push(w)
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        className="fixed bottom-0 left-0 right-0 z-[101] bg-white shadow-2xl pb-[env(safe-area-inset-bottom)]"
        style={{ borderRadius: '16px 16px 0 0', padding: 16, maxHeight: '60vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 2 }} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Select walker</p>
        
        {scheduledWalkers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Scheduled Today</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {scheduledWalkers.map(w => (
                <button key={w.id} onClick={() => onSelect(w.id)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: '#E8F5EF', border: '1px solid #6DCAA8', fontSize: 14, fontWeight: 600, color: '#0F6E56', textAlign: 'left', cursor: 'pointer' }}>
                  {w.full_name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {otherWalkers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Other Walkers</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {otherWalkers.map(w => (
                <button key={w.id} onClick={() => onSelect(w.id)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: '#FAF7F4', border: '1px solid #E8E4E0', fontSize: 14, fontWeight: 500, color: '#333', textAlign: 'left', cursor: 'pointer' }}>
                  {w.full_name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => onSelect(null)}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'transparent', border: '1px dashed #AFA9EC', fontSize: 14, fontWeight: 500, color: '#534AB7', cursor: 'pointer', marginTop: 12 }}>
          Clear assignment
        </button>
      </motion.div>
    </>
  )
}
