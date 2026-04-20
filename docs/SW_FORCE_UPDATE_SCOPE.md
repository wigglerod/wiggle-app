# Service Worker Force-Update — Scoping

**Open question:** #27
**Session:** 2026-04-19 (wiggle-v4)
**Status:** Scoping only — no code changes in this pass.
**Incident trigger:** 2026-04-15. After the `tower-approve.js` / `useWalkGroups.js` fix shipped, Amelie opened a stale cached bundle and re-corrupted 5 `walk_groups` rows within ~90 seconds. The "walker-ping" ritual (Rod DMs walkers to reload) is the current safety net and is fragile — one missed ping = silent regression on a writer path.

---

## 1. Current state

### Files
- [vite.config.js](../vite.config.js) — `VitePWA` plugin config (lines 27–113).
- [src/main.jsx](../src/main.jsx) — manual `registerSW` registration, update polling, auto-reload listener.
- [src/components/UpdateBanner.jsx](../src/components/UpdateBanner.jsx) — "New version available" banner listener.
- Build-time constant: `__APP_VERSION__` = ISO timestamp baked into bundle ([vite.config.js:6](../vite.config.js:6)). Displayed only in Login and Settings footers; **not** fetched at runtime.

### What's cached today
Workbox precache (auto-generated from build manifest) — hashed JS/CSS/HTML/images/fonts:
```
globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff,woff2}']
navigateFallback: '/index.html'
```
Runtime caches (NetworkFirst / CacheFirst):
| Pattern | Strategy | Cache | Max age |
|---|---|---|---|
| Google Fonts stylesheets | CacheFirst | `google-fonts-cache` | — |
| Google Fonts webfonts | CacheFirst | `google-fonts-webfonts` | 1 year |
| `*.supabase.co/rest/v1/*` | NetworkFirst (10s) | `supabase-api-cache` | 5 min |
| `*.supabase.co/storage/v1/*` | CacheFirst | `dog-photos-cache` | 30 days |
| `maps.(googleapis\|gstatic).com/*` | CacheFirst | `google-maps-cache` | 7 days |
| `/api/acuity*` | NetworkFirst (10s) | `acuity-api-cache` | 5 min |

### What's in place for updates
1. **Workbox lifecycle** — `skipWaiting: true`, `clientsClaim: true`, `cleanupOutdatedCaches: true`. New SW activates immediately on install and claims open tabs.
2. **Registration polling** ([src/main.jsx:10–33](../src/main.jsx:10)):
   - `registration.update()` on load.
   - `registration.update()` every 5 min while app is open.
   - `registration.update()` on `visibilitychange` → `visible` (critical for iOS PWA).
3. **Auto-reload on controller change** ([src/main.jsx:36–41](../src/main.jsx:36)) — when the new SW takes control, the page reloads once.
4. **Prompt banner** — `registerType: 'prompt'` + `UpdateBanner` listens for `wiggle-sw-update` and shows "New version available" CTA.

**Note the contradiction:** `registerType: 'prompt'` says "let the user decide", but `skipWaiting + clientsClaim + controllerchange → reload` forces the reload anyway. In practice the auto-reload wins; the banner rarely gets tapped before the page reloads itself. Either path is effectively Option A.

### Why the April 15 incident still happened
The SW update pipeline fires **after** the old bundle has already loaded and started executing. Precached `index.html` is served instantly on app open → it references the OLD hashed JS bundles → the user is running stale writer code for some window (seconds to minutes) before:
  - `registration.update()` finishes,
  - new SW installs + activates,
  - `controllerchange` fires,
  - page reloads.

Amelie's 90-second corruption window fits this exactly. The current design reduces the window, it does not eliminate it. Any SW-update-speed fix has the same floor: there is always some first-paint execution of the last-cached bundle.

---

## 2. Options

### Option A — skipWaiting + clients.claim() (mostly in place)
**Current state: implemented.** Nothing to build, minor tightening possible.
- **Pro:** zero user action required; update window is bounded by the polling interval (≤5 min, or next visibility change).
- **Pro:** iOS PWA handled via visibility-change poll.
- **Con:** does not close the first-paint window. An offline-then-online walker who has never foregrounded since the fix shipped still runs old JS on the next cold open until `registration.update()` completes.
- **Con:** mid-session reload is possible. For Wiggle this is low-risk — walks are short-form writes, not long-running forms — but a reload mid-drag-assign would re-fetch state and could feel jarring.
- **Tightening ideas** (small effort, still Option A):
  - Shorten the 5-min interval to 60–90s. Cost: extra `update()` HEAD/manifest requests; negligible.
  - Call `registration.update()` before every writer path (pre-write gate) — cheap if the new SW is already cached, costly if not.

### Option B — Version banner, manual reload
**Current state: banner exists but is overshadowed by auto-reload.** To make this the real strategy, drop `skipWaiting`/`clientsClaim` and let `onNeedRefresh` do the work; user taps Update → `updateSW(true)` reloads.
- **Pro:** walker controls the reload — no mid-session surprise.
- **Con:** this is exactly the Amelie failure mode. She didn't know to reload. A banner on top of a card that looks like it works is easy to ignore.
- **Con:** with banner-only, the old bundle can execute writes indefinitely. That is a worse safety posture than today for a product whose main risk is a stale writer.
- **Verdict:** banner as a *sole* strategy is a regression. Keep the banner as a visible "something updated" signal, but do not rely on it for safety.

### Option C — Cache-bust on critical writer paths
Bypass cache for specific fetches to the DB/API writers.
- **Pro:** surgical; no app-shell reload.
- **Con:** doesn't help. The corruption shape from April 15 was old **client JS logic** (wrong key type in `useWalkGroups.js` / `GroupOrganizer.jsx`) writing valid-shaped-but-wrong data to a fixed server endpoint. Bypassing cache on the fetch call does not refresh the JS code building the request body. Rejected.

### Option D — Runtime version gate on writer paths (new option)
Add a small `/version.json` served by the API (or a CDN-no-cache static file). On mount, and before any writer call (group assign, walker change, rename), fetch `/version.json` and compare to `__APP_VERSION__`. If mismatch → block the write, trigger `registration.update()`, show banner, and refuse the action until reload.
- **Pro:** this is the *actual* mitigation for Amelie's case — it catches the stale-writer scenario at the moment of risk, regardless of SW timing.
- **Pro:** composes with Option A — SW still updates in the background; the gate is just a belt-and-braces at the writer boundary.
- **Pro:** cheap for walkers — one small JSON fetch per writer action, no full reload unless needed.
- **Con:** adds an async check in front of writers — UI must handle "write blocked, please update" as a real state. ~1 day of UI work if done carefully (loading, error, reload flow).
- **Con:** requires a non-cached `/version.json` endpoint. Trivial to add as `api/version.js` or a static file with `Cache-Control: no-store`.

---

## 3. Recommendation

**Option A (tightened) + Option D (writer gate).** Two layers:
1. **Keep and tighten the existing SW auto-update** — shorten the polling interval to 90s and call `registration.update()` on writer-path entry. Low cost, keeps the broad-update coverage.
2. **Add a runtime version gate on writer paths** — this is the only option that actually prevents the April 15 failure mode. The SW can be as fast as we want; it cannot beat "user opens app and acts in the first 5 seconds." A writer-side gate can.

**Why not Option B alone:** it moves a safety-critical decision onto a walker with one hand in a winter coat. Not the right UX for corruption-risk paths.

**Why not Option C:** the corruption was in the JS, not in the request headers. Cache-busting fetches does nothing for this class of bug.

---

## 4. Estimated effort (recommended path)

| Task | Effort | Notes |
|---|---|---|
| Shorten polling interval to 90s | 5 min | [src/main.jsx:21](../src/main.jsx:21) one-line change |
| Add `registration.update()` call on writer-path entry | 30 min | Small helper in `src/lib/`; called by GroupOrganizer + tower-approve caller sites |
| Add `/version.json` endpoint with `Cache-Control: no-store` | 30 min | New `api/version.js` returning `{ version: process.env.VERCEL_GIT_COMMIT_SHA ?? APP_VERSION }` — requires the same build-time constant to be shared with the client |
| Runtime version-gate helper | 1–2 hrs | `await assertFreshBundle()` — fetches `/version.json`, compares to `__APP_VERSION__`, returns boolean or throws typed error |
| Wire gate into writer paths | 2–3 hrs | GroupOrganizer assign/rename/walker-change; any direct `supabase.from('walk_groups').update()` or `/api/tower-approve` caller. Audit against [AUDIT_walk_groups_writers_20260414.md](../AUDIT_walk_groups_writers_20260414.md) to make sure every writer is covered |
| "Update required to continue" UI state | 2–3 hrs | Single shared component; blocking modal or inline banner + disabled CTA |
| Manual test matrix | 1 hr | Desktop Chrome, iOS Safari PWA, offline → online. Verify stale bundle is blocked, fresh bundle passes transparently |
| **Total** | **~1 working day** | |

### Files that would change (recommended path)
- `vite.config.js` — no structural change. Could optionally expose `APP_VERSION` to server via build env.
- `src/main.jsx` — polling interval tweak.
- `src/lib/assertFreshBundle.js` — NEW. Version-gate helper.
- `src/lib/useWalkGroups.js` or the specific writer callers — call the gate before `.update()` / fetch.
- `src/components/GroupOrganizer.jsx` — handle gate-block state.
- `api/version.js` — NEW. Returns current deployed version, uncached.
- `src/components/UpdateBanner.jsx` — extend to render the gate-triggered banner (same visual).

### Files NOT changing
- Workbox `runtimeCaching` rules — current strategies are correct for their purposes.
- `skipWaiting` / `clientsClaim` — keep as-is; they help in the non-writer case.

---

## 5. Open sub-questions for Rod

1. Do we want the writer-path version check to be **blocking** (refuse the write, force reload) or **advisory** (write anyway, show banner)? **Blocking** matches "fail loud" discipline and matches the Job 1 DB constraint philosophy.
2. Should the version check hit `/version.json` or piggy-back on a header from the Supabase REST response? Static endpoint is simpler and doesn't require server changes to each writer.
3. Should the gate be a hook (`useFreshBundle()`) or a one-shot (`await assertFreshBundle()`)? One-shot is simpler and only runs when needed.
4. Is there appetite to lower the 5-min poll to 90s now, or keep it as-is until the gate is built?
