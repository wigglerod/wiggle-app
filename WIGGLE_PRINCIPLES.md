# WIGGLE PRINCIPLES
## The why behind every decision.
## When a rule doesn't exist for your situation, come back here.
## Last updated: April 3, 2026 — V2 clean slate

---

## How to use this file

Rules tell you what to do.
Principles tell you why — so you can make the right call on things
no rule anticipated.

Before building anything, ask:
1. Which principle does this serve?
2. Does it contradict any other principle?
3. What would Rodrigo do?

If you can't answer all three, the scope is not ready.

---

## THE ECOSYSTEM

### 1. Two Views, One Truth
The app and Tower Control are not two systems.
They are two views of one database.
A change in one is instantly visible in the other.

Because Rod plans from the desk, walkers execute in the field.
Same dogs, same truth, different windows.
If a feature only works in one view, it is incomplete.

### 2. Automate the Admin, Keep the Heart
The app exists to remove friction from operations —
not to replace the human relationships that make Wiggle what it is.

Because 8 years of client trust wasn't built by software.
It was built by walkers who knew every dog by name.
Technology serves the relationship. Never the other way around.

---

## THE WALK DAY

### 3. The Door Is the Context
Every decision is filtered through one moment:
a walker at a building door, winter, one hand occupied,
a dog already pulling.

If it can't be done with one thumb in a winter coat, reconsider it.
The worst UX failure isn't ugly — it's a walker fumbling
while an anxious dog strains at the leash.

### 4. Nothing Vanishes
No state transition removes a dog from view.
Not walking stays amber. Returned fades but remains.
The count always matches reality.

A disappearing card creates doubt — "did I miss one?" —
and doubt at a door with six dogs is dangerous.
Visibility is a safety feature.

### 5. Every Action Is Reversible
State is additive (insert) and reversible (delete).
No destructive writes anywhere in the app.

Cold fingers misswipe. New walkers make mistakes.
The cost of an error must be near zero.
If an action cannot be undone, question whether it belongs here.

### 6. Instant Then Correct
Every action updates the screen immediately,
then saves to the database. The UI never waits for the server.
Rollback on failure.

A pause per swipe compounds across 40 dogs on spotty cell service.
Basements have no signal at all.
The walker's experience cannot depend on network latency.

---

## THE DOG

### 7. The Card Never Lies
The dog card always shows name, address, and door code —
no layout mode, no role, no exception can remove them.

The card is a promise: everything you need to get through that door
is visible without a single tap.
isCompact may reduce size. It may never remove content.

### 8. The Drawer Is the Control Centre
Every action that changes a dog's state for the day
lives inside the Dog Profile Drawer — and nowhere else.

One dog, one place, always the same gesture.
Splitting actions across surfaces breaks muscle memory.
If you're about to add a dog action somewhere other than the drawer,
stop. You are breaking this principle.

### 9. Close Means Done With This Dog
The drawer closes automatically after status actions:
pickup, back home, not walking, undo.
It stays open after informational taps: notes, edit times.

When a walker marks a dog as picked up,
they are already moving to the next door.
The app should move with them, not wait for a manual close.

### 10. Notes Have a Lifetime
- Forever Notes → never expire. Allergies, aggression, building quirks.
- Owl Notes → this week. Staff-to-staff handoffs.
- Acuity Notes → this booking. Owner's immediate-need message.
- Walk Notes → today only. State, times, events.

The right note at the right time is the only note that helps.
When unsure where a note belongs, ask:
"When does this stop being relevant?" — that is its lifetime.

---

## THE VISUAL LANGUAGE

### 11. Every Write Has a Name
Every action carries who did it — walker name, walker ID, timestamp.
No anonymous mutations anywhere in the system.

"Who did this?" lets Rod help when something goes wrong.
Accountability is care, not surveillance.
7 walkers, 95 dogs, one operation — attribution is how it stays coherent.

### 12. Color Is Signal, Not Decoration
Every color has exactly one job.
A color that does two jobs does neither — it becomes noise.

Before adding any color, ask: what does this color already mean?
If it has a job → you cannot reassign it.
If it has no job → define one before using it.
A color is allowed if it has purpose: functional, aesthetic, or guides the walker.

Current color jobs:
- Coral #E8634A → primary action, something to tap
- Purple #534AB7 → this dog has a forever note / group structure / walker identity
- Sage #2D8F6F → picked up, positive, done
- Amber #C4851C → needs attention, not walking, warning
- Slate #475569 → utilitarian info, door codes, addresses
- Black #2D2926 → default dog name, primary text

### 13. Warmth Is Structural
The palette is warm — peach, cream, coral, amber, sage.
Cold grays are visual noise. Pure white is not Wiggle.

Wiggle is built on personality and trust, not logistics.
The app should feel like the company feels —
approachable, warm, and alive.
If it feels like a bank app, it is wrong.

---

## THE FOUR FILTERS
### Run every decision through these, in order.

**WWRS** — What would the walker need right now, one hand, winter coat?
If the answer is "not this" — stop.

**ONE PLACE** — Does this action or information already have a home?
If yes — put it there. Do not create a second home.

**SIMPLEST** — What is the smallest version that solves the real problem?
Strip it to the bone. Build that first.

**BOTH VIEWS** — Does this work for the app AND Tower Control?
If it only works in one — it is incomplete.

---

## REAL SITUATIONS — HOW TO APPLY THESE

**"Should this go in the app or Tower Control?"**
App = walkers in the field, real-time, one hand.
Tower = Rod and Gen at the desk, planning, managing.
If it requires a keyboard or takes more than 2 taps — it's probably Tower.

**"Where does this new action go?"**
Affects a specific dog's state today → Dog Profile Drawer.
Affects a group → group header or Tower Control.
Affects the whole day → Tower Control.

**"Should we add this feature?"**
Run WWRS. Run SIMPLEST. If it passes both — scope it.
If it fails either — defer it or kill it.

**"This drawer is getting long — should we split it?"**
No. The drawer is the control centre because everything is in one place.
The solution to a long drawer is better hierarchy inside it,
not a second screen.

**"A walker is confused by the app closing after pickup."**
That is working as designed. Close means done with this dog.
If it feels wrong, the onboarding needs to be better — not the behavior.
