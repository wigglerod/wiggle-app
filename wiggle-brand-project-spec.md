# WIGGLE BRAND PROJECT — MASTER SPEC
### The complete design and product reference for Wiggle World
### For Claude Brand Project knowledge base · April 2026

---

## What this document is

This is the authoritative design and product reference for Wiggle World.
Every Claude session in this project reads this document first.
When generating prompts, making design decisions, or answering questions
about the Wiggle product, this spec takes precedence over everything else.

If something is not in this document, ask Rod before deciding.
If something contradicts this document, flag it before acting.

---

## The Product — Wiggle World

Wiggle Dog Walks is a Montréal neighbourhood dog walking company.
Founded by Rodrigo (Rod). ~95 dogs. 7 walkers. Two sectors: Plateau and Laurier.
Gen (Geneviève) is the co-admin who manages daily operations from home.

Wiggle World is the unified product that contains both surfaces:

**The Neighbourhood HQ** — the walker-facing PWA.
Phone. One hand. Winter coat. Moving between buildings on the Plateau.
Walkers use this every day to manage their walk sessions.

**The Studio** — the admin desktop dashboard.
Gen's command room. Desktop browser. Planning the day before walkers leave.
The screen that replaces four browser tabs.

Both surfaces share one Supabase database.
Both surfaces share one auth system (same login, same profiles).
Role-based routing decides which surface you see after login.

### The Bridge — Admin Control Dashboard

The Studio and The Neighbourhood HQ are not simply two apps that share a database.
The admin control dashboard in The Studio is the explicit bridge between the two worlds.

Here is the relationship, precisely stated:
When a walker acts in The Neighbourhood HQ (picks up a dog, writes a note, raises a flag),
that action writes to Supabase. The Studio dashboard reads that same data in real time
and surfaces it for Gen. She sees what the walker did — the dog's chip turns green,
the flag appears, the owl note counter updates — without a page refresh, without a text.

The reverse is equally true and equally important.
When Gen approves a Mini Gen draft in The Studio, walk_groups is written.
The Neighbourhood HQ reads walk_groups and the walker's screen updates immediately.
When Gen sends a quick owl note from the Studio dashboard, the owl appears
on that dog's name card in The Neighbourhood HQ within seconds.

This means the admin dashboard must be designed with The Neighbourhood HQ in mind at all times.
It is not a reporting tool. It is not a management panel. It is the control room
for The Neighbourhood HQ — a real-time mirror from above. Gen's view answers the question:
what is happening in The Neighbourhood HQ right now, and what does it need from me?

This has one important architectural implication: the Studio dashboard is always the
admin entry point. When an admin logs in, they land on the dashboard — not on a generic
admin home — because the dashboard IS the connection to what is live in The Neighbourhood HQ.

The existing walker app at wiggle-app-dusky.vercel.app continues running
until The Neighbourhood HQ is ready and walkers migrate to it.
The old app is never touched. It is the safety net during this build.

---

## The Design Language — The Field

This design direction was finalized by Rod after a full direction review session.
It is called "The Field" — the design language of The Neighbourhood HQ.
The Studio has its own design language (see The Studio section below).

### The Core Structure

The Neighbourhood HQ has one defining visual idea: two dark forest green surfaces
(the top bar and the bottom nav) framing warm peach/cream content between them.

Think of it like a book: dark cover, warm pages, dark cover.
The warmth of the content is made warmer by the dark frames surrounding it.
This is intentional. Do not change the bar or nav to any other color.

The forest green is #111A14. It is not sage (which signals "done").
It is much deeper — almost black, unmistakably green.
Rod described it as "a park at 7am in January."

### Typography — The Most Important Decision

**Two fonts. Two registers. Never swap them.**

**Fraunces** (serif, optical-sizing: auto) is everything Wiggle *says*.
It carries voice, personality, and character.
Use for: the wordmark, session hero numbers, session status, group names, dog names.
The dog names in Fraunces italic are the single most important typographic moment.
"Pepper" in italic serif is not a data label. It is the name of a specific animal
Wiggle has known for years. "Pebbles ★" in fuschia Fraunces italic is genuinely beautiful.

**DM Mono** (monospace) is everything Wiggle *delivers*.
It carries precision, operational data, and factual information.
Use for: dates, door codes, addresses, timestamps, walker badges, counters.

The split creates texture. You feel the difference between content that has personality
and content that has precision — without reading a word.
This is the typographic argument for what Wiggle actually is:
95 individual relationships, not 95 data rows.

Do not use DM Sans anywhere in Wiggle World. That was the old system.
Do not use Inter, Roboto, or system fonts for named elements.

### The Colour System

The colour system has two categories: structural colours and signal colours.
Structural colours define surfaces. Signal colours communicate state.
Mixing them corrupts the language walkers have learned.

**Structural colours:**
- Forest (#111A14) — top bar, bottom nav, group left borders
- BG (#FFF5F0) — app background (warm peach)
- Card (#FAF7F4) — card backgrounds (warm cream)
- Border (#E8E4E0) — card borders
- Shadow-card (#D5CFC8) — heavier bottom border (creates depth on cards)

**Signal colours — these are the non-negotiable ones:**
- Sage (#2D8F6F) — picked up, done, positive state. Sage-bg (#E8F5EF) for card fill.
- Amber (#C4851C) — not walking today, owl notes, caution. Amber-bg (#FDF3E3) for fill.
- Purple (#534AB7) — forever note signal on dog name. Only on names. Never for navigation.
- Fuschia (#961e78) — forever note content. Sections, text, star marker.
- Coral (#E8634A) — CTA action buttons ONLY. Never used for information or state.

**Rules that must never be broken:**
- No blue anywhere in The Neighbourhood HQ. Blue has no defined job.
- Coral is CTA only. Never informational.
- Purple is dog name signal only. Not for nav, headings, or decoration.
- Sage is done/positive. Never used for structure or branding.

### Colour Signal Map

This is how walkers read the screen. Breaking a signal corrupts the whole system.

| Signal | Meaning | Rule |
|--------|---------|------|
| Purple dog name | dogs.notes IS NOT NULL | Forever note exists for this dog |
| Fuschia ★ after name | Same as above | Visual signal alongside purple |
| Fuschia section background | Forever note content is displayed | Admin-written, permanent |
| Sage card background | Dog picked up today | 'pickup' note_type in walker_notes |
| Sage strikethrough on name | Dog name when picked up | Fraunces italic struck through in sage |
| Amber card background | Dog not walking today | 'not_walking' in walker_notes |
| Amber strikethrough on name | Name struck in amber | Not walking state |
| 🦉 animated after name | Active owl note for this dog + sector | Walks side-to-side, 2s loop |
| Coral | Tap this button to do something | CTA only |

---

## The Neighbourhood HQ — Walker Surface

### The WWRS Filter

Every decision about the walker app passes through this filter first:

**WWRS — What Would the Walker Need Right Now?**
One hand. Winter coat. A dog already pulling. A building door in front of them.
If the feature requires two taps or reading a sentence to understand, it fails.
If the information isn't visible without a tap, ask if it needs to be.
If the action requires precision input, give them a tap instead.

This is not a usability guideline. It is the reason this product exists.

### Three Screens That Do Everything

**The Walk Screen (Today)** — the primary view.
Groups, walkers, dogs. Every card shows name + address + door code without a tap.
Status reads in colour. The walker scans, they don't browse.

**The Dog Profile Drawer** — one dog, one place, everything.
Slides up from below. All actions that change this dog's day state live here only.
Nowhere else. Pickup, not walking, undo, back home — all in the drawer.
It auto-closes after state actions. It stays open when the walker is reading.

**The Note Composer** — quick picks, one toggle, done.
After the walk. Quick chips handle 90% of observations without typing.
The "Warn next walker" toggle dual-writes: permanent activity note + 3-day owl note.
No keyboard required for the most common observations.

### The Four Note Types

| Type | Symbol | Lifetime | Who writes | Stored in |
|------|--------|----------|------------|-----------|
| Forever Note | ★ | Never expires | Admin only | dogs.notes |
| Owl Note | 🦉 | 3-7 days | Anyone | owl_notes |
| Acuity Note | 📅 | Same day | Owner (via Acuity) | Phase 2 |
| Activity Note | 📝 | Permanent | Any walker | walker_notes |

The Forever Note is the most sacred. It was written by an admin (Rod or Gen)
and it applies to every walk this dog will ever have. Purple name = read the drawer.
Fuschia section = this is the content they need to know before they knock.

The Owl Note is staff-to-staff communication with a timestamp.
The animated owl walking on the dog's name is the signal that context exists.
Sector filtering is mandatory on owl notes — always include target_sector.
A cross-sector note is a data error that creates confusion. Never allow it.

The "Warn next walker" toggle in the Note Composer does two things at once:
writes the permanent activity record AND creates a timed owl note.
This dual-write is what makes warnings propagate. It is not optional logic.

### What Is On a Walk Card (and What Is Not)

**On the card — always visible without a tap:**
- Status dot (7px circle, coloured by state)
- Dog name (Fraunces italic 700 — the most important element)
- Address (DM Mono 8px, slate)
- Door code pill (DM Mono, slate bg) — hidden when picked up
- Pickup timestamp — shown instead of door code when picked up

**Removed from The Neighbourhood HQ cards:**
- Dog photo — profile drawer only
- Breed label — profile drawer only
- Avatar circle / emoji placeholder — removed entirely (no orphan)
- Difficulty dots — profile drawer only

These removals make the scheduling view and group cards dramatically cleaner.
The promise of the card is: everything you need to get to the door, nothing more.

### Walker Autonomy — Core Principle

Rod and Gen's job ends when dogs are assigned to walk_groups.
Walkers own all group organization decisions.
Tower Control (The Studio) never overrides walker group choices.
Check for Friends exists in The Neighbourhood HQ because walkers plan their own groups.
It is a planning tool, not a management tool.

### Sector Rules

Walkers see only their sector's dogs by default in the Dog Directory.
The "All" sector tab is removed from The Neighbourhood HQ.
Plateau and Laurier tabs are both visible and tappable — walkers can plan with both.
Only Rod (admin in The Studio) has access to the unified cross-sector view.

---

## The Studio — Admin Surface

### Who Uses It

Gen (Geneviève) is the primary user. She manages daily operations from home.
Rod is the secondary user. He reviews data and manages settings.
The Studio is a desktop browser experience. Not a PWA. Not optimized for phone.

### The Studio Design Language

The Studio uses cool gray surfaces, not the warm peach of The Neighbourhood HQ.
The two surfaces must feel different. Gen is planning, not walking.
She needs density, not warmth. She needs to scan 22 dogs across 4 walkers at once.

Studio palette:
- Background: #F0F2F5 (cool light gray)
- Cards: #FFFFFF (clean white)
- Borders: #E2E6EC
- Text: #1A1D23
- Mid text: #6B7280
- Sidebar: #1A1D23 (dark)
- Sidebar active: white text + coral left border

The coral, sage, amber, purple, fuschia signal colours carry over into The Studio.
They mean the same things in both surfaces. The background changes. The signals don't.

Beast orange (#E8762B) is a Studio colour. It does not appear in The Neighbourhood HQ.

### The Studio Build Order

The Studio is built in Phase 2, after The Neighbourhood HQ is complete.
Build order: migrate what exists first, then build the new bridge dashboard on top, then add new components.

**Phase 2A — Studio shell + Tower Control migration:**
Before building anything new, scaffold The Studio shell (dark sidebar at #1A1D23, cool gray layout at #F0F2F5, role-based routing to /studio) and migrate the existing Tower Control components from wiggle-v4 into it. Do not rebuild what already works — port it.

The migration priority order is: Mini Gen review panel first (TowerMiniGen.jsx — the most proven component, 100% resolution rate, do not change its logic), then api/tower-approve.js (recreate in wiggle-world/api/ — same logic, new deployment), then the weekly board, then the existing dashboard structure. Each component gets adapted to The Studio design system (cool gray surfaces, white cards, dark sidebar) but its Supabase queries and data logic stay identical. The existing Tower Control in wiggle-v4 remains live throughout this entire phase — Gen keeps working there until The Studio's Mini Gen panel produces identical results.

When migrating, fix the known audit issues from April 6 while you are in the components: flags need Ask/Done action buttons wired to Supabase, must-ask items need inline context (one line explaining why), owl notes in the dashboard need urgency/expiry indicators, the weekly board needs walker names visible per group, and weekly board cells need to be tappable with drill-down to that day's groups.

**Phase 2B — Bridge Dashboard (Today View):**
This is the bridge screen and it is built on top of the migrated foundation. It is the first thing an admin sees after login and it must answer one question immediately: what is happening in The Neighbourhood HQ right now?

Three-panel desktop layout built specifically to mirror and control The Neighbourhood HQ. Left panel: Mini Gen drafts (migrated from Phase 2A, now with approve-all button) and open walker flags with Ask/Done actions wired to Supabase. Center panel: live walk board — walker cards showing real-time dog chip status from walker_notes realtime subscriptions. This IS The Neighbourhood HQ's state surfaced for Gen from above — same data, different altitude. Right panel: Beast suggestions (with confirm-before-act UI) and quick owl note composer. The owl composer belongs on the dashboard specifically because it writes directly into The Neighbourhood HQ — Gen pushes context to walker dog cards without leaving the bridge screen.

**Phase 2C — Dogs management:**
Full dog directory with admin capabilities. Edit forever notes (fuschia). Edit addresses. View all sectors (cross-sector view available to admin roles only — this is the "All" view that walkers never see).

**Phase 2D and beyond:** Staff management, billing, messaging (TELUS SMS inbox), Map Health panel for acuity_name_map gaps.

### The Studio Rules

Every AI action (Mini Gen draft approval, Beast suggestions) requires a confirm step.
The agent stops. Gen decides. No AI writes to production without human approval.
This is the only AI architecture Wiggle will ever use.

Mini Gen writes to mini_gen_drafts first (staging table).
Gen approves in The Studio. The approval writes to walk_groups.
Beast suggestions surface in the right panel with "Do it / Skip" — never auto-execute.

---

## The Database — Supabase

**Project ID:** ifhniwjdrsswgemmqddn
**URL:** https://ifhniwjdrsswgemmqddn.supabase.co

### Single Source of Truth Rules

Walk state lives entirely in walker_notes. The note_type column carries the state:
'pickup' means the dog was picked up. 'returned' means back home. 'not_walking' means absent.
'note' means an activity note. walk_logs exists but is empty — ignore it completely.

dog_ids in walk_groups stores dog NAMES (text[]), not UUIDs. This is intentional.
It makes debugging human-readable. Every query that touches dog_ids uses names.

Owl notes MUST always be filtered by target_sector. This is not optional.
A query to owl_notes without a sector filter is a bug. Notes bleed across sectors.

walk_groups unique constraint: (walk_date, group_num, sector).
Always check MAX(group_num) for the sector before inserting a new group.

### Key Tables

**dogs** — the dog roster
Every dog Wiggle walks. The notes column is the forever note.
If notes IS NOT NULL, the dog name is purple in every screen.

**walk_groups** — today's (and future) walk groupings
dog_ids text[] — names only. walker_ids uuid[]. locked_by uuid.
Mini Gen writes drafts to mini_gen_drafts first. Approved drafts become walk_groups rows.

**walker_notes** — ALL walk state
Every pickup, return, not-walking, activity note, and flag lives here.
Every row must have: dog_name, note_type, walker_id, walker_name, walk_date.

**owl_notes** — timed staff-to-staff notes
target_sector is mandatory. acknowledged_by is a uuid array — one entry per walker who read it.
expires_at is when the note disappears from the feed.

**profiles** — user profiles
role: 'admin' | 'senior_walker' | 'junior_walker'
sector: 'Plateau' | 'Laurier' (walker's home sector)

**mini_gen_drafts** — Mini Gen staging
status: 'pending' | 'approved' | 'rejected'
Mini Gen writes here. The Studio promotes to walk_groups on approval.

**acuity_name_map** — Acuity booking name bridge
acuity_name is often the OWNER's name (first or full).
dog_name is the DOG's canonical name from the dogs table.
74+ entries. 100% resolution rate. Never store descriptions — only canonical dog names.

---

## The AI Layer — Stop and Wait

**Mini Gen** is live. It reads Acuity bookings and drafts walk groups.
It writes to mini_gen_drafts (staging), not directly to walk_groups.
It stops and waits for Gen's approval before anything reaches production.
100% resolution rate (114/114 in testing). Runs daily. Gen reviews in The Studio.

**Beast** is next. It will surface suggestions in The Studio's right panel.
Conflict detection, capacity alerts, name map gaps, operational patterns.
Every Beast suggestion requires "Do it" before any Supabase write executes.
Beast never touches production alone. Same discipline as Mini Gen.

This is the only AI architecture Wiggle will ever use.
"Confirm before acting" is not a feature. It is a core principle.

---

## The Build Workflow

### Four Tools in Harmony

**Claude Chat (this session type)** — strategy, Supabase queries, specs, design decisions.
**Cowork** — autonomous overnight file editing. Executes build prompts independently.
**Claude Code** — architecture, multi-file logic, heavy lifts, debugging.
**Claude Brand Project (this project)** — holds the spec. Generates prompts. Stays consistent.

### How the Brand Project and Cowork Work Together

1. Rod and Claude Brand Project (this) agree on what to build next.
2. Claude Brand Project writes the Cowork prompt as a .txt file.
3. Rod gives the .txt to Cowork.
4. Cowork executes autonomously — it has the spec via the prompt.
5. Cowork creates a READY.md with what it built and any questions.
6. Rod reviews and deploys manually.

The Brand Project spec (this document) is the reference Cowork prompts pull from.
When a new Cowork prompt is needed, Claude Brand Project writes it using this spec.
The prompts should never require Rod to explain context — the spec does that.

### Prompt Discipline

Every Cowork prompt:
- States what puzzle piece is being placed and how it connects to the whole.
- Is delivered as a .txt file, not a chat explanation.
- References WIGGLE_WORLD_SPEC.md and CLAUDE.md in the repo.
- Contains only one logical build unit (one screen, one component, one feature).
- Ends with a verification checklist.
- Never deploys — Rod reviews first.

---

## Names and Branding

**Wiggle World** — the umbrella product name.
**The Neighbourhood HQ** — the walker-facing PWA. Part of the Wiggle brand identity.
**The Studio** — Gen's admin dashboard.
**Mini Gen** — the AI agent that drafts walk groups from Acuity bookings.
**Beast** — the AI assistant in The Studio. Orange. Suggests. Never acts alone.
**The Field** — the design language of The Neighbourhood HQ (Fraunces + forest green).

The wordmark in the app top bar is "Wiggle" in Fraunces 900, warm cream white (#F2DEC5),
on the forest green bar. This is not a logo — it is the typographic mark of the brand.

---

## What Never Changes

These decisions are final. They do not get revisited without Rod explicitly opening the question.

- Fraunces for dog names. DM Mono for data. Never swapped.
- Forest green frames The Neighbourhood HQ. Not negotiable.
- Coral is CTA only. Never informational.
- Purple means forever note exists on that dog.
- Fuschia means forever note content is being displayed.
- Sage means done. Amber means needs attention.
- No blue in The Neighbourhood HQ.
- walk_logs is empty and ignored.
- dog_ids stores names, not UUIDs. Intentional.
- Owl notes always filtered by target_sector. Non-optional.
- Beast and Mini Gen stop and wait. Always.
- Walker autonomy: Rod and Gen's job ends when dogs are in walk_groups unassigned.

---

*Wiggle World · Montréal · Built for scale · Work smart, play always 🐾*
