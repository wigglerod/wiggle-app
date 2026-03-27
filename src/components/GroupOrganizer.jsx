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
    addWalker, removeWalker, linkGroups, unlinkGroups,
    loaded, lastSaved, lockGroup, unlockGroup,
  } = useWalkGroups(events, date, sector)

  const anyGroupLocked = Object.keys(groupLocks).length > 0
  useEffect(() => { onAnyGroupLocked?.(anyGroupLocked) }, [anyGroupLocked, onAnyGroupLocked])

  // Pickup tracking
  const { pickups, markPickup, undoPickup } = usePickups(date)

  // Quick note sheet
  const [swipeNoteDog, setSwipeNoteDog] = useState(null)
  const [swipeNoteGroupName, setSwipeNoteGroupName] = useState(null)

  // Walker name lookup
  const [walkerNameMap, setWalkerNameMap] = useState({})
  useEffect(() => {
    if (!sector) return
    async function fetchWalkers() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, sector, schedule')
        .in('role', ['senior_walker', 'admin', 'junior_walker'])
        .order('full_name')
      if (data) {
        const map = {}
        for (const w of data) map[w.id] = w.full_name
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

  function enrichDogClick(ev, groupKey) {
    const gName = groupKey === 'unassigned' ? 'Unassigned' : (groupNames[groupKey] || `Group ${groupKey}`)
    onDogClick({ ...ev, _groupKey: groupKey, _groupName: gName })
  }

  // Format pickup time
  function formatPickupTime(time) {
    if (!time) return null
    return new Date(time).toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' })
  }

  // ── Render a DogCard for an event ──────────────────────────────
  function renderDogCard(ev, id, groupNum, idx, isLocked, isCurrent = false, isCompact = false) {
    const dog = ev.dog || {}
    const dogId = dog.id
    const dogPickup = dogId ? pickups[dogId] : null
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
          isPickedUp={!!dogPickup}
          isCurrent={isCurrent}
          isCompact={isCompact}
          pickupTime={formatPickupTime(dogPickup?.time)}
          onSwipeLeft={() => markPickup(dogId, ev.displayName)}
          onSwipeRight={() => {
            setSwipeNoteDog({ id: dogId, dog_name: dog.dog_name || ev.displayName, photo_url: dog.photo_url })
            setSwipeNoteGroupName(gName)
          }}
          onUndoPickup={dogPickup ? () => undoPickup(dogId) : undefined}
          onTapName={() => enrichDogClick(ev, groupNum)}
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

    const pickedCount = dogIds.filter(id => { const ev = eventsMap.get(id); return ev?.dog?.id && pickups[ev.dog.id] }).length
    const total = dogIds.length
    const allPickedUp = total > 0 && pickedCount === total

    // ── DONE state (collapsed) ─────────────────────────────────
    if ((allPickedUp || isDone) && isGroupLocked) {
      const times = dogIds.map(id => { const ev = eventsMap.get(id); return ev?.dog?.id && pickups[ev.dog.id]?.time ? new Date(pickups[ev.dog.id].time).getTime() : null }).filter(Boolean)
      const elapsed = times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 60000) : 0
      return (
        <div key={num} style={{ opacity: 0.45, background: '#f0ece8', border: '0.5px solid #e0dcd8', borderRadius: 14, padding: '8px 10px' }}
          className="flex items-center justify-between"
        >
          <span style={{ fontSize: 12, fontWeight: 500, color: '#0F6E56' }}>{'\u2713'} {gName} {'\u00b7'} {elapsed} min</span>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 6, fontWeight: 600, background: '#E1F5EE', color: '#0F6E56' }}>Done</span>
        </div>
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
            isGroupLocked && allPickedUp ? 'done'
            : isGroupLocked && !allPickedUp ? 'walking'
            : !isGroupLocked && anyGroupLocked ? 'upnext'
            : null
          }
        />

        {/* Walker assignment buttons — PLAN mode only */}
        {!isGroupLocked && (
          <WalkerButtons
            num={num}
            wIds={wIds}
            walkerNameMap={walkerNameMap}
            allWalkers={walkerNameMap}
            onAdd={(walkerId) => addWalker(num, walkerId)}
            onRemove={(walkerId) => removeWalker(num, walkerId)}
          />
        )}

        {/* Swipe hint (first locked group only) */}
        {isGroupLocked && groupNums.filter(n => groupLocks[n]).indexOf(num) === 0 && (
          <p style={{ fontSize: 11, color: '#c5c0bb', textAlign: 'center', marginBottom: 6, padding: '8px 16px', letterSpacing: '0.02em', background: 'rgba(0,0,0,0.015)', borderRadius: 8 }}>
            {'\u2190'} swipe = picked up | swipe {'\u2192'} = note
          </p>
        )}

        {/* Dogs */}
        {isGroupLocked ? (
          // Locked: DogCards with swipe, no DnD
          (() => {
            const firstUnpickedIdx = dogIds.findIndex(id => {
              const ev = eventsMap.get(id)
              return ev?.dog?.id && !pickups[ev.dog.id]
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

            return (
              <div key={`link-${num}-${partnerNum}`} style={{ display: 'flex', gap: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>{renderGroup(groupA, visibleNums.indexOf(groupA), true)}</div>
                <div style={{ width: 3, background: '#185FA5', borderRadius: 2, margin: '20px 0', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, marginTop: offsetPx }}>{renderGroup(groupB, visibleNums.indexOf(groupB), true)}</div>
              </div>
            )
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

      {/* End of day celebration */}
      <EndOfDayCelebration
        groupNums={groupNums}
        groupNames={groupNames}
        groupLocks={groupLocks}
        groups={groups}
        eventsMap={eventsMap}
        pickups={pickups}
        doneGroupNums={doneGroupNums}
        walkerAssignments={walkerAssignments}
        userId={user?.id}
        date={date}
      />

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
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
//   SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════

// ── Walker assignment buttons (PLAN mode) ────────────────────────
function WalkerButtons({ num, wIds, walkerNameMap, allWalkers, onAdd, onRemove }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const walkerList = Object.entries(allWalkers)
    .map(([id, name]) => ({ id, name }))
    .filter(w => !wIds.includes(w.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap', position: 'relative' }}>
      {wIds.map(id => {
        const name = walkerNameMap[id]
        if (!name) return null
        return (
          <button
            key={id}
            onClick={() => onRemove(id)}
            style={{
              background: '#EEEDFE', color: '#534AB7',
              border: '1.5px solid #AFA9EC',
              fontSize: 10, fontWeight: 700,
              padding: '4px 12px', borderRadius: 20,
              cursor: 'pointer',
            }}
          >
            {name.split(' ')[0]} ×
          </button>
        )
      })}
      {wIds.length < 2 && (
        <button
          onClick={() => setPickerOpen(p => !p)}
          style={{
            background: 'transparent', color: '#D5CFC8',
            border: '1.5px dashed #D5CFC8',
            fontSize: 10, fontWeight: 500,
            padding: '4px 12px', borderRadius: 20,
            cursor: 'pointer',
          }}
        >
          + walker
        </button>
      )}
      {pickerOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setPickerOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 50,
            background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 4,
            maxHeight: 200, overflowY: 'auto', minWidth: 160,
          }}>
            {walkerList.length === 0 && (
              <p style={{ fontSize: 11, color: '#aaa', padding: '8px 12px' }}>No walkers available</p>
            )}
            {walkerList.map(w => (
              <button
                key={w.id}
                onClick={() => { onAdd(w.id); setPickerOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', fontSize: 12, fontWeight: 500,
                  color: '#333', background: 'transparent', border: 'none',
                  cursor: 'pointer', borderRadius: 8, minHeight: 36,
                }}
                className="active:bg-[#FFF4F1]"
              >
                {w.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Group header ──────────────────────────────────────────────────
function GroupHeader({ gName, num, wNames, wIds, isLocked, lockInfo, dogCount, pickedCount, isTarget, selectedDogName, onTargetTap, onRename, isLinked, onLinkTap, statusBadge }) {
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

        {/* Walker names — purple, always visible */}
        {wNames.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 600, color: '#534AB7', whiteSpace: 'nowrap', marginLeft: 2 }}>
            {wNames.map(n => n.split(' ')[0]).join(' + ')}
          </span>
        )}

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
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: dogPk ? 'line-through' : 'none', color: dogPk ? '#aaa' : '#555' }}>{ev.displayName}</span>
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

// ── End of day celebration ─────────────────────────────────────────
function EndOfDayCelebration({ groupNums, groupNames, groupLocks, groups, eventsMap, pickups, doneGroupNums, walkerAssignments, userId, date }) {
  const [noteCount, setNoteCount] = useState(0)
  const [issueCount, setIssueCount] = useState(0)

  const myLockedNums = groupNums.filter(n => {
    const wIds = walkerAssignments[n] || []
    return groupLocks[n] && (wIds.includes(userId) || wIds.length === 0)
  })

  const allDone = myLockedNums.length > 0 && myLockedNums.every(n => {
    const ids = (groups[n] || []).map(String)
    return (ids.length > 0 && ids.every(id => { const ev = eventsMap.get(id); return ev?.dog?.id && pickups[ev.dog.id] })) || doneGroupNums.has(n)
  })

  // Fetch note/issue counts
  useEffect(() => {
    if (!allDone || !date) return
    async function fetchCounts() {
      const { data } = await supabase
        .from('walker_notes')
        .select('note_type, tags')
        .eq('walk_date', date)
        .eq('walker_id', userId)
      if (!data) return
      const redTags = ['Seems off', 'Reactive', 'Limping', 'Refuse to walk', 'Wounded', 'Soft stool / diarrhea', 'DM Me']
      let notes = 0, issues = 0
      for (const row of data) {
        if (row.note_type === 'note') notes++
        if (row.tags && row.tags.some(t => redTags.includes(t))) issues++
      }
      setNoteCount(notes)
      setIssueCount(issues)
    }
    fetchCounts()
  }, [allDone, date, userId])

  if (!allDone) return null

  const totalDogs = myLockedNums.reduce((s, n) => s + (groups[n] || []).length, 0)

  // Per-group durations + total time
  const groupStats = myLockedNums.map(n => {
    const ids = (groups[n] || []).map(String)
    const times = ids.map(id => { const ev = eventsMap.get(id); return ev?.dog?.id && pickups[ev.dog.id]?.time ? new Date(pickups[ev.dog.id].time).getTime() : null }).filter(Boolean)
    const duration = times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 60000) : 0
    return { num: n, name: groupNames[n] || `Group ${n}`, duration, times }
  })

  const allTimes = groupStats.flatMap(g => g.times)
  const totalTime = allTimes.length > 1 ? Math.round((Math.max(...allTimes) - Math.min(...allTimes)) / 60000) : 0

  return (
    <div style={{ textAlign: 'center', padding: '30px 14px' }}>
      <div style={{ fontSize: 36, letterSpacing: 8, marginBottom: 12 }}>{'\u{1F43E}'} {'\u{1F43E}'} {'\u{1F43E}'}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>All walks done!</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
        {myLockedNums.length} group{myLockedNums.length > 1 ? 's' : ''} {'\u00b7'} {totalDogs} dog{totalDogs > 1 ? 's' : ''} {'\u00b7'} {totalTime} min
      </div>

      {/* Per-group stats */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 12, border: '0.5px solid #e8e5e0', textAlign: 'left', marginBottom: 8 }}>
        {groupStats.map(g => (
          <div key={g.num} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
            <span>{'\u2713'} {g.name}</span>
            <span style={{ color: '#aaa' }}>{g.duration} min</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        {noteCount} note{noteCount !== 1 ? 's' : ''} logged {'\u00b7'} {issueCount} issue{issueCount !== 1 ? 's' : ''} flagged
      </div>

      <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '0.5px solid #e8e5e0' }}>
        <span style={{ color: '#aaa', fontSize: 13 }}>See you tomorrow!</span>
      </div>
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
