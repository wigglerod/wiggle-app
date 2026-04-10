# WIGGLE V4 — FULL VISUAL AUDIT
## Tower Control + Walker App
### April 6, 2026

---

## METHODOLOGY

Every route was opened live in Chrome and screenshotted while Rodrigo navigated.
Audit checks: design system compliance, information hierarchy, Gen's Monday morning test (WWGS), and polish/cleanup needs.

Code structure was also reviewed via source exploration of all Tower components, hooks, and pages.

---

## WALKER APP — THE FOUNDATION (PRESERVE)

The walker app is solid. It works, it feels like Wiggle, and walkers use it daily. These screens are the standard the Tower should aspire to.

### What's working well

- **Today view (locked):** Warm peach background, cream cards, coral borders on active groups, sage on picked-up dogs, door codes visible as slate pills, pickup times shown. This is the gold standard.
- **Today view (unlocked):** Dashed blue borders clearly signal edit mode. Walker buttons are purple. Groups show dog count and route order.
- **Dogs tab:** Search, "Check for Friends" tool, sector filter tabs (All/Plateau/Laurier), dog photos with difficulty dots and breed. Clean and useful.
- **Settings:** Simple — profile card, Admin Panel link, sign out, version. No clutter.
- **Dog cards:** Name, address, door code, difficulty dot — all visible without a tap. The promise is kept.

### Walker app issues (minor)

1. **Address shows postal code on some cards** — e.g. "4065 Rue Drolet H2W2L5" should be "4065 Rue Drolet" per CLAUDE.md spec (strip postal codes)
2. **Ben's address on the card still shows full format** — the address parser may not be stripping consistently

---

## TOWER CONTROL — ROUTE-BY-ROUTE AUDIT

---

### 1. DASHBOARD (/tower/dashboard) — Gen's primary screen

**What's good:**
- Title "Gen's Dashboard" with date — immediately orients Gen
- Sector pills top-right (Plateau 7 / Laurier 6) — quick count
- Stats bar: 13 Dogs today, 4 Flags, 10 Must-ask, 9 Owl notes active — the right numbers at a glance
- FLAGS section surfaces the real problems: 3 reactive dogs + 1 missing address
- TODAY'S DOGS as colored chips — fast visual scan
- OWL NOTES and MUST-ASK TODAY side by side — good density for desktop
- The Beast AI at the bottom with "Confirms before acting" badge — trust signal

**Top 3 problems:**

1. **FLAGS section has no actions.** Gen sees "Luna GS — reactive dog" but can't do anything from here. No link to the dog, no "acknowledged" button, no way to dismiss. It's information without resolution. WWGS says: she needs to act on these, not just read them.

2. **Must-Ask list has no context.** Shows dog names with sector badges but no reason WHY they're must-ask. Gen has to tap each one to find out. The "why" should be visible inline — even one line ("reactive", "new address", "owner note") would transform this from a list into a decision tool.

3. **Owl notes section is just a feed.** No grouping by sector, no expiry urgency indicators on this view (the Schedule page has them, but the dashboard doesn't). Gen sees Pepper Mini Aussie's note from April 6 the same as Ziva's from March 24. The recent/urgent ones should feel different.

**Design system notes:**
- Background is warm peach ✓
- Cards are cream ✓
- Coral is the CTA color ✓
- Dog name chips use colored backgrounds — some are red/coral for reactive dogs which is good, but the color logic isn't documented in CLAUDE.md. Are these reactive flags? Must-ask flags? The legend is missing.

---

### 2. WEEKLY BOARD (/tower/weekly)

**What's good:**
- Clean 5-day × 2-sector grid — Gen sees the whole week at once
- Today (Monday) is highlighted with orange top border
- Dog names as chips — compact and scannable
- Reactive dogs highlighted in red/coral chips (Luna GS, Nela, Pebbles, Sirius)
- Legend at bottom: Reactive dog / Must-ask / Walker
- PM slots visible but empty — honest about what's not scheduled

**Top 3 problems:**

1. **No walker names visible.** The grid shows dogs but not WHO is walking them. Gen needs to know "Monday Plateau = Chloe + Megan" at a glance. The walker app's group headers show this — the weekly board should too.

2. **No way to act on a day.** Tapping a cell should do something — open that day's groups, or at minimum show the full roster. Right now it's read-only with no drill-down.

3. **PM slots are empty with just "PM" label.** If PM walks are rare or future, consider hiding PM rows until they have data. Empty rows waste Gen's screen space and create the impression something is missing.

**Design system notes:**
- Sector labels use correct colors (teal-blue for Plateau, green for Laurier) ✓
- Red chips for reactive dogs — same question as dashboard: is this documented?
- Grid borders are warm ✓

---

### 3. DOG ROSTER (/tower/dogs)

**What's good:**
- Clean table with all 95 dogs
- Columns: Dog, Owner, Sector, Address, Door Code, Notes, Schedule
- Sector pills (Plateau/Laurier) in correct colors
- Door codes in coral/red — visible
- Notes column shows truncated text
- Schedule shows M T W T F day indicators
- Grouped by sector with header

**Top 3 problems:**

1. **No search or filter.** 95 dogs in one scrolling table. Gen needs to find Pepper Mini Aussie's address — she has to scroll. The walker app has search; the Tower roster doesn't. This is the #1 missing feature on this page.

2. **Door codes are coral/red text.** Per CLAUDE.md, door codes should be slate pills (#475569, white text). The Tower roster is using a different treatment than the walker app cards. Should match.

3. **"Notes" column truncates.** If a dog has a forever note, Gen sees "Protective dog - be careful. Lockb..." — she can't read the full thing without another click (if clicking even works). Consider a tooltip or expandable row.

**Design system notes:**
- Dog names are NOT purple even when they have forever notes — violates the CLAUDE.md rule: "Purple #534AB7 on dog name = this dog has a forever note"
- Table rows have no hover state visible in the screenshot
- Schedule column with letter abbreviations is clean

---

### 4. SCHEDULE ECOSYSTEM (/tower/schedule)

**What's good:**
- All three sections present: Owl Notes, Conflict Rules, Sector Overrides
- Owl notes show dog name, sector, note text, author, and scheduled date
- Conflict Rules: Mochi + Chaska → "Never same group" — clear
- Sector Overrides: Paloma → "Always Plateau" — clear

**Top 3 problems:**

1. **Owl notes have no expiry information on this page.** The Admin Dashboard shows "Expires today", "1 week left", "3 weeks left" — but the Schedule Ecosystem page just shows the scheduled date. Gen needs to see which notes are about to expire HERE, not just in the admin panel.

2. **No way to create or edit from this view.** This is read-only. To create an owl note, Gen has to go to Admin Dashboard → scroll down → find the composer. The Schedule page should either have a "New Owl Note" button or link directly to the composer.

3. **Dog names in coral/red instead of purple.** Per CLAUDE.md, dog names that are tappable links should be purple (#534AB7). The coral/red treatment makes them look like warnings rather than interactive links.

**Design system notes:**
- Left border accent on owl note cards — works well as a visual grouping device
- Section headers use uppercase small text — clean
- Warm backgrounds ✓

---

### 5. BILLING (/tower/billing)

**What's good:**
- Placeholder is honest: "Coming next session — Acuity API connection needed"
- Subtitle "Packages · renewals · predictions" sets expectations

**Top 3 problems:**

1. **This is a placeholder.** Not a problem — just noting it's not built yet.
2. **The empty space is vast.** Could show a brief description of what this will do, or even a "coming soon" illustration to make it feel intentional rather than broken.
3. **No ETA or link to context.** Gen might wonder "is this weeks or months away?"

---

### 6. STAFF (/tower/staff)

**What's good:**
- Walker schedule grid: Name × Mon-Fri with sector assignments
- Roles shown: Wiggle Pro, Chief Pup
- Sector labels in correct colors
- Shows Rod and Gen too — complete picture
- Dashes for off-days — clear

**Top 3 problems:**

1. **Gen and Rod are mixed into the walker list.** They're admins, not walkers. Showing "Admin" for every day of Gen's week doesn't help anyone. Consider separating admins from walkers, or at least visually distinguishing them.

2. **No phone/email/contact info.** If Gen needs to reach Chloe about a group change, she has to know Chloe's number already. A contact column or tap-to-call would be useful.

3. **Read-only with no indication of source.** The Staff page doesn't say where this schedule comes from or how to change it. The code mentions "Walkers are scheduled in Wiggle HQ" — that note should be visible to Gen.

**Design system notes:**
- Sector badges use the right colors ✓
- Table is clean and readable ✓
- Role badges are a nice touch

---

### 7. MINI GEN (/tower/mini-gen)

**What's good:**
- 2-column grid of draft cards — good density
- Each card: date + sector, dog name chips, Approve/Reject buttons, flag count, dog count
- "Run Mini Gen" coral button in header
- "Last run: Sun, Apr 5 · 27 draft days pending" — status at a glance
- "No flags for this day" green checkmarks — trust signal

**Top 3 problems:**

1. **27 pending drafts is overwhelming.** Gen sees a wall of cards. There's no prioritization — March 30 cards (6 days old!) appear alongside today's drafts. Stale drafts should be visually different or auto-archived.

2. **No bulk approve.** Gen has to tap Approve on each card individually. If she trusts Mini Gen's output for a clean week, she should be able to "Approve all no-flag days" in one action.

3. **This page lives outside the Tower sidebar navigation.** The sidebar has Dashboard, Weekly Board, Dogs, Schedule, Billing, Staff — but no Mini Gen link. You access it via a separate URL or button. Gen might not know it exists. It should be in the sidebar.

**Design system notes:**
- Header bar uses orange/coral gradient — different from the rest of Tower which uses the peach bg. Creates a visual disconnect.
- Dog chips use neutral colors — good, not competing with the Approve/Reject buttons
- Approve = green, Reject = red — standard but not Wiggle palette. Consider sage for approve and amber for reject.

---

## ADMIN DASHBOARD (/admin) — THE CLEANUP TARGET

This is the page that needs the most work. It's a long, scrolling mega-page that tries to do everything.

### Today tab

**What's good:**
- Sector summary at top (Plateau 5 dogs / Laurier 4 dogs / walker names / Walking status)
- Warning alerts for unassigned groups (amber background)
- Groups list with status dots and completion counts

**Problems:**
- **Duplicates Tower Dashboard.** The sector summary and group status already live on Gen's Dashboard. Having two places for the same info breaks ONE PLACE.
- **Warning style is correct** (amber bg) — but the group list below uses red/green dots that aren't in the color system.

### Owl Note Composer

**What's good:**
- @ mention support for dogs, sectors
- Date picker for scheduled appearance
- Active Notes (8) with expiry indicators ("Expires today", "1 week left", "3 weeks left")
- Scheduled Notes (1) section — nice separation
- X button to dismiss notes

**Problems:**
- **This composer should live on the Schedule page**, not buried in the Admin Dashboard. WWGS: Gen goes to Schedule to manage notes, not to Admin.
- **Expiry indicators here are great** but missing from the Schedule Ecosystem page and Dashboard owl notes section. Be consistent.

### Beast AI Assistant (Admin)

- **CRASHES on click.** This is a confirmed bug. The Beast section works on the Tower Dashboard but crashes when accessed from the Admin page.

### Manage tab — Dogs

**What's good:**
- Dog list with photos, difficulty dots, sector badges
- Edit (pencil) and delete (trash) icons per dog
- "+ Add Dog" and "Sync" buttons
- Sector filter tabs

**Problems:**
- **This duplicates the Dogs tab in the walker app AND the Dog Roster in Tower.** Three places to see dogs. ONE PLACE is violated.

### Manage tab — Logs & Conflicts

**What's good:**
- Walk history search ("Have two dogs walked together?")
- Conflict rule manager with Mochi & Chaska visible
- "+ Add Conflict Rule" button

**Problems:**
- **Conflict management duplicates the Schedule Ecosystem page.** Schedule shows conflicts read-only; Admin lets you edit them. Should be one place.

### Manage tab — System

**What's good:**
- Stats cards: 95 Dogs, 12 Walkers, 2 Notes today
- Team list with names, emails, sectors, role badges
- Database Protection section — all green checks
- Backup History (last 7) — all OK
- Protection Status: DROP TABLE blocked, TRUNCATE blocked, audit logging, nightly backups, seed script protection

**Problems:**
- **Team list duplicates the Staff page.** Staff shows the weekly schedule; System shows the contact list. These should be unified.
- **Database Protection is excellent** but is this something Gen needs to see? This feels like Rod-only information.

---

## CROSS-CUTTING ISSUES

### 1. The ONE PLACE rule is broken in multiple places

| Information | Lives in... | Should live in... |
|---|---|---|
| Dog list | Walker App Dogs, Tower Dog Roster, Admin Manage Dogs | Tower Dog Roster (admin adds edit capability) |
| Owl notes | Dashboard, Schedule Ecosystem, Admin Owl Composer | Schedule Ecosystem (with composer added) |
| Conflict rules | Schedule Ecosystem (read), Admin Logs & Conflicts (edit) | Schedule Ecosystem (with edit added) |
| Group status | Dashboard, Admin Today tab | Dashboard only |
| Team/Staff | Tower Staff, Admin System | Tower Staff (with contact info added) |
| Beast AI | Dashboard, Admin (crashes) | Dashboard only |

### 2. The Admin Dashboard should be dismantled

The Admin page at /admin is a legacy mega-page. Its useful parts should be absorbed into the proper Tower routes:
- Owl Note Composer → Schedule Ecosystem page
- Conflict editor → Schedule Ecosystem page
- Dog management (add/edit/delete) → Dog Roster page
- Beast AI → already on Dashboard (remove from Admin)
- Database/Backup → System page or Rod-only settings
- Group status → already on Dashboard (remove from Admin)

### 3. Color system violations

- Dog names in Tower are NOT purple when they have forever notes (Dog Roster, Schedule, Dashboard chips)
- Door codes in Dog Roster use coral/red text instead of slate pills
- Dog name links on Schedule page use coral/red instead of purple
- Mini Gen header uses orange gradient instead of warm peach bg
- Approve/Reject buttons on Mini Gen use raw green/red instead of sage/amber

### 4. Missing from Tower that Gen needs

- **Search** on the Dog Roster page
- **Actions** on Dashboard flags (acknowledge, link to dog)
- **"Why"** on Must-Ask items
- **Expiry indicators** on Dashboard and Schedule owl notes
- **Walker names** on Weekly Board
- **Mini Gen** in the sidebar navigation
- **Bulk approve** on Mini Gen page

---

## BUG LOG

1. **Beast AI crashes** when opened from Admin Dashboard (confirmed by Rod)
2. **Address parser inconsistency** — some walker app cards show postal codes that should be stripped

---

## PRIORITY RECOMMENDATION

**Phase 1 — Clean:** Dismantle the Admin Dashboard. Move owl note composer to Schedule, conflict editor to Schedule, dog CRUD to Dog Roster. Remove duplicated sections. Fix the Beast crash by removing it from Admin (it already works on Dashboard).

**Phase 2 — Polish:** Fix color system violations across all Tower pages. Purple dog names, slate door code pills, sage/amber for approve/reject. Make Tower feel like Wiggle.

**Phase 3 — Empower:** Add search to Dog Roster, actions to Dashboard flags, "why" to Must-Ask, walker names to Weekly Board, Mini Gen to sidebar, bulk approve.

---

*Audited by Cowork. Visual screenshots + source code review. April 6, 2026.*
*Work smart, play always. 🐾*
