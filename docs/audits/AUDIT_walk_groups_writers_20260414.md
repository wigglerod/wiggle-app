# AUDIT: walk_groups.dog_ids Writers & Shape-Drift Risks

**Date:** April 14, 2026
**Scope:** `~/Documents/wiggle-v4/` (production main, post-revert commit `0c3a9c8`)
**Auditor:** Cowork session — read-only, no code changes

---

## Part 1 — Every Writer to `walk_groups.dog_ids`

### Writer 1: `useWalkGroups.js` → `saveGroup` (THE PRIMARY BUG)

- **File:** `src/lib/useWalkGroups.js`
- **Function:** `saveGroup` (useCallback)
- **Line:** 189–201 (upsert at line 189, `dog_ids` written at line 194)
- **Shape it writes:** **UUIDs (WRONG).** The `dogIds` parameter comes from the `groups` state, which is populated at line 40: `events.map((ev) => ev.dog?.id || ev._id?.toString?.() || String(ev._id))`. When `ev.dog?.id` exists (which it does for all matched dogs), it's a UUID from the `dogs` table. Fallback `ev._id` is an Acuity appointment numeric ID.
- **Trigger:** User drags a dog between groups in the GroupOrganizer. Called via `moveEvent` (line 236) and `reorderGroup` (line 302).
- **Last modified:** Line 189 — `12990669` (Rodrigo, 2026-03-09). Line 40 (the bug root) — `0c3a9c8f` (Rodrigo, 2026-04-14, the revert commit).

**This is the known bug.** Line 40 builds `allEventIds` using `ev.dog?.id` (UUID) as first preference. Every downstream write through `saveGroup` propagates this UUID shape into `walk_groups.dog_ids`.

### Writer 2: `useWalkGroups.js` → `addGroup`

- **File:** `src/lib/useWalkGroups.js`
- **Function:** `addGroup` (useCallback)
- **Line:** 252–264 (upsert at line 252, `dog_ids` at line 257)
- **Shape it writes:** `dog_ids: []` — **empty array, always.** Safe. No shape risk.
- **Trigger:** User clicks "Add Group" button.
- **Last modified:** `8f7ce010` (Rodrigo, 2026-03-06)

### Writer 3: `useWalkGroups.js` → `renameGroup`

- **File:** `src/lib/useWalkGroups.js`
- **Function:** `renameGroup` (useCallback)
- **Line:** 281–291 (upsert at line 281, `dog_ids` at line 286)
- **Shape it writes:** `groupsRef.current[groupNum] || []` — **same UUID shape as Writer 1.** This is a pass-through of whatever is currently in the `groups` React state, which is populated from `allEventIds` (line 40). If dogs are already assigned, this writes UUIDs.
- **Trigger:** User renames a group in the organizer.
- **Last modified:** Line 281 — `8f7ce010` (Rodrigo, 2026-03-06). The `dog_ids` line 286 — same commit.

### Writer 4: `useWalkGroups.js` → `_persistWalkerIds`

- **File:** `src/lib/useWalkGroups.js`
- **Function:** `_persistWalkerIds` (async helper)
- **Line:** 395–405 (upsert at line 395, `dog_ids` at line 400)
- **Shape it writes:** `groupsRef.current[groupNum] || []` — **same UUID shape as Writer 1.** Same mechanism as Writer 3.
- **Trigger:** Walker assignment changes (user assigns a walker to a group).
- **Last modified:** Lines written across multiple commits; `dog_ids` line is consistent with the `saveGroup` pattern.

### Writer 5: `tower-approve.js` → approved draft promotion ✅

- **File:** `api/tower-approve.js`
- **Function:** `handler` (default export)
- **Line:** 87–100 (insert at line 88, `dog_ids` at line 94)
- **Shape it writes:** `dog_ids: [dogName]` — **dog NAMES (CORRECT).** The value comes from `mini_gen_drafts.dog_names`, which stores human-readable dog names (e.g., "Mochi", "Luna").
- **Trigger:** Admin approves a Mini Gen draft in Tower Control (`POST /api/tower-approve`).
- **Last modified:** `0b11f069` (Rodrigo, 2026-04-10)

### Writer 6: `MapView.jsx` → `handleLPMenuAssign` ⚠️

- **File:** `src/components/MapView.jsx`
- **Function:** `handleLPMenuAssign`
- **Line:** 407–422 (update at line 412, `dog_ids` at line 411)
- **Shape it writes:** Spreads existing `wg.dog_ids` (whatever shape is already in DB) and appends `longPressMenu.dogId`, which is `String(ev._id)` (line 397). `ev._id` is the **Acuity appointment numeric ID** (a number like `628491234`), not a UUID and not a dog name. **WRONG SHAPE — writes Acuity IDs.**
- **Trigger:** User long-presses a dog on the map view, then selects a group from the context menu.
- **Last modified:** `d8c5c20a` (Rodrigo, 2026-03-10)

### Writer 7: `MapView.jsx` → `assignToGroup` ⚠️

- **File:** `src/components/MapView.jsx`
- **Function:** `assignToGroup`
- **Line:** 425–441 (update at line 430, `dog_ids` at line 429)
- **Shape it writes:** Spreads existing `wg.dog_ids` and appends `selectedId`, which is `String(ev._id)` (line 386–387). Same as Writer 6: **Acuity appointment numeric ID. WRONG SHAPE.**
- **Trigger:** User taps a dog chip on the map view, then taps a group to assign.
- **Last modified:** `6b1f601c` (Rodrigo, 2026-03-10)

### Writer 8: `MapView.jsx` → `handleGroupReorder`

- **File:** `src/components/MapView.jsx`
- **Function:** `handleGroupReorder`
- **Line:** 443–455 (update at line 445, `dog_ids` at line 446)
- **Shape it writes:** `newDogIds` is a reordered version of the existing `wg.dog_ids`. **Pass-through — writes back whatever shape was already in the DB.** If the DB had names, it writes names. If it had UUIDs, it writes UUIDs.
- **Trigger:** User drag-reorders dogs within a group on the map view.
- **Last modified:** `744864dc` (Rodrigo, 2026-03-15)

### Summary Table

| # | File | Function | Line | Shape Written | Correct? |
|---|------|----------|------|---------------|----------|
| 1 | `src/lib/useWalkGroups.js` | `saveGroup` | 189 | UUIDs (`ev.dog?.id`) | ❌ BUG |
| 2 | `src/lib/useWalkGroups.js` | `addGroup` | 252 | `[]` (empty) | ✅ Safe |
| 3 | `src/lib/useWalkGroups.js` | `renameGroup` | 281 | UUIDs (from groups state) | ❌ BUG |
| 4 | `src/lib/useWalkGroups.js` | `_persistWalkerIds` | 395 | UUIDs (from groups state) | ❌ BUG |
| 5 | `api/tower-approve.js` | `handler` | 88 | Dog names | ✅ Correct |
| 6 | `src/components/MapView.jsx` | `handleLPMenuAssign` | 412 | Acuity IDs | ❌ **NEW FINDING** |
| 7 | `src/components/MapView.jsx` | `assignToGroup` | 430 | Acuity IDs | ❌ **NEW FINDING** |
| 8 | `src/components/MapView.jsx` | `handleGroupReorder` | 445 | Pass-through | ⚠️ Amplifies existing drift |

**No other writers found.** Searched all `.js`, `.jsx`, `.ts`, `.tsx` files in `src/` and `api/`. No Supabase edge functions exist in this repo (`supabase/functions/` is empty). No Apps Script files in the repo. `BeastSection.jsx` mentions `walk_groups` only in a read-only AI system prompt. `Admin.jsx`, `WeeklyView.jsx` only read from `walk_groups`, never write.

---

## Part 2 — Other Shape-Drift Risks

### Table: `walk_groups`

**Column: `dog_ids` (text[])** — Covered in Part 1. Three distinct shapes writing to one column.

**Column: `walker_ids`** — Not in the base schema (`supabase-schema.sql`), added via later migration. Written by `useWalkGroups.js` in three places (lines 197, 260, 403). All write profile UUIDs consistently. `tower-approve.js` writes `walker_ids: []`. **Low drift risk** — single semantic shape (profile UUIDs), consistent across all writers.

### Table: `route_orders`

**Column: `event_order` (text[])** — Schema at `supabase-schema.sql:247`.

- **Expected shape:** Event identifiers used for ordering pickup routes.
- **Writer:** `src/components/RouteBuilder.jsx` line 139 — writes `events.map((ev) => String(ev._id))`, which is Acuity appointment IDs.
- **Only one writer.** No drift risk from multiple writers.
- **Note:** This column uses Acuity IDs, while `walk_groups.dog_ids` is supposed to use dog names. The two columns serve different purposes, so this is not a conflict — but it's worth noting that `ev._id` means different things in different contexts.

### Table: `mini_gen_drafts`

**Column: `dog_names` (text[])** — Schema at `migrations/20260405_mini_gen_drafts.sql:7`.

- **Expected shape:** Dog names (human-readable strings).
- **Writer:** `api/mini-gen.js` line 304 — inserts rows with `dog_names` populated from Acuity appointment matching. `tower-approve.js` reads this column but does not write to it.
- **Only one writer.** No drift risk.

### Table: `dogs`

**Column: `level_tags` (text[])** — Added via `supabase/migrations/20260315_add_level_tags.sql`.

- **Expected shape:** Level tag strings (e.g., "reactive", "puller").
- **Writer:** `src/components/DogDrawer.jsx` line 321 — writes string tags.
- **Only one writer.** Not an identifier column. No drift risk.

### Table: `walker_notes`

- No `text[]` columns found in any schema file or migration. All columns appear to be scalar types (`text`, `uuid`, `date`, etc.). **No array drift risk.**

### Summary

| Table | Column | Expected Shape | Writers | Drift Risk |
|-------|--------|---------------|---------|------------|
| `walk_groups` | `dog_ids` | Dog names | 8 code paths | 🔴 **HIGH** — 3 shapes |
| `walk_groups` | `walker_ids` | Profile UUIDs | 4 code paths | 🟢 Low — consistent |
| `route_orders` | `event_order` | Acuity IDs | 1 code path | 🟢 None |
| `mini_gen_drafts` | `dog_names` | Dog names | 1 code path | 🟢 None |
| `dogs` | `level_tags` | Tag strings | 1 code path | 🟢 None |
| `walker_notes` | _(no arrays)_ | N/A | N/A | 🟢 N/A |

---

## Part 3 — Vercel Pro Preview Testing Plan

After deploying the `useWalkGroups.js` fix to a feature branch, test on the preview URL from a phone:

1. **Drag-assign a dog to a group** on the main organizer screen (GroupOrganizer). Open Supabase Table Editor → `walk_groups` → verify the `dog_ids` cell for that row contains a **dog name string** (e.g., `"Mochi"`), not a UUID (e.g., `"a1b2c3d4-..."`).

2. **Rename a group** that already has dogs assigned. Re-check the same row in Supabase — confirm `dog_ids` was not wiped or corrupted by the rename upsert.

3. **Assign a walker** to a group with dogs. Re-check — confirm `dog_ids` still contains names after the walker assignment upsert (`_persistWalkerIds` path).

4. **Open Map View, tap a dog chip, assign to group.** Check the `dog_ids` row in Supabase — confirm the appended value is a dog name, not an Acuity numeric ID. _(This tests the MapView writer — Writers 6/7 from Part 1. If MapView was not also patched, this will fail.)_

5. **Reload the organizer after all the above.** Confirm all dogs still render in their correct groups with names displayed — no "ghost" cards, no missing dogs, no blank names.

---

## Summary

**Are there any writers besides `useWalkGroups.js` shipping the wrong shape?** Yes. `MapView.jsx` has two independent writer paths (lines 411–412 and 429–430) that write `String(ev._id)` — Acuity appointment numeric IDs — directly into `walk_groups.dog_ids`. These are a **separate bug from the `useWalkGroups.js` UUID issue**, writing a third shape (numeric Acuity IDs) into the same column. A third MapView writer (line 445, `handleGroupReorder`) is a pass-through that amplifies whatever shape is already stored. These MapView writers have been present since March 10, 2026 and were not addressed by the April 14 patch or revert. However, MapView usage may be low enough that these paths haven't been triggered often — this needs verification against the actual `walk_groups` data.

**Are there any other tables at similar risk?** No. Every other `text[]` column in the schema (`walker_ids`, `event_order`, `dog_names`, `level_tags`) has either a single writer or multiple writers that all agree on shape. `walk_groups.dog_ids` is the only column with multiple writers disagreeing on shape.

**Is the preview testing plan sufficient to catch a regression?** Steps 1–3 cover the `useWalkGroups.js` paths. Step 4 specifically targets the MapView writers, which are a separate fix needed beyond the known `useWalkGroups.js` patch. Step 5 is the integration smoke test. The plan is sufficient **if step 4 is not skipped** — the MapView writers are a real second bug that the original patch did not address.
