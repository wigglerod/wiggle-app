# WIGGLE_MAP.md

**Read this first. Every session. No exceptions.**

Last updated: April 19, 2026

---

## What Wiggle is right now

Rodrigo runs two parallel Wiggle codebases. This is deliberate, not an accident.

### wiggle-v4 — the CURRENT production app

Walkers and Gen use this every walk day. Do not break it.

- **Local folder:** `~/Documents/wiggle-v4`
- **GitHub repo:** `github.com/wigglerod/wiggle-app`
- **Deployed at:** `wiggle-app-dusky.vercel.app`
- **Supabase project:** `ifhniwjdrsswgemmqddn` (shared)
- **Status:** live, in daily use

### wiggle-world — the NEW Wiggle

Rebuild in progress. More sophisticated. New Studio (admin UI with rooms: Scout, Dashboard, Owl, Mini Gen), new app, new Gen's Assistant.

- **Local folder:** `~/Documents/wiggle-world`
- **GitHub repo:** `github.com/wigglerod/wiggle-world`
- **Deployed at:** https://wiggle-world.vercel.app
- **Supabase project:** `ifhniwjdrsswgemmqddn` (SAME as wiggle-v4 — shared database)
- **Status:** active rebuild

---

## The rules

1. **Before any code or DB change, state which Wiggle you're working on.** "I am working in wiggle-world" or "I am working in wiggle-v4." If you can't say it, stop and ask.

2. **Shared Supabase = shared blast radius.** Both codebases read/write the same database. A migration on `walk_groups` affects wiggle-v4 whether you meant it to or not. Before any DDL (CREATE, ALTER, DROP, CHECK constraint, etc.), name every consumer of the affected table in BOTH codebases. If you can't, don't run it.

3. **Don't cross-contaminate.** Code in wiggle-world does not get copied into wiggle-v4, and vice versa, without Rodrigo explicitly saying so. They are intentionally separate.

4. **Vercel deploys from GitHub, not from your local folder.** A push to `wiggle-world.git` deploys wiggle-world's Vercel. A push to `wiggle-app.git` deploys wiggle-v4's Vercel. They do not talk to each other. If you push to the wrong repo, the wrong thing deploys — or nothing does.

5. **Closed-day rule applies to both.** Wiggle is closed Fri + Sat. No DB mutations, no seeding, no tests against production data on closed days. True for wiggle-v4 AND wiggle-world, because they share the DB.

---

## Who touches what

- **Claude.ai (strategy chat):** Reads this map, asks which Wiggle, plans the move.
- **Claude Code (terminal agent):** Reads this map from the project root it was launched in. The folder tells it which Wiggle it's on.
- **Cowork:** No memory across sessions. Tell it explicitly at session open: "You are working in wiggle-world" (or wiggle-v4).
- **Antigravity:** Same as Cowork — state which Wiggle at session open.

---

## Known shared tables

Both codebases read/write these in Supabase project `ifhniwjdrsswgemmqddn`:

- `walk_groups` — `dog_ids` column uses dog names, not UUIDs. CHECK constraint pending.
- `walker_notes`
- `flag_cards` — Scout's inbox
- `acuity_name_map`
- `playbook_examples` — seeded April 19, 2026 for Gen's Assistant (108 rows)
- `beast_brain` — seeded April 19, 2026, voice config (1 row)
- `dogs`, `profiles`, `owl_notes`, and more

If you're adding a new table, state whether it belongs to wiggle-v4, wiggle-world, or both.

---

## Session-opening acknowledgement

Every agent, at the start of every session, must say:

> "I have read WIGGLE_MAP.md. I am working on **[wiggle-v4 / wiggle-world]**. I will not touch the other one. I understand the Supabase instance is shared."

If an agent can't say this honestly, stop and ask Rodrigo.
