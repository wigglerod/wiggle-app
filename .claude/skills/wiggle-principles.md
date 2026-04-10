# Wiggle Principles
## The why behind every decision.

Every color has exactly one job. A color that does two jobs does neither.
Before building anything, ask: Which principle does this serve?

## THE ECOSYSTEM
### 1. Two Views, One Truth
The app and Tower Control are two views of one database. A change in one is instantly visible in the other.

### 2. Automate the Admin, Keep the Heart
Technology serves the relationship. Never the other way around.

## THE WALK DAY
### 3. The Door Is the Context
Every decision is filtered through: a walker at a building door, winter, one hand occupied, a dog already pulling. If it can't be done with one thumb in a winter coat, reconsider it.

### 4. Nothing Vanishes
No state transition removes a dog from view. Visibility is a safety feature.

### 5. Every Action Is Reversible
No destructive writes anywhere in the app.

### 6. Instant Then Correct
Every action updates the screen immediately, then saves to the database. Rollback on failure.

## THE DOG
### 7. The Card Never Lies
Always shows name, address, door code. No exception.

### 8. The Drawer Is the Control Centre
Every action that changes a dog's state lives inside the Dog Profile Drawer — and nowhere else.

### 9. Close Means Done With This Dog
Drawer closes after: pickup, back home, not walking, undo. Stays open after: notes, edit times.

### 10. Notes Have a Lifetime
- Forever Notes: never expire. Allergies, aggression, building quirks.
- Owl Notes: this week. Staff-to-staff handoffs.
- Acuity Notes: this booking.
- Walk Notes: today only.

## THE VISUAL LANGUAGE
### 11. Every Write Has a Name
Every action carries who did it — walker name, walker ID, timestamp.

### 12. Color Is Signal, Not Decoration
- Coral #E8634A → primary action
- Purple #534AB7 → tappable links, dog names, walker names
- Fuschia #961e78 → dog has a forever note
- Sage #2D8F6F → picked up, positive, done
- Amber #C4851C → needs attention, warning
- Slate #475569 → door codes, addresses
- Background #FFF5F0 → peach, never white
- Card #FAF7F4 → cream, never white

### 13. Warmth Is Structural
Cold grays are visual noise. Pure white is not Wiggle.

## THE FOUR FILTERS
WWRS — What would the walker need right now, one hand, winter coat?
ONE PLACE — Does this action already have a home?
SIMPLEST — What is the smallest version that solves the real problem?
BOTH VIEWS — Does this work for the app AND Tower Control?
