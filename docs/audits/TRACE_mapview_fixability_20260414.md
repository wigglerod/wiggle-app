# TRACE — MapView `dog_ids` Fixability Assessment

**Date:** 2026-04-14  
**Scope:** Read-only trace of `src/components/MapView.jsx` write paths (writers 6, 7, 8 from audit)  
**File:** 777 lines total

---

## Trace 1 — Data flow into MapView write sites

### Where `events` comes from

`events` is a **prop**: `export default function MapView({ events, date, sector, onDogClick, lockedView })` (line 239). MapView does not fetch events itself — it receives them from its parent. The parent's fetcher is not visible from this file alone.

Inside MapView, events are indexed into an `eventsMap` (line 282–288) keyed by `String(ev._id)`:

```js
const eventsMap = useMemo(() => {
  const m = new Map()
  for (const ev of events || []) {
    m.set(String(ev._id), ev)
  }
  return m
}, [events])
```

### The three write sites

All three capture the ID the same way — `String(ev._id)`:

| Writer | Line | How ID enters | What gets written to `dog_ids` |
|---|---|---|---|
| `handleLPMenuAssign` | 411 | `longPressMenu.dogId` ← set at line 397 as `String(ev._id)` | `[...wg.dog_ids, longPressMenu.dogId]` |
| `assignToGroup` | 429 | `selectedId` ← set at line 386 as `String(ev._id)` | `[...wg.dog_ids, selectedId]` |
| `handleGroupReorder` | 446 | Reorders existing `dog_ids` array (no new IDs injected) | Reordered `newDogIds` |

Writer 3 (`handleGroupReorder`) only reorders — it doesn't inject new bad-shape IDs, just shuffles whatever's already there.

### Is it the same `events` shape as `useWalkGroups`?

**Unknown — would need deeper trace.** `events` arrives as a prop, so we'd need to trace the parent component to confirm the shape. However, the critical difference is already visible:

- **useWalkGroups** (line 40) resolves IDs as: `ev.dog?.id || ev._id?.toString?.() || String(ev._id)` — prioritizing the Supabase UUID (`ev.dog?.id`).
- **MapView** always uses `String(ev._id)` — the Acuity numeric ID. Never checks `ev.dog?.id`.

If these are the same event objects (likely — same app, same data source), then the fix *is* mechanical: replace `String(ev._id)` with the same resolution chain from useWalkGroups line 40. But I can't confirm "same shape" without tracing the parent, so this stays at **likely mechanical, not confirmed mechanical**.

---

## Trace 2 — Reverse blast radius

### Does MapView read `walk_groups.dog_ids`?

Yes. The main reader is `orderedDogs()` (line 61–75), called at line 313:

```js
const { dogs, noAddr } = orderedDogs(wg.dog_ids, eventsMap, resolveAddress)
```

`orderedDogs` looks up each ID from `dog_ids` in `eventsMap`:

```js
const ev = eventsMap.get(String(id))  // id comes from dog_ids
if (!ev) continue                      // SILENT DROP if not found
```

**What shape does `orderedDogs` expect?** It expects IDs that match `eventsMap` keys — which are `String(ev._id)` (Acuity numeric IDs). So the reader is **currently aligned with the bug shape**.

### Blast radius of fixing writes

If we fix the writes to use dog names (or UUIDs), but `eventsMap` stays keyed by `String(ev._id)`, then:

1. **Newly assigned dogs would silently vanish from the map render.** `orderedDogs` would look up a UUID/name in a map keyed by Acuity ID → miss → `continue` → dog disappears from the group display.
2. **Existing groups with old Acuity-ID-shaped `dog_ids` would keep working** until someone reassigns.
3. **Mixed-shape `dog_ids` arrays** would emerge in the DB — some entries as Acuity IDs (legacy), some as names/UUIDs (new writes). Silent partial rendering.

**This means a write-only fix is not safe.** You'd also need to re-key `eventsMap` (or add a secondary index) and update `orderedDogs` to resolve both shapes. That's still tractable but it's not a one-line swap.

---

## Trace 3 — Pinned chaos check

**6 useState hooks, 4 useEffect hooks** in the main component, plus a sub-component (`MapWithMarkers`) with its own effect. No `useReducer`. The state is spread but not insane for a 777-line map component. No large commented-out blocks, no TODO/FIXME markers, no duplicate logic. The file has clean section-header dividers (`// ──`). The write logic (lines 407–455) is reasonably isolated in its own block — not tangled with rendering or map marker logic. The chaos Rod sensed is probably not in the write paths themselves but in the map/marker interaction layer and the multiple coordinate systems at play. The writes are one of the *cleaner* parts of this file.

---

## Verdict

**VERDICT: MODERATE**

The write paths are clean and isolated — that part is mechanical. But MapView's *reader* (`orderedDogs` via `eventsMap`) is currently aligned with the bug shape. Fixing writes without fixing the reader creates silent data loss (dogs vanish from map). A real fix requires: (1) swap write IDs, (2) re-key or dual-key `eventsMap`, (3) update `orderedDogs` lookup, (4) confirm parent passes same event shape as `useWalkGroups`. Estimated ~1–2 hours in a focused session, not 30 minutes. Not a landmine — the logic is traceable and the file isn't chaotic — but not a quick swap either. Given MapView is pinned for HQ rebuild anyway, deferring is the right call unless this bug is actively corrupting production data today.
