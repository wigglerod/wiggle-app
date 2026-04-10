# CLAUDE.md
*Read this first. Every session. Before writing a single line.*

---

## What this repo is

**Wiggle World** — a new product for Wiggle Dog Walks, a Montréal dog walking company (~95 dogs, 7 walkers, Plateau + Laurier sectors). This repo builds two surfaces on one Supabase brain:

- **The Neighbourhood HQ** — walker-facing PWA (phone, one hand, winter coat) — Phase 1
- **The Studio (Tower Control)** — admin desktop dashboard for Gen and Rod — Live V4

The existing walker app at `wiggle-app-dusky.vercel.app` is **untouchable**. It keeps running for walkers throughout this build. Wiggle World eventually replaces it. Not yet.

**Full architecture, all design tokens, all rules → `WIGGLE_WORLD_SPEC.md`**
**Universal principles → `WIGGLE_PRINCIPLES.md`. Walker-app principles → `HQ_PRINCIPLES.md`.**

---

## Current build state

| Surface | Status |
|---|---|
| Tower Control (The Studio) | Live — V4 (confirmed April 5–6, 2026) |
| Wiggle World Phase 1 scaffold | **NEXT** — new repo (`wiggle-world/`), same Supabase project |
| The Neighbourhood HQ | Phase 1 — builds inside Wiggle World scaffold |
| WeekScreen | Placeholder — "coming soon" |
| BeastScreen (HQ) | Placeholder — Beast lives in Tower |

**What's already done in wiggle-v4 (do not rebuild, do not port blindly):** walk groups, dog cards, pickup/return/not-walking state, dog drawer, note composer, owl notes, forever notes, flag system, Mini Gen pipeline, Tower Control V4. All of this is documented and needs to be re-implemented cleanly in the Wiggle World repo with The Field design system.

---

## The design system — The Field

Two fonts. Two registers. Non-negotiable.

**Fraunces** (serif, optical sizing on) — everything Wiggle *says*: wordmark, session hero, group names, dog names (italic 700).
**DM Mono** (monospace) — everything Wiggle *delivers*: door codes, addresses, timestamps, walker badges, data labels.

Never use DM Sans. That is the old system.

The visual frame: forest green top bar (`#111A14`) + forest green bottom nav (`#111A14`) surrounding warm peach/cream content. Like a book — cover, pages, cover. Do not change the bar or nav color.

Full token table → `WIGGLE_WORLD_SPEC.md § 4`

---

## The rules most likely to be broken — read these twice

**No blue.** Blue has no defined job in this app. Not for links, not for focus rings, not for anything.

**Dog names are Fraunces italic.** Not bold sans-serif. Not DM Mono. Fraunces italic 700. This is the single most important typographic decision in the app.

**No avatar circles or emoji on walk cards.** No breed label on walk cards. No dog photo on walk cards — ever. Fails WWRS.

**No "All" tab in DogsScreen.** Plateau and Laurier only. No exceptions.

**No Admin Panel in HQ Settings.** That belongs in Tower. If a walker can see it, something is wrong.

**No Beast color (`#E8762B`) in HQ.** Tower only.

**`owl_notes` always filter by `target_sector`.** Notes must never bleed across sectors.

**No anonymous writes.** Every mutation carries `walker_id`, `walker_name`, and `walk_date`. Always.

---

## The AI layer — the most important rule in the product

**Every AI agent stops and waits for human approval before touching production data.**

🤖 **Mini Gen** is live. Pipeline: `Acuity → The Watcher → The Briefing → Mini Gen → mini_gen_drafts`. Gen approves in Tower. `api/tower-approve.js` promotes to `walk_groups`. Mini Gen never writes directly to `walk_groups`. 100% resolution rate (114/114). Do not build anything that alters this flow without a new prompt.

🦍 **Beast** is next (Tower only). Surfaces suggestions with a "Do it" confirm block. Never executes without a human pressing that button.

---

## The four filters — run before building anything

1. **WWRS** — Would a walker with one hand in a winter coat use this without thinking? If not, reconsider.
2. **ONE PLACE** — Does this action already have a home? Put it there.
3. **SIMPLEST** — Strip it to the bone. Build that.
4. **BOTH VIEWS** — Does it work in HQ and Tower? If only one, it's incomplete.

---

## Supabase

- **Project ID:** `ifhniwjdrsswgemmqddn`
- **URL:** `https://ifhniwjdrsswgemmqddn.supabase.co`
- **Anon key:** from wiggle-v4 `.env` — never commit raw keys
- **Walk state lives in `walker_notes` only.** `walk_logs` is empty — ignore it.
- **Full table reference → `WIGGLE_WORLD_SPEC.md § 3`**

---

## What not to do without a new prompt

Tower Control V4 is live — do not regress it. Do not build billing, maps, SMS, push notifications, Instagram integration, or the client portal. Do not deploy — Rod reviews and deploys manually.

---

## Where to go when you're unsure

`WIGGLE_WORLD_SPEC.md` → `WIGGLE_PRINCIPLES.md` → `HQ_PRINCIPLES.md` (if it's a walker-app call) → make the call Rod would make.

The mantra: **Work smart. Play always.**
