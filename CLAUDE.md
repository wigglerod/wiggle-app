# WIGGLE DOG WALKS — DESIGN CONSTITUTION
### Loaded automatically every Claude Code session.
### Lives at: ~/Documents/wiggle-v4/CLAUDE.md
### Do not edit without Rodrigo's approval.
### Last updated: April 2026

---

## WHO WE ARE

Wiggle Dog Walks is a boutique dog walking company in Montréal's Plateau and
Laurier sectors. ~95 active dogs. ~7 walkers. One co-admin (Gen). Founded and
operated by Rodrigo (Rod).

Brand voice: **"Work smart, play always."**
Operating philosophy: **Occam's razor. Simplest truth, strongest foundation.**

We occupy a rare white space: boutique neighbourhood operator with tech-forward
infrastructure and lifestyle-grade branding. We are not a logistics platform.
We are not a startup. We are a small business built on personality, trust, and
8 years of relationships with dogs and their families.

---

## THE PRODUCT ECOSYSTEM

Four surfaces. One brand. Different audiences, different contexts, same soul.

| Surface | Audience | Purpose | Status |
|---|---|---|---|
| **Wiggle App** | Walkers in the field | Real-time ops, one hand, winter coat | Active — V4 |
| **Tower Control** | Rod + Gen at the desk | Planning, management, oversight | Active — V4 |
| **Website** | Clients + prospective clients | Brand, trust, booking | Upcoming |
| **Instagram** | Community, lifestyle, dog culture | Brand voice, reach, warmth | Upcoming |

These are not separate projects. They are one brand speaking in four voices.
Every design decision made on the app should be coherent with what the website
will feel like and what an Instagram post will look like. When you build
anything, ask: does this feel like Wiggle — or does it feel like something else?

---

## THE PRINCIPLES
### The why behind every decision. When no rule exists, come back here.

**Before building anything, ask three questions:**
1. Which principle does this serve?
2. Does it contradict any other principle?
3. What would Rodrigo do?

If you can't answer all three — the scope is not ready.

---

### THE ECOSYSTEM

**1. Two Views, One Truth**
The app and Tower Control are not two systems — they are two views of one
database. A change in one is instantly visible in the other.
*Because Rod plans from the desk, walkers execute in the field. Same dogs,
same truth, different windows. If a feature only works in one view, it is
incomplete.*

**2. Automate the Admin, Keep the Heart**
The app exists to remove friction from operations — not to replace the human
relationships that make Wiggle what it is.
*Because 8 years of client trust wasn't built by software. It was built by
walkers who knew every dog by name. Technology serves the relationship.
Never the other way around.*

---

### THE WALK DAY

**3. The Door Is the Context**
Every decision is filtered through one moment: a walker at a building door,
winter, one hand occupied, a dog already pulling.
*Because the worst UX failure isn't ugly — it's a walker fumbling while an
anxious dog strains at the leash. If it can't be done with one thumb in a
winter coat, reconsider it.*

**4. Nothing Vanishes**
No state transition removes a dog from view. Not walking stays amber.
Returned fades but remains. The count always matches reality.
*Because a disappearing card creates doubt — "did I miss one?" — and doubt
at a door with six dogs is dangerous. Visibility is a safety feature.*

**5. Every Action Is Reversible**
State is additive (insert) and reversible (delete). No destructive writes.
*Because cold fingers misswipe, new walkers make mistakes. The cost of an
error must be near zero. If an action cannot be undone, question whether
it belongs in the app at all.*

**6. Instant Then Correct**
Every action updates the screen immediately, then saves to the database.
The UI never waits for the server. Rollback on failure.
*Because a pause per swipe compounds across 40 dogs on spotty cell service —
and basements have no signal at all.*

---

### THE DOG

**7. The Card Never Lies**
The dog card always shows name, address, and door code — no layout mode,
no role, no exception can remove them. isCompact may reduce size only.
*Because the card is a promise: everything you need to get through that door
is visible without a single tap.*

**8. The Drawer Is the Control Centre**
Every action that changes a dog's state for the day lives inside the Dog
Profile Drawer. The card may offer fast-path shortcuts — swipe gestures,
inline expand — but only when they perform the identical action as the drawer.
Same outcome, no divergence. The drawer is the source of truth.
The card is the fast path to it.
*Because one dog, one place, always the same gesture. If a shortcut ever
produces a different outcome than the drawer, fix the shortcut — not the
drawer.*

**9. Close Means Done With This Dog**
The drawer closes automatically after status actions: pickup, back home,
not walking, undo. It stays open after informational taps: notes, edit times.
Door codes are always visible — no tap-to-reveal, ever.
*Because when a walker marks a dog as picked up, they are already moving.
The app should move with them.*

**10. Notes Have a Lifetime**
Owl notes → this week. Walker-to-walker handoffs.
Forever notes → never expire. Allergies, building quirks, aggression.
Walk notes → this walk only. State, times, today's events.
*Because the right note at the right time is the only note that helps.
When unsure where a note belongs, ask: "When does this stop being relevant?"
That is its lifetime.*

---

### THE VISUAL LANGUAGE

**11. Every Write Has a Name**
Every action carries who did it — walker name, walker ID, timestamp.
No anonymous mutations anywhere in the system.
*Because "who did this?" lets Rod help when something goes wrong.
Accountability is care, not surveillance.*

**12. Color Is Signal, Not Decoration**
Every color has exactly one job. A color that does two jobs does neither.
*Because when fuschia means "permanent note" and also "random style choice,"
it stops meaning anything. Protect the signal.*

**13. Warmth Is Structural**
The palette is warm — peach, cream, coral, amber, sage. Cold grays and
unassigned colors are visual noise.
*Because Wiggle is built on personality and trust, not logistics.
The app should feel like the company feels — approachable, warm, alive.*

---

## THE FOUR FILTERS
### Run before building anything, in this order.

**WWRS** — What would the walker need right now, one hand, winter coat?
If the answer is "not this" — stop. This filter applies to every surface,
not just the app. A website visitor with 3 seconds on their phone is the
same test in a different context.

**ONE PLACE** — Does this action or information already have a home?
If yes — put it there. Do not create a second home.

**SIMPLEST** — What is the smallest version that solves the real problem?
Strip it to the bone. Ask this BEFORE opening the editor — not after
you've already committed to a full build. The excitement about a new
feature is the signal to run SIMPLEST.

**BOTH VIEWS** — Does this work for the app AND Tower Control?
If it only works in one view — it is incomplete.

---

## COLOR SYSTEM
### Every color earns its place. No exceptions across any surface.

Before adding any color to any surface — app, website, Instagram graphic —
ask: what does this color already mean in the Wiggle universe?
If it has a job → you cannot reassign it.
If it has no job yet → define one before using it.

### Assigned Colors — Do Not Reassign

| Token | Hex | Job | Surfaces |
|---|---|---|---|
| Coral | `#E8634A` | Hero color — primary action, CTA, brand identity | All |
| Coral Dark | `#C94A34` | Pressed/active state of coral only | All |
| Purple | `#534AB7` | Tappable links — dog names, walker names | App only |
| Fuschia | `#961e78` | Dog has a permanent note — pay attention | App only |
| Sage | `#2D8F6F` | Picked up, positive, done, success | App |
| Amber | `#C4851C` | Needs attention, warnings, not walking | App |
| Slate | `#475569` | Utilitarian info — door codes, addresses, metadata | App |
| Teal-Blue | `#3B82A0` | Plateau sector identity | App + Website map |
| Forest Green | `#4A9E6F` | Laurier sector identity | App + Website map |

### Surface Colors

| Token | Hex | Job |
|---|---|---|
| Background | `#FFF5F0` | Peach — app bg, website section bg, never white |
| Card surface | `#FAF7F4` | Cream — cards, sections, never pure white |
| Border | `#E8E4E0` | Warm gray — never cold gray |
| Surface alt | `#F0ECE8` | Secondary surfaces |
| Text primary | `#333333` | Never `#000` |

### Unassigned (Must earn a job before use)

Blue, red — no current role in the Wiggle universe. Do not use decoratively
on any surface. Define the job first, add it to the table above.

### Hard Rules

- Never use Tailwind's default cold grays (`gray-100`, `gray-200`,
  `slate-100` without warm override)
- No pure white (`#ffffff`) anywhere — use cream `#FAF7F4` instead
- Coral is the CTA on every surface — not blue, not green, not gray
- The palette is warm. If it feels like a bank app, it is wrong.

---

## TYPOGRAPHY

**Font: DM Sans** — weights 400, 500, 600, 700.
This is the Wiggle voice in text form. Do not introduce other fonts
without Rodrigo's explicit approval. This applies to the app, website,
and any graphic templates.

Minimum touch targets: **44px height** for any tappable element on any
mobile surface — app or website.

---

## APP-SPECIFIC RULES

### Dog Card — Non-Negotiable Content
Every card in every state ALWAYS shows:
- Dog name (purple `#534AB7` or fuschia `#961e78` if `dogs.notes` has content)
- Street address (number + street name, no postal code)
- Door code as slate pill `#475569`
- Difficulty dot (level 1 = sage, level 2 = amber, level 3 = coral)

`isCompact` mode may reduce padding and font size ONLY.
Never removes name, address, or door code. Ever.

### Card States

| State | Background | Name | Notes |
|---|---|---|---|
| Waiting | `#FAF7F4` cream | Purple | Default |
| Picked up | `#E8F5EF` sage | Struck through | Show pickup time |
| Back home | `#F0ECE8` sand, opacity 0.55 | Normal | Show both times |
| Not walking | `#FDF3E3` amber | Struck through amber | Amber border + badge |

### Drawer Rules
CLOSE after: Picked Up, Back Home, Not Walking, any Undo.
NEVER CLOSE after: Edit times, Info taps, Note editing.
Door codes are always visible — no tap-to-reveal, no exceptions.

### The Three Dog Views
- **Dog Card** — the compact row. Always visible. Scan without tapping.
- **Inline Expand** — tap the caret ▼. Quick action without leaving the group.
- **Dog Profile Drawer** — tap the dog's name. Full control centre.
  Every action that changes a dog's state for the day lives here.

### Database Rules
- Walk state lives in `walker_notes` only — never `walk_logs` (empty, unused)
- `note_type` values: `pickup` | `returned` | `not_walking` | `group_done`
- Query Supabase FIRST — never ask Rodrigo for data that lives in the DB
- Every write must carry `walker_id`, `walker_name`, `walk_date`

### Tool Assignment
| Task | Tool |
|---|---|
| Visual fix, drawer behaviour, swipe, card state | Antigravity |
| Architecture, hook refactor, multi-file restructuring | Claude Code |
| Strategy, prompt writing, Supabase queries, planning | Claude Chat |

Clean build ≠ working feature. Device test is the only proof.
Test at: https://wiggle-app-dusky.vercel.app
Login: test@wiggledogwalks.com / WiggleTest2026!

---

## WEBSITE-SPECIFIC RULES (Upcoming)

The Wiggle website is a **client-facing trust surface** — a neighbourhood
institution's front door, not a landing page.

The warmth of the app palette applies directly. Peach background, cream
sections, coral as the primary CTA. These are not just app choices —
they are Wiggle's visual identity. The website must feel like the same
company as the app.

Photography leads. Dogs, walkers, streets of Plateau and Laurier.
Lifestyle-grade, not stock-photo corporate. Coral and warm tones should
complement the photography — never clash with it.

Booking flow is the primary CTA. Every section has a path to "start a walk."
The coral button is that action — always. Never blue, never green for CTAs.

Mobile-first always. Wiggle clients manage their dogs from their phones.
If the homepage doesn't work at 390px, it doesn't work.

Bilingual: site should support EN/FR toggle. Plan for it from day one.

---

## INSTAGRAM-SPECIFIC RULES (Upcoming)

Wiggle's Instagram is a **lifestyle and community channel** — not a
promotions feed. The brand voice is "Work smart, play always." Content
should feel effortless, warm, and rooted in the neighbourhood.

Coral `#E8634A` is the brand accent in every graphic. When a post uses a
brand color, it is coral. This is the thread that connects every surface.

DM Sans for any text overlaid on imagery. Never decorative fonts.

Dog names and dog personalities are the content. The app knows every dog
by name. Instagram should feel like it does too. Mia energy. Neighbourhood
energy. Not influencer energy.

When building Instagram graphics or templates, use the same color tokens.
Amber on Instagram should feel like it could belong in the app — same
warmth, same signal, same brand.

---

## THE DRIFT CHECK
### Run before every PR, every design review, every new section or graphic.

- [ ] Background is warm — peach `#FFF5F0` or cream `#FAF7F4`, never white
- [ ] Every color used has a defined job in the color table above
- [ ] No color is doing two different jobs on the same screen
- [ ] No cold Tailwind grays without warm override
- [ ] Dog names are purple or fuschia — never black, never gray
- [ ] All touch targets ≥ 44px on any mobile surface
- [ ] Door codes always visible as slate pill — never hidden behind a tap
- [ ] Font is DM Sans — not Inter, not system-ui, not anything else
- [ ] Coral is the CTA — not blue, not green, not gray
- [ ] The screen passes WWRS: one hand, one eye on the dog
- [ ] Does this feel like Wiggle — or does it feel like something else?

---

## TECHNICAL REFERENCE

**Stack:** React + Vite + Tailwind CSS + Supabase + Vercel
**Code:** ~/Documents/wiggle-v4/
**Supabase:** ifhniwjdrsswgemmqddn
**Production:** wiggle-app-dusky.vercel.app
**Sectors:** Plateau (#3B82A0) — 56 dogs | Laurier (#4A9E6F) — 39 dogs
**Roles:** Chief Pup (admin) | Wiggle Pro (senior_walker) | Pup Walker (junior_walker)
**Scheduling:** Acuity Scheduling — User ID 36833686
**Tower Control:** ~/Documents/wiggle-v4/apps-script/Code.js

Do not add new npm packages without asking Rodrigo first.
Do not introduce new font families.
Do not use cold gray Tailwind classes.
Do not remove dog name, address, or door code from any card state.

---

*This file is a living document. Update it when the design system evolves —
not when you feel like improvising. Work smart, play always. 🐾*
