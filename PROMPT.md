# WHEEL 1 — Owl Notes Safety + Walk Groups DELETE

**Source of truth.** Three Playwright specs under `tests/wheels/` run against `https://wiggle-app-dusky.vercel.app`. When all three pass, this wheel is COMPLETE. Until then, every iteration must:

1. Read this file.
2. Run `npm run test:wheels` (or `npx playwright test tests/wheels/<spec>`).
3. Use the failure output to drive the next code change.
4. Schema changes go through Supabase `apply_migration` (not `execute_sql`).
5. Deploy to main → wait for prod → re-run the tests.

If a test still fails after a reasonable number of iterations (~30+), STOP and write `BLOCKER.md` describing what's stuck. Do not invent fixes that don't pass the test.

---

## The three bugs

### Bug 1 — Owl-note acknowledgement is global, not per-walker
- **File:** `src/lib/useOwlNotes.js` (~line 170, `acknowledgeNote`)
- **Symptom:** Walker A taps "Got it" → Walker B's banner for that note disappears within seconds via realtime UPDATE.
- **Root cause:** `acknowledgeNote` writes `last_acknowledged_date = today` on the single shared row. `useOwlNotes` then filters the row out for every walker whose realtime UPDATE matches that date (line ~224: `if (n.expires_at && n.last_acknowledged_date === today) return false`).
- **Fix direction (CC chooses the shape):**
  - Add a join table via `apply_migration`. Suggested:
    ```sql
    CREATE TABLE public.owl_note_acks (
      note_id   uuid NOT NULL REFERENCES public.owl_notes(id) ON DELETE CASCADE,
      walker_id uuid NOT NULL,
      ack_date  date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Toronto')::date,
      PRIMARY KEY (note_id, walker_id, ack_date)
    );
    -- RLS: walkers can insert their own acks; everyone can read.
    -- Add to supabase_realtime publication, REPLICA IDENTITY FULL.
    ```
  - Leave the existing `acknowledged_by` / `last_acknowledged_date` columns alone for backward compat.
  - New filter in `useOwlNotes`: a note is hidden for *this walker* when `(note_id, current_walker_id, today)` exists in the ack table — not when `last_acknowledged_date === today`.
  - Subscribe to `owl_note_acks` filtered by `walker_id = current_walker`; other walkers' acks must not affect this walker's UI.

### Bug 2 — Owl-note EOD expiry is not enforced
- **File:** `src/lib/useOwlNotes.js` (writer paths — `createNote`)
- **Symptom:** A note for a specific date with no `(N days)` tail and no explicit `expires_at` lingers forever; even when `scheduled_date` is in the past, the row still passes the load filter.
- **Root cause:** `parseDuration` only returns an `expiresAt` when there's a tail; the writer doesn't default to EOD of `scheduled_date` in America/Toronto.
- **Fix direction:**
  - In `createNote` (and any other writers): if neither an explicit `expiresAt` nor a parsed-tail expiry is provided, compute `expires_at` from `scheduled_date` as the end of that day in America/Toronto (≈23:59:59 Toronto time).
  - **Don't** introduce writes from `useOwlNotes.load()` — walker `load()` should be SELECT-only (this also closes the audit HIGH about the per-load `DELETE FROM owl_notes WHERE expires_at < now()`; remove that DELETE while you're here).
  - Optional: a server-side cron / Edge Function to clean up expired rows daily. Not required to pass the test — filtering on read is enough.

### Bug 3 — `walk_groups` realtime ignores DELETE
- **File:** `src/lib/useWalkGroups.js` (~line 142)
- **Symptom:** Admin deletes a `walk_groups` row → every walker who already has the app open keeps showing the stale group/dog assignments until full reload.
- **Root cause:** Handler reads `payload.new` and returns early; on DELETE, `payload.new` is `null` and `payload.old` carries the row.
- **Additional schema work:**
  - `walk_groups.replica_identity` is currently `'default'`. Run `ALTER TABLE public.walk_groups REPLICA IDENTITY FULL` via `apply_migration` so DELETE payloads carry the full old row.
- **Fix direction:**
  - Branch on `payload.eventType`:
    - `INSERT` / `UPDATE`: existing logic, but read from `payload.new`.
    - `DELETE`: read from `payload.old`. Remove the row from `groupNums`, `groups`, `groupNames`, `groupLocks`, `walkerAssignments`. Rebuild `unassigned` from the remaining `groupNums`.

---

## Tests (the contract)

Three specs under `tests/wheels/`:

1. `owl-note-ack-per-walker.spec.js` — two browser contexts (Walker A + Walker B), an owl note with a `(3 days)` tail, A acks, B must still see it after ~3s realtime window.
2. `owl-note-eod-expiry.spec.js` — yesterday-scheduled untailed note must NOT render today; today-scheduled untailed note must get an `expires_at` near today's EOD-in-Toronto.
3. `walk-groups-delete-realtime.spec.js` — test admin inserts a Plateau group, walker sees it, admin deletes it, walker no longer sees it within ~3s.

Run all: `npm run test:wheels`
Run one: `npx playwright test tests/wheels/owl-note-ack-per-walker.spec.js`

Test infra:
- Playwright config: `playwright.config.js` (targets `https://wiggle-app-dusky.vercel.app` by default; override with `WHEEL_BASE_URL`).
- Helpers: `tests/wheels/_helpers.js` (service-role Supabase admin client, `ensureTestWalker`, `loginAs`).
- Test walker accounts (provisioned, idempotent via `node tests/wheels/_provision.mjs`):
  - `test_walker_plateau_a@wiggledogwalks.com` / `WiggleTest2026!` (senior_walker, Plateau)
  - `test_walker_plateau_b@wiggledogwalks.com` / `WiggleTest2026!` (senior_walker, Plateau)
- Env required in `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Known test-setup considerations (for ralph-loop)

- The walker Dashboard only loads walk_groups when Acuity returns events for the day (`useWalkGroups.load` short-circuits if `allEventIds.length === 0`). On normal business days this is fine. If Acuity returns nothing for the day the test runs against, that's a real-world reason all three tests would be flaky — note this as a temporal blocker, do not work around it by hacking the walker hook.
- Realtime arrival can take 1–4 seconds in production. Tests use `sleep(3500–4000)` then poll for visibility/absence; bump the sleep window before declaring a fix broken.
- Empty groups (`dog_ids = []`) may not render distinctively in `GroupOrganizer` — the test seeds `group_name = 'TEST_GROUP_<ts>'` and asserts that text. If the UI hides nameless empty groups, the test seeds the name on purpose.

---

## Rules (from the wheel briefing)

- **Read-only on wiggle-world.** Only touch `~/Documents/wiggle-v4/`.
- **Live URL is the verifier.** No localhost-only green signals. Vercel preview branches are not enabled — merge to main → wait for prod deploy → run tests.
- **Discipline #6 post-merge window.** 15 minutes after merge, if any test still fails or unrelated walker reports come in, revert.
- **Schema changes use `apply_migration`, not `execute_sql`.** Multi-statement SQL → one `execute_sql` per statement; only the last returns results.
- **No service-role keys in client code.** Test setup uses service role via MCP — the app code uses authenticated session + RLS.
- **Brain tables are archived.** No `wiggle_decisions` writes. Commit hash + green test output is the artifact.
- **One PR per bug or one PR for the wheel — CC's call.**

---

## Completion signal

When `npm run test:wheels` reports **3 passed** against `https://wiggle-app-dusky.vercel.app` post-deploy, write **COMPLETE** and stop.
