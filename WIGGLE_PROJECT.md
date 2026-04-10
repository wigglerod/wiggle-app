# WIGGLE PROJECT — Master Context
## Read this before touching anything. Every tool. Every session.
## Last updated: April 7, 2026 — All V4 bugs resolved. Tower V4 live. Next: Wiggle World Phase 1 scaffold.

---

## THE BUSINESS

- Wiggle Dog Walks — Montréal, QC
- Owner: Rodrigo (Rod) — Chief Pup role in the app
- Co-admin: Gen (Geneviève) — daily Tower Control user
- ~95 active dogs, ~7 walkers
- Two sectors: Plateau (56 dogs) and Laurier (39 dogs)
- Scheduling platform: Acuity Scheduling (NOT Google Calendar)
- Brand voice: "Work smart, play always."
- Operating philosophy: Occam's razor — simplest truth, strongest foundation.

---

## THE PICTURE ON THE BOX

A walker stands at a door in winter, one hand free.
The dog profile is the complete action centre — one screen,
everything needed to manage a dog's entire day.
Every prompt is one puzzle piece. State what piece you are
placing and how it connects to the whole before writing code.

---

## THE PRODUCT ECOSYSTEM

Four surfaces. One brand. Same soul.

| Surface       | Audience             | Purpose                              | Status        |
|---------------|----------------------|--------------------------------------|---------------|
| Wiggle App    | Walkers in the field | Real-time ops, one hand, winter coat | Active — V4   |
| Tower Control | Rod + Gen at desk    | Planning, management, oversight      | LIVE — V4     |
| Website       | Clients + prospects  | Brand, trust, booking                | Upcoming      |
| Instagram     | Community, lifestyle | Brand voice, reach, warmth           | Upcoming      |

These are not separate projects. They are one brand in four voices.
Every decision made on one surface must be coherent with the others.

---

## THE THREE TOOLS

- **Claude Chat** — strategy, Supabase/Vercel MCP queries, spec writing, prompt writing
- **Antigravity** — ALL visual work, interactive behaviour, anything requiring browser verification
- **Claude Code** — architecture, multi-file restructuring, non-visual work, Tower Control

### TOOL RULE — NON-NEGOTIABLE

Any fix involving user interaction (tapping, state changes, drawer open/close,
card state updates) goes to Antigravity. Claude Code edits blind.
A clean build does NOT mean the feature works on device.
Never claim something works without device verification.

---

## INFRASTRUCTURE

- App: wiggle-app-dusky.vercel.app (React PWA, Vite, Tailwind, Framer Motion,
  @dnd-kit, Supabase realtime, Workbox PWA)
- App code: ~/Documents/wiggle-v4/
- Supabase project ID: ifhniwjdrsswgemmqddn
- Vercel project ID: prj_8xMbgRMgEXcF0DE44u70SOFeL8ma
- Team ID: team_UWOcgVnP9qC84S65WA0vSAbr
- Tower Control: wiggle-app-dusky.vercel.app/tower (React, same codebase)
- Tower code: ~/Documents/wiggle-v4/src/pages/Tower*.jsx
- Tower tabs: /tower/dashboard · /tower/weekly · /tower/schedule
              /tower/dogs · /tower/staff · /tower/billing (placeholder)
- Tower auth: role = 'admin' in profiles table (not chief_pup)
- Apps Script (legacy Code.js): no longer Tower — ignore

---

## TEST CREDENTIALS

- test@wiggledogwalks.com / WiggleTest2026!
- Role: admin, Sector: both (upgraded Apr 6 2026)
- Use for ALL Antigravity automated testing
- Never appears in walker assignment dropdowns

---

## DATABASE — KEY TABLES

### dogs (95 rows — confirmed Apr 6 2026)
dog_name, sector, owner_first, owner_last, email, phone,
address, door_code, notes, photo_url, breed, level,
ig_handle, contact_method, building_access, unit_number

dogs.notes = Forever Notes — permanent standing instructions.
Never expires. When not null → dog name shows in purple on card.
24 dogs currently have forever notes.

### walk_groups
id, walk_date, group_num, group_name, dog_ids (text[]),
walker_ids (uuid[]), sector, locked, locked_by,
locked_by_name, dog_order (jsonb)
dog_ids stores dog NAMES as text[] — not UUIDs. Intentional.
Query must return ALL rows where walk_date = today
and dog_ids is not empty. No other filters.

### walker_notes — ALL walk state lives here
id, dog_id, dog_name, walker_id, walker_name,
note_type, message, walk_date, group_num, tags, created_at

note_type values:
  'pickup'         — dog has been picked up
  'returned'       — dog is back home
  'not_walking'    — dog is not walking today
  'note'           — walker activity note (permanent history)
  'group_done'     — group marked as done
  'resolver_flag'  — Mini Gen conflict flag (Tower only)

### walk_logs — EMPTY, unused
Do not write any walk state here. Use walker_notes exclusively.

### owl_notes (7 active as of Apr 6 2026)
Staff notes. Written by Rod, Gen, or any walker.
Expires weekly. Sector-filtered — walkers only see their sector.
HARD RULE: query must always include AND target_sector = walker_sector.
Never query without it or notes bleed across sectors.
Schema: id, note_text, target_type, target_dog_id, target_dog_name,
  target_sector, created_by, created_by_name, acknowledged_by,
  acknowledged_by_name, acknowledged_at, note_date, expires_at,
  created_at, scheduled_date, last_acknowledged_date

### mini_gen_drafts
walk_date, sector, dog_names (text[]), dog_uuids (uuid[]),
flags (jsonb), status ('pending' | 'approved' | 'rejected'), run_date
Mini Gen writes here. Gen approves via Tower /tower/dashboard.
Approved rows → promoted to walk_groups via api/tower-approve.js.
Cron: POST /api/mini-gen at 8 AM EDT weekdays. Gen can trigger manually.

NOTE: As of Apr 6, old pending drafts from Mar 30–Apr 2 remain in the table
as 'pending' (stale past dates). They are harmless. Future: add a cleanup
job to auto-reject past-date pending drafts. Not urgent.

### acuity_name_map (77 rows — confirmed Apr 6 2026)
acuity_name = OWNER name from Acuity
dog_name = canonical DOG name from dogs table
acuity_email = owner email for disambiguation
- Same-home pairs get two rows per booking name
- Email disambiguates duplicate acuity_names
- Never store descriptions as dog_name

### dog_conflicts
Two dogs that cannot walk together.
1 confirmed row: Mochi ↔ Chaska.
Surfaced in Tower /tower/schedule.

### dog_alt_addresses
Alternate pickup addresses for dogs.
Table exists, currently empty.
Surfaced in Tower /tower/schedule.

### profiles (12 rows — confirmed Apr 6 2026)
full_name, role, sector, email, email_alt, schedule
(text "Mon, Tue, Wed" — parse with regex)
Duplicate accounts cleaned April 6. email_alt column added.
Admin role value: 'admin' (never 'chief_pup' in DB).

### group_links
Interlock data. sync_position (int) = how many dogs Walker A
picks up before Walker B starts.

### HARD RULE
Before asking Rod ANY question about dogs, walkers, groups,
or schedules — query Supabase first. If the answer is in the DB,
answer it directly. Never ask Rod for data that exists in the database.

---

## COLOR SYSTEM — SEE CLAUDE.md FOR FULL SPEC

Quick reference:
- Coral #E8634A — primary action, CTAs, brand identity
- Purple #534AB7 — dog name signal: this dog has a forever note (dogs.notes not null)
- Fuschia #961e78 — forever note CONTENT: section bg, expand block, editor (NOT the name)
  Purple on name = "there's a note." Fuschia on section = "here it is." Both active.
- Sage #2D8F6F — picked up, positive, done
- Amber #C4851C — needs attention, not walking, warnings · owl note labels
- Slate #475569 — door codes, addresses, utilitarian info
- Black #2D2926 — default dog name color (no forever note)
- Blue — allowed when it has a defined functional purpose
- Beast orange #E8762B — Run Mini Gen button in Tower ONLY

Tower design system uses COOL GRAY (not warm peach/cream). Never let
app warmth bleed into Tower surfaces.

---

## DOG CARD — ALWAYS SHOW (non-negotiable)

Mini card must ALWAYS show regardless of layout mode
including isCompact (interlock) mode:
1. Dog name — tappable → opens DogProfileDrawer
   Default color: black (#2D2926)
   If dogs.notes has content → name color: purple (#534AB7)
2. Address — street number + street name only, no postal code
3. Door code — slate pill if exists
4. Difficulty dot — sage = easy, amber = needs attention

isCompact may reduce padding/font size ONLY.
NEVER removes name, address, or door code. Ever.

Card states:
- Waiting:      cream bg #FAF7F4, black name
- Picked up:    sage bg #E8F5EF, name struck through, pickup time
- Back home:    sand bg #F0ECE8, opacity 0.55, both times shown
- Not walking:  amber bg #FDF3E3, amber border, name struck in amber

---

## DOG PROFILE DRAWER — ACTION CENTRE

CLOSE after: Picked Up, Back Home, Not Walking, any Undo
NEVER CLOSE after: edit times, info taps, note viewing
WHY: Status actions = done with this dog, move on.

NOT WALKING:
- Writes walker_notes note_type='not_walking'
- Card stays visible in amber state — does NOT disappear
- Undo deletes the row, resets card, closes drawer

INFORMATION SECTIONS (order in drawer):
1. Walk Times — pickup/return times, duration, edit buttons
2. Forever Notes — dogs.notes, fuschia bg #fdf4fb, permanent, never expires
   Admin sees Edit button. Walkers see read-only + "admin-only" label.
3. Owl Notes — staff-written, expires weekly, sector-filtered, amber bg
4. Acuity Notes — client-written, from Acuity booking (Phase 2 — not built yet)
5. Activity Notes — walker_notes note_type='note', permanent history, neutral bg

---

## CURRENT BUGS

None confirmed as of April 6, 2026.

The four bugs previously listed were fixed by Antigravity session April 6:
Commit: `fix: undo pickup clears return state + drawer cleanup + card visibility + owl badge`

What was verified:
- ✅ Undo pickup → card resets to waiting state, drawer closes
- ✅ Back home → drawer auto-closes after markBackHome()
- ✅ Not Walking undo → drawer closes, card resets
- ✅ isCompact interlock → size reduction only, name/address/door code never stripped
- ✅ Dog name color → purple (not fuschia) per CLAUDE.md final ruling
- ✅ Swipe gesture works in interlock layout

### Known non-user-facing issue
schedule-verify cron (`/api/cron/schedule-verify`) logs an error on every run.
Does not affect walkers or Gen. Investigate when time allows.
Error details: truncated in logs — full message needed for diagnosis.

---

## TOWER — BEAST ACTIONS NOT WIRED

Beast confirm UI works. "Do it" button does nothing yet.
Next: wire to real Supabase writes (owl note + not walking).
Each action needs its own api/tower-beast-action.js endpoint.
Beast NEVER executes without CONFIRM block — rule stays forever.

---

## PROMPT RULES — EVERY PROMPT EVERY TIME

1. Job first. Why inside the job. Rules after. Test at end.
2. Verify the thing EXISTS before writing rules for it.
3. Query Supabase FIRST. Never ask Rod for data in the DB.
4. One prompt = one puzzle piece. State what piece + how it
   connects to the whole before writing anything.
5. Clean build ≠ working feature. Device test is the only proof.
6. Antigravity for anything visual or interactive. Always.
7. WWRS: "What would the walker need right now, one hand, winter coat?"
8. Surgical edits only. Read the full file first.

---

## PROJECT FILES — CANONICAL SET

| File                | Purpose                                          |
|---------------------|--------------------------------------------------|
| WIGGLE_PROJECT.md   | This file — master ops context                   |
| WIGGLE_PRINCIPLES.md| The why behind every decision                    |
| WIGGLE_WORKFLOW.md  | Three-tool workflow guide                        |
| CLAUDE.md           | Design constitution + code rules (Claude Code)   |
| NOTES_SPEC.md       | Notes system full spec (build reference)         |

DELETE anything not in this list.

---

## NEXT: WIGGLE WORLD PHASE 1 SCAFFOLD

New repo: `wiggle-world/` — same Supabase project (`ifhniwjdrsswgemmqddn`).
Claude Code prompt for the scaffold exists in Wiggle Ops folder.
The Neighbourhood HQ builds inside this scaffold.
Tower Control stays in wiggle-v4 — live, do not regress.

---

## LONG-TERM — DO NOT BUILD DURING APP SESSIONS

- Mini Gen drafts cleanup: auto-reject past-date pending rows (cron or on-run)
- schedule-verify cron error: investigate and fix
- Supabase trigger: auto-populate acuity_name_map on new dog insert
- Map Health panel in Tower /tower/schedule
- 9 AM check: propose new map entries from unresolved bookings
- Gmail Action Queue in Tower
- TELUS SMS inbox in Tower (webhook → Supabase → Tower messages panel)
- Beast actions: wire "Do it" to real Supabase writes (owl note, not walking)
- Billing tab: placeholder until billing table exists in Supabase
- Promote step UI: push approved mini_gen_drafts → walk_groups in bulk
- Acuity Notes (Phase 2): blue bg cards from owner bookings in the walker app
- Goals and Check for Friends: deferred until one month of real walk data
