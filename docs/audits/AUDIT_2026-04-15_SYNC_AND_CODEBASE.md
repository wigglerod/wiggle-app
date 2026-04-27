# Audit — Sync issue + full codebase sweep
Date: 2026-04-15
Scope: wiggle-v4 (live app at wiggle-app-dusky.vercel.app), read-only
Supabase project: ifhniwjdrsswgemmqddn

---

## Part 1 — Sync root cause

### Root-cause statement

**The sync gap between walkers is caused by `walker_notes` almost certainly not being added to the `supabase_realtime` PostgreSQL publication.** The realtime subscription in `src/lib/usePickups.js:72-101` connects to Supabase successfully and listens on channel `pickups-${date}`, but if the table is not in the publication, PostgreSQL never emits WAL events for it — the subscription silently receives zero events. Each walker only sees their own optimistic UI updates; cross-walker state is invisible until a full page refresh triggers the initial SELECT query.

A contributing secondary cause — **no deduplication constraint on `walker_notes`** — means that when two walkers both mark the same dog (because neither saw the other's action), both INSERT rows succeed, creating duplicate `pickup` or `returned` records for the same dog on the same day.

### Evidence

1. **Only `walk_groups` is explicitly added to the publication** in the codebase:
   - `supabase-schema.sql:209`: `ALTER PUBLICATION supabase_realtime ADD TABLE walk_groups;`
   - No equivalent statement exists for `walker_notes` anywhere in the repo (searched all `.sql` files)

2. **`walker_notes` has no CREATE TABLE statement in the repo** — it was created directly in the Supabase SQL editor. No migration file tracks its schema, RLS policies, or realtime publication membership.

3. **The realtime subscription code itself is correct** — channel `pickups-${date}`, event `*`, filter `walk_date=eq.${date}`, proper cleanup on unmount (`usePickups.js:100`). If the publication existed, this would work.

4. **No role divergence** — admin and senior_walker use identical code paths:
   - Both use `GroupOrganizer.jsx` -> `usePickups(date)` hook
   - Both use the anon key (user's auth token) for writes (`src/lib/supabase.js:6`)
   - `permissions.js:8-9`: `canLogPickups: true` for all roles
   - No conditional rendering based on role in the pickup flow

5. **The `pickups:sync` custom event** (`usePickups.js:54-68`) only propagates state between multiple hook instances **within a single browser window** (via `window.dispatchEvent`). It does NOT enable cross-device/cross-browser sync.

6. **Production evidence matches perfectly**:
   - Rod marks Brindu pickup at 15:49:51 -> INSERT fires -> Rod's UI updates optimistically
   - Solene's subscription gets nothing (table not in publication) -> her UI still shows "waiting"
   - 11 minutes later, Solene marks Brindu pickup at 16:00:19 -> second INSERT creates duplicate row
   - Walker-to-walker pairs (Megan/Solene on Uki, Sam/Solene on Mochi) show the same pattern — confirming this is NOT admin-specific

### Cannot determine from code alone

- Whether `walker_notes` was added to the publication manually via Supabase dashboard (no SQL editor history in repo)
- Whether RLS is enabled on `walker_notes` and what policies exist (could be an additional blocker)
- Whether `REPLICA IDENTITY` is set to `FULL` on the table (affects DELETE event payloads)

### The killer runtime test

Open Supabase SQL Editor for project `ifhniwjdrsswgemmqddn` and run:

```sql
-- 1. Check if walker_notes is in the realtime publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- 2. Check if RLS is enabled on walker_notes
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'walker_notes';

-- 3. Check what RLS policies exist
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'walker_notes';

-- 4. Check replica identity (needed for DELETE events)
SELECT relname, relreplident
FROM pg_class
WHERE relname = 'walker_notes';
-- 'd' = default (PK only), 'f' = full, 'n' = nothing
```

**If query 1 does NOT list `walker_notes`:** root cause confirmed. Fix: `ALTER PUBLICATION supabase_realtime ADD TABLE walker_notes;`

**If query 1 DOES list `walker_notes`:** check queries 2-3. If RLS has a restrictive SELECT policy (e.g., `walker_id = auth.uid()`), that blocks realtime broadcasts to other walkers. Fix: change to `auth.uid() IS NOT NULL`.

**If both publication and RLS are correct:** the issue is client-side. Open browser console on Solene's device, navigate to Schedule, and run:
```js
// Check if the channel is connected
const channels = supabase.getChannels()
console.log('Active channels:', channels.map(c => c.topic))
```
Then have Rod mark a pickup and watch for `REALTIME:*` events in the console.

### Fix scope

| Scenario | Fix | Code changes | SQL statements |
|----------|-----|--------------|----------------|
| Not in publication | Add to publication | 0 files | 1 statement |
| RLS blocks cross-walker | Fix SELECT policy | 0 files | 1-2 statements |
| Both | Publication + RLS | 0 files | 2-3 statements |
| Dedup (secondary fix) | Add UNIQUE constraint + UPSERT | 3 functions in usePickups.js (~10 lines) | 1 statement |

---

## Part 2 — Full sweep findings

### BREAKING

1. **`walker_notes` not in `supabase_realtime` publication (likely)**
   - Location: Infrastructure (Supabase project, not in codebase)
   - Impact: All cross-walker pickup/return sync is broken. Walkers coordinate verbally.
   - HQ port impact: **must fix before port** — this is the #1 sync primitive

2. **5 tables have no CREATE TABLE in the repo — schema is untracked**
   - Tables: `walker_notes`, `owl_notes`, `flag_cards`, `expected_schedule`, `group_links`
   - These were created directly in Supabase SQL editor
   - No migration files, no tracked RLS policies, no publication membership
   - HQ port impact: **refactor needed** — must extract schema to tracked migrations before port

3. **3 cron paths in vercel.json reference non-existent handlers**
   - `vercel.json:7`: `/api/cron/schedule-check` -> handler doesn't exist
   - `vercel.json:8`: `/api/cron/schedule-verify` -> handler doesn't exist
   - `vercel.json:9`: `/api/cron/backup-dogs` -> handler doesn't exist
   - These fire on Vercel's scheduler and silently 404
   - HQ port impact: **easy carry** (remove dead entries or implement handlers)

4. **No deduplication on walker_notes pickup/returned rows**
   - Location: `src/lib/usePickups.js:113,147` (markPickup, markReturned)
   - No UNIQUE constraint on `(dog_id, walk_date, note_type)` in the database
   - Multiple walkers can INSERT duplicate rows for the same dog
   - `applyRow()` overwrites — last writer wins, earlier writer's data is lost
   - HQ port impact: **must fix** — add constraint + switch to UPSERT

### RISKY

1. **`tower-approve.js` missing `updated_by` attribution**
   - `api/tower-approve.js:87-100`: inserts walk_groups rows without `updated_by`
   - Violates WIGGLE_PRINCIPLES #8 ("every write has a name")
   - HQ port impact: easy fix (add `updated_by: 'tower-approve'` or a system UUID)

2. **Offline queue feature is incomplete — `enqueueOfflineAction` never called**
   - `src/lib/useOffline.js:37`: exported but no caller in the codebase
   - All write operations (pickups, group changes) fail silently when offline
   - Walkers in dead zones (basements, parks) lose their actions
   - HQ port impact: **refactor needed** — decide: implement queue callers or remove dead code

3. **Multiple `usePickups` hook instances create duplicate realtime channels**
   - GroupOrganizer and DogDrawer both call `usePickups(date)`
   - Both create channels named `pickups-${date}` — Supabase may deduplicate or double-fire
   - `usePickups.js:75-76`
   - HQ port impact: **refactor needed** — lift to PickupsProvider context

4. **Multiple `useOwlNotes` instances (5 mount points)**
   - Dashboard.jsx, Schedule.jsx, OwlNotesTab.jsx, DogProfileDrawer.jsx, OwlQuickDrawer.jsx
   - Each creates its own `owl-notes-realtime-*` channel
   - 5 concurrent subscriptions to the same table
   - `src/lib/useOwlNotes.js:82-116`
   - HQ port impact: **refactor needed** — lift to OwlNotesProvider context

5. **DELETE events in usePickups may be silently dropped**
   - `usePickups.js:86-90`: `if (!oldRow?.dog_id) return` — discards DELETE events where `dog_id` is missing
   - If `walker_notes` has `REPLICA IDENTITY DEFAULT`, DELETE payloads only contain the PK (id), not `dog_id` or `note_type`
   - This means undo operations (undoPickup, undoReturned) would not propagate to other walkers even if realtime works
   - HQ port impact: **must fix** — `ALTER TABLE walker_notes REPLICA IDENTITY FULL;`

6. **`dog_conflicts` RLS is too permissive**
   - `migrations/20260315_lock_schedule_and_conflicts.sql:21-25`
   - `FOR ALL USING (true) WITH CHECK (true)` — any authenticated user can create/delete conflicts
   - Should be admin-only for writes, read-only for walkers
   - HQ port impact: easy fix

7. **`acuity_notes` RLS allows unauthenticated reads**
   - `supabase/migrations/20260406_acuity_notes.sql:24-26`
   - SELECT policy uses `booking_date = CURRENT_DATE` without requiring authentication
   - Missing `TO authenticated` qualifier — anonymous users can read today's notes
   - HQ port impact: easy fix

8. **Supabase REST API cached by service worker for 5 minutes**
   - `vite.config.js:70-78`: `NetworkFirst` with 10-second timeout, 5-min cache
   - If walker phone has slow connectivity (common in the field), the SW serves stale data
   - Does NOT affect realtime (WebSocket), but affects initial page load queries
   - HQ port impact: review caching strategy for write-heavy tables

### NOTES

1. **PWA update strategy is solid**
   - `registerType: 'prompt'` with UpdateBanner component
   - skipWaiting + clientsClaim for immediate activation
   - 5-minute interval update checks + visibilitychange listener (critical for iOS)
   - SW itself served with `no-cache` headers (`vercel.json:24-29`)
   - `main.jsx:10-33`, `vite.config.js:27-113`, `UpdateBanner.jsx`
   - HQ port impact: **easy carry**

2. **`walk_groups.walker_id` vs `walker_ids` migration handled well**
   - Fallback logic in `useWalkGroups.js:77,156` gracefully handles both formats
   - `row.walker_ids?.length ? row.walker_ids : (row.walker_id ? [row.walker_id] : [])`
   - HQ port impact: **easy carry** (can drop legacy `walker_id` fallback)

3. **`tower-approve.js` dog_ids fix confirmed intact**
   - `api/tower-approve.js:94`: `dog_ids: [dogName]` — correctly writes dog names
   - Idempotency check at line 71-78 uses `.contains('dog_ids', [dogName])`
   - HQ port impact: **easy carry**

4. **No service role key in client code — confirmed zero matches in src/**
   - `api/lib/supabase-admin.js` correctly isolates the service role to server-side only
   - `src/lib/supabase.js` uses only the anon key
   - HQ port impact: **easy carry**

5. **`walker_notes.message` vs `owl_notes.note_text` — no crossed wires**
   - BeastChat.jsx correctly reads `walker_notes.message` and `owl_notes.note_text` from different tables
   - No column name confusion found anywhere
   - HQ port impact: **easy carry**

6. **Role system is clean**
   - `permissions.js` uses explicit capability flags, no string equality drift
   - `AuthContext.jsx` provides `isChiefPup`, `isAdmin`, `isSenior`, `isJunior`
   - `roles.js` has clean label/color maps
   - Only note: `isAdmin` includes `senior_walker` (`AuthContext.jsx:52`) — this is intentional but could confuse during port
   - HQ port impact: **easy carry**

7. **Profiles RLS has two overlapping SELECT policies**
   - Base schema: `profiles_own` (own row only, `auth.uid() = id`)
   - Script: "Authenticated users can read all profiles" (`USING (true)`)
   - Both are permissive, so the union allows reading all profiles
   - Works correctly but should be cleaned up to a single policy
   - HQ port impact: **easy carry** (consolidate)

8. **Dogs cache in localStorage for offline use**
   - `useOffline.js:87-107`: `getCachedDogs()` and `setCachedDogs()`
   - Used by Dashboard and Schedule for offline fallback
   - No cache invalidation strategy — stale dog data persists until next successful fetch
   - HQ port impact: **don't port** (replace with proper offline-first strategy)

---

## Part 3 — Recommended next sessions

### Priority 1: Fix walker sync (30 min)
1. Run the diagnostic SQL queries from Part 1 in Supabase SQL Editor
2. Add `walker_notes` to `supabase_realtime` publication
3. Verify/fix RLS policies on `walker_notes`
4. Set `REPLICA IDENTITY FULL` on `walker_notes`
5. Add UNIQUE constraint on `(dog_id, walk_date, note_type)` and switch `markPickup`/`markReturned` to UPSERT
6. Test cross-walker sync in the field

### Priority 2: Schema extraction (1-2 hours)
Extract CREATE TABLE + RLS + publication statements for all 5 untracked tables (`walker_notes`, `owl_notes`, `flag_cards`, `expected_schedule`, `group_links`) from live Supabase and commit as tracked migrations.

### Priority 3: Realtime provider refactor (1 hour)
Lift `usePickups` and `useOwlNotes` into React context providers to eliminate duplicate channel subscriptions. Single mount point per subscription.

### Priority 4: Cron cleanup (15 min)
Remove the 3 dead cron entries from `vercel.json`, or implement the missing handlers if the functionality is still needed.

### Priority 5: RLS tightening (30 min)
Fix `dog_conflicts` write policy (admin-only), `acuity_notes` SELECT policy (require authentication), and audit the 5 untracked tables' policies once extracted.

### Priority 6: Offline queue implementation (1-2 hours)
Either implement `enqueueOfflineAction` callers in `usePickups.js` and `useWalkGroups.js`, or remove the dead code and design a proper offline-first strategy for HQ.

---

## Appendix A — Brain entries (run in Supabase SQL Editor)

Supabase MCP was unauthorized during this audit. Run these manually.

### Diagnostic queries (run FIRST)

```sql
-- 1. Is walker_notes in the realtime publication?
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- 2. Is RLS enabled on walker_notes?
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname = 'walker_notes';

-- 3. What RLS policies exist on walker_notes?
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE tablename = 'walker_notes';

-- 4. What's the replica identity?
SELECT relname, CASE relreplident
  WHEN 'd' THEN 'default (PK only)'
  WHEN 'f' THEN 'full'
  WHEN 'n' THEN 'nothing'
  WHEN 'i' THEN 'index'
END as replica_identity
FROM pg_class WHERE relname = 'walker_notes';
```

### Open questions entries

```sql
-- Sync root cause (priority follow-up)
INSERT INTO wiggle_open_questions (date, question, blocks, owner)
VALUES (
  '2026-04-15',
  'walker_notes realtime sync is broken — walkers cannot see each other''s pickup/return state. Most likely: table not in supabase_realtime publication. Run diagnostic queries in audit report to confirm. Fix: 1-3 SQL statements, 0 code changes.',
  'All cross-walker pickup sync in the field',
  'Rod'
);

-- BREAKING: Untracked table schemas
INSERT INTO wiggle_open_questions (date, question, blocks, owner)
VALUES (
  '2026-04-15',
  'walker_notes, owl_notes, flag_cards, expected_schedule, group_links have no CREATE TABLE in the repo. Schema, RLS, and publication membership are untracked. Must extract to migrations before HQ port.',
  'HQ port (Phase 6) — schema portability',
  'Rod'
);

-- BREAKING: Dead cron handlers
INSERT INTO wiggle_open_questions (date, question, blocks, owner)
VALUES (
  '2026-04-15',
  'vercel.json references 3 non-existent cron handlers: /api/cron/schedule-check, /api/cron/schedule-verify, /api/cron/backup-dogs. These silently 404 on every scheduled run.',
  'post-launch cleanup',
  'Rod'
);

-- BREAKING: No deduplication on walker_notes
INSERT INTO wiggle_open_questions (date, question, blocks, owner)
VALUES (
  '2026-04-15',
  'No UNIQUE constraint on walker_notes (dog_id, walk_date, note_type). Multiple walkers can insert duplicate pickup/returned rows for the same dog. Needs constraint + UPSERT in usePickups.js.',
  'Data integrity — duplicate pickup records accumulating in production',
  'Rod'
);

-- RISKY findings (bundled)
INSERT INTO wiggle_open_questions (date, question, blocks, owner)
VALUES (
  '2026-04-15',
  'Audit risky findings: (1) tower-approve.js missing updated_by, (2) offline queue never called, (3) duplicate realtime channels from multiple usePickups/useOwlNotes instances, (4) DELETE events may be silently dropped (REPLICA IDENTITY), (5) dog_conflicts RLS too permissive, (6) acuity_notes allows unauthenticated reads, (7) SW caches REST API for 5 min. See full report: docs/audits/AUDIT_2026-04-15_SYNC_AND_CODEBASE.md',
  'post-launch / HQ port',
  'Rod'
);

-- NOTES (bundled)
INSERT INTO wiggle_open_questions (date, question, blocks, owner)
VALUES (
  '2026-04-15',
  'Audit notes 2026-04-15 — see report. Summary: PWA update strategy solid, tower-approve dog_ids fix intact, no service role in client, role system clean, profiles RLS has overlapping policies (harmless). Full details: docs/audits/AUDIT_2026-04-15_SYNC_AND_CODEBASE.md',
  NULL,
  'Rod'
);
```

### Session log entry

```sql
INSERT INTO wiggle_sessions (goal, outcome, commit_hash, product)
VALUES (
  'Audit sync issue between walkers + full codebase sweep for HQ port',
  'Root cause identified: walker_notes likely not in supabase_realtime publication. 4 BREAKING, 8 RISKY, 8 NOTE findings. Report: docs/audits/AUDIT_2026-04-15_SYNC_AND_CODEBASE.md',
  NULL,
  'wiggle-v4'
);
```

---

## Appendix B — Files read during audit

| File | Purpose |
|------|---------|
| `src/lib/usePickups.js` | Pickup/return state management + realtime |
| `src/lib/useWalkGroups.js` | Walk group management + realtime |
| `src/lib/useOwlNotes.js` | Owl notes + realtime |
| `src/lib/useOffline.js` | Offline detection + queue |
| `src/lib/supabase.js` | Supabase client init |
| `src/lib/permissions.js` | Role-based permissions |
| `src/lib/roles.js` | Role labels/colors |
| `src/context/AuthContext.jsx` | Auth state provider |
| `src/components/GroupOrganizer.jsx` | Group organizer (pickup triggers) |
| `src/components/UpdateBanner.jsx` | PWA update banner |
| `src/main.jsx` | SW registration |
| `api/tower-approve.js` | Draft promotion endpoint |
| `api/lib/supabase-admin.js` | Service role client |
| `vercel.json` | Deployment config + crons |
| `vite.config.js` | Build + PWA config |
| `supabase-schema.sql` | Base schema + RLS |
| `supabase/migrations/20260401999999_admin_rls.sql` | Admin RLS migration |
| `supabase/migrations/20260315_owl_daily_ack_and_addresses.sql` | Owl notes migration |
| `supabase/migrations/20260406_acuity_notes.sql` | Acuity notes schema |
| `supabase/migrations/20260406_dog_vacations.sql` | Dog vacations schema |
| `migrations/20260315_lock_schedule_and_conflicts.sql` | Lock + conflicts schema |
| `migrations/20260405_mini_gen_drafts.sql` | Mini Gen drafts schema |
| `scripts/add-profiles-rls.sql` | Profiles RLS addition |
