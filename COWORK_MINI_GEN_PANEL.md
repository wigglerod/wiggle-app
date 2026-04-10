# COWORK TASK — Mini Gen Review Panel
# Tower Control V4 — First Screen
# Written April 5, 2026

---

## WHAT YOU ARE BUILDING

One React page. The Mini Gen Review Panel.
This is the first real screen of Tower Control.
Gen opens this every Monday morning to see what Mini Gen found
and approve or reject the draft walk schedule.

File to create: src/pages/TowerMiniGen.jsx
Route: /tower/mini-gen (add to the existing router)
Deploy to Vercel when done.

---

## THE FOUR THINGS ON THIS SCREEN (top to bottom)

### 1. HEADER BAR
Full width. Dark background (#2D2926). Height 56px.
Left: 🐾 "Tower Control" in coral (#E8634A), 16px bold, DM Sans
Right: Beast orange button — "🦍 Run Mini Gen" (#E8762B)

When "Run Mini Gen" is clicked:
- POST to https://wiggle-app-dusky.vercel.app/api/mini-gen
- Show a loading spinner on the button while it runs
- When it returns, refresh the draft table and flag list below
- Show the JSON summary in a small status bar under the header:
  "Last run: April 5 · 114 resolved · 0 unresolved · 1 conflict · 2 vacation conflicts"

---

### 2. STATUS BAR (under header)
Single row. Cream background (#FAF7F4). Border bottom 1px #E8E4E0.
Shows stats from the most recent mini_gen_drafts run_date.
Query: SELECT run_date, COUNT(*) as drafts FROM mini_gen_drafts
       WHERE status = 'pending' GROUP BY run_date ORDER BY run_date DESC LIMIT 1

Display: "Last run: [run_date] · [N] draft days pending"

If no drafts exist yet, show: "Mini Gen hasn't run yet. Press Run Mini Gen to start."

---

### 3. DRAFT TABLE — "This Week's Draft"
Section label: "📋 MINI GEN DRAFT" in 10px uppercase coral (#E8634A)

One card per mini_gen_drafts row.
Query: SELECT walk_date, sector, dog_names, dog_uuids, flags, status
       FROM mini_gen_drafts
       WHERE status = 'pending'
       ORDER BY walk_date, sector

Each card layout:
┌─────────────────────────────────────────────────────┐
│ Mon Mar 30 · LAURIER              [Approve] [Reject] │
│                                                      │
│ Lou Bouvier · Pluto · Sirius · Enzo OG · Pepper     │
│ Husky · Winston · Indie Lab · Claude · Maya · Alba  │
│ Luna GS · Pepper Mini Aussie · Rosie · Cheesy       │
│ Pebbles                               15 dogs       │
│                                                      │
│ ⚠ 0 flags for this day                              │
└─────────────────────────────────────────────────────┘

Card styling:
- Background: #FAF7F4
- Border: 1px solid #E8E4E0
- Border bottom: 2.5px solid #D5CFC8 (clay shadow)
- Border radius: 10px
- Padding: 14px 16px

Header row:
- Date + sector: 13px bold, color depends on sector:
  Plateau → #3B82A0, Laurier → #4A9E6F
- Approve button: sage green (#2D8F6F), white text, 10px bold
- Reject button: amber (#C4851C), white text, 10px bold

Dog names: render as dog chip pills (see component below)
Dog chip pill: padding 2px 8px, border-radius 10px, font-size 10px, 
  bg #F0F2F5, border 1px #E2E6EA, text #534AB7

Dog count: bottom right, 11px, text #9AA3AE

Flag indicator:
- If flags array is empty: "✓ No flags for this day" — sage (#2D8F6F), 11px
- If flags exist: "⚠ N flag(s) — see below" — amber (#C4851C), 11px, bold

Approve action: PATCH mini_gen_drafts SET status = 'approved' WHERE id = [row.id]
Reject action: PATCH mini_gen_drafts SET status = 'rejected' WHERE id = [row.id]
Both: refresh the list after response, show toast "Approved" or "Rejected"

Layout: 2-column grid on desktop (one Plateau, one Laurier per day side by side)
Use grid-template-columns: 1fr 1fr with gap 12px

---

### 4. FLAG LIST — "What Mini Gen Flagged"
Section label: "🚩 FLAGS" in 10px uppercase coral

Query: SELECT dog_name, message, walk_date, tags, created_at
       FROM walker_notes
       WHERE note_type = 'resolver_flag'
         AND walk_date >= (SELECT MIN(walk_date) FROM mini_gen_drafts WHERE status = 'pending')
       ORDER BY walk_date, tags

Each flag renders as a Problem Card:
- Conflict flag (tags contains 'conflict'): LEFT BORDER coral #E8634A, bg #FAECE7
- Vacation flag (tags contains 'vacation'): LEFT BORDER amber #C4851C, bg #FDF3E3
- Capacity flag (tags contains 'capacity'): LEFT BORDER purple #534AB7, bg #EEEDFE
- Unresolved flag (tags contains 'unresolved'): LEFT BORDER slate #475569, bg #F0F2F5

Card content:
- Top: dog_name (13px bold, purple #534AB7) + date (11px muted, right-aligned)
- Bottom: message text (12px, DM Mono, text #5A6270)

If no flags: "✓ Mini Gen found no issues this week." in sage, centered, italic.

---

## DATA CONNECTIONS

Use the existing Supabase client at src/lib/supabase.js for reads.
Use the admin client at api/lib/supabase-admin.js via an API route for writes
(status updates need service role — create api/tower-approve.js if needed).

Tables:
- mini_gen_drafts: READ (dog_names, flags, status, walk_date, sector)
- walker_notes: READ (note_type = 'resolver_flag')
- Mini Gen trigger: POST /api/mini-gen (existing endpoint)

---

## AUTH

This page is admin-only.
Check Supabase auth: user must have role = 'admin' in profiles table.
If not admin, redirect to the walker app login.
Rod's UUID: 1c9bb8cf-e7c5-437a-babf-b83469115567 (admin, sector: both)
Gen's UUID: db94d31c-90b7-410e-9ce1-e8f79a752925 (admin, sector: both)

---

## DESIGN SYSTEM — NON-NEGOTIABLE

Font: DM Sans — already in the codebase
Background: #FFF5F0 (peach) — never white
Cards: #FAF7F4 (cream)
Borders: #E8E4E0 (warm gray) — never cold gray
Primary action: coral #E8634A
Beast: orange #E8762B — only on the Run Mini Gen button
Plateau: #3B82A0
Laurier: #4A9E6F
Sage: #2D8F6F (positive, approved)
Amber: #C4851C (warning, attention)
Purple: #534AB7 (dog names)

NO BLUE anywhere except Plateau sector color.
NO cold grays (gray-100, slate-100, etc.)
NO pure white backgrounds.

Read CLAUDE.md before writing any JSX.

---

## WHAT NOT TO BUILD

Do NOT build:
- The full Tower Control (tabs, weekly board, billing, staff)
- Walker assignment UI
- The promote step (pushing approved drafts to walk_groups)
- Any scheduling features

Build ONLY this one page. When it works, stop.

---

## TEST

After building and deploying:
1. Open https://wiggle-app-dusky.vercel.app/tower/mini-gen
2. Confirm you see 8 draft cards (Mon–Thu, both sectors)
3. Confirm you see 3 flags (1 conflict, 2 vacation conflicts)
4. Click "Run Mini Gen" — confirm it hits the API and shows new results
5. Click Approve on one card — confirm status changes in Supabase
6. Take a screenshot and report back

Success = Gen can open this page, see what Mini Gen found,
and approve or reject each day's draft with one click.

Work smart, play always. 🐾
