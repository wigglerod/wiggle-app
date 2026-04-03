# WIGGLE DOG WALKS — DESIGN CONSTITUTION
## Loaded automatically every Claude Code and Antigravity session.
## Lives at: ~/Documents/wiggle-v4/CLAUDE.md
## Do not edit without Rodrigo's approval.
## Last updated: April 3, 2026 — V2 clean slate

---

## WHO WE ARE

Wiggle Dog Walks. Montréal's Plateau and Laurier.
~95 dogs. ~7 walkers. One co-admin. Founded and operated by Rodrigo.

Brand voice: "Work smart, play always."
Philosophy: Occam's razor — simplest truth, strongest foundation.

We are not a logistics platform. Not a startup.
A small business built on personality, trust, and 8 years of
relationships with dogs and their families.
The technology serves that. Never the other way around.

---

## THE FOUR FILTERS
### Run before building anything. In this order. No exceptions.

**WWRS** — What would the walker need right now, one hand, winter coat?
If the answer is "not this" — stop.

**ONE PLACE** — Does this action or information already have a home?
If yes — put it there. Do not create a second home.

**SIMPLEST** — What is the smallest version that solves the real problem?
Strip it to the bone. Ask this BEFORE opening the editor.

**BOTH VIEWS** — Does this work for the app AND Tower Control?
If it only works in one view — it is incomplete.

---

## COLOR SYSTEM
### Every color earns its place. Every color has exactly one job.

A color that does two jobs does neither — it becomes noise.
Before adding any color, ask: what does this color already mean?
If it has a job → you cannot reassign it.
If it has no job → define one before using it.
Blue is allowed — but only when it has a defined functional purpose.

### Brand & Functional Colors

| Token       | Hex       | Job                                                        |
|-------------|-----------|------------------------------------------------------------|
| Coral       | `#E8634A` | Primary action — CTAs, lock slider, brand identity hero    |
| Coral Dark  | `#C94A34` | Pressed/active state of coral only                         |
| Coral Light | `#FAECE7` | Coral tint — status highlights, light backgrounds          |
| Purple      | `#534AB7` | Tappable links — dog names (default), walker names, group structure |
| Fuschia     | `#961e78` | Dog name when `dogs.notes` has content — pay attention             |
| Purple bg   | `#EEEDFE` | Purple tint — walker buttons, group tints, interlock bars  |
| Purple Dark | `#3D3590` | Unlock slider, deep purple accents                         |
| Sage        | `#2D8F6F` | Picked up, positive, done, success                         |
| Sage bg     | `#E8F5EF` | Picked up card background                                  |
| Sage border | `#6DCAA8` | Picked up card border                                      |
| Amber       | `#C4851C` | Needs attention, not walking, warnings                     |
| Amber bg    | `#FDF3E3` | Not walking card bg, forever notes bg in drawer            |
| Amber border| `#F0C76E` | Warning borders                                            |
| Slate       | `#475569` | Utilitarian info — door codes, addresses, metadata         |

### Surface Colors

| Token       | Hex       | Job                                                        |
|-------------|-----------|------------------------------------------------------------|
| Background  | `#FFF5F0` | Peach — app bg, never white                                |
| Card        | `#FAF7F4` | Cream — all cards and panels, never pure white             |
| Sand        | `#F0ECE8` | Secondary surfaces, back-home card, done states            |
| Border      | `#E8E4E0` | Warm gray — all borders, never cold gray                   |
| Shadow      | `#D5CFC8` | Card bottom shadow — clay 3D effect                        |

### Text Colors

| Token       | Hex       | Job                                                        |
|-------------|-----------|------------------------------------------------------------|
| Text        | `#2D2926` | Primary — warm black. NEVER #000 or #333.                  |
| Text mid    | `#8C857E` | Secondary text, labels                                     |
| Text light  | `#B5AFA8` | Tertiary, hints                                            |
| Text faint  | `#D5CFC8` | Disabled, placeholder                                      |

### Dog Name Color Logic (hard rule)

- Default: black `#2D2926` — no forever note, nothing special
- Fuschia `#961e78` — dogs.notes has content (permanent standing instructions)
- This is the ONLY trigger for fuschia on a dog name
- Purple elsewhere = tappable links, walker names, group structure, interlock

### Sector Colors (map + visual identity only)

- Plateau: Teal-Blue `#3B82A0`
- Laurier: Forest Green `#4A9E6F`
- These are reserved for sector identification on maps and visual indicators.
  Not for general UI use.

### Hard Rules

- NEVER use Tailwind cold grays (gray-100, gray-200, slate-100 without warm override)
- NEVER use pure white (#ffffff) — use cream #FAF7F4
- Coral is the CTA on every surface — always
- Background is always warm — if it feels like a bank app, it is wrong
- Fuschia (#961e78) is reserved for forever notes ONLY (dogs.notes signal). No other use.

---

## TYPOGRAPHY

Font: **DM Sans** — weights 400, 500, 600, 700.
This is the Wiggle voice in text form.
Do not introduce other fonts without Rodrigo's explicit approval.
Applies to the app, website, and all graphic templates.

Minimum touch targets: **44px height** for any tappable element on mobile.

---

## DOG CARD — THE MOST IMPORTANT COMPONENT
### The card is a promise. Everything to get through that door, visible without a tap.

### Always show — no exceptions, no layout mode overrides:
1. Dog name — tappable → opens DogProfileDrawer
   - Default: black `#2D2926`
   - If dogs.notes has content: purple `#534AB7`
2. Address — street number + street name only (no postal code, no city)
3. Door code — slate pill `#475569`, white text, only if exists
4. Difficulty dot — sage = easy, amber = needs attention, coral = caution

`isCompact` mode (interlock): may reduce padding and font size ONLY.
Never removes name, address, or door code. Ever.

### Card States

| State       | Background        | Name color          | Notes                          |
|-------------|-------------------|---------------------|--------------------------------|
| Waiting     | `#FAF7F4` cream   | Black or purple     | Default                        |
| Picked up   | `#E8F5EF` sage    | Struck through      | Show pickup time               |
| Back home   | `#F0ECE8` sand    | Normal, opacity 0.55| Show both times                |
| Not walking | `#FDF3E3` amber   | Struck amber        | Amber border + badge           |

### Card Styling
- Background: cream `#FAF7F4`
- Border: 1px solid `#E8E4E0`
- Border-bottom: 2.5px solid `#D5CFC8` (clay shadow effect)
- Border-radius: 10px
- Font: DM Sans 12px
- Padding: 8px 10px

### Address Display
- 10px, slate `#475569`, font-weight 500
- Split on first comma, strip Canadian postal codes
- Result: street number + street name only (e.g. "4200 Esplanade")

### Door Code Pill
- 9px white text, bold
- Background: slate `#475569`
- Padding: 2px 7px, border-radius: 5px

---

## GROUP HEADER RULES

### Walker Buttons (not static text — tappable)
- Two walker slots per group
- Tap → opens picker to assign/switch walker
- Picker shows: scheduled-today walkers first (sage bg), others second (cream bg)
- Exclude: "Wiggle Pro", "Pup Walker", null names, Gen (admin)
- Rod (sector: both) appears in both Plateau and Laurier pickers

### Walker Schedule Parsing
- profiles.schedule = text string "Mon, Tue, Wed"
- Parse with regex to check today's day name
- profiles.sector determines which sector they appear in

### Group Header Format
- Left: group name
- Right: walker name(s) as purple buttons + dog count
- Walker names always visible — always on the header line

### Group States
- Active: coral solid border, cream bg
- Done: collapsed, tappable to expand, faded
- Done expanded: all dogs shown in final state, names tappable → drawer with undo
- Interlock: purple sync bar between linked groups

---

## DOG PROFILE DRAWER — ACTION CENTRE
### One dog. One place. Every action that changes a dog's state lives here.

### Drawer Close Rules (hard)
CLOSE after: Picked Up, Back Home, Not Walking, any Undo
NEVER CLOSE after: edit times, info taps, note viewing
WHY: Status action = walker moves to next door. App moves with them.

### Actions (contextual by state)
- Waiting: "Mark as Picked Up"
- Picked up: "Mark as Back Home" + "Undo pickup"
- Back home: "Undo return"
- Not walking: "Undo — pick up after all"
- Any state: "Not Walking today" if not already set

### Information Sections (order in drawer)
1. **Walk Times** — pickup/return times, duration, edit buttons
2. **Forever Notes** — dogs.notes, amber bg, permanent, never expires
3. **Owl Notes** — staff-written, expires weekly, sector-filtered
4. **Acuity Notes** — client-written, expires like owl notes
   (See NOTES_SPEC.md for full build plan)

---

## LOCK SLIDER

- Lock (slide RIGHT): coral gradient
- Unlock (slide LEFT): purple dark gradient
- Thumb: light bg with shadow, 44×44px, border-radius 12px
- Height: 60px total, border-radius 16px

---

## DATABASE RULES

- Walk state lives in `walker_notes` ONLY — never `walk_logs` (empty, unused)
- `note_type` values: `pickup` | `returned` | `not_walking` | `group_done`
- Query Supabase FIRST — never ask Rodrigo for data in the DB
- Every write must carry `walker_id`, `walker_name`, `walk_date`
- `walk_groups.dog_ids` stores dog names as text[] — intentional, names are unique per sector

---

## TOOL ASSIGNMENT

| Task                                         | Tool          |
|----------------------------------------------|---------------|
| Visual fix, swipe, card state, drawer        | Antigravity   |
| Architecture, hooks, multi-file, Tower       | Claude Code   |
| Strategy, Supabase queries, prompt writing   | Claude Chat   |

Clean build ≠ working feature. Device test is the only proof.
Test at: https://wiggle-app-dusky.vercel.app
Login: test@wiggledogwalks.com / WiggleTest2026!

---

## TECHNICAL REFERENCE

- Stack: React 19, Vite, Tailwind CSS, Framer Motion, @dnd-kit,
  Supabase realtime, Workbox PWA, Sonner toast
- Code: ~/Documents/wiggle-v4/
- Supabase: ifhniwjdrsswgemmqddn
- Production: wiggle-app-dusky.vercel.app
- Sectors: Plateau (#3B82A0) — 56 dogs | Laurier (#4A9E6F) — 39 dogs
- Roles: Chief Pup (admin) | Wiggle Pro (senior_walker) | Pup Walker (junior_walker)
- Acuity: User ID 36833686 | Type IDs: 80336576 Plateau, 80336804 Laurier, 81191222 Private
- Tower: ~/Documents/wiggle-v4/apps-script/Code.js

Do not add npm packages without asking Rodrigo.
Do not introduce new font families.
Do not use cold gray Tailwind classes.
Do not remove dog name, address, or door code from any card state.
Do not use fuschia for anything except forever notes (dogs.notes signal).

---

## THE DRIFT CHECK
### Run before every PR, design review, or new component.

- [ ] Background is warm — peach or cream, never white
- [ ] Every color has a defined job in the table above
- [ ] No color is doing two jobs on the same screen
- [ ] No cold Tailwind grays without warm override
- [ ] Dog name is purple (default) or fuschia (forever note) — nothing else
- [ ] All touch targets ≥ 44px
- [ ] Door codes always visible as slate pill — never hidden
- [ ] Font is DM Sans — nothing else
- [ ] Coral is the CTA — not blue, not green, not gray
- [ ] Screen passes WWRS: one hand, one eye on the dog
- [ ] Does this feel like Wiggle — or something else?

---

## WEBSITE (upcoming)

Client-facing trust surface. Neighbourhood institution's front door.
Peach background, cream sections, coral CTA — same palette as the app.
Photography leads — dogs, walkers, Plateau and Laurier streets.
Mobile-first always. Bilingual EN/FR from day one.
Coral is the only booking CTA. Never blue, never green.

## INSTAGRAM (upcoming)

Lifestyle and community channel. Not a promotions feed.
Coral accent in every graphic. DM Sans for text overlays.
Dog names and personalities are the content. Neighbourhood energy.
Same color tokens as the app — warmth carries across every surface.

---

*This file is a living document. Update when the design system evolves.
Not when you feel like improvising. Work smart, play always. 🐾*
