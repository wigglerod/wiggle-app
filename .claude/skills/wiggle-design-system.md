---
name: wiggle-design-system
description: >
  v4 design system — the live walker app (wiggle-app-dusky.vercel.app)
  and Tower Control. Use when building or fixing visual elements in v4
  components: colors, typography, dog cards, walk cards, drawer, states,
  badges, layout. Load before writing JSX or Tailwind in v4. NOT for
  wiggle-world / The Field — that lives in wiggle-world-design-system.
scope: wiggle-v4
last_rewritten: 2026-05-04
---

# Wiggle Design System (v4)

This skill describes what v4 actually does — the walker PWA at
wiggle-app-dusky.vercel.app and Tower Control at `/tower/*`. Both run
from `~/Documents/wiggle-v4/`. For wiggle-world (The Field, Fraunces,
forest frame), load `wiggle-world-design-system` instead.

**Sources of truth.** Codebase wins on facts. `WIGGLE_PROJECT.md` and
`HQ_PRINCIPLES.md` win on rules. Brain wins on decisions. Anything
marked `(? ...)` is flagged for follow-up — read the flag before
acting on the surrounding rule.

---

## Color palette + jobs

Source: `WIGGLE_PROJECT.md:180-189`, verified against v4 codebase.

| Token | Hex | Job |
|---|---|---|
| Coral | `#E8634A` | Primary action, CTAs, brand identity |
| Coral Dark | `#C94A34` | Pressed coral; interlock-B accents |
| Purple | `#534AB7` | "This dog has a forever note" — signal on the name |
| Fuschia | `#961e78` | Forever-note CONTENT in the drawer (section bg `#fdf4fb`, editor, expand block). NEVER the name. |
| Sage | `#2D8F6F` | Picked up, positive, done |
| Amber | `#C4851C` | Needs attention, not walking, warnings, owl-note labels |
| Slate | `#475569` | Door codes, addresses, utilitarian info |
| Black | `#2D2926` | Default dog name color (no forever note) |
| HQ Background | `#FFF5F0` | App peach in HQ. Never pure white. (`src/index.css:11`) |
| HQ Card | `#FAF7F4` | Cream card surface in HQ |
| HQ Border | `#E8E4E0` | Warm gray card border in HQ |
| Beast Orange | `#E8762B` | Run Mini Gen button — **Tower ONLY**, never in HQ |
| Blue | functional only | Allowed when it has a defined functional purpose. Example: `WalkCard.jsx:38` uses `bg-blue-100 text-blue-700` for the Plateau sector tag. Do not use blue as a generic accent. |

**Color rule (brain decision #6, 2026-04-12):** *color serves a purpose.*
The blanket "no cold gray" ban is dead. Cool gray is required in Tower
(see Tower section below). Use cold-gray utility classes when they
serve a Tower-density purpose. Don't reach for them in HQ — HQ stays
warm because warmth is structural in the field (`HQ_PRINCIPLES.md:50`).

---

## Typography (v4 reality)

- **Font: DM Sans** (400, 500, 600, 700). The only font loaded in v4.
  Source: `index.html:15`, `src/index.css:4` (`* { font-family: 'DM Sans', sans-serif }`).
- Fraunces and DM Mono are **not loaded in v4**. Do not reference them
  in v4 components. They are wiggle-world tokens.
- Touch targets: minimum **44px** (`WIGGLE_PROJECT.md`, `HQ_PRINCIPLES.md`).
- Primary CTA buttons: minimum **48px** height. Source: `WalkCard.jsx:101`
  (`min-h-[48px]`).
- Inputs at 16px font to suppress iOS focus zoom (`src/index.css:30`).

> **(? PRINCIPLE-vs-CODE GAP)** `HQ_PRINCIPLES.md:24` says: *"Dog
> names are Fraunces italic. This is the single most important
> typographic moment in the app."* v4 currently renders dog names in
> DM Sans 600 (semibold, not italic) — Fraunces is not loaded. Do not
> "upgrade" v4 dog-name typography in a non-design session. When this
> changes in v4 it will be a deliberate design session, not a side
> effect. This is an HQ_PRINCIPLES ↔ v4 reconciliation item.

---

## Dog card — always show

Source: `WIGGLE_PROJECT.md:196-208`.

The mini card MUST always show, regardless of layout mode (including
`isCompact` / interlock):

1. **Dog name** — tappable → opens `DogProfileDrawer`
2. **Address** — street number + street name only, no postal code
3. **Door code** — slate `#475569` pill if exists
4. **Difficulty dot** — sage `#2D8F6F` = easy, amber `#C4851C` = needs
   attention

`isCompact` may reduce padding/font size only. **Never** strips name,
address, or door code.

**v4 has avatar circles on cards.** 20px in compact mode, larger in
full mode (`DogCard.jsx:257-268`, `:430-433`). Photo if uploaded,
otherwise colored bg with the dog's initial. Wiggle-world's "no avatar
circles on walk cards" rule is wiggle-world-only — it does not apply
to v4.

---

## Dog name color — THE RULE

Source: `WIGGLE_PROJECT.md:181-187, 201-202`.

Two surfaces, two colors, one signal:

- **Purple `#534AB7` on the name** = "this dog has a forever note —
  pay attention before you walk in" (when `dogs.notes IS NOT NULL`).
- **Fuschia `#961e78` in the drawer** = "here is the note" (section
  bg, editor, expand block).

| Condition | Dog name color |
|---|---|
| Walking, no forever note | **Black `#2D2926`** (default) |
| Walking, forever note set (`dogs.notes IS NOT NULL`) | Purple `#534AB7` |
| Not walking (state override) | Amber `#C4851C` |
| Picked up / returned | (color unchanged, line-through applied) |

**Mental model: purple on the name says "there's a note." Fuschia in
the drawer says "here it is." Two surfaces, two colors, one signal.**
Never put fuschia on the name itself.

> **(? CODEBASE BUG — do not codify)** `DogCard.jsx` currently renders
> the dog name with default = purple `#534AB7` and forever-note =
> fuschia `#961e78` — **inverted vs the rule above**. See `DogCard.jsx:194`
> (compact branch) and `:448` (full branch). This is a production bug,
> not a new rule. Logged for a separate fix session. Skills describe
> rules; bugs get fixed, not codified — do not match this inverted
> behavior when writing new dog-name rendering code.

---

## Card states (mini card)

Source: `WIGGLE_PROJECT.md:210-214`, verified `DogCard.jsx:156-180`.

| State | Background | Border | Other |
|---|---|---|---|
| Waiting (default) | `#FAF7F4` cream | `#E8E4E0` + `#D5CFC8` bottom | — |
| Picked up | `#E8F5EF` sage-bg | `#6DCAA8` | name struck through, pickup time shown |
| Returned (back home) | `#F0ECE8` sand | inherited | **opacity 0.55**, both times shown |
| Not walking | `#FDF3E3` amber-bg | `#F0C76E` | amber border + badge, name struck in amber |
| Current (door active) | `#FFF4F1` coral-light | 1.5px `#E8634A` + 2.5px bottom | — |
| Interlock A | `#EEEDFE` purple-bg | 3px `#AFA9EC` left | — |
| Interlock B | `#FAECE7` coral-light | 3px `#E8634A` left | — |

**Animated owl 🦉** walks across the name line when the dog has an
active unread owl note (`DogCard.jsx:464-473`, `owlWalk` keyframes in
`src/index.css`).

**★** is shown when the dog has BOTH a forever note AND an active owl
note (`DogCard.jsx:460-463`).

---

## Dog Profile Drawer — the control centre

Source: `WIGGLE_PROJECT.md:218-235`, `HQ_PRINCIPLES.md:30-34`.

**Close after:** Picked Up, Back Home, Not Walking, any Undo.
**Never close after:** edit times, info taps, note viewing.
**Why:** status actions = "done with this dog, move on."

Information sections, in order:

1. **Walk Times** — pickup/return times, duration, edit buttons
2. **Forever Notes** — `dogs.notes`, fuschia bg `#fdf4fb`, permanent.
   Admin sees Edit; walkers see read-only + "admin-only" label.
3. **Owl Notes** — staff-written, expires weekly, sector-filtered,
   amber bg
4. **Acuity Notes** — Phase 2, not yet built
5. **Activity Notes** — `walker_notes note_type='note'`, neutral bg

Door codes are always visible on the card itself — never hidden behind
a tap (`HQ_PRINCIPLES.md:20`, "the card is a promise").

---

## Tower (lives in this v4 codebase, NOT wiggle-world Studio)

Source: `WIGGLE_PROJECT.md:191`, `:69-73`.

Tower lives at `/tower/*` in the same v4 codebase
(`src/pages/Tower*.jsx`). It is reached via `role = 'admin'` in the
`profiles` table (not `'chief_pup'`).

**Tower uses cool gray. Never let HQ warmth bleed into Tower.**

- Cool gray utility classes (`slate-*`, `gray-*`) are correct in Tower.
- Beast orange `#E8762B` is permitted in Tower (Run Mini Gen button)
  and forbidden in HQ.
- The "warmth is structural" principle (`HQ_PRINCIPLES.md:50`) is
  HQ-scoped — do not apply it to Tower components.

The same color *signals* (sage = done, amber = attention, coral =
action, purple = forever-note) carry into Tower; only the
*atmosphere* (warm peach in HQ vs cool gray in Tower) changes.

---

## Drift check — before shipping any v4 UI

- HQ background is peach `#FFF5F0`, not white. HQ cards are cream
  `#FAF7F4`, not white.
- Tower stays cool gray. HQ stays warm. Don't bleed atmospheres.
- Dog name colors follow the rule above (default black; purple = note
  signal; fuschia = drawer content only). **Do not replicate the
  DogCard inverted-color bug** in new code.
- Touch targets ≥ 44px; primary CTAs ≥ 48px.
- Door codes always visible as slate pill on the card itself.
- Font is DM Sans (400/500/600/700). No Fraunces / DM Mono in v4.
- Blue is permitted only when it has a defined functional purpose
  (e.g. Plateau sector tag). Not as a generic accent.
- Avatar circles are part of v4 cards.
- No Beast orange in HQ surfaces.
- For anything visual or interactive, verify on device per
  `WIGGLE_PROJECT.md:52-58` — clean build ≠ working feature.

---

## Open reconciliation items (logged, not for this skill to solve)

1. **DogCard dog-name color logic is inverted vs rule.** Owner: Rod.
   Fix in a dedicated session.
2. **`HQ_PRINCIPLES.md:24` (Fraunces italic) vs v4 reality (DM Sans
   600).** Either v4 drifts toward HQ_PRINCIPLES, or HQ_PRINCIPLES
   gets rewritten. Phase 5 doc-reconciliation item.
3. **`WIGGLE_PROJECT.md:251` semantic ambiguity.** The line "purple
   (not fuschia) per CLAUDE.md final ruling" reads as a bug-fix
   instruction, not a rule restatement. Clarify next time
   `WIGGLE_PROJECT.md` is touched.

🐾
