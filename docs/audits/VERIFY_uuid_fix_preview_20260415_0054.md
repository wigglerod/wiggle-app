# UUID Fix Preview Verification — 2026-04-15 00:54

**Preview URL:** `https://wiggle-app-git-fix-walk-groups-dog-i-e37af0-wigglerods-projects.vercel.app`
**Branch:** `fix/walk-groups-dog-ids-reship`
**Commit:** `f101adf`
**Patch:** `src/lib/useWalkGroups.js` line 40 — `ev.dog?.id` → `ev.dog?.dog_name`

---

## Pre-flight

| Check | Result |
|---|---|
| Preview URL loads | ✅ Yes — redirects to `/login` |
| Login with test credentials | ✅ Authenticated as "Chief Pup" (admin, both sectors) |
| Tower Control accessible | ✅ Gen's Dashboard renders, 18 dogs today |
| GroupOrganizer accessible | ⚠️ Renders but **non-functional** (see below) |

---

## Critical Finding — Key Mismatch Bug

**The fix is incomplete.** The patch changes the identifier used in `useWalkGroups.js` but does NOT update the corresponding key in `GroupOrganizer.jsx`, creating a system-wide mismatch:

| File | Line | Key used | Value type |
|---|---|---|---|
| `src/lib/useWalkGroups.js` | 40 | `ev.dog?.dog_name` | Dog name string (e.g., `"Cleo Golden"`) |
| `src/components/GroupOrganizer.jsx` | 289 | `ev.dog?.id` | Dog UUID (e.g., `"50439441-4089-..."`) |

**What happens:**

1. `useWalkGroups` builds `allEventIds` from dog names → `["Cleo Golden", "Luna GS", "Shaft", ...]`
2. `useWalkGroups` loads `walk_groups` from DB, filters `dog_ids` against `allEventIds` — existing UUID-based data doesn't match, so all groups appear empty
3. All dogs land in `groups.unassigned` (dog name strings)
4. `GroupOrganizer.eventsMap` is keyed by UUID → `eventsMap.get("Cleo Golden")` returns `undefined`
5. `UnassignedPool` iterates dog names, looks up each in eventsMap, gets `undefined`, returns `null` → **zero dog pills render**

**Result:** The entire GroupOrganizer is non-functional. No dogs appear in any group or in the unassigned pool. No assignment, rename, or walker-change actions can be taken through the UI.

---

## Step-by-Step Results

### Step 1 — Drag-assign
**Action:** Could not perform.
**Reason:** Unassigned pool shows "Unassigned 12" header but renders 0 dog pills. No dogs are clickable or draggable.
**DB state (pre-existing):** Laurier groups contain UUID-based `dog_ids` (e.g., `["50439441-4089-41ea-af21-85eabe842871", ...]`). The preview code can't match these to dog names, so groups show 0/0.
**Result:** ❌ BLOCKED

### Step 2 — Rename a group
**Action:** Could not meaningfully test. Groups render with headers (Group 1/2/3) but contain 0 dogs. A rename could technically be performed but would not test the `dog_ids` preservation because there are no dogs in the array to corrupt.
**Result:** ❌ BLOCKED (no dogs to verify preservation of)

### Step 3 — Assign walker
**Action:** Same as Step 2 — walker badge is visible and "+ walker" buttons exist, but with 0 dogs in every group, verifying that `dog_ids` survives a walker change is meaningless.
**Result:** ❌ BLOCKED

### Step 4 — Reload integrity
**Action:** Observed current state.
**Observation:** Every group shows "0 dogs". Unassigned pool shows count "12" but no dog pills. No blank cards (because no cards render at all). No UUIDs visible to user (because nothing renders). No duplicate dogs (because nothing renders).
**Result:** ❌ FAIL — dogs are invisible, not merely misplaced

---

## DB Snapshot (for context)

Laurier groups for 2026-04-14 (queried via Supabase MCP):

| Group | group_num | dog_ids (current DB) | dog_ids shape |
|---|---|---|---|
| Group 1 | 1 | `["50439441-...", "97e95d0e-...", "2c277249-..."]` | UUIDs ❌ |
| Group 2 | 2 | `["d03fab77-...", "f2ca718f-...", "b856deb2-...", "8f2e37c7-..."]` | UUIDs ❌ |
| Group 3 | 3 | `["fbff9170-...", "500f8680-...", "129d4370-..."]` | UUIDs ❌ |
| Group 4 | 4 | `["ea050f9a-..."]` | UUID ❌ |
| Group 5 | 5 | `["51a6a46a-..."]` | UUID ❌ |

Plateau Group 6 ("Last one") has `dog_ids: ["Lucky"]` — a name string, likely written by a different code path.

---

## Root Cause

The patch (`f101adf`) only changed one side of a two-sided identifier system:

- ✅ **Write path fixed:** `useWalkGroups.js` line 40 now uses `dog_name` — new writes to `walk_groups.dog_ids` would contain dog names
- ❌ **Read path broken:** `GroupOrganizer.jsx` line 289 still builds `eventsMap` keyed by `dog.id` (UUID) — so the UI can't look up events by their new dog-name identifiers

**The fix needs:** `GroupOrganizer.jsx` line 289 must also change from `ev.dog?.id` to `ev.dog?.dog_name` (or a shared helper should produce both maps).

Additionally, any existing UUID-based `dog_ids` rows in the DB need a one-time backfill migration to convert UUIDs → dog names, or the load logic needs a compatibility layer that handles both formats during transition.

---

## Cleanup

No test changes were made to the database — the UI was non-functional so no writes occurred.

---

## VERDICT: RED — do not merge

The preview branch has a **key mismatch** between `useWalkGroups` (now dog_name-based) and `GroupOrganizer.eventsMap` (still UUID-based). This renders the entire GroupOrganizer non-functional — zero dogs appear in any group or the unassigned pool. The fix requires a matching change in `GroupOrganizer.jsx` line 289 and a data backfill for existing UUID-based rows.
