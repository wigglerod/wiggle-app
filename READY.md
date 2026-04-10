# READY.md
*Pre-build orientation. What's decided, what's open, what to do first.*
*Created: April 2026 — before Phase 1 scaffold*

---

## What's about to be built

This is the Phase 1 scaffold for **Wiggle World: The Neighbourhood HQ** — the new walker-facing PWA that will eventually replace the existing app at `wiggle-app-dusky.vercel.app`. The existing app is untouched throughout.

Phase 1 produces a working, installable PWA with five screens (TodayScreen, DogsScreen, WeekScreen placeholder, BeastScreen placeholder, SettingsScreen), all core components (GroupBlock, DogCard, DogDrawer, NoteComposer, SessionHero, TopBar, BottomNav), four data hooks (useAuth, useWalkGroups, useWalkState, useOwlNotes), and a StudioPlaceholder for the Phase 2 admin surface.

The design system is locked. The database is live. The constitution is written. The scaffold can be built without any further design decisions.

---

## What is fully decided — do not revisit these

**Design direction** is The Field, finalized April 2026. Forest green frame (`#111A14`), warm peach/cream content, Fraunces + DM Mono typography split. Every color token is in `WIGGLE_WORLD_SPEC.md § 4`. Every typography rule is in `§ 5`. None of this is open for interpretation.

**Font system** is Fraunces + DM Mono only. DM Sans was the old app. It does not appear anywhere in this codebase.

**Supabase project** is live with real data. Project ID: `ifhniwjdrsswgemmqddn`. All tables exist and are populated. The walk state source of truth is `walker_notes`. `walk_logs` is empty — ignore it. Full schema in `WIGGLE_WORLD_SPEC.md § 3`.

**The AI layer** (Mini Gen) is live and running. The `mini_gen_drafts` staging table exists. `api/tower-approve.js` already promotes approved drafts to `walk_groups`. Do not build anything that alters this flow.

**Component scope** is locked for Phase 1. No additional screens, no Tower features, no billing, no maps, no SMS. Anything not in the build prompt is Phase 2 or later.

---

## Open questions — resolve before or during the build

**The anon key.** The build prompt says to copy the anon key from the existing wiggle-v4 `.env`. Confirm that file is accessible in the development environment before starting. If not, retrieve it from the Supabase dashboard before writing any Supabase client code.

**PWA icons.** The manifest requires `icon-192.png` and `icon-512.png`. The build prompt says to generate a placeholder — a forest green square with "W" — if no icons are provided. Confirm whether real icons exist before generating placeholders, since swapping them later requires a re-deploy.

**Supabase RLS policies.** Row-level security may be configured on the live database. Before writing any data hooks, verify which tables have RLS enabled and what policies are in place — particularly for `walker_notes` (walkers should only write their own notes) and `dogs` (read-only for walkers, write for admins). If RLS is blocking reads during local development, the anon key may need specific policies enabled.

**Repo location.** The scaffold creates a new `wiggle-world/` directory. Confirm whether this is a brand new standalone repo or a new directory inside an existing monorepo. The Vercel deployment config differs depending on the answer.

**Walker test accounts.** Local development requires at least one walker-role profile in the `profiles` table to test the HQ routing. Confirm that test accounts exist and their credentials are accessible, or create them in the Supabase dashboard before starting on auth flows.

**Sector for testing.** The TodayScreen and DogsScreen filter by the logged-in walker's `sector` from their profile. Confirm which sector (Plateau or Laurier) the test account belongs to, so the initial data renders with real groups rather than an empty screen.

---

## Verification checklist — run before handing off

This checklist is for the end of the Phase 1 build session, before this file is updated with a completion summary.

`npm run build` passes with zero errors. Dog names render in Fraunces italic throughout. Top bar and bottom nav are both `#111A14`. The scroll area background is warm peach `#FFF5F0`. No dog photo, breed label, or avatar circle appears on walk cards. No "All" tab exists in DogsScreen. No Admin Panel link appears in Settings. Check for Friends is present and functional in DogsScreen. Purple name = `dogs.notes` is not null. Fuschia ★ = same signal. Sage card = picked up state. Amber card = not walking state. DogDrawer closes automatically after pickup, not-walking, back home, and undo. DogDrawer stays open after tapping address, door code, or reading notes. NoteComposer writes `walker_id`, `walker_name`, and `walk_date` on every send. The "Warn next walker" toggle dual-writes to both `walker_notes` and `owl_notes`. The PWA manifest is installed with forest green `#111A14` as `theme_color` and `background_color`. `WIGGLE_WORLD_SPEC.md` exists at the repo root. `CLAUDE.md` exists at the repo root.

---

## How to update this file after the build

When the Phase 1 scaffold is complete, replace the checklist above with a brief summary of what was actually built, any decisions that were made during the build that deviated from the prompt, and any new open questions that surfaced. This file becomes the handoff document to the next session.

---

*Do not deploy. Rod reviews and deploys manually.*
