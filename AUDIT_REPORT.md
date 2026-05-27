# Wiggle-v4 Audit Report
## Date: 2026-05-26
## Commit: 261a5a7a0b1b0521f82a3db0aa2109d0e37fb70b

## Summary
- 11 correctness findings
- 8 performance findings
- Top 3 to fix first:
  1. Owl-note acknowledgement is global — when one walker taps "Got it" on a dog reminder, every other walker immediately stops seeing it. A safety reminder can vanish before everyone has read it.
  2. The pickup-time edit modal hardcodes the `-04:00` (EDT) UTC offset, so any time edited between November and March is saved one hour off.
  3. The shared walk-groups realtime channel ignores DELETE events — admin-deleted groups stay visible on every walker's screen with stale dog assignments until they hard-refresh.

---

## Correctness Findings

### [CRITICAL] Owl-note acknowledgement is shared, not per-walker
**File:** `src/lib/useOwlNotes.js:170`
**What's wrong:** Owl notes are how Tower passes safety info to walkers ("Mae bites at door — knock first"). The "Got it" button is supposed to be a personal acknowledgement, but right now whoever taps it first hides the note for everyone, even walkers who haven't opened it yet. A real safety reminder can disappear off another walker's screen mid-morning.
**Why it happens:** `acknowledgeNote` writes `last_acknowledged_date = today` to the single shared `owl_notes` row, and `useOwlNotes` filters the row out for every walker whose realtime UPDATE matches that date (line 224: `if (n.expires_at && n.last_acknowledged_date === today) return false`). There's only one `acknowledged_by` column, not a per-walker join table. Realtime UPDATE then propagates the change to every other open client.
**How to verify it's real:** Two walkers open the app on the same morning, one taps "Got it" on a dog-targeted reminder with a duration. The second walker's banner/owl indicator on that dog disappears within seconds.
**Suggested fix direction:** Track acknowledgement per-walker in a separate table (e.g. `owl_note_acks(note_id, walker_id, ack_date)`); leave the parent row untouched on dismiss.

### [CRITICAL] Pickup-time edit hardcodes EDT offset
**File:** `src/components/DogDrawer.jsx:1009`
**What's wrong:** When a walker edits the pickup or "back home" time after the fact, the saved timestamp is off by one hour for ~5 months of the year (standard time, roughly November through mid-March). The card and walk-log will then show a time the walker did not enter.
**Why it happens:** `saveEdit` constructs the new Date with a string-template offset: `new Date(\`${walkDate}T${hh}:${mm}:00-04:00\`)`. `-04:00` is Eastern Daylight Time; during Eastern Standard Time the correct offset is `-05:00`. There is no DST detection. The Toronto timezone is otherwise used correctly elsewhere via `toLocaleString('en-US', { timeZone: 'America/Toronto' })`.
**How to verify it's real:** Edit a pickup time in dev tools clock-shifted to January, save, then read the row back and reformat — the displayed time will be one hour later than what you typed.
**Suggested fix direction:** Compute the correct offset for `walkDate` (e.g. via `Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', timeZoneName: 'shortOffset' })`) or store a wall-clock string and resolve to UTC server-side.

### [CRITICAL] Walk-groups realtime ignores DELETE
**File:** `src/lib/useWalkGroups.js:142`
**What's wrong:** When an admin or Tower deletes a walk-group row (e.g. clears today's plan to rebuild it), the deletion is invisible to every walker who already has the app open. The group keeps showing, dogs in it stay assigned to a group that no longer exists in the DB, and any locks/walker-assignments freeze in the last state Tower saw.
**Why it happens:** The handler at line 142 reads `payload.new` and returns early if it's null or wrong-sector. On a Postgres DELETE event, `payload.new` is null and `payload.old` carries the deleted row, so the handler short-circuits before touching state. There is no `eventType === 'DELETE'` branch.
**How to verify it's real:** With a walker session open, delete a row from `walk_groups` for today (or call the same logic from Tower). The walker's `groupNums`, `groups[num]`, `groupLocks`, `walkerAssignments` all remain populated for the deleted group until the next full `load()`.
**Suggested fix direction:** Branch on `payload.eventType`; on DELETE, remove the row from `groupNums`, `groups`, `groupNames`, `groupLocks`, `walkerAssignments` and rebuild `unassigned`.

### [HIGH] Offline queue can lose actions on replay
**File:** `src/lib/useOffline.js:53`
**What's wrong:** If a walker taps a pickup and another tap (or any other write) happens during the few milliseconds the replay loop is running, the second action gets enqueued but is then wiped along with the rest of the queue. Walker's tap looks like it worked (toast says synced) but nothing reached the DB.
**Why it happens:** `replayOfflineQueue` reads the queue into a local `queue` array, iterates it, then unconditionally calls `localStorage.removeItem(QUEUE_KEY)` (line 95). Any `enqueueOfflineAction` call that landed between the read and the remove is silently discarded. The same `removeItem` also discards *failed* items that the per-action `catch` logged — they are never retried.
**How to verify it's real:** Throttle the network, queue 2 offline actions, come back online, and during the replay loop trigger a third offline action. The third action's row never appears in `walker_notes`, and `localStorage.wiggle_offline_queue` is empty.
**Suggested fix direction:** Pop items individually as they succeed (or write back the unprocessed/failed tail), and run replay under a single-flight guard so concurrent calls don't race.

### [HIGH] Offline queue is never replayed on app start
**File:** `src/lib/useOffline.js:12`
**What's wrong:** If a walker queued actions while offline, killed the app (or it crashed / iOS evicted the PWA), and then reopened it while still online, the queued actions sit in `localStorage` until the next online → offline → online cycle. The walker sees their pickup on the card (from the optimistic state, if it survived) but no row is in `walker_notes` and no one else can see it.
**Why it happens:** `replayOfflineQueue` is only invoked from the `window.addEventListener('online', ...)` handler. There is no replay attempt on mount or on visibility return. `navigator.onLine === true` at app start does not fire an `online` event.
**How to verify it's real:** Set network to offline, perform a pickup, force-quit the app, restore the network, reopen the app. `localStorage.wiggle_offline_queue` still contains the entry; no row appears in `walker_notes` until you toggle network off/on again.
**Suggested fix direction:** Call `replayOfflineQueue()` once on app mount (after first successful auth check), and also on visibility return alongside the existing `useChannelHealth` resync.

### [HIGH] `updateTimestamp` has no rollback or transport handling
**File:** `src/lib/usePickups.js:364`
**What's wrong:** When a walker corrects a pickup or "back home" time via the drawer, the app optimistically shows the new time, deletes the old DB row, then inserts a new one. If anything between the delete and the insert fails (network drop, RLS reject on the insert, anything not a `23505`), the DB now has no row for that note type while the local card keeps showing the new time. The walker leaves believing their correction saved.
**Why it happens:** `updateTimestamp` sets local state, then issues `delete` followed by `insert`. The delete result is not checked at all. The insert's error branch only filters out `23505` and shows a toast — there is no rollback of the local optimistic state and no transport-failure queueing. The transport-failure path that every other writer in this file has is missing here.
**How to verify it's real:** Open the drawer for a returned dog, edit the time, throttle the network to "offline" between the delete and insert (or revoke RLS on insert temporarily), confirm the toast says "Failed to update time", and observe the card still shows the new time while the DB row is gone.
**Suggested fix direction:** Snapshot the prior pickedUpAt/returnedAt before optimistic write; on any error, restore the snapshot. Route transport failures through `enqueueOfflineAction` like the other writers.

### [HIGH] `useOwlNotes.load` deletes expired rows on every load
**File:** `src/lib/useOwlNotes.js:52`
**What's wrong:** Every walker, every time their `useOwlNotes` hook (re)loads — on mount, on every visibility return, on every focus/online/pageshow, on every active-probe-driven resync, on every `permissions`/`userSector` change — sends a `DELETE FROM owl_notes WHERE expires_at < now()` to Supabase. If RLS allows the delete, walkers are racing to delete each other's expired notes; if RLS blocks it (most likely), every walker is firing a wasted authenticated round-trip per resync. Either way it's wrong: cleanup is not a walker-side responsibility.
**Why it happens:** The DELETE is the first thing `load()` does. The result is not even checked.
**How to verify it's real:** Watch the network tab as you switch between apps on the phone — every visibility return fires `DELETE /rest/v1/owl_notes?expires_at=lt.<ts>` from each walker.
**Suggested fix direction:** Remove the DELETE from the walker path entirely; do expired-note cleanup on a server-side cron / Supabase Edge Function. Walker `load()` should be SELECT-only.

### [HIGH] New-group number is computed locally — collisions overwrite each other
**File:** `src/lib/useWalkGroups.js:268`
**What's wrong:** Two walkers / admins adding a new group at the same time will both pick the same next group_num from their local `groupNumsRef.current`, both upsert with `onConflict: 'walk_date,group_num,sector'`, and the second walker's upsert silently overwrites the first (including any dogs/walker_ids the first walker may have set in the same gesture). One person's work disappears with no toast and no error.
**Why it happens:** `addGroup` does `Math.max(...groupNumsRef.current) + 1` from local state. The upsert's `onConflict` resolves the conflict by replacing the existing row.
**How to verify it's real:** Two browser sessions on the same date/sector. Both press "Add group" within a couple of seconds. Inspect `walk_groups` — there is one row at the new group_num, owned by whoever wrote last.
**Suggested fix direction:** Allocate the next group_num server-side (e.g. an RPC that does `INSERT ... RETURNING group_num`) or use a `walk_date_sector_seq` table.

### [HIGH] `lockGroup` UPDATE on a row that doesn't exist yet
**File:** `src/lib/useWalkGroups.js:341`
**What's wrong:** A walker who creates a group via `addGroup` then locks it before any `saveGroup`/`reorderGroup`/`renameGroup` has had a chance to actually run can hit a window where the `walk_groups` row doesn't exist yet — the UPDATE matches zero rows and the lock is never written. The locker's UI shows "locked", everyone else's shows unlocked, and the divergence persists until next resync. Because the SDK doesn't report "0 rows affected" as an error, there is no toast.
**Why it happens:** `addGroup`'s upsert is fire-and-forget inside an IIFE; `lockGroup` issues a plain UPDATE eq'd on `walk_date/group_num/sector` and treats no-error as success. If the add upsert hasn't landed yet, lockGroup's UPDATE silently affects zero rows.
**How to verify it's real:** Add a new group and immediately call `lockGroup`. With network throttling the race is reliably reproducible — local locks, DB row stays `locked: false` (or no row at all), other clients keep editing.
**Suggested fix direction:** Make `lockGroup` an upsert that ensures the row exists, or chain it after `addGroup`'s upsert resolves; check `data.length` from `.select()` to detect no-op updates.

### [HIGH] Realtime handler captures stale event-ID list
**File:** `src/lib/useWalkGroups.js:180`
**What's wrong:** When a dog that was a TBD/unmatched Acuity event becomes a resolved dog later in the day (e.g. an admin maps it via DogDrawer's "Link to Existing Dog"), realtime updates from `walk_groups` no longer correctly include that dog in groups for any walker who already had the page loaded. The card can render in the wrong group or show as unassigned until full reload.
**Why it happens:** The subscription effect re-runs only on `[date, sector, allEventIds.length]`. `allEventIds` is rebuilt every render; if events array contents change but length doesn't (a TBD swap or sector flip), the channel closure keeps using the originally-captured `allEventIds`, so `allEventIds.includes(id)` / `allEventIds.filter(...)` operate against an outdated set.
**How to verify it's real:** Open the walker view with one unresolved event. In a separate session, link it to a real dog via the drawer. Then have Tower move that dog in a group — the realtime payload arrives but the walker's view doesn't pick it up.
**Suggested fix direction:** Keep the subscription stable but read the current event list from a ref (`allEventIdsRef.current`) inside the handler; or include event identity (e.g. a hash of dog_names) in the dep array.

### [MEDIUM] `markNotWalking` / `undoNotWalking` lack guards and offline path
**File:** `src/lib/usePickups.js:401`
**What's wrong:** Three smaller asymmetries with the other walker-notes writers: (a) `markNotWalking` has no `if (pickups[dogId]?.notWalking) return` pre-write guard, so a double-tap on a flaky network inserts twice and relies on the partial unique index to no-op the second; (b) `undoNotWalking` has no `isTransportFailure` queueing branch, so undoing "not walking" offline shows a red toast and silently does nothing while pickup/return undo offline are queued; (c) `markNotWalking` calls `notifySync()` with no updater, forcing every other hook instance to re-`load()` instead of patching state.
**Why it happens:** The "not walking" branch was added after the pickup/return symmetry was built and didn't replicate all of its safety paths.
**How to verify it's real:** Read the file at lines 401–481 against 137–264; the missing branches are clearly absent.
**Suggested fix direction:** Mirror the pickup/return handlers — add the `notWalking` guard, the transport-failure queue path, and pass an updater to `notifySync`.

---

## Performance Findings

### [HIGH] `freshBundle` blocks every write with a 3-second uncached fetch
**File:** `src/lib/freshBundle.js:53`
**What's wrong:** Every walker swipe (pickup, return, undo, group save, lock, rename, walker reassign, note insert, alt-address change) awaits a `cache: 'no-store'` fetch of `/version.json` with a 3-second timeout before issuing its write. On a good signal that's a small extra round-trip per action; on basement signal it's up to 3s of "did anything happen?" before the optimistic UI lands. Across a morning with 40 pickups + 40 returns, that's 80 unconditional network fetches per walker just for the gate.
**Why it happens:** `assertFreshOrThrow` is called inline at the top of every writer. There is no in-process cache window; every call hits the network.
**How to verify it's real:** Open Chrome DevTools network tab, throttle to "Slow 3G", swipe a pickup. The pickup write is held behind the `/version.json` GET until either it returns or the 3s timer fires.
**Suggested fix direction:** Cache the version check in memory for a few seconds (or until the next visibility return), so a burst of pickups in a hallway only pays the fetch once.

### [HIGH] `usePickups` fires up to 5 parallel REST loads per drawer open
**File:** `src/lib/usePickups.js:51` (callers: `src/components/GroupOrganizer.jsx:220`, `src/components/DogDrawer.jsx:950`, `src/components/DogDrawer.jsx:986`)
**What's wrong:** Opening a dog drawer mounts `usePickups(date)` two additional times (in `LiveWalkTimes` and `WalkTimesSection`), on top of the always-mounted instance in `GroupOrganizer`. When the dashboard is viewing both sectors, `GroupOrganizer` itself is rendered twice — so opening a drawer fires up to five independent `SELECT * FROM walker_notes WHERE walk_date=...` round-trips. The realtime channel is deduped by `sharedRealtimeChannel`, but the initial REST `load()` is not, and each instance maintains its own state map that the others have to catch up to via the window event.
**Why it happens:** Hook state is per-mount; only the realtime channel is shared. Every mount runs the initial `load` effect.
**How to verify it's real:** Network tab, sector="both", tap a dog — you'll see 4–5 simultaneous `walker_notes` GETs.
**Suggested fix direction:** Centralize the date's pickups in a context provider (one fetch per date), and have hook callers read from the shared store.

### [HIGH] Acuity API route has no caching
**File:** `api/acuity.js:60`
**What's wrong:** The Acuity-fetch endpoint sets no `Cache-Control` header. Every Dashboard mount, every pull-to-refresh, every sector cycle, every Today↔Tomorrow toggle re-hits `/api/acuity?date=...`, and the route in turn re-hits Acuity. With 7 walkers all opening the app within a few minutes, Acuity sees 7+ identical full-day fetches; each costs the walker 1–3s before the day's events render.
**Why it happens:** The handler calls `res.json(events)` without setting any cache header. Vercel defaults to no caching.
**How to verify it's real:** `curl -I https://wiggle-app-dusky.vercel.app/api/acuity?date=2026-05-26` shows no `Cache-Control` or `s-maxage`. Refresh the dashboard a few times — every load hits Acuity.
**Suggested fix direction:** Add `res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')` (or similar). Acuity data shifts rarely within a day; a 1-minute edge cache saves both walker latency and Acuity quota.

### [MEDIUM] Owl-note cleanup DELETE on every walker resync
**File:** `src/lib/useOwlNotes.js:52`
**What's wrong:** Same row as Correctness Finding above, but flagged here as a perf cost: the wasted DELETE round-trip happens on visibilitychange, focus, online, pageshow, and the 30s active probe (via `lastResyncAt`), each of which calls `load()`. For a walker who background/foregrounds the app 30 times in a morning, that's 30 wasted writes per walker.
**Why it happens:** `load()` issues the DELETE unconditionally before the SELECT.
**How to verify it's real:** Background/foreground the app several times with the network tab open; watch for `DELETE owl_notes?expires_at=lt...` on each return.
**Suggested fix direction:** Remove the DELETE from `load()` (also fixes the correctness finding above).

### [MEDIUM] Dogs + name-map fetched in full on every refresh
**File:** `src/pages/Dashboard.jsx:77`
**What's wrong:** The Dashboard re-fetches every row of `dogs` and `acuity_name_map` on initial mount and on every pull-to-refresh. `dogs` is ~hundreds of rows with no projection — every column comes back, including long text fields (`notes`, `goals`, `access_notes`). There is also no realtime subscription on `dogs`, so the walker only sees profile edits after pull-to-refresh.
**Why it happens:** `fetchDogs` does `.select('*')` against both tables; no incremental sync.
**How to verify it's real:** Network tab on a fresh open; one ~hundreds-of-rows JSON response for dogs and one for acuity_name_map.
**Suggested fix direction:** Project only the columns the dashboard actually uses, and subscribe to `dogs` realtime updates so manual refresh isn't needed.

### [MEDIUM] AuthContext value not memoized — every consumer re-renders with provider
**File:** `src/context/AuthContext.jsx:55`
**What's wrong:** Every render of `AuthProvider` creates a new `value` object and a new `permissions` object via `getPermissions(role)`. Every component using `useAuth()` (GroupOrganizer, every DogCard, DogDrawer, etc.) re-renders on every Auth re-render — and `permissions` being a new object means any consumer that puts it in a useEffect/useMemo dep array runs that effect/memo every render.
**Why it happens:** No `useMemo` around `value`; `getPermissions(role)` doesn't memoize.
**How to verify it's real:** Wrap a console.log in any leaf consumer and click anywhere that updates Auth-adjacent state — every consumer re-renders.
**Suggested fix direction:** `useMemo` the `value` object (and the inner `permissions`) keyed on the few primitives that actually change (role, sector, session id, isLoading).

### [MEDIUM] Walker list re-fetched on every sector change
**File:** `src/components/GroupOrganizer.jsx:230`
**What's wrong:** The walker-list fetch (`profiles` table) runs every time `sector` changes. With sector cycling Plateau → Laurier → both, opening the app and cycling fires three full `profiles` selects in succession. The data rarely changes intraday.
**Why it happens:** The effect's only dep is `sector`; no caching across cycles.
**How to verify it's real:** Cycle the sector chip in the header — three GETs of `profiles` in DevTools.
**Suggested fix direction:** Fetch once per session into a context (or use TanStack Query–style caching); the list is small and stable.

### [MEDIUM] N×M conflict scan rebuilt on every render
**File:** `src/components/GroupOrganizer.jsx:314`
**What's wrong:** `activeConflicts` rebuilds an O(groups × dogsPerGroup² × conflicts) nested loop on every render. With ~5 groups × ~10 dogs × ~tens of conflict rules, that's a few thousand string comparisons per render — and the parent re-renders on every pickup, every realtime patch, every sector cycle.
**Why it happens:** `useMemo`'s dep array includes `groups`, which is a new object reference on every `setGroups`, including no-op ones from realtime echoes.
**How to verify it's real:** Profile a tick where a pickup hits — the `useMemo` recomputes even when the group composition didn't actually change.
**Suggested fix direction:** Build an index of conflict pairs by lowercase dog-name once when `conflicts` loads, and look up per pair in O(1). Or shallow-compare group composition before recomputing.

---

🐾
