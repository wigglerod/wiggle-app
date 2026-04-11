# TABLE AUDIT — April 10, 2026

Worker: Cowork (overnight session)
Brief: BRIEF_00_OVERNIGHT.md
Supabase project: `ifhniwjdrsswgemmqddn`

---

## EXECUTIVE SUMMARY

### Part A — Repo Cleanup

**Completed:**
- CREATED: `_archive/CLAUDE_WIGGLE_WORLD.md` (old CLAUDE.md content preserved)
- OVERWRITTEN: `CLAUDE.md` with placeholder (exact content from brief)

**Not completed (and why):**
- A.2 (archive root-level vision docs): Cowork's file tools cannot read files >10,000 tokens. All 7 root HTML files exceed this limit (13K–41K tokens each). The wiggle-v4 directory is not mounted in the bash sandbox, so shell commands cannot reach these files. WIGGLE_WORLD_SPEC.md also could not be copied for the same reason.
- A.3 (archive apps-script): `Code.js` is 66K tokens — too large to read/copy. Cannot delete `.clasp.json` without bash access.
- A.4 (delete fix_drawer_close.txt): No delete capability for unmounted directories.

**Action for Rod or Claude Code:** Run these commands in a terminal inside `~/Documents/wiggle-v4/`:
```bash
mkdir -p _archive
mv tower-app-vision-draft.html wiggle-vision-2026.html wiggle-product-vision.html wiggle_notes_complete.html wiggle_ecosystem_map.html wiggle-admin-preview.html Wiggle_Master_Gameplan.html WIGGLE_WORLD_SPEC.md _archive/
mv apps-script _archive/apps-script
rm _archive/apps-script/.clasp.json
rm fix_drawer_close.txt
```

**Files left alone (uncertainty — not in brief scope):**
- `create-hq-principles.txt` — stale task prompt (HQ_PRINCIPLES.md already exists). Safe to delete.
- `update-claude-md.txt` — stale task prompt. Safe to delete.
- `update-wiggle-project.txt` — stale task prompt. Safe to delete.
- `index.html` — Vite app entry point. Brief said "all HTML in root are vision docs" but this is the live app entry. Left it alone.

### Part B — Table Verdicts (one-line)

| # | Table | Rows | Verdict |
|---|-------|------|---------|
| 1 | expected_schedule | 84 | SAFE TO BUILD ON |
| 2 | dog_conflicts | 1 | SAFE TO BUILD ON |
| 3 | schedule_checks | 5 | UNCLEAR — NEEDS ROD'S INPUT |
| 4 | flag_cards | 35 | SAFE TO BUILD ON |
| 5 | beast_brain | 0 | DEAD TABLE — SAFE TO IGNORE (placeholder for Beast) |
| 6 | dogs_audit | 322 | SAFE TO BUILD ON |
| 7 | daily_notes | 0 | SAFE TO BUILD ON |
| 8 | match_log | 0 | UNCLEAR — NEEDS ROD'S INPUT |
| 9 | route_orders | 0 | SAFE TO BUILD ON |
| 10 | dog_vacations | 0 | DEAD TABLE — SAFE TO IGNORE (recently created placeholder) |
| 11 | acuity_notes | 1 | UNCLEAR — NEEDS ROD'S INPUT |

### Top 3 tables the Architect needs to decide on before Phase 2

1. **schedule_checks** — 5 rows of meaningful schedule-vs-roster comparison data, but NO writer and NO reader in the codebase. Something wrote these (edge function? manual?). If Phase 2 Weekly Board depends on schedule checking, the Architect needs to know what writes here and whether to reuse or replace.
2. **acuity_notes** — has a frontend reader (`useAcuityNotes.js`) but no writer in the codebase. 1 row looks like test data. If Phase 3 Briefing Agent will surface Acuity booking notes to walkers, who writes them?
3. **match_log** — has a writer in `Schedule.jsx` but 0 rows. Either the matching code never ran, or logs were cleared. Architect should confirm if this table is needed for Phase 2 reconciliation.

### Surprises

1. **flag_cards most recent row is a bank notification.** Scout categorized an Interac e-Transfer from RBC as "unknown" and filed it as a flag card. This isn't a bug (Scout correctly flagged it as unclassifiable) but the inbox is catching non-dog-related email. Worth noting for Scout tuning.
2. **dogs_audit is actively firing — 322 rows and growing.** Trigger-written via `dogs_audit_fn()` on every INSERT/UPDATE/DELETE on `dogs`. Most recent entry is from today (Pebbles, updated by Rod). No frontend reads this yet, but it's a clean audit trail waiting for a UI.
3. **expected_schedule has no writer in the codebase.** 84 rows exist and Mini Gen reads them, but nothing in `src/` or `api/` writes to this table. Data was likely loaded manually or via an external tool.

---

## DETAILED TABLE AUDITS

---

## 1. expected_schedule

**Row count:** 84

**Schema:**
- id: integer, NOT NULL
- dog_name: text, NOT NULL
- type: text, NOT NULL
- monday: boolean, nullable
- tuesday: boolean, nullable
- wednesday: boolean, nullable
- thursday: boolean, nullable
- friday: boolean, nullable
- ask_when: boolean, nullable
- contact_method: text, nullable
- contact_handle: text, nullable
- notes: text, nullable
- created_at: timestamp with time zone, nullable

**Writers (files that insert/update):**
- (none found in codebase)

**Readers (files that select):**
- api/mini-gen.js:169 — SELECT `.from('expected_schedule')` — reads schedule to compare against Acuity bookings

**Most recent row:**
```json
{"id":56,"dog_name":"Arlo","type":"must_ask","monday":false,"tuesday":false,"wednesday":false,"thursday":false,"friday":false,"ask_when":true,"contact_method":"ig","contact_handle":"Arlos wiggle adventures","notes":null,"created_at":"2026-03-23 04:02:07.029328+00"}
```

**Verdict:** SAFE TO BUILD ON — Mini Gen actively reads this table. Schema is stable and well-structured. Writer is external (likely manual data entry or import). The `type` field and per-day booleans provide the exact shape Phase 2 needs.

---

## 2. dog_conflicts

**Row count:** 1

**Schema:**
- id: uuid, NOT NULL
- dog_1_name: text, NOT NULL
- dog_2_name: text, NOT NULL
- reason: text, nullable
- created_by: text, nullable
- created_at: timestamp with time zone, nullable

**Writers (files that insert/update):**
- src/pages/Admin.jsx:223 — INSERT
- src/pages/Admin.jsx:238 — DELETE

**Readers (files that select):**
- src/pages/Admin.jsx:212 — SELECT
- src/hooks/tower/useScheduleData.js:27 — SELECT
- src/components/GroupOrganizer.jsx:282 — SELECT
- api/mini-gen.js:111 — SELECT
- src/components/tower/beast/BeastSection.jsx:7 — referenced in comment (read access listed)

**Most recent row:**
```json
{"id":"a04f7f28-75f6-44b6-a9d8-a3cb148dc2b3","dog_1_name":"Mochi","dog_2_name":"Chaska","reason":"Do not group together","created_by":null,"created_at":"2026-03-15 19:03:54.606957+00"}
```

**Verdict:** SAFE TO BUILD ON — Confirmed Mochi/Chaska as expected. Active writer (Admin page) and multiple readers (Tower, GroupOrganizer, Mini Gen). Clean schema.

---

## 3. schedule_checks

**Row count:** 5

**Schema:**
- id: uuid, NOT NULL
- check_date: date, NOT NULL
- check_time: text, NOT NULL
- status: text, NOT NULL
- issues_found: integer, NOT NULL
- details: jsonb, nullable
- created_at: timestamp with time zone, NOT NULL

**Writers (files that insert/update):**
- (none found in src/ or api/)
- supabase-schema.sql:353 — DDL only (table creation)

**Readers (files that select):**
- (none found in codebase)

**Most recent row:**
```json
{"id":"374b567d-108f-492b-96e8-d11b1526bd65","check_date":"2026-04-06","check_time":"10am","status":"clear","issues_found":0,"details":{"week":"2026-04-06 to 2026-04-10","issues":[],"timeSlots":28,"totalDogs":97,"comparison":{"resolved":13,"newIssues":0,"currentIssues":0,"morningIssues":13},"unmatchedDogs":0},"created_at":"2026-04-06 14:16:40.299843+00"}
```

**Verdict:** UNCLEAR — NEEDS ROD'S INPUT — The data is rich and useful (schedule comparison with issue tracking, 97 dogs across 28 time slots), but nothing in the codebase reads or writes to this table. The 5 rows were likely written by an edge function, a script, or a prior session. The Architect needs to determine: what wrote these, is it still running, and should Phase 2 Weekly Board read from here?

---

## 4. flag_cards

**Row count:** 35

**Schema:**
- id: uuid, NOT NULL
- source: text, NOT NULL
- source_id: text, nullable
- source_thread_id: text, nullable
- dog_name: text, nullable
- dog_id: uuid, nullable
- owner_name: text, nullable
- owner_email: text, nullable
- category: text, nullable
- summary: text, nullable
- raw_excerpt: text, nullable
- walk_date: date, nullable
- status: text, NOT NULL
- actioned_by: uuid, nullable
- actioned_by_name: text, nullable
- actioned_at: timestamp with time zone, nullable
- action_taken: text, nullable
- priority: text, nullable
- created_at: timestamp with time zone, NOT NULL
- scout_run_date: date, nullable

**Writers (files that insert/update):**
- api/scout.js:270 — INSERT (bulk insert of classified cards)
- api/scout.js:94 — SELECT (dedup check before writing)

**Readers (files that select):**
- (none found in src/)

**Most recent row:**
```json
{"id":"df677003-5035-4201-b897-20d914e964cf","source":"gmail","source_id":"gmail_19d72478d32ccc91","source_thread_id":"19d72478d32ccc91","dog_name":null,"dog_id":null,"owner_name":"RBC Royal Bank","owner_email":"ibanking@ib.rbc.com","category":"unknown","summary":"Unclassified message from RBC Royal Bank","raw_excerpt":"Subject: Interac e-Transfer: solene has accepted your transfer of $674.97...","walk_date":null,"status":"open","actioned_by":null,"actioned_by_name":null,"actioned_at":null,"action_taken":null,"priority":"normal","created_at":"2026-04-09 13:25:03.720535+00","scout_run_date":"2026-04-09"}
```

**Verdict:** SAFE TO BUILD ON — Scout is actively writing (most recent: yesterday). No frontend reader yet, which matches the gameplan (Phase 1a builds the Tower flag review UI). Schema is rich — has source tracking, status workflow, and action audit fields. Ready for a reader.

---

## 5. beast_brain

**Row count:** 0

**Schema:**
- id: uuid, NOT NULL
- created_by: uuid, nullable
- updated_at: timestamp with time zone, nullable
- business_hours: text, nullable
- walk_time: text, nullable
- timezone: text, nullable
- tone: text, nullable
- greeting: text, nullable
- signature: text, nullable
- language: text, nullable
- reply_add_walk: text, nullable
- reply_cancel_walk: text, nullable
- reply_new_lead: text, nullable
- reply_booking_note: text, nullable
- reply_general: text, nullable
- rules: text, nullable
- notes: text, nullable

**Writers (files that insert/update):**
- (none found)

**Readers (files that select):**
- (none found)

**Most recent row:**
N/A (0 rows)

**Verdict:** DEAD TABLE — SAFE TO IGNORE — Placeholder for the Beast email reply agent. Schema looks like a config/personality table (tone, greeting, reply templates). No code touches it. Will come alive when Beast is built; until then, ignore.

---

## 6. dogs_audit

**Row count:** 322

**Schema:**
- id: uuid, NOT NULL
- dog_id: uuid, nullable
- dog_name: text, nullable
- action: text, nullable
- changed_by: text, nullable
- old_data: jsonb, nullable
- new_data: jsonb, nullable
- changed_at: timestamp with time zone, nullable

**Writers (files that insert/update):**
- Database trigger: `dogs_audit_trigger` on `dogs` table → `dogs_audit_fn()` — fires on INSERT, UPDATE, DELETE

**Readers (files that select):**
- (none found in codebase)

**Most recent row:**
```json
{"id":"0859e745-4869-4a5d-8a46-0096930233b9","dog_id":"dfd8aab8-891a-4405-a61f-005c70285965","dog_name":"Pebbles","action":"UPDATE","changed_by":"rodrigo@wiggledogwalks.com","old_data":{"notes":"reactive Dog! Bringing back the forever box.","updated_by":"Test Walker"},"new_data":{"notes":"reactive Dog!","updated_by":"Rodrigo Galvan"},"changed_at":"2026-04-10 13:19:25.088764+00"}
```
(Note: old_data/new_data truncated above — full row contains all dog profile fields)

**Verdict:** SAFE TO BUILD ON — Actively recording via database trigger. 322 rows with the most recent from today. Captures who changed what and when. No frontend reader yet, but this is a clean audit trail ready for a Tower "change history" view.

---

## 7. daily_notes

**Row count:** 0

**Schema:**
- id: uuid, NOT NULL
- note_text: text, NOT NULL
- created_by: uuid, NOT NULL
- note_date: date, NOT NULL
- created_at: timestamp with time zone, NOT NULL

**Writers (files that insert/update):**
- src/pages/Schedule.jsx:118 — UPSERT (on conflict: note_date)

**Readers (files that select):**
- src/pages/Schedule.jsx:102 — SELECT (by note_date)

**Most recent row:**
N/A (0 rows)

**Verdict:** SAFE TO BUILD ON — Fully wired in the Schedule page (read + write). 0 rows means the feature exists but nobody has used it yet. Schema is simple and clean. On-conflict key is `note_date` (one note per day).

---

## 8. match_log

**Row count:** 0

**Schema:**
- id: uuid, NOT NULL
- acuity_name: text, NOT NULL
- matched_dog: text, nullable
- match_method: text, NOT NULL
- walk_date: date, NOT NULL
- created_at: timestamp with time zone, NOT NULL

**Writers (files that insert/update):**
- src/pages/Schedule.jsx:178 — UPSERT (on conflict: acuity_name, walk_date)

**Readers (files that select):**
- (none found)

**Most recent row:**
N/A (0 rows)

**Verdict:** UNCLEAR — NEEDS ROD'S INPUT — Writer exists in Schedule.jsx but table has 0 rows. Either the Acuity-to-dog matching code path hasn't been triggered in production, or the table was recently created/cleared. The schema tracks how names were matched (method field) which is useful for debugging the Acuity pipeline. Architect should confirm if this is expected to be empty or if the matching code has a bug preventing writes.

---

## 9. route_orders

**Row count:** 0

**Schema:**
- id: uuid, NOT NULL
- walk_date: date, NOT NULL
- time_slot: text, NOT NULL
- user_id: uuid, NOT NULL
- event_order: ARRAY, NOT NULL
- created_at: timestamp with time zone, NOT NULL
- updated_at: timestamp with time zone, NOT NULL

**Writers (files that insert/update):**
- src/components/RouteBuilder.jsx:134 — UPSERT (on conflict: walk_date, time_slot, user_id)

**Readers (files that select):**
- src/components/RouteBuilder.jsx:108 — SELECT

**Most recent row:**
N/A (0 rows)

**Verdict:** SAFE TO BUILD ON — Fully wired in RouteBuilder (read + write). Stores per-walker, per-slot custom pickup ordering. 0 rows means walkers haven't reordered any routes yet. Schema is clean with a natural composite key.

---

## 10. dog_vacations

**Row count:** 0

**Schema:**
- id: uuid, NOT NULL
- dog_id: uuid, nullable
- dog_name: text, NOT NULL
- sector: text, NOT NULL
- start_date: date, NOT NULL
- end_date: date, NOT NULL
- reason: text, nullable
- source: text, nullable
- created_by: uuid, nullable
- created_at: timestamp with time zone, NOT NULL

**Writers (files that insert/update):**
- (none found in codebase)

**Readers (files that select):**
- (none found in codebase)

**Most recent row:**
N/A (0 rows)

**Verdict:** DEAD TABLE — SAFE TO IGNORE — Created via migration on April 6, 2026 (`supabase/migrations/20260406_dog_vacations.sql`). Schema is well-designed with date ranges, sector, and source tracking. No code reads or writes yet. This is a placeholder for a future feature, not legacy debt.

---

## 11. acuity_notes

**Row count:** 1

**Schema:**
- id: uuid, NOT NULL
- dog_id: uuid, nullable
- dog_name: text, NOT NULL
- sector: text, NOT NULL
- note_text: text, NOT NULL
- acuity_appointment_id: text, nullable
- booking_date: date, NOT NULL
- created_at: timestamp with time zone, NOT NULL

**Writers (files that insert/update):**
- (none found in codebase — migration DDL only: `supabase/migrations/20260406_acuity_notes.sql`)

**Readers (files that select):**
- src/hooks/useAcuityNotes.js:14 — SELECT (by dog_id and today's booking_date)

**Most recent row:**
```json
{"id":"34943ca1-c5db-4bb3-aeda-1828f62d8a5a","dog_id":"dbe79444-b9e9-47c4-a11f-c6f98b3f8fee","dog_name":"Pepper Husky","sector":"Laurier","note_text":"She didn't eat breakfast this morning — may be low energy. Short walk is fine.","acuity_appointment_id":"12345","booking_date":"2026-04-07","created_at":"2026-04-07 00:33:41.80283+00"}
```

**Verdict:** UNCLEAR — NEEDS ROD'S INPUT — Frontend reader exists (`useAcuityNotes` hook surfaces today's note per dog), but no writer in the codebase. The 1 row has `acuity_appointment_id: "12345"` which looks like test data. Phase 3 Briefing Agent presumably needs an Acuity webhook or edge function to write booking notes here. Architect needs to decide: what process will populate this table in production?

---

## META

### What was NOT done that the brief asked for

1. **Part A.2 — Archive root HTML files:** Could not read or copy files exceeding 10K tokens. All 7 vision HTMLs (tower-app-vision-draft.html, wiggle-vision-2026.html, wiggle-product-vision.html, wiggle_notes_complete.html, wiggle_ecosystem_map.html, wiggle-admin-preview.html, Wiggle_Master_Gameplan.html) and WIGGLE_WORLD_SPEC.md remain at root.
2. **Part A.3 — Archive apps-script:** Code.js (66K tokens) too large to copy. `.clasp.json` cannot be deleted without bash access. The `apps-script/` directory remains in place.
3. **Part A.4 — Delete fix_drawer_close.txt:** No file deletion capability for this directory.
4. **Reason for all three:** The `wiggle-v4` directory is accessible to Cowork's file tools (Read/Write/Edit) but is NOT mounted in the bash sandbox. Only the `Wiggle Ops` workspace folder is mounted. File tools can read/write but cannot delete files, and cannot read files larger than ~10K tokens. A Claude Code session or manual terminal commands can finish this in 30 seconds — exact commands are in the Part A summary above.

### Questions for the Architect

1. **schedule_checks:** What writes to this table? The 5 existing rows contain useful Acuity-vs-roster comparison data. Is there an edge function or cron that ran this? Is it still active?
2. **expected_schedule:** Same question — 84 rows, Mini Gen reads them, but nothing in the codebase writes them. How is this table populated?
3. **acuity_notes:** The reader hook exists but there's no writer. What will populate this in production — an Acuity webhook? A Scout pipeline? Manual entry?
4. **match_log:** Writer code exists in Schedule.jsx but 0 rows. Is this expected, or is the matching code path not being reached?
5. **index.html:** The brief said "all root HTML files are vision docs" but `index.html` is the Vite app entry point. I left it alone. Confirm this was correct.
