# Wiggle UX Rethink — Full Audit

*Analysis date: 2026-04-01*
*Analyst perspective: Senior product designer, evaluating holistic UX*

---

## 1. CURRENT FLOW MAP

### Screens and Components

| Screen | Route | Primary Purpose | Who Uses It |
|--------|-------|----------------|-------------|
| Dashboard | `/` | Group organization + walk execution | Rod (admin) + walkers |
| Schedule | `/schedule` | Time-slot view + walk logging | Walkers (but no bottom nav entry) |
| Dogs | `/dogs` | Dog database, search, friend check | Rod + senior walkers |
| Admin | `/admin` | Today status + dog management + system | Rod + Gen |
| Settings | `/settings` | Profile, sign out, update check | Everyone |
| Login | `/login` | Authentication | Everyone |

### Bottom Nav Routes
- Tab 1 (Calendar icon, labeled "Schedule") → `/` (Dashboard)
- Tab 2 (Paw icon) → `/dogs`
- Tab 3 (Gear icon) → `/settings`

**Problem #1 immediately visible:** The bottom tab labeled "Schedule" navigates to the Dashboard, not the Schedule page. The actual Schedule page (`/schedule`) has no bottom nav entry and is effectively orphaned — accessible only by direct URL or internal links.

### Tap Counts for Key Tasks

#### Setting up a full day of walks from scratch (Rod, one sector)

Assume 25 dogs for Plateau sector, organizing into 3 groups:

1. Open app → Dashboard loads (1 tap or auto)
2. Wait for Acuity data to load (~2-4 seconds)
3. Dogs appear in Unassigned pool
4. For each of 25 dogs, move to a group:
   - **Option A: Long-press → menu → tap group** = 2 actions × 25 dogs = **50 taps**
   - **Option B: Tap dog (select) → tap group header** = 2 taps × 25 dogs = **50 taps**
   - **Option C: Drag-and-drop** = 1 drag gesture × 25 dogs = **25 gestures** (but dragdrop on mobile is clumsy, especially with 25 items)
5. Assign walkers: tap walker slot → pick from sheet → confirm × 2 slots × 3 groups = **~12 taps**
6. Rename groups (optional): tap pencil → type name → confirm × 3 = **~9 taps**
7. Reorder dogs within groups (optional): drag to reorder, ~5-10 gestures
8. Switch to Laurier sector (cycle sector filter): **1-2 taps**
9. Repeat steps 3-7 for Laurier (~20 dogs, 3 groups)

**Total for full-day setup: ~120-150 individual interactions, taking 15-25 minutes.**

Every single day starts from zero. No memory of yesterday's groups. No suggestions.

#### Checking status of all walkers mid-day (Rod)

1. From Dashboard: groups show visual state (green = done, walking mode banner) — **0 taps** if already on Dashboard
2. But: need to scroll through all groups to see each one's state
3. OR: Navigate to Admin (tap Admin in header) → **1 tap**
4. Admin > Today tab shows sector summaries + group list — **0 additional taps**
5. Expand a group to see individual dog pickup status — **1 tap per group**

**Total: 2-5 taps, but requires navigating away from the operational view.** The Dashboard itself doesn't have a consolidated status summary — you have to scan each group visually.

#### Walker completing a full walk cycle (pickup to return, 6 dogs)

1. Open app → Dashboard (if assigned to a locked group, sees their group prominently)
2. Scan group, identify first dog
3. Swipe left on dog card → "Pick up" → **1 swipe gesture**
4. Walk to dog, pick up dog (real world)
5. Repeat swipe for remaining 5 dogs → **5 swipe gestures**
6. Walk the dogs (real world)
7. Return each dog: swipe left again → "Back home" → **6 swipe gestures**

**Total: 12 swipe gestures.** This flow is actually clean and well-designed. The swipe-to-act paradigm works.

But: the walker first has to find their group among potentially 6+ groups. If they aren't assigned as walker on a group, they see ALL groups unlocked, which is confusing.

#### Adding a note about a dog

**During a walk (locked mode):**
1. Swipe right on dog card → QuickNoteSheet opens — **1 swipe**
2. Select pre-set tags (0-3 taps) and/or type message
3. Tap Save — **1 tap**

**Total: 2-5 taps.** Reasonable.

**From dog profile:**
1. Tap dog name → DogDrawer slides up — **1 tap**
2. Scroll to notes section
3. Notes shown are read-only in the drawer (walker notes from past walks)
4. No obvious way to add a NEW note from the profile view without going back to swipe

This is a gap — notes can only be created via swipe-right or the walk logging modal.

---

## 2. FRICTION POINTS

### Critical Friction (daily pain, high impact)

**F1. Zero-memory daily setup** — `GroupOrganizer.jsx`
The GroupOrganizer rebuilds from scratch every day. Acuity events have new session IDs daily, so yesterday's groups can't carry over. Rod manually assigns 40-50 dogs to groups every single morning. This is the single biggest time sink in the app. For a team managing 93 dogs across 2 sectors, this is ~150 interactions before a single dog gets walked.

**F2. Two competing views, one bottom tab** — `Dashboard.jsx` + `Schedule.jsx` + `BottomTabs.jsx`
Dashboard (/) shows group-based organization with drag-drop and swipe execution. Schedule (/schedule) shows time-slot-based view with walk logging. Both fetch the same Acuity data. Both show today's dogs. A walker doesn't know which to use. Worse: the Schedule page isn't reachable from the bottom nav. The tab labeled "Schedule" goes to the Dashboard. This creates a dead view that has useful features (walk logging, time-grouped cards) that nobody can find.

**F3. Walker can't find their group** — `GroupOrganizer.jsx`
When a walker opens the app, they see ALL groups for their sector: unassigned pool, Group 1, Group 2, Group 3, etc. There's no "Your Walk" highlight. They have to scan group headers for their name. Once groups are locked, other walkers' groups collapse (good), but during planning phase everything is visible and editable by everyone.

**F4. Status monitoring requires screen-switching** — `Admin.jsx` TodayTab vs `Dashboard.jsx`
Rod organizes walks on Dashboard. To check real-time status, he navigates to Admin > Today. These views show overlapping-but-different information about the same day. The Dashboard shows groups with visual states; Admin shows a summary list. Neither gives a true at-a-glance dashboard. Rod is constantly flipping between two screens.

### Moderate Friction (weekly annoyance, moderate impact)

**F5. Walker assignment is manual despite known schedules** — `GroupOrganizer.jsx` WalkerPickerSheet
The `profiles` table has schedule data (e.g., "Mon,Tue,Fri"). The GroupOrganizer fetches walkers filtered by sector. But it never pre-assigns walkers to groups based on who's scheduled today. Rod taps each slot, scrolls through options, and assigns manually. The data to automate this exists — it's just not used.

**F6. Lock metaphor is confusing** — `GroupOrganizer.jsx` LockButton
"Lock" means "transition from planning to walking mode." But the padlock icon and "hold 1 second" interaction suggest security/protection, not "start your walk." New walkers don't intuit that locking a group enables swipe-to-pickup. The "Lock All Groups — Start Walking" button label is better, but the per-group lock button just shows a padlock with no label.

**F7. Undo is buried in profile drawer** — `DogCard.jsx` + `DogDrawer.jsx`
Per the back-home spec, undo = edit timestamps in the profile drawer. There's no undo button on the card itself. If a walker accidentally swipes a dog as "picked up," they have to: tap dog name → drawer opens → find the Walk Times section → tap Edit on the timestamp → change it. That's 4-5 interactions to fix a single accidental swipe.

**F8. Owl notes system is overbuilt** — `OwlQuickDrawer.jsx` + `useOwlNotes.js`
The owl notes system supports: @mentions with autocomplete, target types (dog/sector/all), scheduled future dates, auto-expiry with duration parsing ("3 days"), daily acknowledgment that resets, per-sector filtering. This is a full messaging system. The actual use case is: Rod sends a note like "Buddy is on medication this week — extra care" or "Ice on Esplanade, be careful." A simple text + scope (everyone or one sector) would cover 90% of needs.

**F9. Dog database page is read-heavy, action-light** — `DogsPage.jsx`
The Dogs page is a scrollable list of 93 dogs with search. Tapping a dog opens a full profile drawer for editing. This works, but there's no sorting by sector (admin only filter), no bulk operations, and the friend-check feature at the top pushes the dog list below the fold. The friend-check is a rarely-used admin feature taking prominent space on a page every walker visits.

### Low Friction (minor polish, low impact)

**F10. Pull-to-refresh is the only refresh mechanism on Dashboard** — `Dashboard.jsx`
If Acuity data changes (new booking, cancellation), the only way to see it is pull-to-refresh. There's no polling, no push notification, no visual indicator that data might be stale.

**F11. Date selector is ambiguous** — `Dashboard.jsx`
The Today/Tomorrow toggle plus WeeklyView toggle creates three possible date views. If Rod is looking at tomorrow's schedule and a walker opens the app to today, they're seeing different days on the same screen. No visual indicator of "you're looking at tomorrow, not today."

**F12. Map view is disconnected** — `MapView.jsx`
The collapsible map in GroupOrganizer shows dog locations, but it's separate from the walk execution flow. The "Start Route" button opens Google Maps in a new tab. There's no in-app turn-by-turn. The map is informational but not actionable.

---

## 3. PROPOSED FLOW

### Morning: Rod sets up the day (7:30 AM)

Rod opens Wiggle on his phone. The app shows a clean morning dashboard. At the top: **"Wednesday, April 1 — Plateau"** with a sector toggle.

Below that, a card reads: **"25 dogs today. Suggested groups based on yesterday + addresses."** The app has pre-grouped dogs by analyzing: (1) yesterday's group composition for this sector/day-of-week, (2) address proximity clustering, (3) dog compatibility (no conflicts). Three groups are pre-filled with walker names auto-assigned from schedule data (Chloe: Mon,Tue,Fri → she's assigned to Group 1 on this Wednesday? No — Solene: Tue,Wed,Thu → she's auto-suggested).

Rod scans the suggestions. Looks good. He drags two dogs from Group 2 to Group 1 (Buddy and Max live on the same block as Group 1 dogs). Tweaks done in 30 seconds.

He taps **"Confirm & Notify Walkers"**. Groups lock. Each walker gets a push notification: "Your walk is ready — 7 dogs in Morning East."

**Total: ~5 taps + 2 drag gestures. Time: 2 minutes.**

Compare to today: 120-150 taps, 15-25 minutes.

### Morning: Chloe starts her walk (9:00 AM)

Chloe opens Wiggle. Instead of the full GroupOrganizer with all groups, she sees a single focused screen: **"Your Walk — Morning East"** with her 7 dogs listed in route order (optimized by address proximity).

At the top: a progress bar (0/7 picked up). A "Start Route" button opens in-app directions.

She arrives at the first address. The card shows: **#1 Buddy — 4200 Esplanade — #4532** (position, name, address, door code). She swipes left. Card turns sage green with timestamp. Progress bar: 1/7.

She works through her list. Each pickup is one swipe. If she needs to add a note: swipe right → quick note sheet. If she accidentally swipes the wrong dog: tap the green check mark on the card → "Undo pickup?" confirmation → one tap to undo (not buried in profile).

After all 7 pickups, the screen transitions: **"All picked up! Walk time."** Timer starts. The dog list reshuffles to show return order (back to address proximity, reverse route).

After the walk, she returns each dog. Swipe left again → "Back home 🏠". Each card fades. When the last dog is returned: confetti, walk summary, optional notes.

**Total: 14 swipes for a 7-dog walk. Zero navigation. Zero confusion about which screen to use.**

### Mid-day: Rod checks status (11:30 AM)

Rod doesn't need to navigate anywhere. His Dashboard shows all groups with live status. At the top of the screen, a compact **status strip** shows:

```
Plateau: ● Chloe — 5/7 picked up  ● Solene — Done ✓  ● Megan — Planning
Laurier: ● Amanda — 3/6 walking   ● Belen — Not started
```

This strip is always visible. No scrolling needed. If Rod taps a group, it expands to show individual dog status. If something needs attention (a note was added, a dog was skipped, a pickup is overdue), it surfaces as a subtle amber badge on the status strip — Rod doesn't have to go looking for problems.

The Admin page still exists for dog management, conflict rules, backups, and system config. But the Today tab is redundant — its information now lives on the Dashboard.

### Evening: Gen reviews the day (6:00 PM)

Gen opens Admin > Today (or: the Dashboard, since status is now inline). She sees:

```
Plateau: All groups done ✓ — 25/25 dogs walked — 2 notes
Laurier: All groups done ✓ — 18/20 dogs walked — 1 skip (Bella: owner cancelled)
```

She taps "2 notes" to see what walkers reported. She taps "1 skip" to see the reason. No digging required.

---

## 4. SPECIFIC RECOMMENDATIONS

Ordered by impact (highest first).

### 1. Auto-suggest groups from historical patterns and address proximity
**What:** When Acuity events load, the app pre-groups dogs into walk groups using: (a) the most recent group composition for this day-of-week and sector, (b) address proximity clustering for new/changed dogs, (c) conflict avoidance.
**Why:** Manual grouping of 25-50 dogs is the single biggest daily time cost. Rod spends 15-25 minutes on a task that could take 2. The data needed (walk_groups history, dog addresses, dog_conflicts) already exists in Supabase.
**Replaces:** Starting with an empty unassigned pool every morning.

### 2. "Copy last Wednesday" / template groups
**What:** A button that loads last week's (or last same-day-of-week's) group assignments as a starting point. Rod tweaks from there instead of starting from zero.
**Why:** Dog rosters are ~80% stable week-to-week. The 20% that changes can be manually adjusted in 2 minutes. This is a simpler implementation than full auto-grouping and would deliver 80% of the benefit.
**Replaces:** Manual reconstruction of known-stable groups every single day.

### 3. Inline status strip on Dashboard — kill Admin > Today tab
**What:** A compact, always-visible status strip at the top of the Dashboard showing all groups' status (planning/walking/done) with dog counts and walker names. Tappable for detail. Replaces the need to navigate to Admin > Today.
**Why:** Rod currently toggles between Dashboard and Admin to get a full picture. Status should live where the action happens. The Admin > Today tab becomes redundant and can be removed.
**Replaces:** Admin > Today tab for status monitoring. Admin page focuses on configuration only (dogs, conflicts, system, backups).

### 4. Walker-focused home screen with "Your Walk" prominence
**What:** When a walker (non-admin) opens the app and their group is assigned and locked, show ONLY their group prominently, with other groups collapsed. Show a clear "You're walking Group Morning East — 7 dogs" header.
**Why:** Walkers currently see all groups and must scan for their name. This creates 5-10 seconds of confusion every time they open the app. Sector-locked walkers need only their own group front and center.
**Replaces:** The current "show everything equally" view that treats admin and walker the same.

### 5. Auto-assign walkers from schedule data
**What:** When groups are created (manually or via suggestion), auto-populate walker slots based on `profiles.schedule` (which walkers are scheduled for today) and historical assignment patterns.
**Why:** The schedule data exists in the database. Rod manually assigns walkers to the same groups every week. Let the app do this automatically and Rod just confirms. Saves ~12 taps per sector per day.
**Replaces:** Manual tap-to-assign-walker flow for every group.

### 6. Unify Dashboard and Schedule into one view
**What:** Merge the Schedule page's useful features (walk logging, time-grouped view) into the Dashboard. Remove `/schedule` as a separate route. The GroupOrganizer's locked state should handle everything: swipe to pickup, swipe to return, swipe for notes. Walk logging happens automatically when all dogs are returned.
**Why:** Two overlapping views confuse users and split development effort. The Schedule page isn't even reachable from the bottom nav. Its unique value (time-slot grouping, walk log modal) can live within the GroupOrganizer flow.
**Replaces:** The orphaned Schedule page at `/schedule`.

### 7. Reframe "Lock" as "Ready to Walk" / "Start Walk"
**What:** Replace the padlock metaphor with a clearer action: "Ready to Walk" button that transitions to walk mode. The per-group lock button becomes a checkmark-style "Ready" toggle. The "Lock All Groups" button becomes "Start Walking."
**Why:** "Lock" implies security. Walkers don't intuit that locking enables swipe-to-pickup. "Ready to Walk" → "Walking" → "Done" is a natural progression that matches the mental model.
**Replaces:** Padlock icons, "hold 1 second to lock" interaction, "Lock All Groups" label.

### 8. Surface undo on the card, not buried in profile
**What:** When a dog is marked as picked up or returned, show a small "Undo" button directly on the card (visible for 10 seconds, then fades to just a tap target). Alternatively: tapping a picked-up card's checkmark triggers a quick "Undo pickup?" confirmation.
**Why:** The current undo flow requires opening the profile drawer, finding the timestamp, and editing it — 4-5 taps to fix a 1-swipe accident. A mis-swipe during a walk (cold fingers, dogs pulling) is common and should be instantly reversible.
**Replaces:** The "edit timestamps in profile" undo flow (which can remain as a secondary/precise option).

### 9. Simplify Owl Notes to essential features only
**What:** Strip owl notes to: text message + scope (everyone, one sector, or one dog) + optional expiry. Remove: @mention autocomplete, scheduled dates, duration parsing syntax. Keep: daily acknowledgment (valuable for recurring reminders).
**Why:** The current system has 8+ features for what is essentially "Rod sends a heads-up to the team." The complexity makes it slower to create a note (type a message, figure out @targeting, set expiry format) than to just text the walker directly. Simpler = more used.
**Replaces:** The OwlQuickDrawer's @mention system, scheduled dates, auto-expiry parsing.

### 10. Add "stale data" indicator and periodic auto-refresh
**What:** Show a subtle "Last synced: 9:42 AM" label on the Dashboard. Auto-refresh Acuity data every 10 minutes (or when app returns to foreground after >5 minutes in background). Show a badge when data has changed since last view.
**Why:** Currently the only refresh mechanism is pull-to-refresh, which requires the user to know data might be stale. If a booking is cancelled on Acuity mid-morning, Rod won't know until he manually pulls.
**Replaces:** Pull-to-refresh as the sole refresh mechanism (keep it as manual override).

### 11. Relocate Friend Check from Dogs page to Admin > Manage
**What:** Move the "Have two dogs walked together?" feature from the top of the Dogs page to the Admin > Manage > Logs tab (where walk history already lives).
**Why:** Friend check is an admin research tool that takes prominent space on a page every walker uses for basic dog lookups. Walkers searching for "Buddy" have to scroll past the friend check section to reach the dog list. The feature belongs with other admin data tools.
**Replaces:** Friend check at the top of DogsPage.jsx.

### 12. Smart route ordering in locked groups
**What:** When a group is locked, automatically sort dogs by address proximity to create an efficient walking route. Show the estimated route on the inline map. Allow manual reorder override.
**Why:** Currently, dogs are in the order they were dragged into the group (random). The walker either mentally plans a route or taps "Start Route" which opens Google Maps externally. In-app route optimization would save 5-10 minutes of route planning per walk.
**Replaces:** Manual drag reordering within locked groups + external Google Maps redirect.

---

## 5. WHAT TO CUT

### Cut: Schedule page (`/schedule`)
The Schedule page is a parallel view to the Dashboard that shows the same data in a different format (time-slot cards vs groups). It has no bottom nav entry and is effectively unreachable. Its unique features (time-grouped cards, walk log modal, route builder) should be absorbed into the Dashboard/GroupOrganizer. Having two competing views for the same data creates confusion and maintenance burden.

### Cut: Admin > Today tab (after implementing inline status strip)
Once the Dashboard has an inline status strip showing all groups' live status, the Admin > Today tab becomes redundant. The Admin page should focus on what it's uniquely good at: dog management, conflict rules, team roster, system health, backups. Status monitoring belongs on the operational screen.

### Cut: Beast Chat on Admin page
The Beast AI Assistant is a collapsible section at the bottom of Admin > Today. Unless it's actively being used and providing value, it's UI clutter on an already-complex page. If it IS providing value, it should be accessible from a more discoverable location (Settings or a dedicated tab), not buried at the bottom of a status page.

### Cut: Weekly View toggle on Dashboard
The Dashboard's "Today/Weekly" view toggle adds complexity. The WeeklyView shows a 7-day grid with dog counts per day — useful for planning ahead, but it competes with the GroupOrganizer for the same screen real estate. If kept, it should be its own tab or page, not a toggle on the main operational view. The Dashboard should always show today's operational state.

### Cut: Owl Notes @mention autocomplete complexity
The @mention system with autocomplete for dog names, sector names, and "all" is over-engineered. A simple dropdown with three options (Everyone, Plateau, Laurier) plus an optional dog selector would be faster and less error-prone than typing @-symbols and waiting for autocomplete.

### Cut: DogProfileDrawer as a duplicate of DogDrawer
`DogProfileDrawer.jsx` (used on Dogs page) and `DogDrawer.jsx` (used on Dashboard) are two separate drawer components for dog profiles. They share similar UI but diverge in details. Consolidate to one component with a mode flag (view vs edit, with-walk-info vs without).

---

## 6. WHAT TO AUTOMATE

### A1. Group Suggestion Engine
**What it does:** When Acuity events load for today, the system queries `walk_groups` for the most recent same-day-of-week entry per sector. It maps old dog assignments to today's dogs (by dog UUID, which is stable). New dogs (not in last week's groups) go to an "auto-assign" queue. The engine uses address geocoding to place them in the nearest group. Conflicting dogs (from `dog_conflicts`) are automatically separated.
**Data needed:** `walk_groups` (historical), `dogs.address`, `dog_conflicts`, Acuity events for today.
**Output:** Pre-filled `groups` object passed to GroupOrganizer as initial state. Rod sees "Suggested groups" and can tweak or accept.

### A2. Walker Auto-Assignment
**What it does:** When groups are created, the system reads `profiles.schedule` and `profiles.sector`. For each group, it assigns the first available walker who (a) is scheduled for today, (b) is in this sector, (c) isn't already assigned to another group. Rod's name goes in last (he's the flex walker).
**Data needed:** `profiles.schedule`, `profiles.sector`, current group assignments.
**Output:** Pre-filled `walkerAssignments` in GroupOrganizer. Rod confirms with one tap.

### A3. Auto-Route Optimization
**What it does:** When a group is locked (entering walk mode), the system sorts dogs by geographic proximity using a nearest-neighbor algorithm on addresses. First pickup is closest to the walker's typical start point (could be the Wiggle office or the first address in the cluster). This creates an efficient walking route without the walker having to think about it.
**Data needed:** `dogs.address` (geocoded), group lock event.
**Output:** Reordered `dog_ids` in the locked group + optional Google Maps route URL pre-built.

### A4. Smart Status Updates
**What it does:** The system tracks time since group lock and since last pickup. If a group has been locked for >30 minutes with no pickups, it surfaces an alert: "Group Morning East — locked 35 min ago, no pickups yet." If a pickup happened >60 minutes ago with no return, it surfaces: "Buddy picked up 65 min ago — not yet returned." These alerts appear in the status strip on Rod's Dashboard.
**Data needed:** `walker_notes` (pickup/return timestamps), `walk_groups.locked` status, current time.
**Output:** Amber-flagged items in the status strip.

### A5. Daily Acuity-to-Groups Sync
**What it does:** Instead of the one-time Acuity fetch on Dashboard load, a background process runs at 7:00 AM and again at 8:30 AM to fetch today's Acuity events, match them to dogs, and pre-populate the unassigned pool (or feed into the Group Suggestion Engine). This means when Rod opens the app at 8:00 AM, data is already there — no loading spinner.
**Data needed:** Acuity API credentials, `dogs` table, `acuity_name_map`.
**Output:** Pre-cached matched events in a Supabase table, ready for instant load.

### A6. End-of-Day Auto-Summary
**What it does:** At 5:00 PM (or when the last group is marked done), the system generates a summary: dogs walked, dogs skipped (with reasons from notes), walker notes worth reviewing, and walk duration stats. This is stored in a `daily_summaries` table and surfaced on the Admin page. No more manual review.
**Data needed:** `walker_notes` (pickups, returns, notes), `walk_groups`, `dogs`.
**Output:** A daily summary record with counts, durations, flagged notes, and skip reasons.

---

## APPENDIX: Interaction Pattern Audit

### Patterns currently in use

| Pattern | Where Used | Touch Target OK? | One-Handed? |
|---------|-----------|-------------------|-------------|
| Swipe left | DogCard (pickup/return) | Yes (full card width) | Yes |
| Swipe right | DogCard (add note) | Yes (full card width) | Yes |
| Drag and drop | GroupOrganizer (move dogs) | Borderline (drag handles are 14px wide) | Difficult |
| Long-press (500ms) | DogCard → move menu | N/A (gesture) | Yes |
| Hold (1000ms) | LockButton | Yes (44×44) | Yes |
| Tap | Everywhere | Mostly yes (min-h-[44px] on buttons) | Yes |
| Pull-to-refresh | Dashboard, Schedule, Dogs | Yes (64px threshold) | Yes |
| Bottom sheet / drawer | DogDrawer, QuickNoteSheet, etc. | Yes | Yes |
| Pill toggle | Day selector, view mode, sector | Yes | Yes |
| Inline edit | Group name rename | Small target | Yes |
| Expandable section | DogCard expanded state, Admin groups | Yes | Yes |

**Assessment:** 11 distinct interaction patterns. This is on the high end for a mobile tool app. The core patterns (swipe, tap, bottom sheet) are well-implemented. Drag-and-drop is the weakest — mobile DnD is inherently clumsy, and the 14px drag handles are too small for cold fingers. The long-press as an alternative to drag is good design thinking.

**Recommendation:** Could consolidate to 7 patterns by removing drag-and-drop (replace with long-press menu exclusively), removing pull-to-refresh (replace with auto-refresh + manual refresh button), and removing the hold-1-second lock (replace with a standard tap toggle).

### Touch target audit
- Most buttons: 44px+ height ✓
- Drag handles: 14px wide ✗ (too small)
- Group name pencil icon: ~20px tap target ✗ (too small)
- Sector filter pills: adequate
- Walker slot buttons: adequate
- Dog name tap target: text-sized, relies on dashed underline as affordance ✓ (discoverable)

---

## APPENDIX: What Works Well

Not everything needs fixing. These elements are strong:

1. **Swipe-to-pickup/return flow** — The two-swipe lifecycle (pickup → return) is intuitive, fast, and works one-handed. The visual state progression (cream → sage green → faded) is clear. The swipe hint bar is a nice touch.

2. **Real-time sync** — Supabase realtime channels keep all users in sync within ~100ms. When Chloe picks up a dog, Rod sees it instantly. This is a genuine differentiator.

3. **Conflict detection** — The SOS banner that fires when conflicting dogs end up in the same group is immediate and actionable. The "Fix it" button is a one-tap resolution.

4. **Visual design system** — The color palette (coral, sage, amber, sand) is consistent and functional. Each color has a clear meaning: coral = action/attention, sage = positive/done, amber = warning, sand = inactive. The clay 3D card effect is distinctive.

5. **Offline support** — Cached dogs + offline queue + service worker. For walkers in basements or areas with poor signal, this is essential.

6. **Owl notes concept** — The idea of targeted broadcast messages (to a dog, sector, or everyone) is good. The implementation is overbuilt, but the core concept of "admin leaves notes that walkers see at the right moment" is valuable.

7. **Dog card information density** — Position number, difficulty dot, name (fuchsia if has standing instructions), address, door code — all visible on the mini card without expanding. This is excellent information architecture for a walker at a door.

8. **Walker picker with schedule awareness** — The walker picker already highlights who's scheduled today. This is the right foundation for auto-assignment.
