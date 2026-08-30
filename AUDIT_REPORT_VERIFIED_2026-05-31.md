# Wiggle Audit — VERIFIED Report (2026‑05‑31)

> Read‑only. This file does **not** replace `AUDIT_REPORT.md` — it is the
> multi‑agent audit findings (find → adversarial refute) with **live‑DB
> verdicts folded in**, verified this session against Supabase project
> `ifhniwjdrsswgemmqddn`. No source files were edited to produce it.

**Original run:** 42 findings · 35 confirmed · 4 unconfirmed · 3 refuted (static).
**After live‑DB verification:** 4 findings moved to **Refuted (dead by live data)**,
2 reclassified **Real‑but‑Dormant (scheduled)**. The catastrophic F1 is dead.

Surfaces: **HQ** = walker PWA (warm). **Tower / "Studio"** = admin desktop
(cool‑gray), used by Gen Monday 7am. Live roster: **3 admin · 10 senior · 0 junior**.

---

## 🔴 BROKEN — confirmed, doesn't work (ACTIVE)

**B1 · Beast "Do it" writes nothing but says "✓ Logged."**
`src/components/tower/beast/BeastSection.jsx:175` passes `onConfirm={() => {}}`
(empty); `src/components/tower/beast/BeastConfirm.jsx:56` flips to the static
success text at `:17`; `api/beast.js` is a pure chat proxy with no action route.
Gen clicks "Do it," sees *"Logged — Beast flagged this for follow‑up,"* and
nothing was persisted. Worse than a disabled button — the UI asserts success.

**B4 · The Mini Gen review is split, and the half Gen can reach can't resolve flags.**
The reachable review is the dashboard (`src/pages/TowerDashboard.jsx`) — its FLAGS
section just renders read‑only `FlagCard`s (`src/components/tower/dashboard/FlagCard.jsx`,
no buttons, no fetch). The **only** flag‑resolution tools — inline name‑map fix,
vacation‑remove, and bulk approve‑clean — live in the orphaned standalone page
`src/pages/TowerMiniGen.jsx` (`UnresolvedFixForm:62‑149`, `VacationRemoveBtn:151‑205`,
`approveAllClean:361‑383`), which has **no nav tab and zero links** (route
`src/App.jsx:152` is its only reference). So when a flag appears Monday, the
dashboard offers no way to act on it and the tool that would is unreachable.
*(Full evidence in the handoff below.)*

---

## 🟠 BROKEN — REAL but DORMANT (scheduled — fix before the trigger)

**B2 · Scout cron crashes on any non‑200 from Acuity.** `api/scout.js:129‑137`
calls `acuityRes.json()` with no `.ok` guard, then `for (const appt of appointments)`
— a 429/401/5xx makes the body a non‑array and the loop throws, aborting the whole
run (incl. the Gmail scan) with no signal. **Live status: healthy** — flag_cards are
current through the last weekday run. **→ Fix before a bad Acuity day**, not urgent today.

**B3 · A junior walker's "Warn next walker" / Flag note is silently dropped + reported as total failure.**
`src/hooks/useActivityNotes.js:34‑66` inserts `walker_notes` (succeeds) then `owl_notes`,
but owl INSERT is admin/senior‑only by RLS (`migrations/20260417_extract_owl_notes.sql:61‑71`),
and the composer lets anyone toggle it (`src/components/NoteComposer.jsx:28‑40`). The owl
insert throws after the activity row saved → "Something went wrong," safety warning lost,
retry can duplicate. **Live roster has 0 junior_walkers (3 admin, 10 senior)** so nothing
triggers it today. **→ Fix BEFORE onboarding any Pup Walker.**

---

## 📐 INSTRUCTION VIOLATIONS — breaks the project's own rules (ACTIVE)

**V1 · Door code hidden behind "Tap to reveal" in the live walk drawer.**
`src/components/DogDrawer.jsx:213` inits `doorRevealed=false`; `:732‑766` shows the
code only after tapping a coral button (`:754‑762`). **Rule:** door codes always
visible, never tap‑to‑reveal (HQ_PRINCIPLES.md:20). This is the drawer rendered on
Dashboard + Schedule; the card pill and `DogProfileDrawer` both show it always —
inconsistent. WWRS failure at a locked door, one hand, winter coat.

**V3 · TowerMiniGen wears the HQ warm palette inside Tower, with a coral run button.**
Peach/cream surfaces at `src/pages/TowerMiniGen.jsx:392/426/435`; "Run Mini Gen" is
coral `#E8634A` (`:406`) vs the dashboard's Beast orange. **Rule:** Tower = cool‑gray;
Beast orange = the Run‑Mini‑Gen signal. Only user‑visible once the page is reachable — fix with B4.

**V4 · Beast orange used outside its one job.** As chrome on the HQ Admin chat panel
(`src/components/BeastChat.jsx:5/138/151/225/231`) and as decorative Tower chrome —
active‑tab underline (`src/components/tower/TowerTabs.jsx:37`) and "today" column border
(`src/components/tower/weekly/WeeklyGrid.jsx:69`). **Rule:** Beast orange = Run Mini Gen only.

**V5 · Color‑as‑decoration in HQ.** Purple "All Sectors" badge (`src/components/Header.jsx:7‑11`,
dup `src/pages/SettingsPage.jsx:7‑11`) competes with purple's forever‑note/tappable‑name job;
the non‑Plateau sector tag is painted blue (`src/pages/Dashboard.jsx:287‑288`) so a **Laurier
walker sees a blue badge**, when blue's only blessed HQ job is the Plateau tag.

**V6 · Systemic cold gray + pure‑white surfaces across HQ chrome.** Page roots are warm,
but cards/drawers/header/bottom‑nav are white/gray — lead `src/components/WalkCard.jsx:9‑13`
(`bg-white border-gray-100`); confirmed counts DogDrawer=71, DogProfileDrawer=50, DogsPage=28,
Schedule=16. **Rule:** HQ warmth is structural. Real but cosmetic and large — not a Monday problem.

**V7 · Dev test endpoint shipped to prod.** `api/ringcentral-test.js` is a handshake test,
publicly reachable as a Vercel route. Read‑only, degrades safely — cleanup.

---

## 🟡 UNTESTED / FRAGILE — works on paper, or breaks under load (ACTIVE)

**F2 · mini‑gen.js fabricates an all‑unresolved draft on a DB blip.** `api/mini-gen.js:74‑75`
reads `acuity_name_map` and `dogs` capturing only `data`, ignoring `error`, with `|| []`
fallbacks. A transient failure → every booking "unresolved" → a "successful" draft full of
bogus flags Gen sees Monday as real work, with a 200 hiding that it ran on no reference data.

**F4 · Schedule tab silently shows empty on a query failure.** `src/hooks/tower/useScheduleData.js:16‑40`
downgrades owl/conflict/alt‑address errors to `console.warn` + empty fallback; supabase‑js
doesn't throw on PostgrestError, so TowerSchedule's error branch is dead. An RLS/schema hiccup
→ Gen sees a clean Schedule tab **missing conflict rules**, no indication anything failed — she
could plan around a `Mochi↔Chaska` conflict that just didn't load.

**F5 · Draft/flag queries aren't tightly week‑bounded.** The dashboard correctly hides past‑date
pending drafts (`src/hooks/tower/useMiniGenResults.js:27` `gte` ✓), but the orphaned page has no
floor (`src/pages/TowerMiniGen.jsx:308‑314`) and nothing auto‑rejects stale rows; the FLAGS
list/count has no upper bound (`useMiniGenResults.js:41‑47`) so a future‑week flag can bleed in. Low impact today.

**F6 · Scout reads canceled appointments.** `api/scout.js:129‑132` omits `&canceled=false` (the
other four Acuity calls include it), so the Scout can raise flags for walks that were canceled.
Read‑only invariant intact — just noise in Gen's flag list. *(Its verifier crashed in the run; the URL is right there in source.)*

---

## 🟢 WORKS — verified‑good (don't re‑audit)

- **Acuity is strictly read‑only** — every call is a GET; no create/cancel/reschedule/void anywhere. The most dangerous invariant holds.
- **Field walk‑state path** (swipe + drawer → `walker_notes`) is robust: optimistic update, rollback on real DB error, transport‑vs‑DB split, offline queue, nothing‑vanishes. `src/lib/usePickups.js`.
- **DogCard dog‑name color** follows the canonical rule (black default / purple = forever note / fuschia off the name) in both branches — the documented inversion is **already fixed** (`src/components/DogCard.jsx:200,467`).
- **Approve/Reject does write** — POST → `api/tower-approve.js` updates status + idempotently promotes into `walk_groups`.
- **owl_notes sector filter** correct with the admin/'both' exception — no cross‑sector bleed.
- **walk_groups.dog_ids** correctly handled as names, not UUIDs.
- **flags JSONB** read as a guarded JS array; no `array_length(flags)` SQL bug.
- **All six Tower tabs resolve;** Billing → "coming soon" is an intentional placeholder.
- **Tower cool‑gray system** correctly applied everywhere except the orphaned TowerMiniGen — warm‑bleed is isolated.
- **Both drawers are live** (DogDrawer = field, DogProfileDrawer = directory) — neither is dead.
- **Debunked (static):** schedule‑verify cron error (cron deleted from `vercel.json`); TowerMiniGen "auth divergence" (the two gates are provably identical functions of `profile.role`).

---

## ⚪ REFUTED BY LIVE DATA — dead, do not chase

**F1 · "Every Mini Gen run is rejected on a phantom `source` column."** ❌ **DEAD.**
Live `mini_gen_drafts` has **no `source` column AND drafts land daily** (10/day, last
**2026‑05‑29 12:00 UTC**) — the cron writes fine. *Residual hygiene only:* the insert payload
still includes `source: 'wiggle-v4'` (`api/mini-gen.js:284,299`, insert `:306`) for a column
the table lacks; since writes are landing it isn't blocking anything (worth confirming how the
live path tolerates the extra key, but it is demonstrably not the catastrophe the static read implied).

**F3 · "Owl‑note realtime may be silently dead."** ❌ **DEAD.** Both `owl_notes` **and**
`owl_note_acks` are in the `supabase_realtime` publication on live — realtime works
(`src/lib/useOwlNotes.js:129‑155`, `158‑197`). *Hygiene only:* that membership isn't captured in
a committed migration (`owl_note_acks` has none in the repo), so it could drift on a rebuild — worth committing, not a bug.

**F8 · "Promote assumes a `dog_order` column that may not exist."** ❌ **DEAD.**
`walk_groups.dog_order` exists on live; the promote insert (`api/tower-approve.js:99`) is fine.

**F7 / V2 · "WalkLogModal writes a divergent walk‑state store to `walk_logs`."** ❌ **DEAD as framed.**
Live `walk_logs` has **0 rows** — inert, not a divergent store, and FriendCheck's "walked together"
count is simply empty, not wrong. *Residual:* `src/components/WalkLogModal.jsx:41‑49` still writes
to a table the canon calls unused (read by `DogsPage`, `DogDrawer` FriendCheck, `Admin`) — a **dead
feature**, not active harm. Decide later: wire it to `walker_notes`, or delete the Log‑Walk path.

**Refuted in the static pass (kept for the record):** "nothing reads walk_logs" (4 readers exist);
"two dead duplicate drawers" (both live, different surfaces); "TowerMiniGen uses a divergent auth gate" (identical to the rest of Tower).

---

## 🎯 RANKED FIX LIST — worst‑in‑front‑of‑Gen‑Monday‑7am first

*(F1 removed — dead. Dead/dormant items demoted below.)*

1. **B1** — Beast "Do it" says "Logged" but writes nothing. Trust trap on her dashboard.
2. **B4** — Dashboard review can't resolve flags (bulk‑approve + inline fixes stranded on the orphaned page).
3. **F2** — A DB blip makes Mini Gen invent a week of fake "unresolved" flags.
4. **F4** — Schedule tab shows empty (not an error) if a conflict/owl query fails.
5. **V1** — Door code behind "Tap to reveal" in the walk drawer *(top walker‑facing item)*.
6. **F6** — Scout reads canceled appointments → flag noise.
7. **F5** — Tighten draft/flag query date bounds + auto‑reject stale pending.
8. **V3** — TowerMiniGen warm palette + coral run button *(bundle with B4)*.
9. **V4** — Beast orange used as generic chrome.
10. **V5** — Purple "All Sectors" badge + blue Laurier tag.
11. **V6** — Systemic cold gray/white in HQ chrome *(large, cosmetic)*.
12. **V7** — Remove `api/ringcentral-test.js` from prod.

**Scheduled (dormant — fix before the trigger, not before Monday):**
- **B2** — Scout Acuity‑crash → **before a bad Acuity day** (healthy now).
- **B3** — Junior‑walker owl‑note drop → **before onboarding any Pup Walker** (0 juniors today).

**Doc cleanup (not code):** strike the stale `schedule-verify cron` item from
`WIGGLE_PROJECT.md:255‑258, 311`; reconcile the `walk_logs` rule (`:118‑119`) with the live 0‑row reality.

---
*Generated read‑only from the multi‑agent audit + live‑DB verification, 2026‑05‑31. No source files modified.*
