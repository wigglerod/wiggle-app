# WIGGLE PROJECT — Master Context
## Read this before touching ANYTHING. Every tool. Every session.
### Read WIGGLE_PRINCIPLES.md before making any architectural decision.
## Last updated: April 2, 2026 — end of session

---

## THE BUSINESS
- Wiggle Dog Walks — Montréal, QC
- Owner: Rodrigo (Rod) — Chief Pup role in the app
- Co-admin: Gen (Geneviève) — daily Tower Control user
- ~95 active dogs, ~7 walkers
- Two sectors: Plateau and Laurier
- Scheduling platform: Acuity Scheduling (NOT Google Calendar)

---

## THE PICTURE ON THE BOX
A walker stands at a door in winter, one hand free.
The dog profile is the complete action centre — one screen,
everything needed to manage a dog's entire day.
Every prompt is one puzzle piece. State what piece you are
placing and how it connects to the whole before writing code.

---

## THE THREE TOOLS
- Claude Chat: strategy, Supabase/Vercel MCP queries, prompt writing
- Antigravity: ALL visual fixes, interactive behaviour, anything
  that requires seeing and tapping to verify. Opens browser,
  takes screenshots, iterates visually.
- Claude Code: architecture, multi-file restructuring, non-visual work

### TOOL RULE — NON NEGOTIABLE
Any fix involving user interaction (tapping, state changes,
drawer open/close, card state updates) goes to Antigravity.
Claude Code edits blind. Vercel logs only show server errors —
a clean build does NOT mean the feature works on device.
Never claim something works without device verification.

---

## INFRASTRUCTURE
- App: wiggle-app-dusky.vercel.app (React PWA, Vite, Tailwind,
  Framer Motion, @dnd-kit, Supabase realtime, Workbox PWA)
- App code: ~/Documents/wiggle-v4/
- Supabase project ID: ifhniwjdrsswgemmqddn
- Vercel project ID: prj_8xMbgRMgEXcF0DE44u70SOFeL8ma
- Team ID: team_UWOcgVnP9qC84S65WA0vSAbr
- Tower Control: ~/Documents/wiggle-app/apps-script/Code.js
- Clasp push: npx @google/clasp push from regular Terminal ONLY

---

## TEST CREDENTIALS
- test@wiggledogwalks.com / WiggleTest2026!
- Role: senior_walker, Sector: Plateau
- Created April 2 — confirmed exists in auth.users and profiles
- Use for ALL Antigravity automated testing
- Never appears in walker assignment dropdowns

---

## DATABASE — KEY TABLES

### dogs (95 rows)
dog_name, sector, owner_first, owner_last, email, phone,
address, door_code, notes, photo_url, breed, level,
ig_handle, contact_method, building_access, unit_number

### walk_groups
id, walk_date, group_num, group_name, dog_ids (uuid[]),
walker_ids (uuid[]), sector, locked, locked_by,
locked_by_name, dog_order (jsonb)
Query must return ALL rows where walk_date = today
and dog_ids is not empty. No other filters.
NOTE: useWalkGroups.js fixed April 2 — removed incorrect
isAdmin locked-group filter hiding groups from senior_walkers.

### walker_notes (ALL walk state lives here)
id, dog_id, dog_name, walker_id, walker_name,
note_type, message, walk_date, group_num, tags, created_at
note_type values:
  'pickup'      — dog has been picked up
  'returned'    — dog is back home
  'not_walking' — dog is not walking today
DO NOT use walk_logs for live walk state — it is empty.

### walk_logs (EMPTY — unused by app)
Do not write any walk state here.
Use walker_notes exclusively.

### acuity_name_map (fully cleaned April 2)
acuity_name = OWNER name from Acuity
dog_name = canonical DOG name from dogs table
acuity_email = owner email for disambiguation
Rules:
- Same-home pairs get two rows per booking name
  (e.g. Amber Rose → Romeo AND Amber Rose → Miyagi)
- Email disambiguates duplicate acuity_names
  (e.g. two Lunas, two Peppers, two Cleos, two Buddys)
- Never store descriptions as dog_name
- All entries verified clean as of April 2

### profiles (14 rows)
full_name, role, sector, email,
schedule (text "Mon, Tue, Wed" — parse with regex)

### HARD RULE: Before asking Rod ANY question about dogs, walkers, 
groups, or schedules — query Supabase first. If the answer is 
in the DB, answer it directly. Never ask Rod for data that 
exists in the database.
---

## COLOR SYSTEM — NO EXCEPTIONS
- Coral #E8634A — primary action, CTAs, lock slider
- Purple #534AB7 — dog name links, walker names on headers
- Sage #2D8F6F — picked up state, positive, done
- Amber #C4851C — not_walking state, warnings, attention
- Slate #475569 — door codes, addresses
- Fuschia #961e78 — dog name ONLY when dogs.notes has content
- NO BLUE anywhere in the app. Ever.
- Background: Peach #FFF5F0
- Cards: Cream #FAF7F4 (never pure white)
- Borders: #E8E4E0 (warm gray, never cold gray)

---

## DOG CARD — ALWAYS SHOW (non negotiable)
Mini card must ALWAYS show regardless of layout mode
including isCompact (interlock) mode:
1. Dog name — purple tappable link → opens DogProfileDrawer
   If dogs.notes has content → name color = fuschia #961e78
2. Address — street number + street name only, no postal code
3. Door code — slate pill if exists
4. Difficulty dot — sage = easy, amber = needs attention
isCompact may reduce padding/font size ONLY.
NEVER removes name, address, or door code. Ever.

Card states:
- Waiting: cream bg, purple name
- Picked up: sage bg #E8F5EF, name struck through, pickup time
- Back home: sand bg #F0ECE8, opacity 0.55, both times shown
- Not walking: amber bg #FDF3E3, amber border, name struck
  through in amber, "Not walking" badge

---

## DOG PROFILE DRAWER — ACTION CENTRE
CLOSE drawer after: Picked Up, Back Home, Not Walking, any Undo
NEVER CLOSE after: door code reveal, edit times, info taps
WHY: Status actions = done with this dog, move on.
Door code = still needed to enter the building.

NOT WALKING:
- Writes walker_notes note_type='not_walking'
- Card stays visible in amber state — does NOT disappear
- Undo deletes the row, resets card, closes drawer

INFORMATION SECTIONS:
1. Walk Times — pickup/return times, duration, edit buttons
2. Forever Notes — dogs.notes, amber bg, permanent
3. Owl Notes — owl_notes table, walker-to-walker
4. Acuity notes — not yet built

---

## WHAT WAS BUILT — APRIL 2, 2026
1. Not Walking button — built, writes to walker_notes,
   card stays visible in amber with strikethrough
2. Done groups expandable — tap to expand, all dogs shown
   in final state, names tappable → profile with undo
3. useWalkGroups query fixed — all walkers see all groups
4. acuity_name_map fully cleaned — zero broken entries
5. Test user created — test@wiggledogwalks.com / WiggleTest2026!

---

## CURRENT BUGS — START NEXT SESSION HERE
All go to Antigravity. Use test@wiggledogwalks.com.
Run test_all_actions.txt.

BUG 1 — Undo pickup state not updating live
usePickups.js undoPickup() deletes DB row but does not
update local React state. Reopen profile still shows
picked up. Fix: refresh local state after DB delete.

BUG 2 — Back home drawer not auto-closing
DogProfileDrawer.jsx markBackHome() not calling onClose()
after success. Fix: call onClose() after await resolves.

BUG 3 — Not Walking unverified
Cannot confirm until bugs 1 and 2 are fixed.
Test last after 1 and 2 confirmed working.

BUG 4 — Interlock cards broken
DogCard.jsx isCompact mode strips name, address, door code.
Swipe gesture broken in interlock layout.
Fix: isCompact reduces size only, never removes content.
Re-attach swipe handler for interlock layout.

---

## PROMPT RULES — EVERY PROMPT EVERY TIME
1. Job first. Why inside the job. Rules after. Test at end.
2. Verify the thing EXISTS before writing rules for it.
3. Query Supabase FIRST. Never ask Rod for data in the DB.
4. One prompt = one puzzle piece. State what piece + how it
   connects to the whole before writing anything.
5. Clean build ≠ working feature. Device test is the only proof.
6. Antigravity for anything visual or interactive. Always.
7. WWRS filter: "What would the walker need right now,
   one hand, winter coat?" Every decision goes through this.
8. Surgical edits only. Read the full file first.
   Do not restructure. Do not reformat. Find the spot, done.

---

## FILES IN PROJECT ROOT — KEEP OR DELETE
KEEP:
- WIGGLE_PROJECT.md — this file, single source of truth
- DESIGN_RULES.md — color/component rules for Claude Code
- WIGGLE_WORKFLOW.md — three-tool workflow guide

DELETE (no longer needed):
- wiggle_back_home_spec.html — implemented, covered here
- Wiggle_V4_Bible_FINAL.html — retired, replaced by this file

---

## LONG-TERM — TOWER CONTROL ONLY
Do not build any of these during app sessions.
- Supabase trigger: auto-populate acuity_name_map on new
  dog insert using owner_first + email from dogs table
- Map Health panel in Tower Control
- 9 AM Monday trigger: re-register after clasp push
- 9 AM check: propose map entries from unresolved bookings
- Admin dashboard: 9 AM trigger health status
- Gmail Action Queue
- Tower rebuild: single scrollable page
