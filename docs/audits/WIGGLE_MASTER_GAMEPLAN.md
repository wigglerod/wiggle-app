# WIGGLE MASTER GAMEPLAN
## Single source of truth. Read every session. Project files home.
## Written April 11, 2026 — Architect 2. Supersedes WIGGLE_MASTER_GAMEPLAN_APRIL10.md (deleted).

---

## SIX-ANSWER PRE-FLIGHT — EVERY SESSION, NO EXCEPTIONS

Before Step 0 of any work, the chat answers all six. Out loud. In writing. No skipping.

1. **Folder on disk** — absolute path
2. **Git remote URL** — `git remote get-url origin`
3. **Vercel project** — name AND project ID
4. **Vercel preview URL pattern** — what the previews actually look like
5. **Supabase project ID** — `ifhniwjdrsswgemmqddn` ✓
6. **Which product** — *the live app* or *wiggle-world*. Never ambiguous.

Why this exists: April 11 was lost to a Foreman verifying against the wrong product. Three hours. Two folders, two Vercel projects, one shared Supabase, one wrong assumption. The pre-flight makes the assumption impossible.

---

## NAMING DISCIPLINE — THE BARE WORD "TOWER" IS DEAD

Two phrases only. No abbreviations.

- **the live app's admin** = the existing admin in `wiggle-app-dusky.vercel.app`. We do not touch it.
- **wiggle-world's Studio** = the new admin desktop in the scaffold at `~/Documents/wiggle-v4/`.

`TowerDashboard.jsx` is *part of* the Studio. It is not the Studio. Don't conflate the file with the surface.

---

## THE TWO PRODUCTS

| | The live app | wiggle-world |
|---|---|---|
| URL | `wiggle-app-dusky.vercel.app` ✓ | `(? ASSUMED — Foreman 2 verifies)` |
| Folder | not in this filing system | `~/Documents/wiggle-v4/` ✓ |
| Vercel project | not touched | `(? ASSUMED — Foreman 2 verifies)` |
| Supabase | `ifhniwjdrsswgemmqddn` ✓ | `ifhniwjdrsswgemmqddn` ✓ (shared) |
| Status | running for walkers, untouched | active build |
| Verification | read-only via git or Cowork audit | live preview, recon, BOTH VIEWS |

One Supabase brain. Two surfaces. The live app keeps running while wiggle-world is built around it. Eventually wiggle-world's HQ replaces the live app's walker UI. Not yet.

---

## CORE PRINCIPLES — IN ROD'S VOICE

**Slow but moving beats fast but wrong, every time.** The discipline is not speed. The discipline is direction.

**Color serves a purpose.** Functional or aesthetic — both count. No color is banned. No color is mandatory. The question is always "what is this color doing here," never "is this allowed." If a color earns its place, it stays. If it doesn't, it goes. (This replaces the old "no blue" rule, which had hardened from misreading the real principle.)

**Minimalism — strip what doesn't earn its place.** Walkers know the dogs. The card doesn't need to repeat what's in their head. Save the space for what they DON'T have memorized — the door code, the address number, the flag.

**Two products, one Supabase brain.** They coexist on `ifhniwjdrsswgemmqddn`. We do not touch the live app from inside wiggle-world. Verification against the live app is read-only — git, Cowork audit, never Claude Code editing.

**Every AI agent stops and waits for human approval.** Mini Gen writes drafts and waits for Gen. Scout writes flag cards and waits for the Studio surface. Beast surfaces suggestions and waits for confirm. No exceptions, ever, at any phase.

**Documents drift silently.** The most expensive mistakes are sentences that sound authoritative but were never verified. Mark every concrete claim ✓ verified or `(? ASSUMED)`.

**Work smart, play always.**

---

## THE FOUR FILTERS — CORRECTED

- **WWRS — walker app only.** "What would the walker need right now, one hand, winter coat?" This filter belongs to HQ. It does not apply to the Studio. (Architect 1 had been sloppily framing it as universal — wrong.)
- **ONE PLACE** — does this action already have a home? Put it there. Don't create a second.
- **SIMPLEST** — what's the smallest version that solves the real problem? Build that.
- **BOTH VIEWS** — does it work in HQ and the Studio? If only one, it's incomplete.

The Studio's design discipline is **minimalist density** — useful information, scannable in seconds, no decoration that doesn't earn its place. This is a stance, not a named filter, until the right name surfaces from real use. Don't force a name on it yet.

---

## DESIGN RULES THAT STAY (with reasoning, not doctrine)

- **No emoji, photos, or breed labels on walk cards.** Walkers know the dogs. Free the space for what they don't have memorized.
- **No "All" tab in DogsScreen.** Walkers see their sector only. Same minimalism.
- **No admin panel inside HQ.** Role separation. Admin work belongs in the Studio.
- **`owl_notes` always filter by `target_sector`.** Plateau walkers don't see Laurier notes. Cross-sector bleed is a bug.
- **No anonymous writes.** Every mutation carries writer id, name, date. Accountability is care, not surveillance.
- **Walk state lives in `walker_notes` only.** `walk_logs` is empty forever. Don't write there.
- **wiggle-world uses Fraunces and DM Mono.** The live app's typography is left alone because we don't touch the live app.

## DELETED RULES — DO NOT REINTRODUCE

- ~~"No blue."~~ Replaced by the color principle above.
- ~~"No DM Sans" as a universal ban.~~ Softened: wiggle-world uses Fraunces + DM Mono; the live app's existing typography is untouched.
- ~~"Warm in the field, cool at the desk — never bleed."~~ Each surface has its identity. If a future choice calls for a warm accent in the Studio or a cool note in HQ for a real purpose, it's allowed.

---

## OPERATIONAL DISCIPLINES — EARNED THROUGH REAL PAIN, APRIL 11

1. **Every "shipped" report includes a commit hash.** The Foreman runs `git log -1 <branch>` to verify branch HEAD matches the hash. *(Earned: Brief 1a.1 was reported shipped with file lists but no hash; the branch was empty for hours.)*
2. **Recon traces from the live entry point to the file, not just confirms the file exists.** Every recon brief asks: "is this file imported by the route registration that the live URL resolves to?" *(Earned: `TowerDashboard.jsx` was real, was correctly described, was orphaned in the running app — three hours.)*
3. **Every table+filter a phase depends on gets verified by SELECT before Step 0 ends.** Not by reading the gameplan. *(Earned: the `'flag'` tag value was guessed wrong from a SELECT DISTINCT.)*
4. **Every stopping rule in a brief has a single unambiguous fork.** Two competing instructions stop nothing.

---

## THE THREE-TIER SYSTEM — WHY IT EXISTS

**Defense in depth.** April 11 surfaced three reality gaps in one day at three different layers — table, file, route. Each was caught by a different tier:

- **Cowork's audit** caught the table (`flag_cards` schema, dead vs live tables)
- **Recon** caught the file (orphaned `TowerDashboard.jsx`)
- **Live test** caught the route (Foreman testing wrong product)

None alone would have prevented the cost. Together they did, before any code shipped to the wrong product. The three tiers are not bureaucracy. They are the only thing that worked.

**Tier roles:**
- **Architect** — big picture, master map, gameplan, Foreman packages. Never writes code. Exempt from "one step at a time" and "workers do the doing" because those are Foreman-tier rules.
- **Foreman** — one step at a time, waits between steps, writes briefs for Workers, verifies commits with `git log`, runs the pre-flight at session open.
- **Worker** — does the doing. Claude Code, Cowork, Antigravity. Reports back with file paths and commit hashes.

---

## THE BUILD SEQUENCE — ORDER IS NON-NEGOTIABLE

- **Phase 0 — Cleanup** ✓ DONE (commit `74f8b5e`)
- **Phase 1 — Close the loop in wiggle-world's Studio**
  - **1a — Walker Flag panel.** Committed `d7710db` on `foreman/1a-walker-flag-panel`. Vercel preview built clean (`3Kr3CVcmP`). *Awaiting visual verification — Foreman 2's first job.*
  - **1b — Live walk board with realtime.** Static board, then realtime layer.
  - **1c — Quick Owl composer.** Writes to `owl_notes`.
- **Phase 1.5 — Scout inbox panel.** Tighten Scout's classifier first (deny-list of senders/categories that should never become flag_cards — bank notifications, etc.), then build the Studio panel on top of `flag_cards`.
- **Phase 2 — Weekly Board in the Studio.** Figma node `16:66`.
- **Phase 3 — The Briefing agent.** Morning decision cards.
- **Phase 4 — Remaining Studio screens.**
- **Phase 5 — Doc reconciliation.** Its own Foreman package. Rewrites `WIGGLE_PROJECT.md`, `HQ_PRINCIPLES.md`, `WIGGLE_PRINCIPLES.md` against this gameplan. Writes `NOTES_SPEC.md`. Writes `ARCHITECTURE_DECISIONS.md`. Kills the name "The Watcher."
- **Phase 6 — wiggle-world's Neighbourhood HQ build-out, then retire the live app.**

---

## AGENTS

- **Mini Gen** — LIVE. Resolves Acuity bookings → drafts → `mini_gen_drafts`. Gen approves in the Studio. `api/tower-approve.js` promotes to `walk_groups`. Never writes directly. ✓ verified.
- **Scout (`api/scout.js`)** — LIVE. Cron, reads Acuity + Gmail, writes structured cards into `flag_cards`. 35+ rows as of Cowork's April 10 audit. ✓ verified by Cowork April 10. *Note: "The Watcher" in older docs is the same agent — name dies in Phase 5.*
- **Beast** — Phase 4+, Studio only. Surfaces suggestions with a "Do it" confirm block. Never executes without a human pressing the button.
- **The Briefing** — Phase 3. Morning decision cards.

---

## TABLES — FROM COWORK'S APRIL 10 AUDIT

**✓ Safe to build on:** `dogs`, `walk_groups`, `walker_notes`, `owl_notes`, `mini_gen_drafts`, `acuity_name_map`, `profiles`, `flag_cards`, `expected_schedule`, `dog_conflicts`, `dogs_audit`, `daily_notes`, `route_orders`, `group_links`

**(? ASSUMED) Unclear, needs Rod's input:** `schedule_checks`, `match_log`, `acuity_notes`

**Dead, ignore:** `beast_brain`, `dog_vacations`, `walk_logs`

---

## CONSTANTS

- **Supabase project ID:** `ifhniwjdrsswgemmqddn` ✓
- **wiggle-world scaffold folder:** `~/Documents/wiggle-v4/` ✓
- **The live app URL:** `wiggle-app-dusky.vercel.app` ✓
- **wiggle-world Vercel project:** `(? ASSUMED — Foreman 2 verifies)`
- **wiggle-world preview URL pattern:** `(? ASSUMED — Foreman 2 verifies)`
- **Rod admin UUID:** `1c9bb8cf-e7c5-437a-babf-b83469115567` ✓
- **Gen admin UUID:** `db94d31c-90b7-410e-9ce1-e8f79a752925` ✓
- **Test walker:** `test@wiggledogwalks.com` / `WiggleTest2026!` (admin role, both sectors) ✓
- **Acuity userId:** `36833686` ✓. Type IDs: Plateau=`80336576`, Laurier=`80336804`, Private=`81191222` ✓
- **Figma file:** `dsTXg9K1tE8XxURVhCYqji` ✓. Weekly Board node: `16:66` ✓

---

## CURRENTLY UNVERIFIED — MUST STAY MARKED `(? ASSUMED)`

1. Whether wiggle-world's HQ exists in the scaffold yet. Foreman 2 verifies as Step 1.
2. The exact wiggle-world Vercel project name and project ID.
3. The exact wiggle-world Vercel preview URL pattern.

**Pre-stated fallback:** If Foreman 2 finds no HQ in the scaffold, Brief 1a.1 is verified visually only — the panel renders correctly with whatever flag rows already exist in shared Supabase. The end-to-end BOTH VIEWS test is deferred until HQ exists. **Do NOT write a flag from the live app to test the Studio.** That crosses a product boundary deliberately and adds confusion we just spent a day cleaning up.

---

## THE NORTH STAR

Gen running her morning from one screen instead of four browser tabs. Slow but moving, every time.

🐾
