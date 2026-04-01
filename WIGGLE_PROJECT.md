# WIGGLE DOG WALKS — PROJECT CONTEXT
## For Antigravity, Claude Code, and Claude Chat
## Last updated: April 1, 2026

---

## BROWSER TESTING — MANDATORY
- Dev server URL: http://localhost:5173
- ALWAYS run "npm run dev" first, then open http://localhost:5173 in the browser
- NEVER open local HTML files in the browser for verification
- NEVER open .html files from the project folder in the browser
- NEVER use file:// URLs — always use http://localhost:5173
- The ONLY valid browser URLs are: http://localhost:5173 (dev) and https://wiggle-app-dusky.vercel.app (production)
- If you see a file:// URL or a .html file in the browser address bar, STOP — you are doing it wrong
- Dev mode auto-login is enabled — localhost:5173 logs in as Rod automatically

---

## WHAT IS WIGGLE?

Wiggle Dog Walks is a dog walking company in Montréal, Canada.
~7 walkers, ~95 active dogs, two sectors (Plateau + Laurier).
Owner: Rodrigo (Rod). Co-admin: Gen.

The business runs on three connected tools:
1. **Wiggle App** — React PWA for walkers (this codebase)
2. **Tower Control** — Google Sheets + Apps Script admin dashboard
3. **Supabase** — the shared brain (database) for both

---

## DESIGN REFERENCES

- **DESIGN_RULES.md** — the design spec (colors, card rules, walker buttons, absolute rules). Read this before editing any UI component.
- **BACK_HOME_SPEC.md** — the Back Home swipe feature spec (pickup → back home → profile undo)
- There is NO HTML design file. Do NOT look for or open any .html design files.

---

## THE THREE AI TOOLS AND THEIR ROLES

### Google Antigravity (PRIMARY for UI work)
- Opens the codebase, edits files, runs the app, opens browser, verifies visually
- USE FOR: all visual/UI changes, component fixes, color changes, layout matching
- STRENGTH: can SEE the rendered app and compare to the design spec
- MODEL: use Claude Sonnet 4.6 or Gemini 3 Pro
- VERIFY AT: http://localhost:5173 (NEVER local HTML files)

### Claude Code (for heavy lifts)
- Terminal-based, reads entire codebase, makes architectural changes
- USE FOR: big refactors, database migrations, multi-file restructuring, Tower Control (Apps Script)
- STRENGTH: 1M token context, deep reasoning across many files
- Run from: `~/Documents/wiggle-v4` in Terminal

### Claude Chat (for strategy and data)
- Connected to Supabase MCP and Vercel MCP
- USE FOR: database queries, deployment checks, planning, writing specs
- STRENGTH: can query live data, check deployments, write documentation
- Supabase project ID: `ifhniwjdrsswgemmqddn`
- Vercel project ID: `prj_8xMbgRMgEXcF0DE44u70SOFeL8ma`
- Vercel team ID: `team_UWOcgVnP9qC84S65WA0vSAbr`

### WORKFLOW
1. **Plan** with Claude Chat (agree on what, query data, write specs)
2. **Build** with Antigravity (precise UI, visual verification at localhost:5173)
3. **Heavy lift** with Claude Code (architecture, Tower, migrations)
4. **Verify** with Claude Chat (check Vercel deploy, Supabase data)

---

## THE APP — TECHNICAL OVERVIEW

| Item | Detail |
|------|--------|
| Framework | React + Vite |
| Hosting | Vercel (auto-deploys from GitHub main) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Local path | ~/Documents/wiggle-v4 |
| Live URL | wiggle-app-dusky.vercel.app |
| Dev URL | http://localhost:5173 |

### Key Components
- **DogCard.jsx** — the dog card with swipe states
- **GroupOrganizer.jsx** — groups, walker buttons, lock/unlock, interlock
- **DogProfileDrawer.jsx** — full dog profile overlay
- **WeeklyView.jsx** — week view with day cards
- **Header.jsx** — app header with avatar, role badge
- **Login.jsx** — login page (auto-login in dev mode)

### Supabase Tables
- `dogs` (95 rows) — dog_name, address, sector, door_code, notes, photo_url, level
- `profiles` (14 rows) — full_name, role, sector, email, schedule
- `walk_groups` (177 rows) — group_name, sector, walk_date, dog_ids (text[]), walker_ids, locked_by
- `acuity_name_map` (40 rows) — maps Acuity booking names to dog names
- `expected_schedule` (84 rows) — expected days per dog
- `owl_notes` — temporary notes (daily/weekly)
- `walker_notes` — walker-created notes

### Roles
| Role | Who | App access |
|------|-----|------------|
| Chief Pup (admin) | Rod, Gen | Everything, both sectors |
| Wiggle Pro (senior_walker) | Chloe, Megan, Solene (Plateau); Amanda, Amelie, Belen, Maeva (Laurier) | Own sector, full walk features |
| Pup Walker (junior_walker) | Future hires | Read-only, follow group lead |

### Walker-Sector Map
- **Plateau:** Chloe (Mon,Tue,Fri), Megan (Mon,Thu), Solene (Tue,Wed,Thu)
- **Laurier:** Amanda (Mon,Tue,Wed,Thu), Amelie (Tue,Wed), Belen (Mon,Thu,Fri), Maeva (Fri)
- **Both:** Rodrigo (Wed Plateau, Fri Plateau)

---

## ROD'S RULES

1. **Occam's razor** — simplest solution that works
2. **Data first, design second, test before promise**
3. **One brain, two faces** — app and Tower share Supabase, never duplicate
4. **The walker at the door** — every screen works one-handed in the rain
5. **Match DESIGN_RULES.md** — that is the design truth
6. **No broken telephone** — if the spec says X, build X
7. **Verify at localhost:5173** — never open local HTML files
8. **Work smart, play always** 🐾
