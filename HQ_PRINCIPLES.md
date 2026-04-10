# HQ PRINCIPLES
## The why behind every decision in The Neighbourhood HQ.
## Walker-app specific. For universal Wiggle World principles → `WIGGLE_PRINCIPLES.md`.

---

## How to use this file
These are the principles for the walker-facing PWA. They inherit everything in `WIGGLE_PRINCIPLES.md` and add the rules that only matter when you're building for a phone in a cold hallway. If something here contradicts the higher layer, the higher layer wins — but that shouldn't happen, and if it does, stop and ask.

---

## THE DOOR IS THE CONTEXT

Every decision in HQ is filtered through one moment: a walker at a building door, winter, one hand occupied, a dog already pulling. If it can't be done with one thumb in a winter coat, reconsider it. The worst UX failure isn't ugly — it's a walker fumbling while an anxious dog strains at the leash. **WWRS is the primary filter in HQ. Run it first, run it every time.**

---

## THE CARD

**1. The card is a promise.** Dog name, address, door code — visible without a single tap, no matter what layout mode the app is in. `isCompact` may reduce size. It may never remove content. The card is the walker's contract with the app: everything they need to get through that door is already on screen.

**2. Nothing vanishes.** No state transition removes a dog from view. Not walking stays amber. Returned fades but remains. The count always matches reality. A disappearing card creates doubt — "did I miss one?" — and doubt at a door with six dogs is dangerous. Visibility is a safety feature.

**3. Dog names are Fraunces italic.** This is the single most important typographic moment in the app. "Pepper" in italic serif is not a data label — it is a name that belongs to a specific animal Wiggle knows by heart. Never make a dog name bold sans-serif. Never make it DM Mono. That's the old system.

---

## THE DRAWER

**4. The drawer is the control centre.** Every action that changes a dog's state for the day lives inside the Dog Profile Drawer — and nowhere else. One dog, one place, always the same gesture. If you're about to add a dog action somewhere other than the drawer, stop. You are breaking this principle.

**5. Close means done with this dog.** The drawer closes automatically after status actions: pickup, back home, not walking, undo. It stays open after informational taps: notes, edit times. When a walker marks a dog as picked up, they are already moving to the next door. The app should move with them.

**6. Every action is reversible.** State is additive (insert) and reversible (delete). No destructive writes anywhere in the drawer. If an action cannot be undone, question whether it belongs in HQ at all.

---

## THE DATA

**7. Instant then correct.** Every action updates the screen immediately, then saves to the database. The UI never waits for the server. Rollback on failure. A pause per swipe compounds across 40 dogs on spotty cell service. Basements have no signal. The walker's experience cannot depend on network latency.

**8. Notes have a lifetime.** Forever notes never expire — allergies, aggression, building quirks. Owl notes last this week — staff-to-staff handoffs. Acuity notes last this booking — owner's immediate-need message. Activity notes last today — state, times, events. The right note at the right time is the only note that helps. When unsure where a note belongs, ask: "when does this stop being relevant?" — that is its lifetime.

**9. Walker autonomy is the default.** Rod and Gen's job ends when dogs are in the system unassigned for the day. Walkers own all group organization. HQ must never behave as if the walker is being managed by the app — the app is a tool in their hand, not a boss in their pocket.

---

## THE WARMTH

**10. Warmth is structural.** The palette is warm — peach, cream, coral, amber, sage, fuschia. Cold grays are visual noise in HQ. Pure white is not Wiggle. The app should feel like the company feels: approachable, warm, alive. If it feels like a bank app, it's wrong.

**11. No blue.** Blue has no defined job in HQ. Not for links, not for focus rings, not for information. If you reach for blue, you're reaching for a habit from another product. Pick a Wiggle color with a defined job instead.

---

## HQ-SPECIFIC DECISION GUIDE

**"Where does this new action go?"** Affects a specific dog's state today → drawer. Affects a group → group header. Affects the whole day → the Studio, not HQ.

**"This drawer is getting long, should we split it?"** No. The drawer is the control centre because everything is in one place. The solution to a long drawer is better hierarchy inside it, not a second screen.

**"A walker is confused by the app closing after pickup."** That's working as designed. Close means done with this dog. Fix the onboarding, not the behavior.

**"Should this go in HQ or the Studio?"** HQ = walkers in the field, real-time, one hand. Studio = Rod and Gen at the desk, planning, managing. If it requires a keyboard or takes more than two taps, it's probably the Studio.

---

## WHEN THE CONTEXT BENDS

The door-in-winter context is the default, but not every HQ moment is a door. Reading notes on the couch the night before a shift is also HQ. Editing a time after the walk is also HQ. In those moments, two-handed is fine and reading is fine. But the defaults — card, drawer, actions, colors — are all tuned for the hallway. When the hallway and the couch disagree, the hallway wins.
