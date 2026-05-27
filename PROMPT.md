# WHEEL 2 — Silent Failure Elimination

**Source of truth.** Three Playwright specs under `tests/wheels/` run against `https://wiggle-app-dusky.vercel.app`. When all three pass, this wheel is COMPLETE. Wheel 1 (owl-notes safety) shipped at `f32a7a6` and is archived in commit history.

Each iteration:
1. Run `npm run test:wheels`.
2. Use failure output to drive the next code change.
3. Schema changes (unlikely for this wheel) go through Supabase `apply_migration`.
4. Deploy to main → wait for prod → re-run tests.

If a test still fails after a reasonable number of iterations (~30+), STOP and write `BLOCKER.md`.

---

## The three bugs

### Bug 1 — Offline queue is never replayed on app start
- **File:** `src/lib/useOffline.js`
- **Symptom:** PWA killed offline mid-queue; walker reopens online; queue stays in localStorage forever because `navigator.onLine === true` at start does not fire an `online` event.
- **Fix:** on `useOffline` mount, if `navigator.onLine` and queue is non-empty, run `replayOfflineQueue()` immediately.

### Bug 2 — Offline queue replay wipes mid-replay enqueues
- **File:** `src/lib/useOffline.js`
- **Symptom:** Old `replayOfflineQueue` reads queue into local array, processes, then unconditionally `localStorage.removeItem(QUEUE_KEY)`. Any enqueue during replay is silently discarded.
- **Fix:** assign `_id` to each enqueued action; per-item drain (keep failed + concurrent enqueues); single-flight guard so concurrent replay calls share one in-flight promise.

### Bug 3 — `updateTimestamp` has no rollback or offline path
- **File:** `src/lib/usePickups.js`
- **Symptom:** Delete-then-insert pickup time edit. If insert fails for anything other than 23505, local card shows new time but DB is empty. Walker thinks edit saved.
- **Fix:** snapshot prev entry + original timestamp before optimistic write; on insert failure, restore local state AND re-insert original DB row (synchronously for hard errors; via offline queue for transport failures).

**Bonus parity:** `markNotWalking` already has the guard + transport-failure branch (audit Finding #1 landed previously). `undoNotWalking` could use the same — flag as follow-up if not in this wheel's scope.

---

## Tests

- `tests/wheels/offline-queue-replay-on-mount.spec.js` — seed queue in localStorage, reload page (already-online state), assert row reaches DB and queue is drained.
- `tests/wheels/offline-queue-race-safety.spec.js` — slow walker_notes POSTs, seed item A, fire `online`, enqueue B mid-replay, fire `online` again, assert both rows reach DB.
- `tests/wheels/update-timestamp-rollback.spec.js` — seed original pickup row, mock `/api/acuity` to fabricate one event for our test dog, open DogDrawer, edit time, intercept INSERT with 500, assert DB still has a pickup row for the walker.

Run: `npm run test:wheels`

Test infra (same as Wheel 1):
- `playwright.config.js` → `https://wiggle-app-dusky.vercel.app`
- Helpers in `tests/wheels/_helpers.js`
- Test walkers: `test_walker_plateau_a@wiggledogwalks.com` / `test_walker_plateau_b@wiggledogwalks.com`, pwd `WiggleTest2026!`

---

## Rules

- Read-only on wiggle-world; this wheel touches wiggle-v4 only.
- Live URL is the verifier. No localhost pass = no green.
- Discipline #6 — 15-min post-merge window, revert on failure.
- Schema changes via `apply_migration`, not `execute_sql`.
- Tests use service role via `_helpers.js`; app code uses authenticated session + RLS.

---

## Completion signal

When `npm run test:wheels` reports **all green** against `https://wiggle-app-dusky.vercel.app` post-deploy, write **COMPLETE** and stop.
