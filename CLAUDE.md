# Wiggle Dog Walks — Claude Instructions

## Core App Structure — DO NOT CHANGE

- **Header:** Wiggle logo top-left (`public/WiggleLogo.png`, `h-8`), date below, Admin/Sign out top-right, sector badge right
- **Main view:** Organizer/Map pill toggle (coral active state `#E8634A`)
- **Organizer layout:** Unassigned section → Group 1 → Group 2 → Group 3 → Add Group button
- **Each group:** dashed border, color-coded background, editable name with pencil icon, dog count badge, "Drag dogs here" placeholder
- **Dog chips:** light background, emoji, name, info button — compact horizontal layout
- **Bottom nav:** Schedule (calendar icon), Dogs (paw icon), Settings (gear icon) — fixed to bottom, coral active state
- **Brand coral:** `#E8634A` — used for active states, buttons, alerts, accents
- **Background:** `#FFF4F1` — used for page backgrounds
- **Mobile-first, clean, minimal** — the app should feel like a simple tool, not a complex dashboard
- **LoadingDog component** (`public/play.jpg`) with framer-motion bounce animation for ALL loading states — never use spinners
- **Wiggle logo** (`public/WiggleLogo.png`) in header AND login page — never use SVG placeholder dogs

## Tech Stack

- React 19 + Vite 7
- Tailwind CSS v4
- Framer Motion (animations)
- @dnd-kit (drag and drop)
- Supabase (database + auth + storage + realtime)
- React Router DOM v7
- sonner (toasts)
- lucide-react (icons)

## Key Files

- `src/components/BottomTabs.jsx` — router-based bottom nav, DO NOT convert back to prop-based
- `src/components/GroupOrganizer.jsx` — drag-and-drop organizer, uses `useWalkGroups` hook
- `src/lib/useWalkGroups.js` — Supabase persistence + realtime for walk groups
- `src/components/LoadingDog.jsx` — animated loading component, use everywhere
- `src/components/Header.jsx` — sticky header with logo, date, sector badge
- `public/WiggleLogo.png` — the real logo file (not LogoWiggleRGB-01.png)
- `public/play.jpg` — the dog photo used in LoadingDog

## Supabase Schema Notes

- `dogs` table needs: `emergency_contact`, `emergency_phone` columns
- `walk_groups` table needs: `group_name TEXT` column
- `walk_groups` constraint `group_num between 1 and 3` must be dropped to allow adding groups
- Walker UPDATE policy on `dogs` table must exist
- Storage bucket `photos` needs authenticated upload/update policies
