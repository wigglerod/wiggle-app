# AUDIT: "Not Walking today" — Ground Truth Report

**Date:** 2026-04-14  
**Auditor:** Claude (read-only, no code changes)  
**Repo:** wiggle-v4 @ `~/Documents/wiggle-v4/`  
**Purpose:** Verify four assumptions before Antigravity build surfaces "Not Walking today" to the mini card expand zone.

---

## Assumption 1 — Drawer component file location

**Verdict: ⚠ Partially correct**

The button lives in `DogDrawer.jsx`, NOT `DogProfileDrawer.jsx`. There IS a separate `DogProfileDrawer.jsx` in the repo but it handles profile editing (forever notes, level tags) — not walk actions.

**Ground truth:**

- **File:** `src/components/DogDrawer.jsx`
- **Component:** The button is rendered inside a sub-component called `WalkTimesSection` (line 982), which is a child of `LiveWalkTimes` (line 946), which is rendered by the main `DogDrawer` default export.
- **Import chain:** `main.jsx` → `App.jsx` (route "/") → `Dashboard.jsx` → imports `DogDrawer` (line 6) + `GroupOrganizer` (line 5) → `GroupOrganizer` imports `DogCard` (line 21)

The DogDrawer opens when a dog card is tapped (via `onDogClick` callback in GroupOrganizer line 550). GroupOrganizer builds a `_walkInfo` object containing pre-bound handler functions and passes the selected event to Dashboard, which renders DogDrawer.

---

## Assumption 2 — The handler function

**Verdict: ✓ Confirmed (with nuance on reusability)**

**Ground truth:**

- **Handler:** `markNotWalking(dogId, dogName, groupNum)` — defined in `src/lib/usePickups.js` line 259
- **Undo handler:** `undoNotWalking(dogId)` — defined in `src/lib/usePickups.js` line 291
- **Both exported** from the hook's return value (line 316)

**Fields written to `walker_notes`** (line 267–276):

| Field | Value | Matches spec? |
|-------|-------|---------------|
| `dog_id` | dogId | ✓ |
| `dog_name` | dogName \|\| 'Unknown' | ✓ |
| `walker_id` | user.id | ✓ |
| `walker_name` | profile?.full_name \|\| 'Walker' | ✓ |
| `note_type` | 'not_walking' | ✓ |
| `walk_date` | date | ✓ |
| `message` | 'Not walking today' | ✓ |
| `group_num` | groupNum \|\| null | ✓ |

All fields match the April 2 spec exactly.

**Reusability assessment (critical for Antigravity):**

The handler itself (`markNotWalking`) is **cleanly reusable** — it's a pure hook function in `usePickups.js` that takes `(dogId, dogName, groupNum)` and has no drawer-specific coupling.

However, the **wiring** is coupled to GroupOrganizer. Here's the chain:

1. `GroupOrganizer` calls `usePickups(date)` → gets `markNotWalking` (line 220)
2. When a dog card is clicked, GroupOrganizer builds a `_walkInfo` object with pre-bound closures: `markNotWalking: () => markNotWalking(dogId, dogName, groupKey)` (line 547)
3. This `_walkInfo` object is passed through `onDogClick` → Dashboard → DogDrawer → LiveWalkTimes → WalkTimesSection
4. DogDrawer wraps it: `onMarkNotWalking={wi.markNotWalking ? async () => { await wi.markNotWalking(); onClose?.() } : undefined}` (line 975)

**For the expand zone:** The DogCard component does NOT currently have access to `markNotWalking`. It receives `isNotWalking` as a boolean prop but has no handler prop to invoke the action. To surface "Not Walking today" in the expand zone, the Antigravity build needs to either:

- **(a)** Pass `onMarkNotWalking` as a new prop to DogCard from GroupOrganizer (same place `_walkInfo` is built), or
- **(b)** Call `usePickups(date)` directly inside DogCard (not recommended — breaks the single-source pattern where GroupOrganizer owns the hook instance)

Option (a) is the clean path. GroupOrganizer already has the bound closures at line 547; it just doesn't pass them to DogCard today.

---

## Assumption 3 — The undo pattern

**Verdict: ✓ Confirmed**

**Ground truth:**

- **Conditional logic:** `WalkTimesSection` in DogDrawer.jsx has two early returns based on state (line 1035):
  - If `isNotWalking && !pickedUpAt` → renders the NOT_WALKING state block with undo button
  - If `!pickedUpAt` → renders the WAITING state block with "Not Walking today" button
- **Undo button label (line 1054):** `Undo — pick up after all` — exact match to spec
- **Undo handler:** `undoNotWalking(dogId)` in usePickups.js (line 291) does a **hard delete**: `supabase.from('walker_notes').delete().eq('dog_id', dogId).eq('walk_date', date).eq('note_type', 'not_walking')` — no soft-delete, no reverse-row. Clean delete.
- **After undo:** Local state sets `notWalking: false`, shows toast "Not walking undone", calls `notifySync()`. Drawer closes via `onClose?.()`.

**Is there any other undo affordance outside the drawer?** No. The card body tap is disabled for not_walking dogs (DogCard.jsx line 378: `if (isReturned || isNotWalking) return`). No swipe gesture for undo. The only path to undo is: tap the dog name (which opens the drawer) → tap "Undo — pick up after all".

---

## Assumption 4 — Visual state on the dog card

**Verdict: ⚠ Partially correct (group count detail differs)**

**Ground truth — DogCard.jsx visual state when `isNotWalking=true`:**

| Property | Value | Matches spec? |
|----------|-------|---------------|
| Container background | `#FDF3E3` | ✓ |
| Container border | `1px solid #F0C76E` | ✓ |
| Container opacity | `1` | ✓ |
| Dog name color | `#C4851C` | ✓ |
| Dog name text-decoration | `line-through` | ✓ |
| Dog name text-decoration-color | `#C4851C` | ✓ |
| Dog name border-bottom | `1px dashed #F0C76E` | ✓ (amber dashed, differs from default purple dashed) |
| Card stays in group | Yes — no removal logic anywhere | ✓ |

**Badge in compact mode (line 322–325):**
```jsx
<span style={{ fontSize: 8, color: '#C4851C', fontWeight: 700, background: '#FDF3E3',
  border: '1px solid #F0C76E', padding: '1px 4px', borderRadius: 3 }}>
  Not walking
</span>
```
Label is "Not walking" (not "Not Walking today") — lowercase 'w', no 'today'. Matches compact mode intent.

**Chevron hidden:** Line 529 — `!isNotWalking` prevents the expand chevron from rendering. Card body tap is also disabled (line 378). The expand zone is unreachable for not_walking dogs.

**Group count — THE DRIFT:**

The denominator **does NOT exclude** not_walking dogs. In GroupOrganizer.jsx line 648:
```javascript
const total = dogIds.length
```
This is the raw count of all dogs in the group, regardless of state. The header displays `{total} dogs` (line 695). The "Continue route" button shows `{total - pickedCount} left` (line 807) — and since not_walking dogs are not counted as pickedUp, they inflate the "left" count.

So if a group has 4 dogs and 1 is not_walking: the header says "4 dogs" and the route button says "3 left" even though the walker only needs to pick up 3. This is a minor UX lie — the walker sees "3 left" but one of those 3 is never getting picked up.

---

## Additional Findings

### 1. Mini card expand zone — file, component, and JSX structure

**File:** `src/components/DogCard.jsx`  
**Lines:** 541–622  
**Condition:** `expanded && !isPickedUp && !isReturned` (note: does NOT check `!isNotWalking`, but this is moot because the card tap is disabled for not_walking)

**Current expand zone JSX structure:**

```
<div> (container — bg #FAF7F4, rounded bottom corners)
  ├── [if dog.notes] ★ Forever note section (fuschia bg #fdf4fb)
  ├── [if owlNote] 🦉 Owl note section (amber bg #FFFBF0)
  └── <div> Bottom button row (flex, gap 6, padding 8px 10px)
       ├── [if owlNote + onAcknowledgeOwl] "✓ Got it" button (sage green)
       └── "✎ Note" button (coral outline, always present)
</div>
```

The "✎ Note" button opens `NoteComposer` (a separate component, `src/components/NoteComposer.jsx`). It sets `showComposer(true)` and `expanded(false)`.

### 2. Exact styles of the "Not Walking today" button in the drawer

**From DogDrawer.jsx lines 1081–1086:**

```javascript
{
  width: '100%',
  padding: 10,
  borderRadius: 10,
  background: '#FDF3E3',
  color: '#C4851C',
  fontSize: 13,
  fontWeight: 700,
  textAlign: 'center',
  border: '1px solid #F0C76E',
  cursor: 'pointer',
  marginTop: 8,
}
```

The undo button uses identical styles (lines 1048–1053). Both buttons share the same visual treatment — only the label differs.

### 3. Unexpected / related code touching not_walking

**Mini Gen agent (`api/mini-gen.js` lines 172–194):** The Mini Gen cron job reads `walker_notes` rows with `note_type='not_walking'` for the current week. If a dog is booked in Acuity but marked not_walking, it flags a `vacationConflict` with reason `'Booked in Acuity but marked not_walking in walker_notes'`. This means: marking not_walking has a downstream effect on Gen's dashboard. If the Antigravity build changes the write pattern (different fields, different note_type string), Mini Gen will stop detecting these conflicts.

**Archive (`_archive/apps-script/Code.js`):** Contains legacy not_walking references. Not live code — safe to ignore.

**No tower/admin undo path:** Tower Control has no UI to undo a walker's not_walking mark. If a walker marks not_walking by accident and closes the drawer, they can re-open via the dog name tap and undo. But there's no admin override.

---

## If Antigravity Builds Naively From the April 2 Spec

Here's what would break or drift:

1. **Wrong file name.** The spec says `DogProfileDrawer` — the actual file is `DogDrawer.jsx`. The `DogProfileDrawer.jsx` file exists but is a completely different component (profile editing). Building against the wrong file = building against the wrong component.

2. **DogCard has no handler prop.** The expand zone lives in `DogCard.jsx`, but DogCard currently receives `isNotWalking` as a read-only boolean. There is no `onMarkNotWalking` prop. The Antigravity build MUST add this prop and wire it from GroupOrganizer (where the bound closure already exists at line 547). This is a ~5-line change in GroupOrganizer + a new prop in DogCard.

3. **Expand zone is hidden for not_walking dogs.** Line 529 hides the chevron, and line 378 disables tap. If the intent is "expand zone shows undo button when dog is not_walking," the expand condition on line 542 needs to include `|| isNotWalking` and the card tap handler on line 378 needs to allow expand toggle for not_walking dogs. Without this, the undo path from the expand zone is unreachable.

4. **Group count denominator lie.** The spec was unclear on this and the code doesn't exclude not_walking from the denominator. If the Antigravity build doesn't address this, the "3 left" count will continue to include not_walking dogs. Not a blocker, but worth a conscious decision.

5. **Mini Gen dependency.** The not_walking write MUST keep `note_type='not_walking'` and `walk_date` and `dog_name` intact, or Mini Gen's conflict detection breaks silently (no error, just missed conflicts).

---

*End of audit. No code was changed. No deployments. No brain entries written.*
