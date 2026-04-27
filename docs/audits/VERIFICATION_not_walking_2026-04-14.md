# VERIFICATION: "Not Walking today" Expand-Zone Button — Preview Deploy

**Date:** 2026-04-14  
**Verifier:** Claude (browser automation via Chrome MCP)  
**Branch:** `feat/not-walking-expand-zone` @ commit `1d161c8`  
**Preview URL:** `https://wiggle-ciggj9jix-wigglerods-projects.vercel.app/`  
**Test account:** `test@wiggledogwalks.com` (Chief Pup role)  
**Test dog:** Gustav — Plateau Group 1 (Braque De Weimar, route #3, address 3758 Rue de Mentana)

---

## Summary

**12/12 tests passed. Feature is ready to merge.**

---

## Test Results

### Test 1 — Expand zone shows both buttons ✅ PASS
- Opened Gustav's expand zone via chevron ▼
- Both "✎ Note" (left) and "Not Walking today" (right) buttons visible
- Buttons render side-by-side in a row, cream/sage styling on "Not Walking today"

### Test 2 — Click marks card as not_walking ✅ PASS
- Clicked "Not Walking today" on Gustav
- Card immediately transitions to amber state:
  - Background: warm cream/amber (`#FDF3E3`)
  - Border: amber (`#F0C76E`)
  - "Not walking" badge appears (amber outline pill)
  - Name shows strikethrough styling
  - Name color shifts to amber (`#C4851C`)
  - Chevron disappears
  - Expand zone collapses

### Test 3 — DB row written correctly ✅ PASS
- Verified via SQL: `walker_notes` row created with:
  - `dog_name`: Gustav
  - `note_type`: `not_walking`
  - `message`: "Not walking today"
  - `walk_date`: 2026-04-14
  - `walker_name`: Test Walker

### Test 4 — Undo via drawer ✅ PASS
- Tapped Gustav's name while in not_walking state → drawer opened
- WALK TIMES section shows amber background with "Not walking today" text
- "Undo — pick up after all" button visible and functional
- Clicked undo → card returns to default waiting state (coral border, chevron restored)
- DB verification: `not_walking` row deleted (empty result set)

### Test 5 — Button hidden when picked up ✅ PASS
- Eva (already picked up, green bg, ✓ checkmark, time shown)
- No chevron visible on Eva's card
- Card tap does nothing — expand zone unreachable
- Guard `!isPickedUp` works correctly

### Test 6 — Button hidden when already not_walking ✅ PASS
- Gustav in not_walking state: no chevron, card tap does nothing
- Expand zone unreachable — prevents double-click of "Not Walking today"
- Guard `!isNotWalking` on chevron + `if (isNotWalking) return` on card tap both work

### Test 7 — Existing Note button still works ✅ PASS
- Opened Gustav's expand zone, clicked "✎ Note"
- NoteComposer bottom sheet opens correctly:
  - Title: "✎ Note about Gustav"
  - 6 chips: Great walk 🐾, Tired today, Reactive, Paw bothering, Extra energy, 🚩 Flag
  - Free text area with "Add details... (optional)" placeholder
  - "Warn next walker" toggle with owl note description
  - "Send note" button
- NoteComposer is not broken by the new sibling button

### Test 8 — Mini Gen compatibility ✅ PASS
- `api/mini-gen.js` lines 172-196:
  - Queries `walker_notes` with `.eq('note_type', 'not_walking')` — matches the value written by `usePickups.markNotWalking`
  - Uses `dog_name` + `walk_date` for set membership — matches fields written
  - No field name mismatch, no schema drift

### Test 9 — Visual amber color match ✅ PASS
- Expand-zone card amber state matches drawer's not_walking visual treatment:
  - Card: amber bg `#FDF3E3`, amber border `#F0C76E`, amber name `#C4851C`, strikethrough
  - Drawer: amber WALK TIMES section with "Not walking today" text
  - "Not walking" badge pill: amber outline, consistent with design system

### Test 10 — Console errors ✅ PASS
- No console errors or exceptions logged during entire test session
- Tested across: expand zone open/close, not_walking click, undo, drawer open, NoteComposer open

### Test 11 — Service worker ✅ PASS
- Service worker registered and active at preview deploy scope
- Script: `/sw.js`, state: `activated`
- No stale cache issues observed during testing

### Test 12 — Mobile viewport (iPhone 13: 390×844) ✅ PASS
- Resized browser to 390×844
- Gustav's not_walking card renders correctly:
  - Amber background, "Not walking" badge, strikethrough name all visible
  - Address and door code fit without overflow
  - No horizontal scroll or clipped elements
  - Bottom nav bar (Schedule/Dogs/Settings) renders correctly

---

## Test Data Cleanup

| Action | Status |
|--------|--------|
| Delete Gustav `not_walking` rows from `walker_notes` | ✅ Done |
| Verify no orphan Test Walker rows for 2026-04-14 | ✅ Confirmed (0 rows) |

---

## Notes & Observations

### Pre-existing issue: Cheesy data collision
During initial testing with Cheesy (Laurier Group 4), a pre-existing `pickup` row from Rodrigo's real walk (18:33) caused the drawer's `isNotWalking && !pickedUpAt` conditional to fall through. This is NOT a bug in this PR — it's a pre-existing data state issue. Testing pivoted to Gustav (clean waiting state) for all remaining tests.

### Swipe gestures not testable via browser automation
Left/right swipe gestures could not be reliably triggered via Chrome MCP's click-drag. This didn't block any test — all 12 tests were completable via tap/click interactions. Swipe behavior should be confirmed on a physical device if desired.

### The expand zone guards are solid
Three independent guards prevent the "Not Walking today" button from appearing in wrong states:
1. Chevron hidden: `!isPickedUp && !isReturned && !isNotWalking`
2. Card tap disabled: `if (isReturned || isNotWalking) return`
3. Expand zone conditional: `expanded && !isPickedUp && !isReturned`

### Group count does NOT exclude not_walking
Group 1 shows "Walking 2/3" when Gustav is not_walking (Whiskey returned, Eva picked up, Gustav not_walking). The "2/3" counts pickups against total, but doesn't subtract not_walking dogs from the denominator. This is pre-existing behavior, not introduced by this PR.

---

## Verdict

**All 12 acceptance tests passed. No regressions found. Feature is ready to merge.**

---

*End of verification. Test data cleaned. No production data modified.*
