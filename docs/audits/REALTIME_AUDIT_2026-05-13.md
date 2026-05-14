# REALTIME SUBSYSTEM AUDIT — wiggle-v4 (2026-05-13)

**Auditor:** Claude Code (Opus 4.7).
**Scope:** Realtime / channel / visibility / sync code in wiggle-v4 only.
**Method:** Static analysis. No code changes. No reproduction.
**Pre-flight:** PASS — `origin/main` at `5f949b3`, `version.json` body matches HEAD. No drift since the earlier session today.

---

## 0. Inventory

### 0.1 Files using realtime APIs

| File | Lines | What it does |
|------|-------|--------------|
| `src/lib/supabase.js` | 6–11 | `createClient` — no `realtime` block → defaults |
| `src/context/AuthContext.jsx` | 39–45 | `supabase.realtime.setAuth` on `TOKEN_REFRESHED` + `SIGNED_IN` |
| `src/lib/sharedRealtimeChannel.js` | 13–26, 29–48, 55–61 | `subscribeShared` registry + `resubscribeAllShared` |
| `src/lib/useChannelHealth.js` | 13–62 | `getChannels`, `setAuth`, `resubscribeAllShared`, in-place walk-groups rejoin |
| `src/lib/usePickups.js` | 4, 79–101 | `subscribeShared` for `walker_notes` table |
| `src/lib/useOwlNotes.js` | 4, 89–116 | `subscribeShared` for `owl_notes` table |
| `src/lib/useWalkGroups.js` | 117–189 | Direct `supabase.channel(...)` (NOT shared) for `walk_groups` |

### 0.2 Files listening for browser lifecycle events

| File | Lines | Event(s) |
|------|-------|----------|
| `src/main.jsx` | 24 | `visibilitychange` → SW `registration.update()` |
| `src/lib/useChannelHealth.js` | 59 | `visibilitychange` → setAuth + rebuild channels |
| `src/lib/useOffline.js` | 22–23 | `online` / `offline` |

### 0.3 Read hooks with realtime subscription

| Hook | Pattern | Backfill on resume? |
|------|---------|---------------------|
| `usePickups` (`src/lib/usePickups.js`) | `load()` on `[date]`, subscribeShared on `[date]` | NO |
| `useOwlNotes` (`src/lib/useOwlNotes.js`) | `load()` on `[permissions, userSector]`, subscribeShared on same | NO |
| `useWalkGroups` (`src/lib/useWalkGroups.js`) | `load()` on `[date, sector, allEventIds.length]`, direct channel on same | NO |
| `useChannelHealth` (mounted once at `src/App.jsx:184`) | N/A — orchestrator | N/A |

### 0.4 Fetch-on-mount hooks (no realtime)

| File | Lines | Table | Notes |
|------|-------|-------|-------|
| `src/components/WalkerNotesSection.jsx` | 12–26 | `walker_notes` | Drawer notes — no realtime, fetches on `dogId` change |
| `src/hooks/useAcuityNotes.js` | 8–23 | `acuity_notes` | OK — daily data, fetch-on-mount adequate |
| `src/components/BeastChat.jsx` | 32–36 | mixed | Tower AI chat context fetch, fetch-on-mount adequate |

### 0.5 Write paths

| File | Function(s) | Lines | Optimistic? | Fresh-bundle gate? |
|------|------------|-------|-------------|--------------------|
| `src/lib/usePickups.js` | markPickup / markReturned / undo* / markNotWalking / updateTimestamp | 105, 142, 179, 209, 234, 271, 306 | YES | YES |
| `src/lib/useWalkGroups.js` | saveGroup / addGroup / renameGroup / addWalker / removeWalker / setWalkers / lockGroup / unlockGroup / linkGroups / unlinkGroups | 192, 252, 285, 358, 373, 392, 320, 340, 429, 449 | mixed | YES |
| `src/lib/useOwlNotes.js` | createNote / acknowledgeNote / deleteNote | 119, 150, 190 | mixed | YES |
| `src/hooks/useActivityNotes.js` | writeNote | 10 | NO | YES |
| `src/components/QuickNoteSheet.jsx` | handleSave (inline) | 46 | NO | YES |
| `src/components/WalkerNotesSection.jsx` | delete (inline) | 47 | YES | YES |
| `src/components/DogProfileDrawer.jsx` | handleSave / saveAltAddress / deleteAltAddress | 137, 174, 194 | NO | YES |

Fresh-bundle gate is universally applied. ✓

---

## 1. Summary table

Severity order: HIGH (walker-visible bug) → MEDIUM (admin-visible / narrow-edge / compounding) → LOW (hardening).

| # | File | Failure mode | Severity |
|---|------|--------------|----------|
| 1 | `src/lib/useOffline.js` + every write path | Offline queue is dead code — `enqueueOfflineAction` exported but never called; failed writes are lost on airplane-mode cycle | HIGH |
| 2 | `src/lib/useChannelHealth.js` + `usePickups.js` / `useOwlNotes.js` / `useWalkGroups.js` | No backfill on visibility return — socket rebuilds but missed `postgres_changes` rows are never refetched | HIGH |
| 3 | `src/main.jsx` + `src/lib/useChannelHealth.js` | No `pageshow event.persisted=true` listener — iOS Safari bfcache restore can skip `visibilitychange` | HIGH |
| 4 | `src/lib/sharedRealtimeChannel.js` + `useWalkGroups.js` | No active channel-health probe — silent WebSocket death while tab is foregrounded goes undetected until next visibility change | HIGH |
| 5 | `src/lib/usePickups.js` (markPickup L124–127, markReturned L161–164) | Optimistic state not rolled back on `23505` — late walker still shows themselves as owner after DB rejects | HIGH |
| 6 | `src/lib/usePickups.js` (markPickup L105, markReturned L142) | No pre-write guard — UI lets walker tap pickup on a dog already picked up locally; stale view → duplicate intent | MEDIUM |
| 7 | `src/lib/useOffline.js` + `src/lib/useChannelHealth.js` | `'online'` event does not trigger channel rebuild — coverage-return path skips socket recovery | MEDIUM |
| 8 | `src/lib/freshBundle.js` (L49) | `fetch('/version.json')` has no `AbortSignal`/timeout — slow network blocks every write up to browser default (~30s) | MEDIUM |
| 9 | `src/components/WalkerNotesSection.jsx` | No realtime subscription — new notes from another walker while drawer is open don't appear | MEDIUM |
| 10 | `src/lib/useChannelHealth.js` | No `'focus'` listener — Safari can fire `focus` without `visibilitychange` on cross-tab return | MEDIUM |
| 11 | `src/lib/useChannelHealth.js` (L45) | Walk-groups rejoin keyed by `'realtime:walk-groups-'` topic prefix — coupling to internal supabase-js topic naming | LOW |
| 12 | `src/lib/sharedRealtimeChannel.js` (L55–61) | `resubscribeAllShared` could race with unmount cleanup — short window, low impact | LOW |
| 13 | `src/lib/supabase.js` (L6–11) | No explicit `realtime` config — heartbeat / backoff use defaults that may be loose for mobile flaky networks | LOW |
| 14 | `src/lib/usePickups.js` (L52–53, L76) | Cold-mount runs `load()`; warm-resume runs only channel rebuild. Asymmetric recovery — cold path is more robust than warm path | LOW |

---

## 2. Per-finding detail (HIGH and MEDIUM)

### Finding 1 — Offline queue is dead code (HIGH)
`src/lib/useOffline.js:37` defines and exports `enqueueOfflineAction` but `grep -rn enqueueOfflineAction src/` finds zero call sites inside `src/`. The only matches are in `.claude/worktrees/*` (other audit sessions) and the export itself. Meanwhile `replayOfflineQueue` (L52) is wired to the `'online'` event at L22 and reads `localStorage[QUEUE_KEY]` — but the queue is always empty because nothing enqueues. Every write in `usePickups.js` (markPickup L124–138, markReturned L161–175, undoPickup L189–205, etc.) calls `toast.error('Failed to save…')` on network error and rolls back the optimistic state — and that's it. There is no retry, no queue, no recovery. On Rod's basement → upstairs walk, a tap during signal loss surfaces as "Failed to save pickup" and the walker has to retap. If the walker doesn't notice the toast (head-down, gloves), the dog is silently un-marked. **Evidence: `useOffline.js:37–45` (orphan function), `usePickups.js:124–132` (rollback path with no enqueue).**

### Finding 2 — No backfill on visibility return (HIGH)
`useChannelHealth.js:35` calls `resubscribeAllShared()` and L41–56 re-issues `subscribe()` on each `realtime:walk-groups-*` channel. Both paths rebuild the WebSocket subscription, but neither calls the hook's `load()` function. In `usePickups.js`, `load` is wrapped in `useCallback` with `[date]` deps (L48); the only `useEffect` that calls it (L51–53) fires on `[load]` change, which doesn't change on resume. Same shape in `useOwlNotes.js` (L42–82 effect deps `[permissions, userSector]`) and `useWalkGroups.js` (L46–111 effect deps `[date, sector, allEventIds.length]`). **Result:** if a teammate inserts five `walker_notes` rows while the phone is suspended, those `postgres_changes` events were emitted to a dead WebSocket and are lost. The rebuilt channel only gets *future* events. The walker's UI never learns those five returns happened until the date prop changes or the page is reloaded. This is the exact shape of yesterday's "Bug return by Rod" pattern — Solene's 11:15 Bug pickup never echoed to Rod's app. **Evidence: `useChannelHealth.js:21–56` (rebuild without refetch), `usePickups.js:48–53`, `useOwlNotes.js:42–82`, `useWalkGroups.js:46–111`.**

### Finding 3 — No `pageshow` listener (HIGH)
Both visibility hooks (`main.jsx:24`, `useChannelHealth.js:59`) bind only `visibilitychange`. iOS Safari can restore a PWA from bfcache without firing `visibilitychange` when the user navigates back or returns from a different tab inside the same app. The MDN-recommended pattern is to listen for `pageshow` and check `event.persisted === true` to detect bfcache restore. Neither file does this. **Result:** a class of iOS resume events leaves the WebSocket dead, the SW unchecked-for-updates, and no recovery path engaged. This compounds with Finding 2 (no backfill) — when the walker eventually does something to trigger `visibilitychange`, the rebuild happens but the missed events are gone. **Evidence: `main.jsx:24`, `useChannelHealth.js:59`.**

### Finding 4 — No active channel-health probe (HIGH)
`sharedRealtimeChannel.js:21–26` and `useWalkGroups.js:178–183` register `subscribe()` callbacks that log on `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`. This is observability only — the warning lands in console and nothing rebuilds. Recovery in this codebase is exclusively driven by `visibilitychange`. If a walker has the phone unlocked, the app foregrounded, but the WebSocket dies (server-side heartbeat timeout, NAT rebind, brief network blip without a visibility event), the channel stays dead until the walker backgrounds and re-foregrounds the app. There is no `setInterval` probing `supabase.getChannels()` for unhealthy state. The status callback could itself trigger a rebuild — it doesn't. **Evidence: `sharedRealtimeChannel.js:21–26` (log only), `useWalkGroups.js:178–183` (log only), `useChannelHealth.js:13–62` (visibility-gated only).**

### Finding 5 — Optimistic state not rolled back on 23505 (HIGH)
`usePickups.js:110–113` sets `pickedUpAt: now` optimistically BEFORE the insert. Lines 124–127:

```js
if (error) {
  if (error.code === '23505') return
  toast.error('Failed to save pickup')
  setPickups(prev => { ... rollback ... })
}
```

The `23505` (unique-constraint violation) branch quietly `return`s without rolling back. Walker B tapped pickup on a dog already picked up by Walker A; their insert is rejected; their optimistic UI still shows themselves as the picker. The realtime echo of Walker A's insert eventually overwrites `walkerName` via `applyRow()` (L11) — but only if Walker B's channel is healthy. If Walker B's channel is also stale (Finding 2), they keep believing they own the pickup. Same pattern at `markReturned:161–164`, `markNotWalking:292–293`. **Evidence: `usePickups.js:124–127, 161–164, 292–293`.**

### Finding 6 — No pre-write guard (MEDIUM)
`usePickups.js:105` `markPickup` does no check against `pickups[dogId]?.pickedUpAt` before firing the insert. The UI is responsible for not showing the button when the dog is already picked up — but the UI's `pickups` map is exactly the state Finding 2 says can be stale. So: stale view → walker taps pickup → unique-constraint rejection (Finding 5) → walker thinks they own it. A 3-line guard inside `markPickup` (`if (pickups[dogId]?.pickedUpAt) return`) would short-circuit before the optimistic update and the insert. **Evidence: `usePickups.js:105–139` (no guard).**

### Finding 7 — `'online'` event doesn't rebuild channel (MEDIUM)
`useOffline.js:13–17` handles `'online'` by calling `replayOfflineQueue()` (which currently no-ops, per Finding 1) but does NOT touch the realtime channels. `useChannelHealth.js:59` only binds `visibilitychange`. So: phone in basement → network drops → `'offline'` fires → channel dies → walker comes upstairs → `'online'` fires → queue replay attempts (empty), but channels stay dead. Recovery has to wait for the next `visibilitychange` (which won't fire if the app is already foregrounded). **Evidence: `useOffline.js:13–17`, `useChannelHealth.js:13–62`.**

### Finding 8 — Fresh-bundle fetch has no timeout (MEDIUM)
`freshBundle.js:49`:

```js
const res = await fetch(VERSION_URL, { cache: 'no-store' })
```

No `AbortSignal`, no `signal: AbortSignal.timeout(...)`. Every write path awaits this fetch via `assertFreshOrThrow()`. On a flaky network the browser default fetch timeout (~30s) governs. The walker taps "pickup," the fresh-bundle fetch hangs, the optimistic UI doesn't even render (the optimistic `setPickups` runs AFTER `await assertFreshOrThrow()` at `usePickups.js:107–110`). The button appears dead for 30s. **Evidence: `freshBundle.js:43–72` (no abort), `usePickups.js:107–110` (gate before optimistic).**

### Finding 9 — WalkerNotesSection has no realtime (MEDIUM)
`src/components/WalkerNotesSection.jsx:12–26` fetches `walker_notes` once on `[dogId]` change. The drawer can stay open for minutes. If another walker writes a note during that window, it won't appear until the drawer is reopened. Admin-facing impact mostly. **Evidence: `WalkerNotesSection.jsx:12–26`.**

### Finding 10 — No `'focus'` listener (MEDIUM)
Closely related to Finding 3. iOS Safari can fire `focus` events for tab returns inside the same browser window without firing `visibilitychange`. `useChannelHealth.js:59` doesn't bind `focus`, so recovery doesn't engage. **Evidence: `useChannelHealth.js:59`.**

---

## 3. Probe results

| # | Scenario | Verdict |
|---|----------|---------|
| 1 | iOS Safari bfcache restore (pageshow `persisted=true`) | **NOT HANDLED** — only `visibilitychange` is wired (`useChannelHealth.js:59`, `main.jsx:24`) |
| 2 | Silent WebSocket death | **PARTIALLY HANDLED** — status callbacks log (`sharedRealtimeChannel.js:21–26`, `useWalkGroups.js:178–183`) but no recovery; rebuild only on visibility |
| 3 | JWT expiry during long-idle | **HANDLED** for happy path — `setAuth` on `TOKEN_REFRESHED`/`SIGNED_IN` (`AuthContext.jsx:39–45`) and on visibility return (`useChannelHealth.js:21–29`). Fails silently if a subscribe-then-setAuth race occurs |
| 4 | Two walkers pickup same dog within 500ms | **PARTIALLY HANDLED** — `23505` swallowed silently (`usePickups.js:125–127`); optimistic UI not rolled back (Finding 5); correction relies on healthy realtime echo |
| 5 | Airplane mode → coverage cycle | **NOT HANDLED** — offline queue dead (Finding 1); failed writes rolled back but not retried; `'online'` event doesn't rebuild channel (Finding 7) |
| 6 | Brindu-shape misfire (dog already picked up by another walker, not echoed locally) | **NOT HANDLED** — no pre-write guard (Finding 6); 23505 silent; correction depends on a healthy channel |

---

## 4. Recommended fix sequence

Ranked by `(impact × likelihood) / effort`. **Fix briefs not included by stop rule — these are sizing-only.**

| # | Fix | Files touched | LOC est. | Depends on |
|---|------|---------------|----------|------------|
| 1 | Add `pageshow event.persisted=true` listener mirroring `visibilitychange` in `useChannelHealth` and `main.jsx` SW update | `src/lib/useChannelHealth.js`, `src/main.jsx` | ~10 | none |
| 2 | Re-fetch on resume — expose `load()` (or a refresh function) from `usePickups` / `useOwlNotes` / `useWalkGroups` and call them from `useChannelHealth` after `resubscribeAllShared` | `src/lib/useChannelHealth.js`, `src/lib/usePickups.js`, `src/lib/useOwlNotes.js`, `src/lib/useWalkGroups.js`, `src/lib/sharedRealtimeChannel.js` (registry callback for refetch) | ~40 | #1 (so re-fetch fires on both visibility and pageshow) |
| 3 | Wire `enqueueOfflineAction` into `usePickups` `markPickup`/`markReturned`/`markNotWalking` failure paths; OR remove the dead infrastructure and rely on toast-driven user retry | `src/lib/usePickups.js`, `src/lib/useOffline.js` | ~25 if wired, ~5 if removed | none |
| 4 | Roll back optimistic state on `23505` in `markPickup`/`markReturned`/`markNotWalking` AND add a pre-write guard checking local `pickups[dogId]` | `src/lib/usePickups.js` | ~15 | none |
| 5 | Active channel-health probe — `setInterval(15s)` inside `useChannelHealth` calling `supabase.getChannels()` and triggering `resubscribeAllShared` + refetch if any channel state ≠ `joined`/`joining`. Compounds with #2. | `src/lib/useChannelHealth.js` | ~15 | #2 |

Optional follow-ups (not in top 5): adding `AbortSignal.timeout(3000)` to `freshBundle.js:49`; binding `'focus'` listener in `useChannelHealth`; adding realtime to `WalkerNotesSection` (use `subscribeShared`); making `useChannelHealth` ALSO listen for `'online'`.

---

## 5. Out-of-scope notes

Audited only the wiggle-v4 realtime/sync/lifecycle code as defined in the brief. Not audited:

- wiggle-world (different product per CLAUDE.md and stop rule)
- Service-worker caching strategy beyond `main.jsx:10–33`'s `registerSW` + `controllerchange` reload — SW message channel, runtime caching, cache versioning, push notifications all out
- Supabase RLS policies — out unless a SEC finding was triggered (none was)
- Mini Gen cron / Scout ingestion — server-side, not client realtime
- Tower views (Tower.jsx, TowerDashboard.jsx, TowerStaff.jsx, etc.) — checked for realtime usage (none beyond shared owl/walker_notes via `useOwlNotes`/`useWalkGroups` re-mounted at admin level)
- Auth signup / password reset — covered in scope only insofar as `AuthContext.jsx` sets realtime auth

---

## 6. Audit limits

**Read in full:**
- `src/lib/freshBundle.js`, `src/lib/sharedRealtimeChannel.js`, `src/lib/useChannelHealth.js`, `src/lib/useOffline.js`, `src/lib/useOwlNotes.js`, `src/lib/usePickups.js`, `src/lib/useWalkGroups.js`, `src/lib/supabase.js`, `src/context/AuthContext.jsx`, `src/main.jsx`, `src/App.jsx`, `src/components/QuickNoteSheet.jsx`, `src/components/WalkerNotesSection.jsx`, `src/hooks/useActivityNotes.js`, `src/hooks/useAcuityNotes.js`

**Skimmed via grep only:**
- `src/components/DogProfileDrawer.jsx`, `src/components/DogDrawer.jsx`, `src/components/BeastChat.jsx`, `src/pages/Dashboard.jsx`, `src/pages/Schedule.jsx`, `src/pages/Admin.jsx`, `src/pages/Tower*.jsx`, `src/components/tower/**`, `src/components/Header.jsx`, `src/components/OfflineBanner.jsx`, `src/components/OwlNotesTab.jsx`, `src/components/OwlQuickDrawer.jsx`, `src/components/UpdateBanner.jsx`. These were checked for realtime/lifecycle usage but the surrounding logic was not deeply read.

**Static analysis cannot tell:**
- Whether iOS Safari, in production with the live PWA install, actually does or doesn't fire `visibilitychange` after bfcache restore in 2026 — the literature says it can be inconsistent; without instrumentation we cannot confirm Rod's specific failure mode
- Whether `supabase-js` v2 internally already retries on `CHANNEL_ERROR` (some versions do, some don't) — would need to check the installed version and its source. The behavior observed in `useWalkGroups.js:178–183` warning suggests recovery is NOT internally automatic, but this is inference
- Whether the `23505` unique constraint actually exists on `walker_notes` in production — the code at `usePickups.js:125` is defensive and would still work if the constraint were missing (the `23505` path would simply never fire). Confirming would require a Supabase introspection query against `pg_constraint`

**Confidence:**
- HIGH findings 1, 2, 3, 4, 5 — high confidence, direct code citation supports each
- MEDIUM findings — high confidence on the code shape; medium confidence on real-world likelihood without telemetry
- LOW findings — directional, low priority

**No SEC findings.** No token leaks observed, no RLS-relevant client code that would expose PII.
