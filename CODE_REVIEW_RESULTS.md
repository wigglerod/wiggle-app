# Code Review Results — 2026-04-01

## 1. Dog Name Clickable — ALL States

### DogCard.jsx — Normal Mode (line 317-332)
- **Color:** `#534AB7` (purple) — always, all states. **PASS**
- **Border-bottom:** `1px dashed #AFA9EC` — always, all states. **PASS**
- **onClick:** `e.stopPropagation(); onTapName()` — fires in all states. **PASS**
- **onTapName source:** `() => enrichDogClick(ev, groupNum, dogPickup, dogId, date)` (GroupOrganizer.jsx:559), which calls `onDogClick(...)` — opens profile drawer. **PASS**
- **Strikethrough:** Applied when `isPickedUp || isReturned`, `textDecorationColor: '#534AB7'` — purple strikethrough, still looks like a link. **PASS**
- **Note:** Container has `opacity: 0.55` in returned state (line 137). The purple name is faded but still visible and tappable. **MINOR — acceptable tradeoff.**

### DogCard.jsx — Compact Mode (line 186-199)
- **Color:** `#534AB7`. **PASS**
- **Border-bottom:** `1px dashed #AFA9EC`. **PASS**
- **onClick:** `e.stopPropagation(); onTapName()`. **PASS**
- **Strikethrough + color:** Purple in all states. **PASS**

### Unassigned Pool Pills (GroupOrganizer.jsx:1261-1296)
- **Dog name:** Plain text `{ev.displayName}` inside a `<button>`. **NOT purple, NOT a link.**
- **onClick:** Calls `onDogTap(ev)` → `handleDogTap` → toggles `selectedId` for tap-to-assign. Does NOT open profile.
- **Profile access:** `onDogClick` is passed as a prop to `UnassignedPool` but is **never used** in the pill rendering.
- **Verdict:** No way to open dog profile from unassigned pool pills.
- **Mitigating factor:** These are pills, not cards. The rule specifies "EVERY card state." Unassigned dogs don't render as DogCards.
- **FINDING: LOW — UX gap, no profile access from unassigned pool. Intentional design tradeoff.**

### CollapsedGroup (GroupOrganizer.jsx:1409-1418)
- **Dog name at line 1411:**
  ```jsx
  <span style={{ color: dogPk ? '#aaa' : '#555' }}>{ev.displayName}</span>
  ```
- **Color:** `#555` (not picked up) or `#aaa` (picked up). **NOT purple.**
- **onClick:** **None.** Name is plain text, not clickable.
- **Profile access:** Only via the address link (`onDogClick(ev)` at line 1414). If a dog has no address, there is **no way to open its profile**.
- **FINDING: BUG — Dog name in CollapsedGroup is not a purple tappable link.**
- **File:** `src/components/GroupOrganizer.jsx`
- **Line:** 1411
- **Fix:** Make the dog name a clickable purple span with `onClick={() => onDogClick(ev)}`, color `#534AB7`, `borderBottom: '1px dashed #AFA9EC'`, `cursor: 'pointer'`.

### DONE State Collapsed (GroupOrganizer.jsx:614-625)
- Individual dog names are NOT rendered — only group summary line. **N/A**

### UPCOMING Group Collapsed (GroupOrganizer.jsx:632-653)
- Individual dog names are NOT rendered — only a joined text string. **N/A**

### Dead Code from Purple Fix
- **Line 122-123 in DogCard.jsx:**
  ```javascript
  const hasPermanentNotes = dog.notes && dog.notes.trim().length > 0;
  const nameColor = hasPermanentNotes ? '#961e78' : '#2D2926';
  ```
  `nameColor` is defined but **never used** (both name renders now use hardcoded `#534AB7`).
- **FINDING: CLEANUP — Remove dead `hasPermanentNotes` and `nameColor` variables.**

---

## 2. Swipe Left — Pickup and Back Home

### Touch Listener Guard (DogCard.jsx:98-111)
```javascript
if (!el || !isLocked || isReturned) return;
```
| Condition | Listeners attached? | Correct? |
|-----------|-------------------|----------|
| Not locked | No | PASS — no swipe in plan mode |
| Locked + waiting | Yes | PASS |
| Locked + picked up | Yes | PASS — isReturned is false |
| Locked + returned | No | PASS — no more swiping |
| Compact mode | No (cardRef is null) | PASS — by design |

### handleTouchEnd Logic (DogCard.jsx:77-95)
```javascript
const { onSwipeLeft: left, onSwipeLeftSecond: leftSecond } = swipeCallbacksRef.current;
if (dx < -THRESHOLD_PX) {
    if (left) left();
    else if (leftSecond) leftSecond();
}
```

**Callback props from GroupOrganizer.jsx:552-553:**
```javascript
onSwipeLeft={!isPickedUp ? () => markPickup(dogId, ev.displayName) : undefined}
onSwipeLeftSecond={isPickedUp && !isReturned ? () => markReturned(dogId, ev.displayName) : undefined}
```

| State | onSwipeLeft | onSwipeLeftSecond | Swipe result | Correct? |
|-------|-------------|-------------------|--------------|----------|
| Waiting | fn → markPickup | undefined | Calls markPickup | PASS |
| Picked up | undefined | fn → markReturned | Calls markReturned | PASS |
| Returned | undefined | undefined | Listeners detached | PASS |

### Ref-based Callback Pattern (DogCard.jsx:44-45)
```javascript
const swipeCallbacksRef = useRef({ onSwipeLeft, onSwipeLeftSecond, onSwipeRight });
swipeCallbacksRef.current = { onSwipeLeft, onSwipeLeftSecond, onSwipeRight };
```
- Updated every render with latest props. **PASS**
- `handleTouchEnd` has empty deps `[]` — stable reference, reads from ref. **PASS**
- No stale closure risk. **PASS**

### markReturned (usePickups.js:147-173)
- Optimistic update: `setPickups(prev => ({ ...prev, [dogId]: { ...prev[dogId], returnedAt: now } }))` — **PASS**
- Supabase insert with `note_type: 'returned'` — **PASS**
- Rollback on error — **PASS**
- Guard: `if (!user || !date || !dogId) return` — **PASS**

### Swipe Right on Picked-Up Card
- `onSwipeRight` is always defined (note sheet opener). When picked up + locked, listeners are attached, swipe right opens note sheet. **Intentional — allows adding a note after pickup.**

### Expanded Panel Buttons (DogCard.jsx:437-470)
- "✓ Picked up" button calls `onSwipeLeft()` directly (prop, not ref) — correct because expanded panel only shows when `!isPickedUp`, so `onSwipeLeft` is always defined at that point. **PASS**
- Panel is gated by `isLocked` (line 437). **PASS**

### Skipped State
- No `isSkipped` prop exists on DogCard. No amber card state implemented. **N/A**

### Threshold
- `THRESHOLD_PX = 60` — 60px minimum swipe distance. **Reasonable for mobile.**

### VERDICT: Swipe logic is CORRECT. No bugs found.

---

## 3. Walker Assignment

### WalkerPickerSheet
- **Deleted.** No remnants in codebase. Confirmed via grep — zero matches for `WalkerPickerSheet`, `walkerPickerOpen`, `onWalkerSlotTap`, or `handleSelectWalker`. **PASS**

### New Inline Pills (GroupOrganizer.jsx:1173-1210)
- **Rendering:** All sector walkers shown as pills via `getSortedWalkers()` with fixed order per sector. **PASS**
- **Fixed order:** Laurier: Amanda, Amelie, Rodrigo, Maeva, Belen. Plateau: Chloe, Megan, Rodrigo, Solene. **PASS**
- **onClick:** `e.stopPropagation(); if (!isLocked) onToggleWalker(w.id)`. **PASS**
- **z-index issues:** None. Pills are inside the group header, no overlapping layers. **PASS**
- **pointer-events:** Not set — default (`auto`). **PASS**
- **Touch target:** `minHeight: 28, minWidth: 44` — meets 44px width but height is 28px (spec says 44px touch target). **FINDING: MINOR — height should be min 44px for comfortable one-handed tapping.**

### handleToggleWalker (GroupOrganizer.jsx:464-471)
```javascript
function handleToggleWalker(groupNum, walkerId) {
    const currentWIds = walkerAssignments[groupNum] || []
    if (currentWIds.includes(walkerId)) {
      removeWalker(groupNum, walkerId)
    } else {
      addWalker(groupNum, walkerId)
    }
  }
```
- **addWalker** (useWalkGroups.js:351-363): Appends walker ID, persists to Supabase. **PASS**
- **removeWalker** (useWalkGroups.js:366-382): Filters out walker ID, persists. **PASS**
- **No max limit:** Old 2-slot system removed. Now unlimited walkers per group. Spec says "multiple walkers" — acceptable. **PASS**

### Ghost/Solid States
| Mode | Ghost (unassigned) | Solid (assigned) |
|------|--------------------|-----------------|
| Unlocked (PLAN) | Visible, tappable, dashed border | Visible, tappable, solid purple | **PASS** |
| Locked (WALKING) | Hidden (`return null`) | Visible, non-tappable | **PASS** |

### Pill Styles
| State | Background | Border | Color | Font-weight |
|-------|-----------|--------|-------|-------------|
| Ghost | transparent | 1px dashed #AFA9EC | #B5AFA8 | 400 | **PASS — matches spec** |
| Solid | #534AB7 | 1px solid #534AB7 | #fff | 600 | **PASS — matches spec** |

---

## Summary of Findings

### Bugs (must fix)

| # | Severity | File | Line | Issue | Fix |
|---|----------|------|------|-------|-----|
| 1 | **HIGH** | GroupOrganizer.jsx | 1411 | CollapsedGroup dog name is NOT purple, NOT clickable. No profile access if dog has no address. | Make name a clickable purple `<span>` with `onClick={() => onDogClick(ev)}`, `color: '#534AB7'`, `borderBottom: '1px dashed #AFA9EC'` |

### Cleanup (should fix)

| # | Severity | File | Line | Issue | Fix |
|---|----------|------|------|-------|-----|
| 2 | LOW | DogCard.jsx | 122-123 | `hasPermanentNotes` and `nameColor` are dead code (never used after purple hardcode) | Remove both lines |
| 3 | LOW | GroupOrganizer.jsx | 1198 | Walker pill `minHeight: 28` is below 44px touch target spec | Change to `minHeight: 44` or add padding to reach 44px effective touch area |
