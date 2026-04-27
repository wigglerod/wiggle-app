# AUDIT: "Directions" Button — Ground Truth Report

**Date:** 2026-04-14  
**Auditor:** Claude (read-only, no code changes)  
**Repo:** wiggle-v4 @ `~/Documents/wiggle-v4/`  
**Purpose:** Verify five assumptions before Antigravity build surfaces "Directions" to the mini card expand zone.

---

## Assumption 1 — Directions handler location

**Verdict: ⚠ Partially correct — it exists, but it's NOT a reusable function. It's an inline `mapsUrl()` helper duplicated across files.**

**Ground truth:**

There is no single extracted handler like `openDirections()`. Instead, there is a local helper function `mapsUrl(address)` defined independently in two files:

**DogDrawer.jsx (lines 45–53) — the more complete version:**
```javascript
function mapsUrl(address) {
  if (!address || !address.trim()) return null
  const trimmed = address.trim()
  const lower = trimmed.toLowerCase()
  const full = lower.includes('montréal') || lower.includes('montreal')
    ? `${trimmed}, Canada`
    : `${trimmed}, Montréal, QC, Canada`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(full)}`
}
```

**DogProfileDrawer.jsx (lines 39–42) — the simpler version:**
```javascript
function mapsUrl(address) {
  if (!address) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}
```

Key difference: DogDrawer's version appends "Montréal, QC, Canada" if the address doesn't already contain "montréal/montreal". DogProfileDrawer's version does NOT append city — it passes the raw address. This is a drift bug: two drawers build different URLs for the same dog's address.

The "handler" is not a `window.open()` call — the button is actually an `<a href={directionsUrl} target="_blank">` tag, not a `<button onClick={...}>`. The browser handles navigation natively via the anchor element.

---

## Assumption 2 — Which map app it opens

**Verdict: ✓ Confirmed — Google Maps web, no device detection**

**Ground truth:**

URL pattern: `https://www.google.com/maps/dir/?api=1&destination={encodedAddress}`

This is the Google Maps Directions API web URL. It always opens Google Maps in the browser — no Apple Maps detection, no `geo:` protocol, no native app deep links, no user preference. On mobile Safari/Chrome it may trigger the Google Maps app if installed (that's OS behavior, not app code).

There is also a separate multi-stop route URL pattern used by GroupOrganizer's `buildRouteUrl()` (line 522):
```
https://www.google.com/maps/dir/{addr1}/{addr2}/{addr3}/
```
This is a different format (path-based vs query-param-based) but also opens Google Maps. The `buildRouteUrl` version adds `&travelmode=walking` in MapView.jsx but NOT in GroupOrganizer.jsx.

---

## Assumption 3 — Which address it uses

**Verdict: ✗ Wrong — it DOES use alt addresses when available**

**Ground truth:**

DogDrawer.jsx computes the address with alt-address priority (lines 211, ~765):

```javascript
const { todayAlt } = useAltAddress(event?.dog?.id)
// ... later in render:
const defaultAddress = /* form-edited address || dog.address || event.location */
const address = todayAlt?.address || defaultAddress
const directionsUrl = mapsUrl(address)
```

So the direction URL uses:
1. **Today's alternate address** (`todayAlt.address`) if one exists for this day of week — e.g. Pluto's "4621 Lanaudière" on Tuesdays
2. **Default address** (`dog.address` or `event.location`) as fallback

The UI also visually distinguishes: amber "Directions" pill when alt address is active, coral pill when using default.

**URL encoding:** `encodeURIComponent()` handles French characters (accents, spaces) correctly. "Rue Lanaudière" becomes `Rue%20Lanaudi%C3%A8re`.

**Null handling:** `mapsUrl()` returns `null` for empty/whitespace-only addresses. The `<a>` tag falls back to `href="#"` with no `target="_blank"` — so tapping does nothing harmful.

**Critical implication for expand zone:** DogCard does NOT have access to the alt address text — it only receives `altAddress={hasAlt ? true : null}` as a boolean indicator from GroupOrganizer (line 580). To build a directions URL in the expand zone, you'd need either:
- **(a)** Pass the resolved address string (with alt fallback already applied) as a new prop, or
- **(b)** Call `useAltAddress(dog.id)` inside DogCard and compute the URL there, or
- **(c)** Pass a pre-computed `directionsUrl` prop from GroupOrganizer

---

## Assumption 4 — Reusability for the expand zone

**Verdict: ⚠ Partially correct — the URL builder is trivial to extract, but the alt-address resolution adds wiring complexity**

**Ground truth:**

The `mapsUrl(address)` function is a **pure function** — takes a string, returns a URL string. Zero coupling to component state. Extracting it to `src/lib/mapsUrl.js` is a one-liner.

However, the real work is **resolving which address to use** (alt vs default). That logic currently lives in DogDrawer's render body using `useAltAddress()`, which is a hook that makes a Supabase query per dog.

**DogCard already has:**
- `dog.address` — the default address (via the `dog` prop)
- `altAddress` — but only as a boolean (`true` or `null`), not the actual address string
- `onTapAddress` prop — currently wired to open the DogDrawer

**Three realistic options for the expand zone:**

| Option | Change | Tradeoff |
|--------|--------|----------|
| **(a)** Pass `directionsUrl` as a pre-computed prop from GroupOrganizer | GroupOrganizer already has `useAltAddressDogIds()` but NOT the actual alt addresses. Would need to upgrade to batch-fetch actual alt address strings. ~20-line change. | Clean, no new hooks in DogCard. But GroupOrganizer already does a lot. |
| **(b)** Call `useAltAddress(dog.id)` inside DogCard | DogCard gains a Supabase query per card. Could be expensive with 15+ dogs. | Simple per-card, but N+1 query pattern. |
| **(c)** Skip alt-address in expand zone, use `dog.address` only | Zero new wiring. Just `mapsUrl(dog.address)` inline. | Fast to build, but walker gets wrong directions for alt-address dogs. |

**Recommendation:** Option (a) is cleanest. GroupOrganizer's `useAltAddressDogIds()` already queries the `dog_alt_addresses` table — upgrading it to return a Map of `dogId → address` instead of a Set of dogIds is a small change to `src/lib/useAltAddress.js`.

---

## Assumption 5 — The button's existing visual treatment

**Verdict: ✓ Confirmed — coral/orange pill, with amber variant for alt-address days**

**Ground truth from DogDrawer.jsx (lines 786–789):**

The "Directions" label is a `<span>` inside an `<a>` tag (not a standalone button). Exact Tailwind classes:

**Default address (coral):**
```
flex-shrink-0 bg-[#E8634A] text-white text-xs font-semibold px-3 py-1.5 rounded-full
```

**Alt address day (amber):**
```
flex-shrink-0 bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full
```

**Resolved styles:**
| Property | Default | Alt day |
|----------|---------|---------|
| Background | `#E8634A` (coral) | `amber-600` → `#D97706` |
| Text color | `#fff` (white) | `#fff` (white) |
| Font size | `text-xs` → 12px | Same |
| Font weight | `font-semibold` → 600 | Same |
| Padding | `px-3 py-1.5` → 12px horiz, 6px vert | Same |
| Border radius | `rounded-full` → pill shape | Same |
| Border | None | None |
| Label | `Directions` | `Directions` |

The entire address block is wrapped in an `<a>` tag with `rounded-2xl p-4` and a background of either `bg-amber-50 border border-amber-200` (alt) or `bg-gray-50` (default). So the "Directions" pill sits at the far right of a full-width address card.

---

## Also Report

### Other places directions/maps are opened

| Location | What it does | Uses alt addresses? |
|----------|-------------|-------------------|
| `DogDrawer.jsx` line 767 | `<a href={mapsUrl(address)}>` — single dog, opens Google Maps | ✓ Yes, via `useAltAddress()` |
| `DogProfileDrawer.jsx` line 618/643 | `<a href={mapsUrl(address)}>` — single dog, profile view | ✓ Yes, via `useAltAddress()` |
| `GroupOrganizer.jsx` line 801 | `window.open(buildRouteUrl(dogIds))` — multi-dog route via "Start Route" button | ✗ No — has a TODO comment: `// TODO: check alt addresses from a batch fetch` |
| `MapView.jsx` line 42 | `buildRouteUrl(addresses)` — multi-dog walking route with waypoints | ✓ Yes, fetches alt addresses |
| `RouteBuilder.jsx` line 170 | `openGoogleMaps()` — multi-dog route via `window.open()` | Partial (normalizes city, unclear on alt) |

### mapsUrl drift between files
DogDrawer's `mapsUrl` appends "Montréal, QC, Canada" to addresses that don't already contain "montréal". DogProfileDrawer's `mapsUrl` does NOT — it passes the raw address. This means identical dogs get different Google Maps queries depending on which drawer you open. Not catastrophic (Google usually resolves it), but it's a drift that should be unified.

### GroupOrganizer's Start Route skips alt addresses
The "Start Route" button in GroupOrganizer (line 801) uses `buildRouteUrl()` which has a TODO on line 517: `// TODO: check alt addresses from a batch fetch`. This means: if a dog has a Tuesday alt address and you start a route on Tuesday, the route uses the wrong (default) address for that dog. This is a known gap.

### No Tower/admin directions path
No admin-specific directions UI was found in Tower components. The `tower/beast/BeastSection.jsx` and other tower files don't reference `mapsUrl` or Google Maps.

### Comments/TODOs found
- GroupOrganizer.jsx line 517: `// TODO: check alt addresses from a batch fetch` — the only directions-related TODO in the codebase.

---

## If Antigravity Built This Naively

1. **Using `dog.address` directly would give wrong directions on alt-address days.** Pluto gets picked up at his sister's place on Tuesdays. If the expand zone uses `dog.address` instead of resolving the alt, the walker drives to the wrong location. This is the biggest risk.

2. **Duplicating `mapsUrl()` a third time makes the drift worse.** There are already two divergent versions. A third copy in DogCard would mean three places to update when (not if) the URL format changes. Extract it to a shared util first.

3. **The expand zone hides for not_walking dogs.** Line 542: `expanded && !isPickedUp && !isReturned`. A not_walking dog technically passes this check (it's not picked up or returned), BUT the chevron is hidden (line 529: `!isNotWalking`) and card tap is disabled (line 378). So in practice, the expand zone is unreachable for not_walking dogs — directions button would never render for them. This is probably fine (you don't need directions for a dog you're not walking), but worth a conscious call.

4. **No `onTapAddress` conflict.** DogCard already has an `onTapAddress` prop (line 31) that opens the full drawer. Adding a "Directions" button to the expand zone is a separate interaction — it shouldn't replace the name tap → drawer flow. But the expand zone IS the zone that shows before the drawer opens, so walkers might expect "tap address = get directions" without opening the drawer. The Antigravity build should decide: does the expand zone Directions button replace the drawer flow, supplement it, or is it a shortcut that exists alongside it?

---

## Recommendation

**This is NOT a one-line surface.** It needs a small refactor first:

1. **Extract `mapsUrl()` to `src/lib/mapsUrl.js`** — unify the two existing versions (use DogDrawer's city-appending version as the canonical one). ~5 minutes.

2. **Upgrade `useAltAddressDogIds()` to return a Map** — change from `Set<dogId>` to `Map<dogId, { address, door_code }>` so GroupOrganizer can pass the resolved address to DogCard without N+1 queries. ~15 minutes.

3. **Add `directionsUrl` prop to DogCard** — computed in GroupOrganizer from the resolved address + `mapsUrl()`. ~5 lines.

4. **Add the button to the expand zone** — an `<a href={directionsUrl} target="_blank">` pill matching the drawer's coral style. ~10 lines in DogCard.jsx.

Total: ~30-minute refactor, not a multi-hour project. But skipping steps 1–2 and going straight to step 4 with `dog.address` gives wrong directions on alt-address days.

---

*End of audit. No code was changed. No deployments. No brain entries written.*
