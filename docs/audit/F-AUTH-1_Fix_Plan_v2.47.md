| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *CP closure — first code shipped in the fix cycle.* |
| --- |

**Document version**

v2.47 — **CP CLOSURE. SHIPS CODE.** **Mints nothing.** FD tail remains **FD-63 (F-AUTH-1)**; XK tail remains **XK-3**. Records the execution of the sweep adjudicated at v2.46 §1: **95 handlers across 11 route files promoted from the global `optionalAuth` fallback to `requireAuth`**, merged at `8ba2b95c` (PR #1039). `roles.js` untouched per the XK-3 hold; `compositions.js`'s seven `authenticateJWT` handlers preserved per D20. **Records that the CP has no automated test coverage** — the four CI checks passed and prove nothing about this change, because no test exercises any promoted handler. **Owes Gate G3's stated test minimum before Track G4 is entered.** Changes no gate. Derived from git against `origin/main` at `8ba2b95c`. No live database contact.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1. **FD-63 (F-AUTH-1)'s route surface is remediated in code; the finding is not closed** — see §5. Track G3 — OPEN, pending re-validation, and now carrying an owed test deliverable (§4). Track G4 — pending re-validation; **not entered, and blocked on §4**. Track G5 — **BLOCKED** per v2.43 §4.2, unchanged. Track G6 — not reached. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# §1. What shipped

Merged at **`8ba2b95c`** (PR #1039), squashed, from `claude/f-auth-1-cp-requireauth`. Basis `e0f351d7`. **11 files changed, 88 insertions, 82 deletions.**

| File | Handlers | Edit shape |
|---|---:|---|
| `compositions.js` | 22 | bare declaration; 7 `authenticateJWT` skipped |
| `continuityEngine.js` | 14 | bare declaration |
| `entanglementRoutes.js` | 13 | `router.use` preset migration |
| `templateStudio.js` | 9 | bare declaration |
| `animatic.js` | 6 | bare declaration, before `asyncHandler` |
| `footage.js` | 6 | bare declaration, before `multer` |
| `iconSlots.js` | 6 | multi-line declaration |
| `decisions.js` | 5 | bare declaration |
| `authorNoteRoutes.js` | 4 | `router.use` preset migration |
| `seasonRhythmRoutes.js` | 3 | inline swap, non-`router` variable |
| `luxuryFilterRoutes.js` | 2 | inline swap, non-`router` variable |
| **Total** | **95** | |

**Four edit shapes, matching v2.44 §2's four miss shapes.** Bare declarations took `requireAuth` as an inserted middleware argument. `entanglementRoutes.js:40` and `authorNoteRoutes.js:18` migrated `router.use(optionalAuth)` → `router.use(requireAuth)` per the **§5.41 v2.37 Q8 sub-discipline**, the same operation CP12 applied to `calendarRoutes.js` and `pageContent.js`. `iconSlots.js`'s six sites are middleware on line N+2. `luxuryFilterRoutes.js` and `seasonRhythmRoutes.js` were inline swaps on `luxuryFilterRouter` / `seasonRhythmRouter`.

**Ordering, verified by direct diff read.** `footage.js:47` carries `requireAuth` **before** `upload.single('video')` — an unauthenticated request is rejected before multer buffers the upload. `animatic.js`'s six sites carry `requireAuth` **before** `asyncHandler(...)`, not inside the handler signature.

**Two comment corrections shipped with the code.** `luxuryFilterRoutes.js:2`'s header note and `entanglementRoutes.js:39`'s inline comment both named `optionalAuth` and were updated. A stale auth comment in an auth file is the shape v2.42 §1.3 had to spend a section un-triaging.

---

# §2. What was held

**`src/routes/roles.js` — not edited.** Held under **XK-3 (F-Stats-1 v1.57)** per v2.45 §3 and v2.46 §4. Eight handlers, tenancy from `req.query.show_id` / `req.body.show_id`, presence-validated and never entitlement-checked, with a `req.user?.show_id` fallback no middleware can set. `requireAuth` would authenticate the caller and change nothing about which show's data is returned. **The hold is unchanged and the remedy remains XK-3's, unevaluated.**

**`compositions.js` — seven `authenticateJWT` handlers preserved** at `:480`, `:511`, `:534`, `:557`, `:595`, `:817`, `:886`, per **D20**. Verified post-merge: `git grep -c "authenticateJWT" -- src/routes/compositions.js` returns **8** — one import plus seven sites, unchanged from pre-state.

---

# §3. Verification performed, and its instrument

**Pre-state.** `git grep -c "requireAuth"` across all eleven files returned nothing at `e0f351d7`. Zero, recorded before any edit.

**Post-state**, per file, handlers plus import line:

```
animatic.js:7            authorNoteRoutes.js:2      compositions.js:23
continuityEngine.js:15   decisions.js:6             entanglementRoutes.js:3
footage.js:7             iconSlots.js:7             luxuryFilterRoutes.js:4
seasonRhythmRoutes.js:4  templateStudio.js:10
```

**`git grep -c "optionalAuth"` across all eleven files against `origin/main` returns nothing.**

`entanglementRoutes.js` and `authorNoteRoutes.js` count 3 and 2 rather than 14 and 5 because a single `router.use(requireAuth)` covers 13 and 4 handlers respectively. **The check is shape-aware by necessity**, which is the same reason §21's G1 could not measure the pre-state.

**Every one of the eleven diffs was read line by line before staging**, and `compositions.js`'s 29 declarations were enumerated individually to confirm the 22/7 split. That reading, not the counts, is what establishes the change is correct: the counts alone cannot distinguish 22 correct promotions from 21 correct plus one D20 route wrongly touched.

**§21's G1 is not the verification and was not used as one.** FD-63 (F-AUTH-1) records that it cannot detect three of the four shapes; v2.45 §4.1 records that its zero does not discharge PE #51.

---

# §4. The CP has no test coverage

**All four CI checks passed on PR #1039 — Cost Exposure Audit, Frontend Tests, Route Validation, and the full backend suite at 2 minutes. None of them tested this change.**

`git grep -l` over `tests/` for the eleven router names returns three files — `cp10-admin.test.js`, `want-field-tier-promotion.test.js`, `world-cluster-tier-promotion.test.js` — **none of which exercises any of the eleven routers.** Each matched on an incidental substring.

**No test in the suite touches any of the 95 promoted handlers.** The green result is the absence of coverage, not the presence of correctness.

**This is the expected consequence of the surface's history and it corroborates the finding.** Every prior CP produced tier-promotion test files — 12 at CP6, 10 at CP7, 6 at CP9, 21 at CP12 — because every prior CP swept files that then acquired tests. These eleven files were never swept, so they never acquired them. CP6 and CP7 each had to convert anonymous-request assertions from 200 to 401 per §5.52; **this CP promoted 95 handlers and broke nothing, because there was nothing asserting the old contract.**

**PR #1039's body predicted test failures of that shape. That prediction was wrong, and it was wrong in the direction that matters** — it anticipated the suite would object, and the suite had nothing to say.

## §4.1 Owed before Track G4

**Gate G3's stated minimum is: *"Test coverage minimum: one authenticated + one unauthenticated test per sub-form."*** Four edit shapes shipped here. That minimum is **undischarged**.

**Track G4 must not be entered before it is met.** G4 is dev verification plus a 2-hour soak — the gate at which a runtime break would surface. Entering it with zero coverage over 95 changed handlers makes the soak a manual substitute for tests, and makes any future green suite on this surface as uninformative as this one.

**Deferral to after the merge was a deliberate decision and is recorded as such. Deferral past G4 is not authorized by it.**

---

# §5. What this does and does not close

**FD-63 (F-AUTH-1)'s route surface is remediated. FD-63 is not closed.**

The finding as stated at v2.43 §2.3 has two halves: the 44-route surface in the shape, and **G1's structural inability to detect it**. This CP fixes the first. **The probe is unchanged.** A future run of §21's G1 over this codebase will still return zero for a bare declaration under the global mount, and will still miss a `router.use` preset, a multi-line declaration, and a non-`router` variable name.

**Nothing in the program's documents outside v2.44, v2.45 and this revision says so.** A reader taking a future G1 zero as evidence of closure would repeat exactly the reading v2.43 corrected.

**Also not closed:** the global `app.use(optionalAuth)` at `src/app.js:236` remains. It is now the fallback for routes that no longer rely on it, and remains the mechanism by which any newly-added bare declaration would ship unauthenticated. **No change to it is proposed here** — it has legitimate consumers and its own disposition question.

---

# §6. Recorded, not addressed

Seen during the reads, out of this CP's scope, and named so a future pass does not rediscover them:

- **`iconSlots.js`'s three write handlers carry `(admin only)` in their JSDoc** and shipped as Tier 1. Tier 2 would be `requireAuth + authorize(['ADMIN'])` per the §5.41 universal canonical. v2.46 adjudicated the surface Tier 1 and retiering mid-sweep would have been scope drift. **The comment and the disposition now diverge on the page.**
- **`animatic.js`: 6 of 6 async handlers missing `try`/`catch`**, per the route validator on every run this session. All six are now `requireAuth`-gated and still unguarded against handler throws.
- **The unbounded-list idiom** recorded at v2.46 §3 — `templateStudio.js:28`, `compositions.js:69`, `decisions.js:69` return the full table when no filter is supplied. Now authenticated. Still unbounded.
- **No handler in these eleven files records who acted.** Promotion supplies an authenticated `req.user`; nothing writes it. `authorNoteRoutes.js:108` hard-deletes by caller-supplied id and stores no actor.
- **`compositions.js` route-order hazard** at v2.45 §2 — `/:id` at `:458` precedes `/search` at `:1188`. Unverified at runtime.

---

# §7. Numeral disambiguation

- **Edit shapes 1–4** at §1 correspond to **miss shapes 1–4** at v2.44 §2. They are the same partition viewed from remediation rather than detection, and neither is the Step 3 **Tier 1–4** disposition scheme.
- **Gate G3** at §4.1 is F-AUTH-1's v1.5 six-gate sequence — *"Self-review passed,"* the gate carrying the test minimum. **Track G3** at Status is the deployment track. **CP12-G1 … CP12-G6** are the §21 verification greps. **XK-3 Gate 1 … Gate 4** are the Cross-Keystone Register's admission gates. All four schemes appear in this document and are written in full at each use.
- **D20** is `authenticateJWT` preservation. **D11** is CP7's scope-expansion outlier.
- **FD-63 (F-AUTH-1)** is v2.43's mint, not re-minted. **XK-3 (F-Stats-1 v1.57)** is the register entry `roles.js` reports against.

---

# §8. What this revision establishes

- **95 handlers promoted to `requireAuth` across 11 files**, merged at `8ba2b95c` (§1).
- **`roles.js` held; `compositions.js`'s D20 subset preserved**, both verified post-merge (§2).
- **Zero `optionalAuth` remaining** across the eleven files on `origin/main` (§3).
- **The CP has no automated test coverage. The four green CI checks prove nothing about this change** (§4).
- **Gate G3's test minimum is undischarged and is owed before Track G4 is entered** (§4.1).
- **FD-63 (F-AUTH-1)'s surface is remediated; the finding is not closed, because the probe is unchanged** (§5).

---

# §9. What this revision does not do

- Does not close FD-63 (F-AUTH-1), amend it, or mint any FD, XK, or PE. FD tail **FD-63 (F-AUTH-1)**; XK tail **XK-3**.
- Does not change §21's G1, the pre-flight script, or any probe.
- Does not amend XK-3, the Cross-Keystone Register, PE #51, or D20.
- Does not edit `roles.js` or convert its hold into a tier disposition.
- Does not supply the Gate G3 tests it records as owed (§4.1).
- Does not change any gate. **Track G4 is not entered. Track G5 remains BLOCKED.**
- Does not address anything at §6.
- Does not propose a disposition for the global `optionalAuth` mount at `src/app.js:236` (§5).
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact.** Derived from git against `origin/main` at `8ba2b95c`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-17. Main at `8ba2b95c`. Predecessor: v2.46.*
*Type: CP closure. First code shipped in the fix cycle. 95 handlers promoted; `roles.js` held; D20 preserved. Records zero test coverage over the CP and owes Gate G3's minimum before Track G4. Mints no FD, no XK, no PE. Tail: FD-63. XK tail: XK-3. Changes no gate. No live database contact. [skip-automerge]*
