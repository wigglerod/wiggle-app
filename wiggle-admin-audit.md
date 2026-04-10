# Wiggle Dog Walks — Design Audit

**Date:** Sunday, April 5, 2026
**Auditor:** Claude (design critique)
**Scope:** Every screen accessible from the walker app and Tower Control
**Method:** Visual inspection (screenshots) + source code review against CLAUDE.md design constitution

---

## Overall Impression

The app has a strong personality. The warm peach background, DM Sans typography, and coral CTAs create a recognizable identity that feels handmade and trustworthy — not like a generic SaaS tool. The empty states are charming (paw prints, "Time for belly rubs"). The information architecture is sound: Schedule, Dogs, Settings maps clearly to what a walker needs.

**The biggest opportunity:** The warm brand system defined in the design constitution is only partially implemented. Roughly 60+ instances of cold Tailwind defaults (bg-white, border-gray-*, text-gray-*) bleed through across every page, creating a split personality — warm in intention, cold in execution. Fixing this single category of issue would transform the app's coherence overnight.

---

## Screens Reviewed

| Screen | Route | Status |
|--------|-------|--------|
| Schedule (Today) | `/` and `/schedule` | Empty state (Sunday) |
| Dogs list | `/dogs` | Populated — ~95 dogs |
| Settings | `/settings` | Logged in as Chief Pup |
| Tower Control Dashboard | `/tower` | Gen's Dashboard — Sunday empty state |
| Tower Mini Gen | `/tower/mini-gen` | 27 draft days pending |

---

## 1. Visual Consistency

### What works

The global background (`#FFF5F0` peach) is correctly applied at the CSS root level. DM Sans is the only font loaded. Coral (`#E8634A`) is consistently the primary CTA color across Schedule, Dogs, and the "Check for Friends" button. The sector badges (Plateau / Laurier) on the Dogs page use recognizable muted pill colors. Dog photos with difficulty dots (green, amber) provide quick visual scanning.

### What doesn't — the cold gray problem

This is the single largest consistency failure across the app. The design constitution says "NEVER use Tailwind cold grays" and "NEVER use pure white (#ffffff) — use cream #FAF7F4." In practice:

**bg-white appears 15+ times** — on card surfaces in Settings (user profile card, Admin Panel row, Sign Out row), Dogs (search input, filter pills, dog list cards, skeleton loaders), Schedule (skeleton cards, progress bar, filter pills), Bottom Nav, and DogProfileDrawer.

**border-gray-100/200 appears 20+ times** — virtually every card border, input border, and section divider uses Tailwind's cold gray instead of the warm `#E8E4E0` specified in the system.

**text-gray-300/400/500/600 appears 15+ times** — secondary text on email addresses, breed names, tab labels, and metadata all use cool Tailwind grays instead of the warm palette (`#8C857E` for mid, `#B5AFA8` for light, `#D5CFC8` for faint).

The result: every screen has the correct warm *background* peeking through, but the foreground elements (cards, inputs, borders) feel like they belong to a different, colder app. The eye catches this dissonance most on the Settings page, where white cards float on peach — they feel like stickers pasted onto a warm surface.

### The Tower split

Tower Control (`/tower`) uses an entirely different design language: a cold `#F4F6F8` background, blue-outlined sector pills ("Plateau 0" / "Laurier 0"), green success banners, and a bronze/brown gradient for "The Beast" AI section. None of these colors exist in the design constitution's color table. The sidebar navigation uses emoji icons and a warm-cream active state, which is closer to the brand — but the main content area diverges sharply.

This is *intentional* (Tower is the admin ops view, not the walker app), but the degree of divergence means these feel like two different products rather than two views of one product.

---

## 2. Information Hierarchy

### Schedule (Today view)

The eye lands on "Chief Pup" badge first (red/coral background, positioned prominently next to the header). Second: the "Today / Tomorrow" or "Today / Week" toggle. Third: the date. On empty days, the paw prints illustration draws attention nicely.

**Problem:** On a day with walks, the "Today/Week" toggle and "All Sectors" badge compete for attention at the same horizontal level as the date. Three pieces of chrome (date, toggle, sector filter) are crammed into one line, which will feel tight on mobile once walk groups load below.

### Dogs page

The eye lands on the coral "Have they walked together?" button — a huge, full-width CTA that dominates above the fold. This is a secondary/novelty feature, yet it visually outweighs the primary task (browsing the dog list). The "CHECK FOR FRIENDS" section header in coral all-caps reinforces this imbalance.

Below that, the All/Plateau/Laurier filter tabs are well-placed. The dog cards themselves are clean: photo + name + breed + sector badge. The difficulty dot is subtle but visible.

**Problem:** The search bar at the very top is the right entry point, but the "Check for Friends" feature between the search and the actual dog list creates a speed bump. A walker looking for a specific dog has to visually skip past this section every time.

### Settings page

Clean and minimal. User profile card → Admin Panel link → Sign Out. The hierarchy is correct. The "Check for updates" link at the bottom is appropriately subtle.

**Problem:** The "All Sectors" badge at the top-right of the header has no clear function on this page. It appears to be a global navigation element leaking into a context where it isn't relevant.

### Tower Control Dashboard

Good hierarchy: KPI cards (Dogs today, Flags, Must-ask, Owl notes) at the top give Gen an instant pulse. "Flags — Needs Attention" section below with a green "all clear" banner is immediately reassuring. Owl Notes and Must-Ask sections follow logically.

**Problem:** "The Beast" AI section at the bottom uses a bold bronze gradient that visually screams louder than the KPI cards above it. On a day with active flags, the AI tool should feel secondary to the operational data — but its styling commands more attention than the numbers.

### Tower Mini Gen

The two-column grid (Plateau left, Laurier right) with date headers is logical. Approve/Reject buttons are clearly actionable. Dog names as pills provide quick scanning.

**Problem:** 27 draft days creates a very long page with no pagination or collapse mechanism. The visual weight is uniform — every card looks identical — making it hard to spot which days need attention vs. which are routine.

---

## 3. Layout Coherence

### Does it feel like one product?

The walker app (Schedule, Dogs, Settings) feels cohesive — same bottom nav, same header pattern, same background. The internal consistency is good *within* these three tabs.

Tower Control feels like a sibling product. The sidebar nav, desktop-width layout, and different color system are appropriate for an admin tool, but the brand thread is thin. The warm peach doesn't carry into Tower's `#F4F6F8` background. The coral CTA doesn't appear at all in Tower (replaced by green Approve and amber Reject buttons). The only brand continuity is the logo and the font.

Tower Mini Gen sits between worlds: it uses the walker app's full-width layout (no sidebar), dark header bar (different from both the walker app and Tower Dashboard), and introduces its own color pair (teal/green for Approve, amber/brown for Reject) that doesn't match either system.

---

## 4. Specific Issues

### Chaotic or cluttered elements

The Dogs page "Check for Friends" section is the clearest example. Two text inputs (`@dog1`, `@dog2`) plus a full-width coral button plus an all-caps coral label create a dense block that visually outcompetes the primary content below. On a phone, this section alone fills roughly 40% of the above-the-fold viewport.

### Misalignment

The bottom nav icons (Schedule, Dogs, Settings) use different visual weights. The Schedule icon is a simple calendar outline, Dogs uses filled paw prints, and Settings uses a gear. The inconsistency is minor but noticeable when the three sit side by side.

The sector badges on dog cards ("Plateau" / "Laurier") use a light blue/purple background that doesn't map to the defined sector colors (Teal-Blue `#3B82A0` for Plateau, Forest Green `#4A9E6F` for Laurier). Both appear to use a similar muted lavender/blue, losing the color-coding distinction.

### Typography drift

The base body text color in `index.css` is set to `#1A1A1A` — a near-black that violates the warm black `#2D2926` specified in the design constitution. This affects every default text element that doesn't have an explicit color override.

Breed names on dog cards and in drawers use `#888` — a cold mid-gray that should be the warm `#8C857E`.

---

## 5. What Works Well

**The warm identity is real.** When the peach background, coral buttons, and DM Sans come together (as they do on the Schedule empty state), the app has genuine warmth and personality. This isn't a template — it feels built by someone who cares about dogs.

**Empty states are delightful.** The paw print illustrations and copy ("No adventures today! Time for belly rubs" / "No walks today — Enjoy your day off!") are on-brand and friendly. These are small touches that make the app feel alive.

**The dog card information density is right.** Photo, name, breed, sector, difficulty dot — all in a compact, scannable row. Nothing is hidden that shouldn't be. This respects the WWRS filter.

**Tower KPI cards are immediately useful.** Dogs today, Flags, Must-ask, Owl notes active — four numbers that tell Gen everything she needs at a glance. The green "all clear" banner is a nice zero-state.

**The bottom nav is simple and correct.** Three tabs. No hamburger menu. No hidden navigation. A walker with one hand and a leash can tap any section.

---

## Top 5 Design Problems (Ranked by Severity)

### 1. Cold Gray Contamination (60+ instances) — CRITICAL

**The problem:** The design constitution defines a complete warm color system, but the implementation defaults to Tailwind's cold grays (`bg-white`, `border-gray-*`, `text-gray-*`) across every page. This is the single biggest gap between intent and execution.

**Why it matters:** Color consistency is what makes a brand feel trustworthy. Right now, every card and input says "generic app" while the background says "Wiggle." The dissonance is subtle but cumulative — it makes the app feel 80% finished.

**The fix:** A systematic find-and-replace pass:
- `bg-white` → `bg-[#FAF7F4]`
- `border-gray-100` / `border-gray-200` → `border-[#E8E4E0]`
- `text-gray-300` → `text-[#D5CFC8]`
- `text-gray-400` → `text-[#B5AFA8]`
- `text-gray-500` / `text-gray-600` → `text-[#8C857E]`
- `bg-gray-50` / `bg-gray-100` → `bg-[#F0ECE8]` or `bg-[#FAF7F4]`
- Body text `#1A1A1A` → `#2D2926`

Define these as Tailwind theme tokens so future development stays on-system.

### 2. Dogs Page Hierarchy — "Check for Friends" Dominates (HIGH)

**The problem:** A novelty feature (checking if two dogs have walked together) occupies prime real estate above the primary dog list, with a full-width coral CTA that visually outranks the search bar.

**Why it matters:** Walkers visit the Dogs page to find a specific dog — not to run friendship checks. The current layout slows down the primary use case every single time.

**The fix:** Collapse "Check for Friends" into a small icon or secondary link below the filter tabs. Or move it to a sub-menu accessed from a button. The dog list should begin immediately below the search bar and sector filters.

### 3. Tower Control — Visual Divorce from Brand (MEDIUM-HIGH)

**The problem:** Tower uses `#F4F6F8` (cold gray) background, blue-outlined pills, green/amber action buttons, and a bronze AI gradient — none of which appear in the design constitution. It feels like a different product.

**Why it matters:** When Gen switches between the walker app and Tower, the context switch is jarring. A shared warm foundation (even with Tower-specific additions) would make the whole system feel intentional.

**The fix:** Apply peach (`#FFF5F0`) or a warm near-white as Tower's background. Use cream (`#FAF7F4`) for cards. Keep the sidebar and emoji nav — they're charming. Remap the sector pills to use the actual sector colors (Teal-Blue for Plateau, Forest Green for Laurier) instead of generic blue outlines. Let "The Beast" keep its personality, but tone down the gradient so it doesn't outshout the KPI cards.

### 4. Sector Badge Colors Don't Match Sector Identity (MEDIUM)

**The problem:** On the Dogs page, both "Plateau" and "Laurier" badges appear to use similar muted lavender/blue tones rather than the defined sector colors (Teal-Blue `#3B82A0` for Plateau, Forest Green `#4A9E6F` for Laurier). The color distinction that would let a walker instantly recognize sectors is lost.

**Why it matters:** Sector is a critical operational concept — it determines which walker takes which dogs. Losing the color signal makes the dog list slightly harder to scan.

**The fix:** Apply the sector colors from the design constitution to the badge backgrounds: a teal-tinted pill for Plateau, a green-tinted pill for Laurier. Keep them muted (use the color at 15-20% opacity for background, full color for text).

### 5. Mini Gen — No Pagination or Priority Signal on 27 Drafts (MEDIUM)

**The problem:** The Mini Gen page presents 27 draft days as an undifferentiated grid with no way to collapse, paginate, or prioritize. Every card has the same visual weight — same size, same Approve/Reject buttons, same "No flags for this day" label.

**Why it matters:** Gen shouldn't have to scroll through 27 identical cards to find the ones that actually need her attention. The page currently says "everything is equal" when operationally it isn't.

**The fix:** Add visual priority signals: cards with flags should use amber borders or a warning badge. Cards older than a week could be collapsed into a "Backlog" section. Consider pagination (7 days visible, "Load more") or a "Review next" button that surfaces the most urgent draft. A simple count badge on each card showing "12 dogs" vs "16 dogs" already exists — extend this logic to flag anomalies.

---

## Appendix: Violation Count by File

| File | Cold gray violations | bg-white violations | Total |
|------|---------------------|---------------------|-------|
| DogsPage.jsx | 9 | 4 | 13 |
| DogProfileDrawer.jsx | 6 | 2 | 8 |
| SettingsPage.jsx | 3 | 4 | 7 |
| Schedule.jsx | 4 | 3 | 7 |
| WalkLogModal.jsx | 3 | 0 | 3 |
| BottomTabs.jsx | 1 | 1 | 2 |
| index.css | 2 | 0 | 2 |
| TowerLayout.jsx | 1 | 0 | 1 |
| **Total** | **29** | **14** | **43+** |

*Note: Additional violations exist in sub-components, inline styles, and conditional class logic not fully enumerated above. True total is estimated at 60+.*

---

*Audit conducted against the Wiggle Design Constitution (CLAUDE.md) and the live app at wiggle-app-dusky.vercel.app. Work smart, play always.*
