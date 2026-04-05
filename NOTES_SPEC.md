# NOTES SPEC — Wiggle Notes System
## Build reference. Read before touching anything notes-related.
## Last updated: April 5, 2026 — color ruling finalized (see CLAUDE.md)
## Replaces the earlier version. This is the single source of truth.

---

## THE BIG PICTURE

Four note types. Four lifetimes. One rule:
the right note at the right time is the only note that helps.
Noise at a door with six dogs is dangerous.

---

## THE FOUR NOTE TYPES

### 1. ★ Forever Notes
**Where:** `dogs.notes` column — existing, no new table needed
**Written by:** Rod or Gen only (chief_pup role)
**Audience:** All walkers who walk this dog
**Lifetime:** Never expires
**Content:** Standing truth — allergies, aggression, building quirks, leash rules.
  Anything the walker needs to know every single time without exception.
**Signal on card:** Dog name turns **purple `#534AB7`**
  - Default name color is black `#2D2926`
  - Purple fires when `dogs.notes` is not null AND not empty string
  - This is the ONLY trigger for purple on a dog name. No exceptions.
  - Purple = "this dog has a forever note — tap to see it" (the signal)
**In expand:** Shows with ★ icon, **fuschia bg `#fdf4fb`**, fuschia border `#e8d0e3`
  No "Got it" button — forever notes are never dismissed
  Fuschia = "this IS the forever note content" (the content color)
**In drawer:** ★ Forever section, fuschia bg `#fdf4fb`, always at top of notes hierarchy
  Only shows if `dogs.notes` is not null/empty
**Edit:** Admin only (chief_pup role).
  Edit button appears in drawer for admins.
  Walkers see read-only with "admin-only" label underneath.
  Saves directly to `dogs.notes` via PATCH on dogs table.
  Drawer stays open after save — this is an info action, not a status action.

### 2. 🦉 Owl Notes
**Where:** `owl_notes` table — existing, schema confirmed good
**Written by:** Rod, Gen, or any walker
**Audience:** Walkers in the same sector (hard filter on `target_sector`)
**Lifetime:** Set by author at write time. Default: 3 days. Stored in `expires_at`.
**Content:** Timed operational context — "dog at sister's this week",
  "door code changed", "paw injury", "owner asked for short walk"
**Signal on card:** Animated 🦉 walks left-to-right on the NAME LINE
  - Owl lives in `.name-line` flex row, fills space right of the dog name
  - Uses `owl-track` div with CSS animation `owl-line`
  - If dog ALSO has a forever note: ★ icon appears between name and owl track
  - Group header shows 🦉 N badge (count of unread owl notes in that group)
**In expand:** Shows with 🦉 icon, amber bg `#FFFBF0`, amber border `#F0C76E`
  "Got it" button → marks `acknowledged_by` + `acknowledged_at` on that row
  Owl disappears from card for THIS walker only. Others still see it.
  Forever note block stacks first, then owl block below.
**In drawer:** 🦉 Owl Notes section, amber bg, shows all active notes for this dog
  Each note: text + author + time ago + expires countdown
**Sector filter:** HARD RULE — query must include `AND target_sector = walker_sector`
  Never show owl notes across sectors.
**Schema:**
  `id, note_text, target_type, target_dog_id, target_dog_name, target_sector,
   created_by, created_by_name, acknowledged_by, acknowledged_by_name,
   acknowledged_at, note_date, expires_at, created_at, scheduled_date,
   last_acknowledged_date`

### 3. 📅 Acuity Notes
**Where:** `acuity_notes` table — DOES NOT EXIST YET (Phase 2)
**Written by:** Dog owners via Acuity booking form
**Audience:** Rod, Gen, and walkers walking that dog
**Lifetime:** Expires on booking date (today only)
**Content:** Immediate owner instructions — "she didn't eat", "use side door"
**Signal on card:** Same 🦉 animated owl (shared signal for "there's a note")
**In expand:** Shows with 📅 icon, blue bg `#EFF6FF`, blue border `#BFDBFE`
  Blue = owner/external source. Visually distinct from staff notes.
**In drawer:** 📅 From Owner section, blue bg, below owl notes
**Phase 2 — skip for now.** Do not build until acuity_notes table exists.

### 4. 📝 Activity Notes
**Where:** `walker_notes` table, `note_type = 'note'`
**Written by:** Walkers after the walk via the note composer
**Audience:** All walkers who walk this dog + Gen + Rod
**Lifetime:** Permanent — this is the historical record
**Content:** What actually happened — observations, energy, reactions
**Signal on card:** None — no card signal, this is history not pre-walk context
**In expand:** NOT shown — expand is pre-walk context only
**In drawer:** 📝 Activity section, neutral bg, at the BOTTOM of notes hierarchy
  Shows last 5–10 entries, most recent first
  Each: note text + walker name + date

---

## THE NOTE COMPOSER

Opens as a bottom sheet when walker taps ✎ Note in the inline expand.
This is the ONLY place walkers write notes.

### Layout
```
[Handle]
Title: "✎ Note about [Dog Name]"

QUICK PICKS:
[ Great walk 🐾 ]  [ Tired today ]  [ Reactive ]
[ Paw bothering ]  [ Extra energy ]  [ 🚩 Flag — ask me later ]

[Free text area — optional]

[divider]

[ Warn next walker toggle ]
  "Becomes an owl note — visible on card for 3 days"

[Send note]  ← coral button
```

### Warn next walker toggle
When ON → writes TWO rows simultaneously:
1. `walker_notes` row with note_type='note' (permanent activity)
2. `owl_notes` row with expires_at = now() + 3 days (timed warning)

### Flag chip
`tags = ['flag']` on the walker_notes row.
Tower queries `WHERE tags @> ARRAY['flag']` for the flag dashboard.
Zero schema change — tags array already exists.

---

## THE DRAWER — FINAL SECTION ORDER

```
┌─────────────────────────────────┐
│  [Handle]                       │
│  [Avatar] Name  Breed · Sector  │
│  [Group badge]                  │
├─────────────────────────────────┤
│  ACTIONS                        │
│  [✓ Mark as Picked Up]         │
│  [Not walking today]            │
├─────────────────────────────────┤
│  Address · Door code            │
├─────────────────────────────────┤
│  ★ Forever  [fuschia bg]        │  ← only if dogs.notes not null
│  [note text]                    │
│  [Edit] for admin · read-only for walkers
├─────────────────────────────────┤
│  🦉 Owl Notes  [amber bg]       │  ← only if active owl notes exist
│  [note] [author] [expires]      │
├─────────────────────────────────┤
│  📅 From Owner  [blue bg]       │  ← Phase 2, skip for now
├─────────────────────────────────┤
│  📝 Activity                    │  ← only if walker_notes notes exist
│  [note] [walker] [date]         │
└─────────────────────────────────┘
```

Section visibility:
- Forever: show only if `dogs.notes` not null/empty
- Owl: show only if active + unexpired owl notes exist for this dog + sector
- Acuity: Phase 2 — skip
- Activity: show only if walker_notes with note_type='note' exist for this dog
- If no notes at all: "No notes for this dog." in muted text

---

## INLINE EXPAND — FINAL DESIGN

Triggered by tapping caret ▼ on a dog card. No screen change.

### What shows
Forever note (if exists) → fuschia bg `#fdf4fb`, ★ icon, NO Got it button
Owl note (if active + unread) → amber bg `#FFFBF0`, 🦉 icon, Got it button
Multiple types stack: forever first, then owl, then acuity

### Buttons (always at bottom)
- "✓ Got it" — only if owl or acuity note exists to acknowledge
- "✎ Note" — always. Opens note composer.

### What is NOT in the expand
- Pickup button — removed. Lives in swipe and drawer only.
- Not walking — removed. Drawer only.

---

## COLOR ASSIGNMENTS — NOTES SYSTEM

| Color          | Hex       | Job in notes                                      |
|----------------|-----------|---------------------------------------------------|
| Purple         | `#534AB7` | Dog name when forever note exists (the SIGNAL)    |
| Fuschia        | `#961e78` | Forever note labels, editor, section text          |
| Fuschia bg     | `#fdf4fb` | Forever note section backgrounds + expand block    |
| Fuschia border | `#e8d0e3` | Forever note section borders                       |
| Amber          | `#C4851C` | Owl note text, section labels                      |
| Amber bg       | `#FFFBF0` | Owl note section backgrounds                       |
| Amber border   | `#F0C76E` | Owl note borders                                   |
| Blue           | `#3B82F6` | Acuity note labels (owner/external signal)         |
| Blue bg        | `#EFF6FF` | Acuity note sections                               |
| Blue border    | `#BFDBFE` | Acuity note borders                                |
| Slate          | `#475569` | Activity note labels                               |
| Coral          | `#E8634A` | Send button in composer — primary action           |

**The purple/fuschia rule in one sentence:**
Purple on the name = "there's a note." Fuschia on the section = "here it is."

Blue is explicitly allowed: it signals "this came from outside" (owner via Acuity).

---

## BUILD ORDER

### Claude Code (logic + wiring):
1. ✅ Wire note composer → walker_notes note_type='note' + tags
2. ✅ Wire warn next walker → owl_notes dual-write
3. ✅ Wire flag chip → tags=['flag']
4. ✅ Wire Got it → acknowledged_by on owl_notes
5. ✅ useOwlNotes hook — by dog + sector + not expired
6. Activity notes hook — walker_notes by dog + note_type='note'
7. Forever note edit → PATCH dogs.notes (role-gated: chief_pup only)
8. Flag dashboard data → walker_notes WHERE tags @> '{flag}'

### Antigravity (visual + interactive):
1. ✅ Animated owl on name line
2. ✅ Inline expand — Got it + ✎ Note only
3. ✅ Note composer bottom sheet
4. ✅ Drawer owl notes section
5. ✅ Group header 🦉 badge
6. Forever note Edit button in drawer (role-gated)
7. Forever note editor sheet (fuschia themed, admin only)
8. Activity notes section in drawer

### Already verified working:
- ✅ Purple dog names (dogs.notes signal)
- ✅ owl_notes sector + expiry data
- ✅ walker_notes fully operational
- ✅ NoteComposer shipped
- ✅ Warn next walker dual-write shipped

---

## SESSION TRIGGER

When someone says "let's build notes" or "owl notes" or "note composer":
1. Read this file first
2. Check: `SELECT COUNT(*) FROM owl_notes WHERE expires_at > now()`
3. Confirm purple is live on dog names in DogCard.jsx
4. Then build — in the order above
