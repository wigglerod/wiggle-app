# WIGGLE PROJECT — Master Context
## Read this before touching ANYTHING. Every tool. Every session.
## Last updated: April 2, 2026

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
- Use this for all Antigravity automated testing
- Never appears in walker assignment dropdowns

---

## DATABASE — KEY TABLES

### dogs (95 rows)
dog_name, sector, owner_first, owner_last, email, phone,
address, door_code, notes, photo_url, breed, level,
ig_handle, contact_method, building_access, unit_number

### walk_groups
id, walk_date, group_num, group_name, dog_ids (text[]),
walker_ids (uuid[]), sector, locked, locked_by,
locked_by_name, dog_order (jsonb)
NOTE: dog_ids stores dog names as text[], not UUIDs.
Query must return ALL rows where walk_date = today
and dog_ids is not empty. No other filters.

### walker_notes (pickup state lives here, NOT walk_logs)
id, dog_id, dog_name, walker_id, walker_name,
note_type, message, walk_date, group_num, tags, created_at
note_type values: 'pickup', 'returned', 'not_walking'

### walk_logs (currently EMPTY — unused by app)
Do not write pickup/return/not_walking state here.
Use walker_notes exclusively.

### acuity_name_map
acuity_name (owner name from Acuity), dog_name (canonical
dog name from dogs table), acuity_email (owner email for
disambiguation). Multiple rows per acuity_name for
same-home pairs (e.g. Amber Rose → Romeo AND Miyagi).

### profiles (14 rows)
full_name, role, sector, email, schedule (text string
e.g. "Mon, Tue, Wed" — parse with regex, no boolean columns)

### owl_notes, group_links, expected_schedule, dogs_audit

---

## COLOR SYSTEM — NO EXCEPTIONS
- Coral #E8634A — primary action, CTAs, lock slider
- Purple #534AB7 — dog name links, walker names on headers
- Sage #2D8F6F — picked up state, positive, done
- Amber #C4851C — not_walking state, warnings, attention
- Slate #475569 — door codes, addresses
- Fuschia #961e78 — dog name color when dogs.notes has content
- NO BLUE anywhere in the app. Ever.
- Background: Peach #FFF5F0
- Cards: Cream #FAF7F4 (never pure white)
- Borders: #E8E4E0 (warm gray, never cold gray)

---

## DOG CARD — ALWAYS SHOW (non negotiable)
Mini card must ALWAYS show regardless of layout mode:
1. Dog name — purple tappable link → opens DogProfileDrawer
   If dogs.notes has content → name color = fuschia #961e78
2. Address — street number + street name only, no postal code
3. Door code — slate pill (#475569 bg, white text) if exists
4. Difficulty dot — sage = easy, amber = needs attention
isCompact may reduce padding/font size for interlock layout
but NEVER removes name, address, or door code.

---

## DOG PROFILE DRAWER — ACTION CENTRE
The profile is the action centre. It contains:

ACTIONS (in order):
1. Mark as Picked Up → onClose() after success
2. Mark as Back Home → onClose() after success
3. Not Walking today → onClose() after success
4. Undo (contextual — shows based on current state)

DRAWER CLOSE RULES:
CLOSE after: Picked Up, Back Home, Not Walking, Undo actions
NEVER CLOSE after: door code reveal, edit times, any info tap
WHY: Status actions transition the walker to the next dog.
Door code reveal is an information lookup mid-task.

NOT WALKING STATE:
- Writes to walker_notes: note_type = 'not_walking'
- Card stays visible in group — does NOT disappear
- Card renders: amber bg (#FDF3E3), amber border (#F0C76E),
  name crossed out in amber (#C4851C), "Not walking" badge
- Undo: deletes walker_notes row, resets card to default
- If already not_walking: show undo button, not the action

INFORMATION SECTIONS:
- Forever Notes (dogs.notes) — permanent standing instructions
- Owl Notes (owl_notes table) — walker-to-walker, temporary
- Acuity notes — TBD next session

---

## GROUP RULES
- Walker name ALWAYS visible on every group header — purple, bold
- Two walker slots per group — tappable buttons with picker
- Active group: coral solid border + cream bg
- Done group: collapsed, tappable to expand
- Done group expanded: shows all dogs in final state
  Sage ✓ = returned home, Amber ✗ = not walking,
  Sage ✓ strikethrough = picked up only
  Each dog name is tappable purple link → opens profile with undo
- Interlock groups: side-by-side, purple sync bar between them

---

## WALKER ROSTER
PLATEAU: Chloe (Mon/Tue/Fri), Megan (Mon/Thu), Solene (Tue/Wed/Thu)
LAURIER: Amanda (Mon-Thu), Amelie (Tue/Wed), Belen (Mon/Thu/Fri),
         Maeva (Fri)
BOTH: Rodrigo (Wed Plateau, Fri Plateau)

---

## CURRENT BUGS (as of April 2, 2026)
1. App shows "No walks today" even when groups exist in DB
   → walk_groups query filtering incorrectly (fix_todays_groups.txt ready)
2. Undo pickup: state not updating live after undo
   → local React state not refreshed after DB delete
3. Back home: drawer not closing automatically after action
4. Not Walking button: exists but unverified due to bugs 2 and 3
5. Interlock cards: missing name/address/door code in compact mode,
   swipe broken in interlock layout
All bugs 2-5: use Antigravity (test_all_actions.txt ready)

---

## PROMPT RULES — READ BEFORE WRITING ANY PROMPT
1. Job first. Why inside the job. Rules after. Test at end.
2. Verify the thing EXISTS before writing behaviour rules for it.
3. Query Supabase FIRST. Never ask Rod for data that's in the DB.
4. One prompt = one puzzle piece. State what piece before writing.
5. Clean build ≠ working feature. Only device test confirms it works.
6. Antigravity for anything visual or interactive. Always.
7. "What would the walker need right now, one hand, winter coat?"
   Apply this filter to every single decision.
8. Surgical edits only. Read the full file before touching it.
   Do not restructure. Do not reformat. Find the spot, insert, done.

---

## WHAT IS NOT THE BIBLE ANYMORE
Wiggle_V4_Bible_FINAL.html was the visual design reference.
This WIGGLE_PROJECT.md is now the single source of truth.
DESIGN_RULES.md still valid for color/component rules.
wiggle_back_home_spec.html — can be deleted, covered here.

---

## LONG-TERM (do not build now — Tower Control)
- Supabase trigger: auto-populate acuity_name_map on new dog insert
- Map Health panel in Tower Control
- 9 AM check: propose new map entries from unresolved bookings
- Gmail Action Queue in Tower
- Tower rebuild: single scrollable page replacing tab structure
- Admin dashboard: 9 AM trigger health status
