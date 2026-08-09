| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Six-step coordinated single-PR plan.* |
| --- |

**Document version**

v2.41 — §7.3 DIRECT-READ SWEEP. Mints nothing. Ships no code. Changes no gate; Track G3 remains OPEN. Closes the probe-limitation caveat recorded at v2.40 §1.6 by enumerating every route declaration in the six batch-probed §7.3 files against origin/main at `0e401ae1`. Records that `calendarRoutes.js` protects five GETs by router-level preset rather than inline middleware — a second probe-design finding, inverse to the first. No PE, FD, or XK numbers minted. Derived entirely from git against origin/main at `0e401ae1`. No live database contact.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP CLOSED at CP12 (see v2.37 §5.71 keystone closure marker). DEPLOYMENT TRACKS OPEN: Track G3 self-review (PARTIALLY DISCHARGED — blocked on the CP12-G4 probe gap, v2.39 §2.4) → Track G4 dev verification + soak → Track G5 prod cutover → Track G6 post-deploy soak. Track labels per v2.38 §2.2 forward definitions. Track G5 is gated on the prod freeze — a structural gate external to this keystone, not an F-AUTH-1 prerequisite.*

---

# §1. The caveat this revision closes

v2.40 §1.6 recorded that the §7.3 batch sweep matched **single-line** `router.<verb>(` declarations, that six of the nine files were checked that way, and that a file using multi-line declaration style would report a false clean under that probe. It stated: *"Six-for-six silence is consistent with a swept codebase. It is not proof."*

This revision supplies the proof by enumeration. Every `router.use` and `router.<verb>` line in each of the six files was listed from `origin/main` and read.

---

# §2. Results

## §2.1 Five files — inline `requireAuth` on every declaration

| File | Declarations | Result |
|---|---|---|
| `storyteller.js` | 37 | Every route declares `requireAuth` inline |
| `characterRegistry.js` | 37 | Every route declares `requireAuth` inline |
| `careerGoals.js` | 7 | Every route declares `requireAuth` inline |
| `uiOverlayRoutes.js` | 24 | Every route declares `requireAuth` inline |
| `wardrobe.js` | 34 | Every route declares `requireAuth` inline |

Counts are of enumerated route declarations, verified by reading the listing rather than by an occurrence tally.

Two observations recorded so a future pass does not re-triage them:

- **`uiOverlayRoutes.js` `/:showId/debug`** carries `requireAuth, authorize(['ADMIN'])` — Tier 2 disposition. §7.3 does not name it.
- **`wardrobe.js`** confirms the §7.3 targets: `/select` and `/purchase` both declare `requireAuth`.

## §2.2 `calendarRoutes.js` — router-level preset

19 route declarations plus one `router.use(requireAuth)` at file scope.

**All 13 mutation routes declare `requireAuth` inline.** §7.3's scope is satisfied.

**Five GETs carry no inline middleware** and are protected solely by the file-scope preset: `/markers`, `/events`, `/events/:id/attendees`, `/simultaneous`, `/events/feed-templates`.

This is the ratified shape. v2.37 §5.41 records CP12's router-preset migration — `router.use(optionalAuth)` → `router.use(requireAuth)` at `calendarRoutes.js` and `pageContent.js` — under the Q8 lock that router-level presets follow the same universal canonical rule as per-handler middleware. **Correct as it stands; no action owed.**

## §2.3 The multi-line style exists and was handled correctly

v2.40 §1.6's concern was well-founded: `wardrobe.js` contains several declarations that wrap across lines — `/:id/process-background`, `/:id/regenerate-product-shot`, `/:id/regenerate-thumbnail`, `/:id/premium-enhance`, `/bulk/regenerate-thumbnails`.

**Every one carries `requireAuth` on the opening line**, so the batch probe matched them correctly. The risk was real; it did not materialise in this set.

---

# §3. Probe-design findings

Two shapes defeat a naive route-line grep, in opposite directions. Both are recorded here for any future verification pass.

**Multi-line declarations.** A route whose middleware chain wraps past the opening line can hide middleware from a single-line probe. In this set the middleware always appeared on the opening line, so no false clean occurred — but that is a property of this codebase's formatting, not a guarantee.

**Router-level presets.** `router.use(requireAuth)` protects routes whose own declarations carry no middleware. A probe asserting *"every route line must contain `requireAuth`"* reports these as unprotected. **This is a false-positive shape, and it is the more dangerous of the two** — it generates spurious findings that cost triage time, and a reader who dismisses one such finding may dismiss a real one beside it.

Any future §7.3-style probe must account for both. Neither is a defect in the code.

---

# §4. What this revision establishes, and what it does not

**Establishes:** the six files batch-probed at v2.40 §1.3 are not false-clean. All 158 route declarations across them are protected — 153 inline (139 across the five files, 14 in `calendarRoutes.js`) and 5 by ratified file-scope preset. **v2.40 §1.6's caveat is closed.**

**Does not establish:** anything runtime. This is still static evidence. Every §7 200/401 assertion remains owed at Track G4. §7.1, §7.2, and §7.6 remain unattempted — they are runtime-only.

**Does not affect** the CP12-G4 probe gap (v2.39 §2.4), v2.39 §1.3's unattempted clauses, or the G5/G6 failure-path gap (v2.40 §7). **Track G3 remains OPEN on all three grounds.**

---

# §5. What this revision does not do

- Does not ship code, change any unit disposition, or alter any PR state.
- Does not change any gate. **Track G3 remains OPEN; Track G4 is not entered.**
- Does not discharge §7 or any runtime assertion.
- Does not supply, guess at, or run a probe for CP12-G4.
- Does not supply a G5 or G6 failure path.
- Does not re-audit CP1–CP12 disposition judgments.
- Does not mint PE, FD, or XK numbers.
- Does not claim or open a prod window.
- **No live database contact.** Derived entirely from git against origin/main at `0e401ae1`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-09. Main at `0e401ae1`. Predecessor: v2.40.*
*Type: §7.3 direct-read sweep. Closes v2.40 §1.6. Mints nothing. Ships nothing. Changes no gate.*
