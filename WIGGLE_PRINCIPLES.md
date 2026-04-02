---
name: wiggle-principles
description: >
  Wiggle Dog Walks — the why behind every decision. These are not rules or features.
  They are the principles that explain why the app was built the way it was, and how
  to make the right call on situations no rule anticipated. Use this skill whenever
  making an architectural decision, scoping a new feature, questioning whether something
  belongs in the app or Tower Control, or when a rule doesn't exist for the situation
  at hand. Also trigger when the user asks "should we build this?", "where does this
  belong?", or "does this feel right?" — load this before answering. When in doubt,
  read the principles before writing a single line.
---

# Wiggle Principles
## The why behind every decision.
## When a rule doesn't exist for your situation, come back here.
## Last updated: April 2, 2026

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
*Why Wiggle exists and how its two parts work together.*

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
*How the app behaves during the hours that matter most.*

### 3. The Door Is the Context
Every decision is filtered through one moment:
a walker at a building door, winter, one hand occupied,
a dog already pulling.

Because the worst UX failure isn't ugly — it's a walker
fumbling while an anxious dog strains at the leash.
If it can't be done with one thumb in a winter coat, reconsider it.

### 4. Nothing Vanishes
No state transition removes a dog from view.
Not walking stays amber. Returned fades but remains.
The count always matches reality.

Because a disappearing card creates doubt —
"did I miss one?" — and doubt at a door with six dogs is dangerous.
Visibility is a safety feature.

### 5. Every Action Is Reversible
State is additive (insert) and reversible (delete).
No destructive writes anywhere in the app.

Because cold fingers misswipe, new walkers make mistakes,
dogs get confused. The cost of an error must be near zero.
If an action cannot be undone, question whether it belongs here.

### 6. Instant Then Correct
Every action updates the screen immediately,
then saves to the database. The UI never waits for the server.
Rollback on failure.

Because a pause per swipe compounds across 40 dogs
on spotty cell service — and basements have no signal at all.
The walker's experience cannot depend on network latency.

---

## THE DOG
*How every dog is seen, acted on, and remembered.*

### 7. The Card Never Lies
The dog card always shows name, address, and door code —
no layout mode, no role, no exception can remove them.

Because the card is a promise:
everything you need to get through that door
is visible without a single tap.
isCompact may reduce size. It may never remove content.

### 8. The Drawer Is the Control Centre
Every action that changes a dog's state for the day
lives inside the Dog Profile Drawer — and nowhere else.

Because one dog, one place, always the same gesture.
Splitting actions across surfaces breaks muscle memory.
If you are about to add a dog action somewhere other than
the drawer, stop. You are breaking this principle.

### 9. Close Means Done With This Dog
The drawer closes automatically after status actions:
pickup, back home, not walking, undo.
It stays open after informational taps: door code, notes, edit times.

Because when a walker marks a dog as picked up,
they are already moving to the next door.
The app should move with them, not wait for a manual close.

### 10. Notes Have a Lifetime
- Owl notes → this week. Walker-to-walker handoffs.
- Forever notes → never expire. Allergies, building quirks, aggression.
- Walk notes → this walk only. State, times, today's events.

Because showing an 8-month-old note next to today's pickup time
creates noise. The right note at the right time
is the only note that helps.
When unsure where a note belongs, ask:
"When does this stop being relevant?" — that is its lifetime.

---

## THE VISUAL LANGUAGE
*How the app communicates without words.*

### 11. Every Write Has a Name
Every action carries who did it —
walker name, walker ID, timestamp. No anonymous mutations.

Because "who did this?" lets Rod help when something goes wrong.
Accountability is care, not surveillance.
7 walkers, 95 dogs, one operation — attribution is how it stays coherent.

### 12. Color Is Signal, Not Decoration
Every color has exactly one job.
A color that does two jobs does neither — it becomes noise.

Because when fuschia means "permanent note" and also
"random style choice," it stops meaning anything.
Before adding any color, ask: what does this color already mean?
If it has a job → you cannot reassign it.
If it has no job → define one before using it.

Current color jobs:
- Coral #E8634A → primary action, something to tap
- Purple #534AB7 → tappable link, dog name, walker name
- Fuschia #961e78 → this dog has a permanent note, pay attention
- Sage #2D8F6F → picked up, positive, done
- Amber #C4851C → needs attention, not walking, warning
- Slate #475569 → utilitarian info, door codes, addresses

Unassigned (available but must earn a job before use):
Blue, green, red — define the job first, add it to this list.

### 13. Warmth Is Structural
The palette is warm — peach, cream, coral, amber, sage.
Cold grays and unassigned colors are visual noise.

Because Wiggle is a small business built on personality and trust,
not a logistics platform.
The app should feel like the company feels —
approachable, warm, and alive.

---

## THE TEST FOR EVERY DECISION

Before building anything, run these four filters in order:

**WWRS** — What would the walker need right now, one hand, winter coat?
If the answer is "not this" — stop.

**ONE PLACE** — Does this action or information already have a home?
If yes — put it there. Do not create a second home.

**SIMPLEST** — What is the smallest version of this that solves the real problem?
Strip it to the bone. Build that first.

**BOTH VIEWS** — Does this work for the app AND Tower Control?
If it only works in one — it is incomplete.

---

## REAL SITUATIONS — HOW TO APPLY THESE

**"Should this go in the app or Tower Control?"**
App = walkers in the field, real-time, one hand.
Tower = Rod and Gen at the desk, planning, managing.
If it requires a keyboard or takes more than 2 taps — it is probably Tower.

**"Where does this new action go?"**
If it affects a specific dog's state today → Dog Profile Drawer.
If it affects a group → group header or Tower Control.
If it affects the whole day → Tower Control.

**"Should we add this feature?"**
Run WWRS. Run SIMPLEST. If it passes both — scope it.
If it fails either — defer it or kill it.

**"This drawer is getting long — should we split it?"**
No. The drawer is the control centre because everything is in one place.
The solution to a long drawer is better hierarchy inside it,
not a second screen.

**"A walker is confused by the app closing after pickup."**
That is working as designed. Close means done with this dog.
If it feels wrong, the onboarding needs to be better —
not the behavior.
