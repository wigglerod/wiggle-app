# AUDIT: walk_groups.dog_ids Readers
**Date:** April 14, 2026  
**Scope:** Read-only code audit of all `dog_ids` field consumers in wiggle-v4 codebase  
**Search method:** Full grep + targeted file reads across `src/`, `api/`

---

## 1. Reader Inventory

### 1.1 useWalkGroups hook (src/lib/useWalkGroups.js)

**Line 40: eventIds computation**
```javascript
const allEventIds = events.map((ev) => ev.dog?.dog_name || ev._id?.toString?.() || String(ev._id))
```
- **What:** Builds canonical ID list for matching. Uses `dog_name` (matches walk_groups write), fallback `_id`.
- **Trigger:** On initial hook load; dependency on `events` array
- **Lookup key shape:** String (dog_name or _id as string)

**Line 71: Initial load + filter**
```javascript
const ids = [...new Set(row.dog_ids || [])].filter((id) => allEventIds.includes(id) && !assignedSet.has(id))
saved[row.group_num] = ids
```
- **What:** Reads `row.dog_ids` from each walk_groups row during initial load. Filters by:
  - Membership in `allEventIds` (deduplication with current events)
  - Not already assigned to another group
- **Trigger:** First `load()` effect when date/sector/allEventIds change (line 44-106)
- **Lookup key shape:** String; matched against `allEventIds` Set
- **Expected dog_ids shape:** Array of strings (dog_names or _ids)
- **Line 44:** Guard: "if (!date || !sector || allEventIds.length === 0) return"

**Line 162: Realtime subscription handler**
```javascript
const ids = [...new Set(row.dog_ids || [])].filter((id) => allEventIds.includes(id))
```
- **What:** Same filter applied to realtime postgres_changes payload (INSERT/UPDATE/DELETE)
- **Trigger:** Realtime channel subscription (lines 111-181) when date/sector change
- **Lookup key shape:** String (same as initial load)
- **Expected dog_ids shape:** Array of strings

---

### 1.2 GroupOrganizer component (src/components/GroupOrganizer.jsx)

**Line 289: eventsMap key computation**
```javascript
const key = ev.dog?.id || String(ev._id)
m.set(key, ev)
```
- **What:** Creates lookup map for events keyed by dog UUID or _id (not dog_name)
- **Comment at line 285:** "Key by dog UUID (matches useWalkGroups allEventIds). Fallback to _id."
- **DRIFT RISK:** This comment is **INCORRECT**. The actual useWalkGroups uses `dog_name`, not `dog?.id`
- **Trigger:** Dependency on `events` array (line 293)
- **Lookup key shape:** UUID (ev.dog.id) or numeric _id as string

**Line 320-321: Conflict detection loop**
```javascript
const ev1 = eventsMap.get(dogIds[i])
const ev2 = eventsMap.get(dogIds[j])
```
- **What:** Inner loop of activeConflicts useMemo. For each group number, iterates `groups[num]` (which are dog_ids from walk_groups state)
- **Line 317:** `const dogIds = (groups[num] || []).map(String)`
- **Lookup key shape:** String (stringified form of dog_ids values)
- **Expected shape:** dog_ids should be strings matching eventsMap keys (dog.id or _id)
- **Drift risk:** **BREAKS** if walk_groups.dog_ids stores dog_names instead of UUIDs/IDs

**Line 390-391: Move event (drag-drop)**
```javascript
const ev = eventsMap.get(dogId)
const targetName = targetGroup === 'unassigned' ? 'Unassigned' : (groupNames[targetGroup] || `Group ${targetGroup}`)
moveEvent(dogId, fromGroup, targetGroup)
```
- **What:** On drag completion, looks up event from eventsMap using selectedId (same as dogIds from groups state)
- **Trigger:** onDragEnd handler when user drops a dog card
- **Lookup key shape:** String (dog UUID or _id)

**Line 436, 464, 515, 531, 646-651, 657-658, 762-792:** Multiple additional lookups
- All use `eventsMap.get(id)` where `id` comes from `dogIds` arrays in `groups` state
- Pattern: iterate `groups[num]`, convert to string, lookup in eventsMap

**Line 286-293: eventsMap creation**
```javascript
const eventsMap = useMemo(() => {
  const m = new Map()
  for (const ev of events) {
    const key = ev.dog?.id || String(ev._id)
    m.set(key, ev)
  }
  return m
}, [events])
```
- **Lookup key shape:** dog.id (UUID) or _id stringified
- **Expected dog_ids shape:** Must match keys in eventsMap

---

### 1.3 WeeklyView component (src/components/WeeklyView.jsx)

**Line 50: Supabase query**
```javascript
.select('walk_date, group_num, dog_ids, walker_ids, group_name')
```
- **What:** Queries walk_groups for the entire week. Selects `dog_ids` but does NOT consume it for lookups
- **Line 68:** `entry.dogs += (row.dog_ids || []).length`
- **Trigger:** Load effect on weekDays or sector change (line 81)
- **Consumption:** Only counts the length, doesn't attempt key-based matching
- **Lookup key shape:** N/A (read-only count, no matching)

---

### 1.4 MapView component (src/components/MapView.jsx)

**Line 254-260: Supabase query**
```javascript
const query = supabase
  .from('walk_groups')
  .select('*')
  .eq('walk_date', date)
```
- **What:** Fetches all walk_groups rows for the given date (and optionally sector)
- **Trigger:** useEffect on date/sector change (line 250-265)
- **State:** `setWalkGroups(data || [])` at line 261

**Line 282-288: eventsMap creation**
```javascript
const eventsMap = useMemo(() => {
  const m = new Map()
  for (const ev of events || []) {
    m.set(String(ev._id), ev)
  }
  return m
}, [events])
```
- **Lookup key shape:** String(_id) — differs from GroupOrganizer!
- **Expected dog_ids shape:** Values must be _id stringified, NOT dog.id or dog_name

**Line 313: orderedDogs call**
```javascript
const { dogs, noAddr } = orderedDogs(wg.dog_ids, eventsMap, resolveAddress)
```
- **Helper function at line 61-75:**
  ```javascript
  function orderedDogs(dogIds, eventsMap, addrResolver) {
    const dogs = []
    const noAddr = []
    for (const id of [...new Set(dogIds || [])]) {
      const ev = eventsMap.get(String(id))
      if (!ev) continue
      const addr = addrResolver ? addrResolver(ev) : (ev.dog?.address || ev.location)
      if (addr && addr.trim()) {
        dogs.push({ event: ev, address: addr.trim() })
      } else {
        noAddr.push(ev.displayName || ev.dog?.dog_name || 'Unknown')
      }
    }
    return { dogs, noAddr }
  }
  ```
- **What:** Iterates dog_ids, deduplicates, looks up each in eventsMap
- **Lookup key shape:** String (converted from dog_id value)
- **Expected dog_ids shape:** _id stringified (matches MapView's eventsMap)

**Line 315-318: Additional filtering**
```javascript
for (const id of [...new Set(wg.dog_ids || [])]) {
  const ev = eventsMap.get(String(id))
  if (ev) assignedIds.add(String(id))
}
```
- **What:** Redundant dedup + lookup of same dog_ids
- **Lookup key shape:** String (same as orderedDogs)

**Line 411, 429, 446, 452:** Writer lines (UPDATE dog_ids)
- These are WRITES, not readers; excluded from this audit

---

### 1.5 Admin.jsx (src/pages/Admin.jsx)

**Line 104: Supabase query**
```javascript
.select('walk_date, group_num, group_name, dog_ids, sector')
```
- **What:** Fetches walk_groups for walk history search
- **Trigger:** handleSearch function when user clicks search button
- **Consumption at lines 109-118:**
  - Comment at line 110: "Since dog_ids stores event IDs (not dog UUIDs), we need to look for patterns"
  - Comment at line 111: "For history, we match by checking if both dog names appear in the same group"
  - Comment at line 112: "We'll need to match via dog_ids — but dog_ids are session-specific _id counters"
  - Then fallback to walk_logs table (lines 121-135)
- **Actual usage:** NOT consumed for matching; data loaded but then abandoned in favor of walk_logs fallback
- **Lookup key shape:** Data loaded but not used; fallback uses walk_logs.dog_id (actual dog UUID)

---

### 1.6 tower-approve.js (api/tower-approve.js)

**Line 76: Supabase query (contains check)**
```javascript
.contains('dog_ids', [dogName])
```
- **What:** Idempotency check — looks for existing walk_groups row containing the dog_name in dog_ids array
- **Trigger:** For each dog_name in draft.dog_names (line 69)
- **Lookup key shape:** Array contains check; looks for dog_name string
- **Expected dog_ids shape:** Array of dog names (strings)

**Line 94: Write operation (creates row with dog_ids)**
```javascript
dog_ids: [dogName],
```
- **What:** WRITE, not reader; excluded from audit

---

### 1.7 BeastSection.jsx (src/components/tower/beast/BeastSection.jsx)

**Line 7 (system prompt):**
```
You have read access to: dogs, walk_groups, walker_notes, owl_notes, mini_gen_drafts, profiles, acuity_name_map, dog_conflicts.
```
- **What:** Prompt documentation only. No actual code reads walk_groups.dog_ids
- **Note:** Beast is read-only for informational purposes; all actions require user confirmation
- **Trigger:** User query to Beast AI
- **Actual code:** No direct walk_groups reading; Beast receives query context from caller

---

## 2. Cross-Reference Table

| File | Function/Component | Line(s) | Lookup Key Shape | Expected dog_ids Shape | Drift Risk if Writers Change to Names | Last Read Audit |
|------|-----------|---------|-------------------|------------------------|--------------------------------------|-----------------|
| src/lib/useWalkGroups.js | useWalkGroups → load | 71 | String (dog_name or _id) | Array[string]: dog_names or _ids | OK | Today |
| src/lib/useWalkGroups.js | useWalkGroups → realtime handler | 162 | String (dog_name or _id) | Array[string]: dog_names or _ids | OK | Today |
| src/components/GroupOrganizer.jsx | GroupOrganizer → eventsMap | 289 | String (_id or dog.id UUID) | Array[string]: _ids or UUIDs | **BREAKS** | Today |
| src/components/GroupOrganizer.jsx | activeConflicts loop | 320-321 | String (_id or UUID) | Array[string]: _ids or UUIDs | **BREAKS** | Today |
| src/components/GroupOrganizer.jsx | multiple render fns | 390-792 | String (_id or UUID) | Array[string]: _ids or UUIDs | **BREAKS** | Today |
| src/components/WeeklyView.jsx | WeeklyView → load | 68 | N/A (count only) | Array (any) | OK | Today |
| src/components/MapView.jsx | MapView → eventsMap | 282-288 | String(_id) | Array[string]: _ids | **BREAKS** if names written | Today |
| src/components/MapView.jsx | orderedDogs → loop | 64-74 | String(_id) | Array[string]: _ids | **BREAKS** if names written | Today |
| src/pages/Admin.jsx | handleSearch → query | 104 | N/A (fallback to walk_logs) | Array (loaded but not used) | OK (unused) | Today |
| api/tower-approve.js | handler → contains check | 76 | dog_name string (array contains) | Array[string]: dog_names | OK | Today |
| src/components/tower/beast/BeastSection.jsx | TOWER_SYSTEM prompt | 7 | N/A (documentation) | N/A (no actual code read) | OK | Today |

---

## 3. Summary

**Total readers found: 11 (across 6 files)**

### By Drift Risk:

**BREAKS (3 readers) — Critical if dog_ids written as dog_names:**
1. **GroupOrganizer.jsx** — `eventsMap` lookup at line 289. Key comment at 285 is INCORRECT: says "matches useWalkGroups allEventIds" but actually keys on `ev.dog.id` or `_id`, NOT `dog_name`. If walk_groups.dog_ids contains dog_names, all `eventsMap.get(id)` lookups return null.
2. **GroupOrganizer.jsx** — conflict detection (lines 320-321). Same eventsMap problem.
3. **MapView.jsx** — orderedDogs function (lines 64-74) and eventsMap (line 282-288). Keys on `_id` only. If dog_ids contains dog_names, all lookups fail silently.

**OK (5 readers) — Tolerant of either format:**
1. **useWalkGroups.js** — Already uses `dog_name` as canonical ID; reads dog_ids and matches against `allEventIds` which also uses dog_name. Shape-tolerant.
2. **WeeklyView.jsx** — Only counts `dog_ids.length`; doesn't attempt matching. Agnostic to shape.
3. **Admin.jsx** — Loads dog_ids but never consumes it; falls back to walk_logs table. Unused.
4. **tower-approve.js** — Writes dog_names into dog_ids via `.contains([dogName])` check. Expects names. Consistent with own writes.
5. **BeastSection.jsx** — No actual code reads.

### Key Finding:

**Architectural inconsistency detected.** Three readers (GroupOrganizer, MapView) assume dog_ids contains session-local event IDs (_id), but the writer (useWalkGroups line 194, tower-approve line 94) stores **dog_name** strings. This works only because:
- GroupOrganizer and MapView are never used together on the same walk_date/sector in the current UI flow
- But if they ever are used together, or if a new feature tries to render both views, the mismatch will surface

**Line 285 comment in GroupOrganizer is misleading.** It claims the eventsMap "matches useWalkGroups allEventIds" but the actual keys are `ev.dog.id` (UUID) or `_id` (event session counter), not `dog_name`.

---

## 4. No Edge Functions or Supabase Functions Found

Grep for `supabase/functions/` returned no results. No serverless functions read walk_groups in this codebase.

