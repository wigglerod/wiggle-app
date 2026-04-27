# AUDIT: "Note" Button for Dog Profile Drawer — Ground Truth Report

**Date:** 2026-04-14  
**Auditor:** Claude (read-only, no code changes)  
**Repo:** wiggle-v4 @ `~/Documents/wiggle-v4/`  
**Purpose:** Verify five assumptions before Antigravity build adds a Note button to DogDrawer.

---

## Assumption 1 — How NoteComposer opens today

**Verdict: ⚠ Partially correct — the expand zone path is confirmed, but there are TWO separate note components, not one**

**Ground truth:**

There are two completely independent note entry paths, using two different components:

### Path A: Expand zone → NoteComposer (chip-based activity note)
- **File:** `src/components/DogCard.jsx` line 609–611
- **onClick:** `(e) => { e.stopPropagation(); setExpanded(false); setShowComposer(true); }`
- **State:** `showComposer` (useState in DogCard, line 36)
- **Mount location:** Inside DogCard's JSX, lines 625–633:
  ```jsx
  {showComposer && (
    <NoteComposer
      dog={dog}
      onClose={() => setShowComposer(false)}
      onSent={() => setShowComposer(false)}
    />
  )}
  ```
- **Props required:** `dog` (object with `id`, `dog_name`, `sector`), `onClose`, `onSent`
- **Writes via:** `useActivityNotes().writeNote()` → inserts to `walker_notes` with `note_type='note'` AND optionally to `owl_notes` (if "warn next walker" toggle is on)

### Path B: Right-swipe → QuickNoteSheet (tag-based quick note)
- **File:** `src/components/GroupOrganizer.jsx` lines 592–595, 1156–1168
- **Trigger:** Right-swipe on DogCard calls `onSwipeRight` → sets `swipeNoteDog` state in GroupOrganizer
- **Mount location:** Inside GroupOrganizer's JSX, lines 1158–1167:
  ```jsx
  <QuickNoteSheet
    isOpen={!!swipeNoteDog}
    onClose={() => setSwipeNoteDog(null)}
    dog={swipeNoteDog}
    groupName={swipeNoteGroupName}
    walkDate={date}
    walkerId={user?.id}
    walkerName={profile?.full_name || 'Walker'}
  />
  ```
- **Props required:** `isOpen`, `onClose`, `dog`, `groupName`, `walkDate`, `walkerId`, `walkerName`
- **Writes directly:** `supabase.from('walker_notes').insert(...)` with `note_type='note'` — no owl_notes integration, no `useActivityNotes` hook

**Key difference:** NoteComposer has chips + free text + "warn next walker" owl toggle + flag support. QuickNoteSheet has tags (different set) + free text + undo toast. They write the same `note_type='note'` to `walker_notes` but via different code paths with different field coverage.

---

## Assumption 2 — Whether NoteComposer is reusable from the drawer

**Verdict: ✓ Confirmed — NoteComposer is fully reusable, zero coupling to DogCard**

**Ground truth:**

NoteComposer (`src/components/NoteComposer.jsx`, 245 lines) is a self-contained bottom sheet. Its dependencies:

| Dependency | Source | Available in DogDrawer? |
|-----------|--------|------------------------|
| `dog` prop (id, dog_name, sector) | Passed from parent | ✓ — DogDrawer has `event.dog` with all these fields |
| `onClose` callback | Passed from parent | ✓ — trivial: `() => setShowNoteComposer(false)` |
| `onSent` callback | Passed from parent (optional) | ✓ — same as onClose, or no-op |
| `useAuth()` | Context provider | ✓ — DogDrawer already calls `useAuth()` at line 209 |
| `useActivityNotes()` | Hook, no params | ✓ — stateless hook, works anywhere |

NoteComposer renders its own `position: fixed` bottom sheet with its own backdrop (z-index 200–201). It does NOT depend on DogCard state, GroupOrganizer, the schedule view, or any parent-specific context. It manages its own chips, text, toggle, and send flow internally.

**To add to DogDrawer:**
1. `import NoteComposer from './NoteComposer'` (1 line)
2. `const [showNoteComposer, setShowNoteComposer] = useState(false)` (1 line)
3. A button somewhere in the drawer JSX: `onClick={() => setShowNoteComposer(true)}` (1 line)
4. Render block: `{showNoteComposer && <NoteComposer dog={dog || { id: event.dog?.id, dog_name: event.displayName, sector: event.dog?.sector }} onClose={() => setShowNoteComposer(false)} onSent={() => setShowNoteComposer(false)} />}` (4 lines)

That's it. No refactor needed.

**One subtlety:** DogDrawer's `dog` object may be null for unlinked Acuity events (events that haven't been matched to a dog profile yet). In that case, `event.dog` is a partial object built from the booking data. NoteComposer needs `dog.id` — if the dog isn't linked, the note would write with `dog_id: undefined`, which would fail the Supabase insert. The button should be conditionally shown only when `dog?.id` or `event.dog?.id` exists.

---

## Assumption 3 — Right-swipe gesture for notes

**Verdict: ⚠ Rod's recollection is correct but incomplete**

**Ground truth:**

Yes, there IS a right-swipe gesture on dog cards that opens a note sheet. But it opens **QuickNoteSheet**, not NoteComposer. They're different components.

**Swipe mechanics (DogCard.jsx):**

| Gesture | Direction | Action | Visual reveal |
|---------|-----------|--------|---------------|
| Left swipe (state 1: waiting) | ← | `onSwipeLeft` → markPickup | "✓ Pick up" sage green |
| Left swipe (state 2: picked up) | ← | `onSwipeLeftSecond` → markReturned | "🏠 Back home" coral |
| Right swipe (any locked state) | → | `onSwipeRight` → opens QuickNoteSheet | "✏ Note" coral |

**Swipe availability conditions (line 108):**
- Swipes are only active when: `isLocked && !isReturned && !isNotWalking`
- So: no swipes on unlocked groups, returned dogs, or not-walking dogs
- This means: **post-return, there's no swipe-for-notes path either** — same gap as the expand zone

**Right swipe flow:**
1. DogCard detects right swipe > 60px threshold → calls `onSwipeRight()` (line 94–96)
2. GroupOrganizer's callback (line 592) sets `swipeNoteDog` state
3. QuickNoteSheet renders as a bottom sheet (lines 1158–1167)
4. QuickNoteSheet writes to `walker_notes` directly (no `useActivityNotes` hook)

**About removal:** Rod's instinct ("if you think is easy, lets remove the swipe left for notes") — the swipe RIGHT (not left) is the note gesture. Removing it is straightforward: delete the `onSwipeRight` prop in GroupOrganizer (line 592–595) and the QuickNoteSheet render block (lines 1156–1168). The visual reveal in DogCard (lines 362–371) would also go. ~15 lines removed. But this should wait until the drawer Note button is live as a replacement path.

---

## Assumption 4 — Where the new Note button should sit in the drawer

**Verdict: Option B is the cleanest fit, with a twist**

**Ground truth — current drawer section order:**

```
1. Header (photo + name + breed badges)         lines 428–502
2. Walk Times (LiveWalkTimes)                    lines 670–672
3. ★ Forever Notes (read-only)                   lines 674–700
4. 🦉 Owl Notes (with "Got it" buttons)          lines 701–726
5. Access Info (tap-to-reveal)                   lines 728–763
6. Address (with Directions button)              lines 765–792
7. Owner Info (admin-only)                       lines 794–815
8. Contact & Instagram (admin-only)              lines 818–840
9. Acuity Booking Info (unlinked events only)    lines 842–850
10. Calendar Notes (unlinked events only)         lines 852–858
11. Check for Friends                             lines 860–863
12. Last Updated footer                           lines 865–870
13. Actions (Edit Profile / Link / Create)        lines 872–936
```

**Analysis of each option:**

**Option A — Top of drawer, near the dog name:**
- Tempting because it's always visible. But the header area (lines 428–502) is already dense: photo, name, breed, level badges, photo upload button. Adding a Note button here competes with the dog identity info. Also, the header is shared between view mode and edit mode — a Note button would need to hide in edit mode.

**Option B — Alongside existing action buttons (Walk Times section):**
- Walk Times is section #2, immediately visible on open. It already contains state-specific action buttons (Mark Pickup, Mark Returned, Not Walking, Undo). A Note button here would be discoverable and contextual. **However:** Walk Times only renders when `event._walkInfo` exists (line 670). For unlinked events or edge cases, it's absent. Also, the Walk Times section is a separate sub-component (`WalkTimesSection`, line 982) — adding a Note button there means modifying that sub-component.

**Option C — Bottom of drawer, after all sections:**
- Safest structurally. The bottom area (after "Check for Friends", before "Edit Profile") is uncrowded. But it's far below the fold on most screens — walkers would have to scroll past Access Info, Address, Owner Info, etc. The whole point is reducing friction; burying it at the bottom doesn't achieve that.

**Option D — Inline within Activity Notes section:**
- There IS no Activity Notes section in DogDrawer. The drawer shows Forever Notes (dog.notes) and Owl Notes, but not the walker_notes activity feed. This option doesn't map to existing structure.

**Recommendation: Option B-prime — a standalone action row between Walk Times and Forever Notes**

Place a "✎ Add Note" button at line ~673, between Walk Times and Forever Notes. Not inside WalkTimesSection, but as a sibling element in the view-mode flex column. This way:
- It's always visible (not gated on `event._walkInfo` existing)
- It's near the top of the drawer, high discoverability
- It doesn't require modifying the WalkTimesSection sub-component
- It renders in all walk states because it's outside the state-conditional WalkTimesSection
- It only requires `dog?.id` to be truthy (same guard as NoteComposer's needs)

**Suggested JSX insertion point — after line 672, before line 674:**
```jsx
{/* ── ✎ Add Note — always available when dog is linked ─── */}
{(dog?.id || event.dog?.id) && (
  <button
    onClick={() => setShowNoteComposer(true)}
    style={{
      width: '100%', padding: 10, borderRadius: 10,
      background: 'transparent', color: '#E8634A',
      border: '1.5px solid #E8634A', fontSize: 13, fontWeight: 700,
      textAlign: 'center', cursor: 'pointer',
    }}
  >
    ✎ Add Note
  </button>
)}
```

This style matches the expand zone's "✎ Note" button exactly (same coral outline pattern, DogCard.jsx line 612–616).

---

## Assumption 5 — Available walk states matter

**Verdict: ✓ Confirmed — no architectural barrier to rendering in all states**

**Ground truth:**

The DogDrawer view-mode section (lines 666–937) is one flat `<div className="flex flex-col gap-3">`. All sections are siblings — there's no wrapper that hides content based on walk state. The walk-state conditionals only exist INSIDE WalkTimesSection (which is a self-contained sub-component).

A Note button placed as a sibling element (Option B-prime above) would render in ALL states: pre-walk, picked-up, returned, not-walking. The only condition needed is `dog?.id` existing (to write a meaningful note).

**Swipe gestures are gated on state** (line 108: `isLocked && !isReturned && !isNotWalking`), so:
- Pre-walk, unlocked: no swipe notes, no expand zone (chevron only shows when locked, actually... let me check)
- Pre-walk, locked: swipe-right → QuickNoteSheet, expand zone → NoteComposer
- Picked up: swipe-right → QuickNoteSheet, no expand zone (collapses on pickup per line 123)
- Returned: no swipes, no expand zone
- Not walking: no swipes, no expand zone

**The drawer Note button fills the gap in returned and not-walking states** — exactly the scenarios where walkers currently have no note path.

---

## Also Report

### Note volume (unable to query — read-only audit)

I cannot query Supabase from this audit (read-only, no SQL execution). To get the note volume:
```sql
SELECT walker_name, COUNT(*) as note_count
FROM walker_notes
WHERE note_type = 'note'
  AND walk_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY walker_name
ORDER BY note_count DESC;
```
Rod can run this in the Supabase dashboard or a future audit can use the `execute_sql` MCP tool.

### Other entry points for adding notes

| Path | Component | Type | Available states |
|------|-----------|------|-----------------|
| Expand zone "✎ Note" button | DogCard → NoteComposer | Activity note with chips + owl toggle | Pre-walk, locked, not picked up |
| Right-swipe gesture | DogCard → GroupOrganizer → QuickNoteSheet | Quick note with tags | Locked, not returned, not not-walking |
| Edit Profile → "Notes" field | DogDrawer (edit mode) | Forever note (dog.notes) | Any (admin-only) |
| Owl notes | DogDrawer "Got it" button | Acknowledge only (no create) | Any |

**No Tower admin quick-note path found.** Tower components don't have a "send note about this dog" action — only the BeastSection references `not_walking` for display purposes.

### TODO/comment hints about notes-from-drawer

**None found.** No TODO, FIXME, or comments in DogDrawer.jsx mentioning a planned Note button. This is a net-new feature, not a completion of something started.

### Two-component note problem

The codebase has TWO note components that both write `note_type='note'` to `walker_notes`:

| | NoteComposer | QuickNoteSheet |
|---|---|---|
| **File** | `src/components/NoteComposer.jsx` | `src/components/QuickNoteSheet.jsx` |
| **Quick picks** | 6 chips (Great walk, Tired, Reactive, Paw, Energy, Flag) | 9 tags (different set — includes Sooo happyy, Wounded, Limping, DM Me) |
| **Writes via** | `useActivityNotes().writeNote()` hook | Direct `supabase.from('walker_notes').insert()` |
| **Owl note support** | ✓ "Warn next walker" toggle → writes to `owl_notes` | ✗ None |
| **Flag support** | ✓ 🚩 Flag chip | ✗ None |
| **Undo** | ✗ None | ✓ Toast with undo (deletes row) |
| **Used by** | DogCard expand zone | GroupOrganizer (swipe-right) |

This is a drift that Rod should be aware of. Two different note components, two different chip/tag sets, two different write patterns. The drawer Note button should use **NoteComposer** (the richer one with owl integration), not QuickNoteSheet.

---

## If Antigravity Built This Naively

1. **Confusing NoteComposer with QuickNoteSheet.** If the build imports QuickNoteSheet instead of NoteComposer, the drawer gets the simpler note sheet without owl/flag support. Always use NoteComposer for new surfaces — it's the more capable component.

2. **Forgetting the `dog?.id` guard.** Unlinked Acuity events have partial dog objects where `dog.id` may be undefined. NoteComposer calls `writeNote({ dogId: dog.id, ... })` — if dogId is undefined, the Supabase insert fails. The Note button must check `dog?.id || event.dog?.id` before rendering.

3. **Z-index collision with the drawer itself.** DogDrawer is a `position: fixed` bottom sheet. NoteComposer is also a `position: fixed` bottom sheet (z-index 200–201). DogDrawer's z-index isn't explicitly set in the code I read (it uses Tailwind's `z-50` = 50). NoteComposer at z-index 200 should render on top. But if someone later changes DogDrawer's z-index, the composer could slip behind the drawer backdrop. Test this visually.

4. **Missing `sector` field.** DogDrawer has `event.dog?.sector` but some dogs might not have a sector set. NoteComposer falls back: `dogSector: dog.sector || profile?.sector` — so it uses the walker's sector as fallback. This is fine, just be aware the fallback exists.

5. **The drawer closes on note send.** If the Note button calls `setShowNoteComposer(false)` on `onSent`, the composer closes but the drawer stays open. This is correct — the walker may want to do other things in the drawer after noting. Don't accidentally wire `onClose` to close the drawer too.

---

## Recommendation

**This is effectively a one-line surface.** NoteComposer is fully reusable with zero refactoring. The implementation is:

- 1 import
- 1 state variable
- 1 button in the JSX (placed between Walk Times and Forever Notes, ~line 673)
- 1 conditional render block for NoteComposer

Total: ~10 lines added to DogDrawer.jsx. No new files, no hook changes, no prop threading through GroupOrganizer.

**Placement recommendation: Option B-prime** — a standalone "✎ Add Note" button between Walk Times (section 2) and Forever Notes (section 3). Coral outline style matching the expand zone's existing Note button. Visible in all walk states. Gated only on `dog?.id` existing.

---

*End of audit. No code was changed. No deployments. No brain entries written.*
