# WIGGLE_WORLD_SPEC.md
*The app's constitution. Every future session reads this before writing a single line.*
*Last updated: April 2026 — Phase 1 build*

---

## 1. WHAT WIGGLE WORLD IS

Wiggle Dog Walks is a Montréal dog walking company. ~95 dogs. 7 walkers. Two sectors: **Plateau** and **Laurier**. Three roles: Chief Pup (admin), Wiggle Pro (senior_walker), Pup Walker (junior_walker).

Wiggle World is a **new product** being built alongside the existing walker app. The existing app runs at `wiggle-app-dusky.vercel.app` — **do not touch it**. It continues running for walkers throughout this entire build. Wiggle World eventually replaces it, but not until it's ready.

### The two surfaces

**The Neighbourhood HQ** is the walker-facing PWA. Designed for the phone, one hand, winter coat. This is what Phase 1 of the build produces.

**The Studio (Tower Control)** is the admin desktop dashboard — Gen and Rod's command room before 8am. Dense, cool-gray, action-first. This is Phase 2 of the build.

Both surfaces share one Supabase project (same database, same auth), one React app with role-based routing, and one Vercel deployment. A change written in one surface is visible in the other in real time. There is no sync. There are no webhooks between surfaces. **One database. Two windows.**

### A note on phase numbering

The vision document (`wiggle-vision-2026.html`) uses a different phase numbering from the build sequence. In the vision doc, "Phase 0" refers to the existing walker app (already done), and "Phase 1" refers to Tower Today View. In this build spec, "Phase 1" refers to The Neighbourhood HQ and "Phase 2" refers to The Studio. These describe the same product, in the same order, counted differently. Do not let this create confusion — the build sequence defined in this document is what matters here.

---

## 2. TECH STACK

- **React 18 + Vite**
- **Tailwind CSS 3** with custom design tokens (all defined in `tailwind.config.js`)
- **@supabase/supabase-js**
- **vite-plugin-pwa** — The Neighbourhood HQ must be installable as a PWA
- **React Router v6**
- **Fonts:** Fraunces + DM Mono from Google Fonts (imported in `index.html`)

**Never use** DM Sans — that was the old system. Never use Inter, Roboto, Arial, or any system font for named UI elements. If a font isn't Fraunces or DM Mono, it doesn't belong in this app.

---

## 3. SUPABASE PROJECT

- **Project ID:** `ifhniwjdrsswgemmqddn`
- **URL:** `https://ifhniwjdrsswgemmqddn.supabase.co`
- **Anon key:** copy from existing wiggle-v4 `.env` file — never commit raw keys to the repo

### Tables — complete reference

**`dogs`**
`id uuid, name text, address text, door_code text, sector text, notes text (null = no forever note), difficulty int (1–3)`
The `notes` field is the forever note. When not null, the dog's name renders in purple throughout the app. Admin-only edit. 24 dogs currently have content.

**`walk_groups`**
`walk_date date, group_num int, sector text, dog_ids text[] (dog NAMES — not uuids, intentional for debuggability), walker_ids uuid[], group_name text, locked_by uuid`
UNIQUE constraint: `(walk_date, group_num, sector)`. Mini Gen never writes here directly — it always writes to `mini_gen_drafts` first and waits for Gen's approval.

**`walker_notes`**
`id uuid, dog_name text, note_type text, note_text text, walker_id uuid, walker_name text, walk_date date, created_at timestamptz, tags text[]`
**This is the single source of truth for all walk state.** `walk_logs` exists but is empty and unused — ignore it forever.

**`owl_notes`**
`id uuid, dog_name text, note_text text, target_sector text, created_by uuid, expires_at timestamptz, acknowledged_by uuid[]`
HARD RULE: always filter by `target_sector` — notes must never bleed across sectors. `acknowledged_by` tracks per-walker read status; other walkers still see an owl note until they individually acknowledge it.

**`profiles`**
`id uuid, full_name text, role text, sector text`

**`mini_gen_drafts`**
Staging table for Mini Gen output. `status` field cycles: `pending → approved → rejected`. Mini Gen never writes directly to `walk_groups`. Every draft waits here for Gen's approval in Tower. `api/tower-approve.js` promotes approved drafts to `walk_groups`. This staging discipline is non-negotiable — it is the same "stop and wait" rule that governs all AI in this product.

**`acuity_name_map`**
77 entries. Bridges Acuity's owner-centric bookings to the dog-centric database. `acuity_name` = the OWNER name in Acuity. `dog_name` = the actual DOG name in the app. Email disambiguates duplicate owner names. Same-home pairs get two rows. Current resolution rate: 100% (114/114). Beast surfaces gaps in this table to Gen in Tower — it is one of Beast's primary functions.

### Walk state source of truth

`walker_notes` is the **only** place walk state lives. The four note types are the complete vocabulary of what can happen to a dog on a walk day.

| Note type | Meaning | Creates |
|---|---|---|
| `pickup` | Dog was collected today | Sage/done state |
| `returned` | Dog is back home | Returned state |
| `not_walking` | Dog not walking today | Amber/caution state |
| `note` | Freeform activity record | Permanent note in drawer history |

`tags: ['flag']` on any note marks it as a walker flag for Gen to action in Tower.

### The write rule — never break this

Every mutation must carry `walker_id`, `walker_name`, and `walk_date`. **No anonymous writes anywhere in the app.** Accountability is care, not surveillance — it's how Rod helps when something goes wrong across 7 walkers and 95 dogs.

---

## 4. DESIGN TOKENS — COLOUR

Add all of these to `tailwind.config.js` under `theme.extend.colors`. The walker app (HQ) and Tower use different palettes intentionally — different context, different energy, same data.

### HQ — Warm palette (The Field)

| Token | Hex | Job — one color, one job, never two |
|---|---|---|
| `forest` | `#111A14` | Structural: top bar, bottom nav, group left border |
| `forest-mid` | `#1E3228` | Hover states on forest surfaces |
| `forest-lt` | `#2A4838` | Lighter forest for depth |
| `coral` | `#E8634A` | CTA buttons **ONLY** — never informational |
| `coral-d` | `#C94A34` | Coral pressed/hover state |
| `coral-light` | `#FAECE7` | Coral background tint |
| `purple` | `#534AB7` | Forever note signal on dog name; tappable links |
| `purple-bg` | `#EEEDFE` | Purple background tint |
| `fuschia` | `#961e78` | Forever note **content** (section bg, text, ★) |
| `fuschia-bg` | `#fdf4fb` | Fuschia background tint |
| `sage` | `#2D8F6F` | Picked up, done, positive state |
| `sage-bg` | `#E8F5EF` | Sage background tint |
| `amber` | `#C4851C` | Not walking, owl notes, caution |
| `amber-bg` | `#FDF3E3` | Amber background tint |
| `slate` | `#475569` | Door codes, addresses (DM Mono data layer) |
| `beast` | `#E8762B` | Beast AI accent — **Studio/Tower ONLY, never in HQ** |
| `bg` | `#FFF5F0` | App background (warm peach) |
| `card` | `#FAF7F4` | Card backgrounds (warm cream) |
| `border` | `#E8E4E0` | Card borders |
| `shadow-card` | `#D5CFC8` | Card bottom border (heavier, creates depth) |
| `text` | `#2D2926` | Primary text |
| `mid` | `#8C857E` | Secondary text |
| `light` | `#C5BFB8` | Tertiary / disabled text |

### Tower — Cool palette (The Studio, Phase 2)

Tower uses a completely different palette because Gen's context is planning, not walking. She needs density and precision, not warmth. Never use warm peach or cream in Tower. Never use cool grays in HQ.

| Token | Hex | Job |
|---|---|---|
| `t-bg` | `#F0F2F5` | Tower background (cool gray) |
| `t-card` | `#FFFFFF` | Tower card backgrounds (white) |
| `t-border` | `#E2E6EC` | Tower borders |
| `t-mid` | `#6B7280` | Tower secondary text |

All signal colors (coral, purple, fuschia, sage, amber) are **shared** between both surfaces — they mean exactly the same thing everywhere in the product.

---

## 5. TYPOGRAPHY RULE

**Two fonts. Two registers. Never swap them.**

### Fraunces (serif, optical sizing always on)
Everything Wiggle **says**. Has personality. Has voice. Use for: wordmark, session hero number, session status text, group names, dog names (italic 700). Weights used: 300 italic body copy, 600, 700, 900.

### DM Mono (monospace)
Everything Wiggle **delivers**. Precise. Operational. Use for: date in top bar, door codes, addresses, timestamps, walker badges, counters ("of 8 dogs out"), all data labels and section labels.

The split creates texture. The reader feels the difference between content with personality and content with precision without reading a word. This is not an aesthetic preference — it is the typographic argument for what Wiggle actually is: 95 individual relationships, not 95 data rows.

**Dog name in Fraunces italic 700 is the single most important typographic moment in the app.** "Pepper" in italic serif is not a data label — it is a name that belongs to a specific animal Wiggle knows by heart. "Pebbles ★" in fuschia Fraunces italic is genuinely beautiful. Do not make dog names bold-only sans-serif. That is the old system.

---

## 6. COLOUR SIGNAL RULES — NEVER BREAK THESE

These are not style choices. They are the visual language walkers learn in their first week. Breaking one signal corrupts the entire system. A color that does two jobs does neither — it becomes noise.

| Signal | Meaning | Source |
|---|---|---|
| Purple dog name | `dogs.notes` IS NOT NULL — forever note exists | `dogs` table |
| Fuschia ★ after name | Same signal, appended in fuschia Fraunces | `dogs` table |
| Fuschia section background | Forever note content being displayed in drawer | `dogs.notes` |
| Sage card | Dog has a `pickup` note today | `walker_notes` |
| Sage strikethrough on name | Dog name when picked up (Fraunces italic struck) | `walker_notes` |
| Amber dog name + struck | Dog has `not_walking` note today | `walker_notes` |
| Amber card background | Not walking state — card stays visible, never disappears | `walker_notes` |
| 🦉 after name (animated) | Active owl note exists for this dog in walker's sector | `owl_notes` |
| Coral | CTA action buttons ONLY — never used informatively | — |
| No blue anywhere | Blue has no defined job in this app | — |

The 🦉 animation is `translateX` 0 → 5px → 0, 2s ease-in-out infinite. It walks. This is the signal that something time-sensitive exists for this dog.

---

## 7. NOTE TYPE SYSTEM — LIFETIMES

Understanding when a note stops being relevant is as important as understanding what it says.

| Type | Where stored | Lifetime | Written by | Purpose |
|---|---|---|---|---|
| `pickup` | `walker_notes` | Today only | Walker (HQ) | Marks dog as collected |
| `returned` | `walker_notes` | Today only | Walker (HQ) | Marks dog as returned home |
| `not_walking` | `walker_notes` | Today only | Walker (HQ) | Marks dog as skipped today |
| `note` (activity) | `walker_notes` | Permanent record | Walker (HQ) | Freeform observation, shown in drawer history |
| Owl note | `owl_notes` | 3 days from creation | Walker (HQ) or Gen (Tower) | Cross-walker heads-up — time-sensitive |
| Forever note | `dogs.notes` | Never expires | Admin (Studio only) | Allergies, building quirks, behavioral flags |

When a walker enables "Warn next walker" in NoteComposer and sends a note, two writes happen simultaneously: one to `walker_notes` (note_type='note') and one to `owl_notes` (target_sector=walker.sector, expires 3 days from now). This dual-write is the mechanism that makes the owl note appear on the dog card for other walkers.

---

## 8. THE FIELD — VISUAL STRUCTURE

The app has a deliberate visual frame: two dark forest green surfaces (top bar `#111A14` and bottom nav `#111A14`) surrounding warm peach/cream content. Like a book — cover, pages, cover. The warmth of the content is made warmer by contrast with the dark frames around it. This is intentional and essential.

**The bar at the top and the nav at the bottom are both `#111A14`. Do not change these colors.**

The Fraunces wordmark in the top bar is the same typographic decision as The Notice brand board — the gap between brand direction and the app closes the moment this bar renders.

---

## 9. THE AI LAYER — STOP AND WAIT, ALWAYS

This is the most important rule in the entire product. **Every AI agent in Wiggle World stops and waits for human approval before touching production data. No exceptions.**

### 🤖 Mini Gen — LIVE

Mini Gen is the walk group drafting agent. Its pipeline: Acuity bookings → The Watcher → The Briefing → Mini Gen → `mini_gen_drafts`. Runs daily at 8am EDT. Gen reviews the staged drafts in Tower and approves or rejects them. After approval, `api/tower-approve.js` promotes drafts to `walk_groups`. Current resolution rate: 100% (114/114 bookings resolved). Mini Gen has never written directly to `walk_groups`. It never will.

### 🦍 Beast — NEXT (Tower only)

Beast lives in Tower's right panel. It detects conflicts, capacity issues, `acuity_name_map` gaps, and operational patterns — and surfaces them as suggestions Gen can act on. Every suggestion has a "Do it" confirm block. Beast never executes anything without a human pressing that button. Beast never touches production alone. Same discipline as Mini Gen.

The Beast color `#E8762B` is used in Tower only. Do not use it in The Neighbourhood HQ.

---

## 10. THE FOUR FILTERS — RUN BEFORE EVERY DECISION

Before building anything, run these four filters in order. If a feature fails any one of them, stop.

**WWRS** — What Would the Walker Need Right Now, one hand, winter coat? If it requires two taps, reading a full sentence, or typing to complete — it fails. The walker's context is kinetic and cold. The app must be faster than the weather.

**ONE PLACE** — Does this action already have a home? Pickup lives in the drawer only. Owl notes live in NoteComposer and Tower only. When actions have one home, walkers build muscle memory. When they don't, walkers make errors.

**SIMPLEST** — What is the smallest version of this that solves the real problem? Strip it to the bone. Build that first. Every extra tap in a building hallway is a potential missed dog.

**BOTH VIEWS** — Does this work for HQ and Tower? A feature that only works in one surface is incomplete. Walker flags a dog in HQ — Gen sees it in Tower. Gen writes an owl note in Tower — walkers see it in HQ within seconds.

---

## 11. WALKER AUTONOMY PRINCIPLE

Rod and Gen's job ends when dogs are entered into the system unassigned for the day. **Walkers own all group organization decisions.** Tower never overrides a walker's group choices. The "Check for Friends" button in DogsScreen — which lets walkers view dogs from the other sector for cross-sector group planning — exists because of this principle. Keep it exactly as designed.

---

## 12. THE STUDIO (TOWER CONTROL) — PHASE 2

The Studio is the admin desktop dashboard. It shares the same Supabase project and React app as The Neighbourhood HQ. **Do not build any Studio features without a dedicated new prompt.**

Tower's Today view has three panels: Mini Gen drafts + open flags on the left, live walk board in the center (real-time dog chip status from `walker_notes` subscriptions), Beast suggestions + Quick Owl composer on the right. Gen sees everything at once without switching tabs.

What belongs in Tower and not in HQ: admin panel, walker management, group planning and locking, Mini Gen draft approval, Beast suggestions, live walk board overview, Gmail Action Queue, TELUS SMS inbox, billing. If a walker can see any of this in HQ Settings, something is wrong.

Tower's design language is intentionally different from HQ. Cool gray (`#F0F2F5`), white cards, dense layout, action-first UI. Never use warm peach or cream in Tower. Never use Tower cool grays in HQ.

---

## 13. PRODUCT ROADMAP — ORIENTATION ONLY

Do not build Phase 2 or beyond without new prompts.

**Phase 0 — Done.** The existing walker app at `wiggle-app-dusky.vercel.app`. Walker groups, dog cards, pickup/return/not-walking, drawer, note composer, owl notes, forever notes, flag system, Mini Gen pipeline. Bug sweep completed April 6, 2026.

**Phase 1 — Build now.** The Neighbourhood HQ (this prompt). The Studio begins with the Tower Today view.

**Phase 2 — After Phase 1.** TELUS SMS inbox (webhook → Tower), Gmail Action Queue, Acuity Notes Phase 2 (owner booking notes as a fourth card type in HQ), `acuity_name_map` health panel in Tower, auto-reject stale mini_gen_drafts.

**Phase 3 — 30 days of data first.** Client portal, walk history for owners, billing tab, Instagram integration (walk photos → Gen approves in Tower → posts), Le Quartier map layer.

---

## 14. WHAT NOT TO BUILD WITHOUT A NEW PROMPT

The Studio beyond `StudioPlaceholder.jsx`, billing or payments, maps and navigation, SMS or push notification systems, Instagram integration, client-facing portal, any HQ feature that requires a keyboard as the primary interaction.

---

## 15. KNOWN RULES — HARD STOPS

No blue anywhere — blue has no defined job in this app. No avatar circles or emoji placeholders on walk cards — first letter of name only, and only as a placeholder in the drawer. No breed label on walk cards — drawer only. No "All" sector tab in DogsScreen — Plateau and Laurier only. No Admin Panel link in HQ Settings. No cold grays in HQ — the palette is warm throughout. No DM Sans — that is the old system. No Beast color (`#E8762B`) in HQ — Tower only. `owl_notes` must always filter by `target_sector` — never show cross-sector notes. Mini Gen never writes to `walk_groups` directly.

---

## 16. INTENTIONAL VS PLACEHOLDER

| Element | Status | Notes |
|---|---|---|
| Dog photos on walk cards | **Intentional absence** | No photo on walk cards, ever. Fails WWRS. |
| Dog photos in drawer | **Placeholder** | First letter shown. Phase 2 adds photo upload. |
| WeekScreen | **Placeholder** | "Coming soon." |
| BeastScreen (HQ) | **Placeholder** | Beast lives in Tower, not HQ. |
| StudioPlaceholder | **Placeholder** | "Studio — Phase 2." |
| Difficulty dots | **Intentional (drawer + DogsScreen only)** | Not on walk cards. Fails WWRS. |
| Check for Friends | **Intentional** | Walker autonomy feature. Keep it exactly as designed. |
| `dog_ids` as names not uuids | **Intentional** | Improves debuggability. Do not change. |
| isCompact mode | **Intentional** | Reduces card size only. May never remove name, address, or door code. |

---

## 17. REPO STRUCTURE

```
wiggle-world/
├── WIGGLE_WORLD_SPEC.md          ← you are here
├── CLAUDE.md                     ← session startup file (read first)
├── READY.md                      ← build summary + open questions
├── index.html                    (Fraunces + DM Mono Google Fonts link)
├── vite.config.js                (vite-plugin-pwa configured)
├── tailwind.config.js            (all design tokens + font families)
├── src/
│   ├── main.jsx
│   ├── App.jsx                   (role-based routing root)
│   ├── supabase.js               (createClient export)
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useWalkGroups.js
│   │   ├── useWalkState.js
│   │   └── useOwlNotes.js
│   ├── hq/
│   │   ├── HQLayout.jsx
│   │   ├── TodayScreen.jsx
│   │   ├── DogsScreen.jsx
│   │   ├── WeekScreen.jsx
│   │   ├── SettingsScreen.jsx
│   │   └── components/
│   │       ├── GroupBlock.jsx
│   │       ├── DogCard.jsx
│   │       ├── DogDrawer.jsx
│   │       ├── NoteComposer.jsx
│   │       ├── SessionHero.jsx
│   │       ├── TopBar.jsx
│   │       └── BottomNav.jsx
│   └── studio/
│       └── StudioPlaceholder.jsx
└── public/
    └── manifest.json             (PWA — forest green #111A14 theme)
```

---

*This document is the single source of truth for Wiggle World architecture, design, and rules.*
*If a situation arises this document doesn't cover: read `WIGGLE_WORLD_SPEC.md` → `wiggle-principles/SKILL.md` → make the call Rod would make.*
