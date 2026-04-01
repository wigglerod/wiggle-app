# WIGGLE DESIGN RULES
## For AI agents editing code — NO HTML in this file on purpose.
## Text-only design spec. Match these rules when editing any component.

---

## COLOR SYSTEM

### Brand Colors (keep these)
- Coral: #E8634A (primary action, lock slider, badges, CTAs)
- Coral dark: #C94A34 (pressed states, gradients)
- Coral light: #FAECE7 (status highlights, light backgrounds)

### Functional Colors (use what makes sense for aesthetics + clarity)
- Sage: #2D8F6F (positive states — picked up, done, easy difficulty)
- Sage bg: #E8F5EF (picked up card background)
- Sage border: #6DCAA8 (picked up card border)
- Amber: #C4851C (attention states — warnings, needs-attention dot, skip)
- Amber bg: #FDF3E3 (owl notes, warning backgrounds)
- Amber border: #F0C76E (warning borders)
- Slate: #475569 (addresses, door codes, secondary info)

### Canvas (backgrounds)
- Peach: #FFF5F0 (app background)
- Cream: #FAF7F4 (card backgrounds — NOT pure white)
- Sand: #F0ECE8 (secondary backgrounds, done/faded cards)
- Border: #E8E4E0 (card borders — warm gray)
- Shadow: #D5CFC8 (card bottom shadow — clay 3D effect)

### Text
- Text: #2D2926 (primary — warm black, NEVER #000 or #333)
- Text mid: #8C857E (secondary)
- Text light: #B5AFA8 (tertiary, labels)
- Text faint: #D5CFC8 (hints, disabled)

### Special
- Fuschia: #961e78 — ONLY used when dogs.notes field has content (permanent standing instructions)

### Color Philosophy
- Use colors that make sense for the design as a whole
- Blue IS allowed if it serves the design
- The key identity colors are coral and the warm tones
- Fuschia for dogs with permanent notes is a HARD rule
- Everything else: pick what looks good and communicates clearly

---

## FONT

- DM Sans everywhere (Google Fonts)
- Weights: 400, 500, 600, 700

---

## DOG CARD — THE MOST IMPORTANT COMPONENT

### Mini card (collapsed, default) MUST show:
- Position number (#)
- Difficulty dot (sage = easy, amber = needs attention)
- Dog name (tappable link, opens profile drawer)
- Address (street number + street name only — NO postal code, NO city)
- Door code (slate pill, white text — only if dog has one)
- That's it. Nothing else on the mini card.

### Dog name rules:
- Default color: BLACK (#2D2926) — the standard text color
- Dog name is a TAPPABLE LINK — tap opens DogProfileDrawer
- If dogs.notes has content: color changes to FUSCHIA (#961e78)
- dogs.notes = permanent standing instructions, NOT owl notes
- dogs.notes empty or null = stays black

### Card styling:
- Background: cream (#FAF7F4)
- Border: 1px solid #E8E4E0
- Border-bottom: 2.5px solid #D5CFC8 (clay shadow effect)
- Border-radius: 10px
- Font: DM Sans, 12px
- Padding: 8px 10px

### Address display:
- Font: 10px, slate color (#475569), font-weight 500
- Right-aligned, truncate with ellipsis
- Split on first comma, strip Canadian postal codes
- Result: street number + street name only (e.g. "4200 Esplanade")

### Door code display:
- Font: 9px, white text, bold
- Background: slate (#475569)
- Padding: 2px 7px, border-radius: 5px
- Only shown if dog has a door code

---

## GROUP HEADER RULES

### Walker buttons (NOT static text):
- Each group has TWO walker slots (buttons, not labels)
- Tap a walker button → opens a picker to switch/assign a different walker
- Walker picker shows walkers filtered by:
  1. FIRST: walkers scheduled for today in this sector (highlighted/primary)
  2. THEN: all other walkers in this sector (secondary options)
  3. Rod (Rodrigo) appears in BOTH sectors — he's the only cross-sector walker
- Exclude generic profiles: "Wiggle Pro", "Pup Walker", and any profile with null full_name
- Exclude admin-only profiles (Gen) from walker assignment

### Walker schedule data (from profiles table):
- profiles.schedule is a text string like "Mon, Tue, Wed"
- Parse with regex to check if today's day name is in the schedule
- profiles.sector determines which sector they appear in
- Rod has sector "both" — show him in both Plateau and Laurier pickers

### Actual walker roster:
PLATEAU walkers:
- Chloe: Mon, Tue, Fri
- Megan: Mon, Thu
- Solene: Tue, Wed, Thu

LAURIER walkers:
- Amanda: Mon, Tue, Wed, Thu
- Amelie: Tue, Wed
- Belen: Mon, Thu, Fri
- Maeva: Fri

BOTH SECTORS:
- Rodrigo: Wed Plateau, Fri Plateau (but can appear in any sector)

### Walker button styling:
- Primary (scheduled today): solid style, clearly visible
- Secondary (available but not scheduled): lighter/outlined style
- Empty slot: dashed border, "+ walker" text
- Walker name always visible on the group header line

### Group header format:
- Left: "Group 1"
- Right: walker name(s) + dog count
- Walker names always visible, always on the header

### Group border styles:
- All groups use a consistent border style (dashed, rounded)
- Different groups can have slightly different opacity/tint for visual distinction
- Active group (currently walking): highlighted border + bg
- Done group: faded, collapsed

---

## LOCK SLIDER

- Lock (slide RIGHT): coral gradient
- Unlock (slide LEFT): contrasting gradient (darker tone)
- Thumb: light bg with shadow, 44x44px, border-radius 12px
- Height: 60px total, border-radius 16px

---

## ABSOLUTE RULES

1. Dog names = tappable links → tap = profile drawer
2. Dog name DEFAULT color = BLACK (#2D2926)
3. dogs.notes has content → name = FUSCHIA (#961e78) — hard rule, never skip
4. Addresses ALWAYS visible on mini card
5. Door codes ALWAYS visible (slate pill) if they exist
6. Walker names on EVERY group header — as tappable buttons with picker
7. Two walker slots per group
8. Cards = cream (#FAF7F4), not pure white
9. Text = warm black (#2D2926), never #000 or #333
10. Background = peach (#FFF5F0)
11. Use colors that make aesthetic and functional sense — no arbitrary restrictions
