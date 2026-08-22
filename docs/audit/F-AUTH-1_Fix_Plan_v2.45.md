> **CORRECTION BANNER — §2's ROUTE-ORDER HAZARD IS VERIFIED AT RUNTIME; ITS
> COUNT IS CORRECTED (added 2026-08-22, after `cf627857`, additive).**
>
> **Scope: §2's *"Recorded, not ruled: a route-order hazard at
> `compositions.js`"* paragraph only.** No other paragraph, ruling, count or
> enumeration in v2.45 is amended. v2.45 mints nothing and this banner mints
> nothing.
>
> **v2.45 committed no error.** It recorded the hazard, marked it *"Not
> verified at runtime and not asserted,"* and recorded it precisely so a later
> pass would not classify a dead route. That judgment was correct and the
> hazard is real. **One clause needs amending: §2 states "two of the ten GETs
> may be unreachable." One is.**
>
> **Method — runtime dispatch, not declaration order.** The real
> `src/routes/compositions.js` router was mounted in a bare Express app under
> real dispatch. `src/middleware/auth.js` and `src/middleware/jwtAuth.js` were
> replaced in `require.cache` **before** the router was required, with a
> recorder returning `req.route.path` and `req.params`. Express 5.2.1.
>
> | Request | Dispatched to | |
> |---|---|---|
> | `/search` | **`/:id`, `id="search"`** | shadowed |
> | `/search/filters/options` | **its own handler** | reachable |
> | `/abc-123` | `/:id` | control |
> | `/search?q=x` | `/:id` | control |
>
> **`/search/filters/options` was never a candidate.** It is three segments;
> `/:id` matches one. Only `/search` is shadowed, which is the whole of the
> count correction.
>
> **Fall-through excluded separately, because the recorder cannot exclude it.**
> The recorder short-circuits at the auth layer, so it establishes which *route
> layer* Express dispatches to and nothing more. It does not establish that
> `/:id`'s handler fails to call `next()`. Checked independently: the handler
> at `:458` terminates in `res.json` or `res.status().json()` on every branch,
> and **no `next(` occurs anywhere in `:458–1030`**. **`/search` is dead, not
> merely shadowed — and that conclusion requires both facts, not either one.**
>
> **Line drift.** v2.45's basis `77d9b995` gives `:457` / `:1187` / `:1254`.
> At `cf627857` the same three declarations sit at **`:458` / `:1188` /
> `:1255`**. A one-line shift; the ordering is unchanged.
>
> **Environment contact, stated in full.** Local file reads; `dotenv` loaded
> `.env` into the probe process; loopback HTTP on an ephemeral port. **No
> database connection was opened** — `authenticate` and `sync` in
> `src/models/index.js` sit inside lazily exported functions (`:1764`, `:1791`,
> `:1900`), not at module load, and the recorder returned before any handler
> body ran. **No deployed host was contacted. No AWS call was issued. Prod
> remains FROZEN and untouched.**
>
> **Flagged, not asserted — and it is the part worth reading.** `/:id`'s
> handler maps `error.message.includes('not found')` to 404 and everything else
> to 500. A Postgres uuid cast failure on `id="search"` would therefore surface
> as **500, not 404** — **a routing defect reported as a server fault.** That
> is the same shape as **FD-68**, where absent Cognito configuration returns
> `401 AUTH_INVALID_TOKEN` and reports an operator fault as a caller fault: in
> both, the symptom points away from the cause. Confirming it requires a
> database and it is **not asserted here**.
>
> **Minting is not decided here.** Whether a dead request-path route warrants
> an FD — and so whether the FD tail advances past **FD-68** — is a disposition
> this banner does not select. It records a measurement and corrects a count.
> **The route-order hazard remains open under limb 1 for that decision.**

| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Six-step coordinated single-PR plan.* |
| --- |

**Document version**

v2.45 — SURFACE ENUMERATION + TWO RULINGS + ONE XK-3 INSTANCE REPORT. **Mints nothing.** FD tail remains **FD-63 (F-AUTH-1)**; XK tail remains **XK-3**. Ships no code. Changes no gate. Rules the two questions raised at v2.44 §4.1 and §4.2: **Shape 4 is not its own FD**, and **PE #51 is not amended**. Extends v2.44's write-route enumeration to the full handler surface — **12 files, 106 handlers, 99 in scope after D20** — recording **38 GET handlers** that no prior revision has counted. Reports `src/routes/roles.js` as an **instance of XK-3 (F-Stats-1 v1.57)** reached from the F-AUTH-1 side: eight handlers whose tenancy root is exclusively caller-supplied because no middleware in the codebase sets `show_id`. Does not amend XK-3 or the Cross-Keystone Register. Supplies the §5.69 pre-CP surface deliverable. Derived entirely from git against `origin/main` at `77d9b995`. No live database contact.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged. Track G3 — OPEN, pending re-validation. Track G4 — pending re-validation; not entered. Track G5 — **BLOCKED** per v2.43 §4.2, unchanged. Track G6 — not reached. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# §1. The surface, enumerated

v2.44 counted write routes. This section counts handlers. The instrument is `git grep -c -E "router\.(get|post|put|patch|delete)"` per file against `origin/main` at `77d9b995`, with the router-variable name substituted for the two Shape 4 files.

| Shape | File | Handlers | Writes | GETs |
|---|---|---|---|---|
| 1 | `compositions.js` | 29 | 19 | 10 |
| 1 | `continuityEngine.js` | 14 | 11 | 3 |
| 1 | `templateStudio.js` | 9 | 7 | 2 |
| 1 | `roles.js` | 9 | 5 | 4 |
| 1 | `decisions.js` | 5 | 1 | 4 |
| 1 | `animatic.js` | 6 | 4 | 2 |
| 1 | `footage.js` | 6 | 4 | 2 |
| 2 | `entanglementRoutes.js` | 13 | 8 | 5 |
| 2 | `authorNoteRoutes.js` | 4 | 3 | 1 |
| 3 | `iconSlots.js` | 6 | 3 | 3 |
| 4 | `luxuryFilterRoutes.js` | 2 | 2 | 0 |
| 4 | `seasonRhythmRoutes.js` | 3 | 1 | 2 |
| | **12 files** | **106** | **68** | **38** |

**Seven of `compositions.js`'s 19 writes carry `authenticateJWT` and are preserved per D20.** They are the only handlers in the table already dispositioned. **99 handlers are in scope**; 61 of them are writes, matching v2.44 exactly.

**Item 10 reconciles.** CP7's planning scope reads *"compositions.js no-auth subset (Item 10 — Tier 1 on 22 handlers; jwtAuth subset stays as-is per D20)."* The file has 29 handlers; 29 − 7 D20 = **22**. CP7's intended scope for that file and this enumeration agree to the unit, and the number confirms the sweep's scope was never write-only.

**A method note on Shape 4, demonstrated in the measuring.** The first pass of this enumeration used the pattern `router\.(get|post|…)` across all twelve files and returned no line for `seasonRhythmRoutes.js` — the file uses `seasonRhythmRouter`. The same shape that defeats §21's G1 defeated the instrument counting it. The two Shape 4 files were re-measured with their own variable names.

---

# §2. The 38 GETs

No prior F-AUTH-1 revision counts these. They are in the same twelve files, under the same four miss shapes, and carry the same absence of disposition: no `requireAuth`, no `router.use(requireAuth)`, no Item 15 `// PUBLIC:` marker.

**§9.6 governs them differently from writes.** Writes are *"always → requireAuth."* GETs receive per-route classification: published-only data is exempt with an Item 15 marker; draft or private data takes `requireAuth`. **Public-by-default is locked as the worse failure mode.**

**§5.71's G5 test supplies the discriminator** — Tier 4 PUBLIC GETs must be `req.user`-free. A handler that reads `req.user` gates on identity and cannot be Tier 4.

Applied to the three largest GET populations, read directly:

- **`compositions.js`** — 10 GETs at `:68`, `:434`, `:457`, `:1030`, `:1054`, `:1083`, `:1148`, `:1187`, `:1254`, `:1276`. None reads `req.user`. Tier 4 candidates on the G5 test; classification owed.
- **`decisions.js`** — 4 GETs at `:68`, `:132`, `:171`, `:239`. None reads `req.user`. Tier 4 candidates on the G5 test — **but** §9.6 rules `decisionAnalytics.js` GETs *"NOT exempt regardless"* on the grounds that a caller-supplied user filter is a data-leak vector, and `decisions.js` is a sibling surface. **Classification owed; the §9.6 precedent is recorded as an input, not applied here.**
- **`roles.js`** — 4 GETs at `:11`, `:41`, `:71`, `:211`. **All four read `req.user`.** Disqualified from Tier 4 by the G5 test. See §3.

**Recorded, not ruled: a route-order hazard at `compositions.js`.** `router.get('/:id')` is declared at `:457`; `router.get('/search')` at `:1187` and `router.get('/search/filters/options')` at `:1254`. Express matches in declaration order, so a request to `/search` is a candidate to resolve at `:457` with `id="search"` and never reach the later handlers. **Not verified at runtime and not asserted.** It bears on disposition only in that two of the ten GETs may be unreachable. Recorded so a future pass does not classify a dead route.

---

# §3. `roles.js` — an instance of XK-3 (F-Stats-1 v1.57)

## §3.1 The shape

All eight handlers in `src/routes/roles.js` derive tenancy identically:

```js
const showId = req.query.show_id || req.user?.show_id;   // :11, :41, :71, :156, :211
const showId = req.body.show_id  || req.user?.show_id;   // :100, :131, :242
```

Read at `:9`–`:29`, the full pattern of the first handler is:

```js
const showId = req.query.show_id || req.user?.show_id;
if (!showId) { return res.status(400).json({ error: 'show ID required' }); }
const roles = await AssetRoleService.getRolesForshow(showId);
```

**Presence-validated. Entitlement never.** No ownership lookup, no join, no membership test.

## §3.2 The fallback cannot fire

`git grep -n "show_id\|showId" origin/main -- src/middleware/` returns **nothing**. Neither `auth.js` nor `jwtAuth.js` nor any other middleware sets `show_id` on `req.user`. `src/middleware/auth.js` builds `req.user` with `id`, `email`, `name`, `groups`, `tokenUse`, `issuedAt`, `expiresAt`, `source`, `raw`.

**`req.user?.show_id` is `undefined` for every caller** — authenticated, anonymous, Cognito or custom-JWT alike.

The consequence is sharper than wrong precedence. It is not that the caller-supplied value is *preferred* over the authenticated one. **There is no authenticated one.** `req.query.show_id` and `req.body.show_id` are the sole functioning sources of tenancy in this file, and the `|| req.user?.show_id` clause is dead code that reads like a safeguard.

## §3.3 Why this is XK-3 and not an F-AUTH-1 tier disposition

XK-3 records that *"`req.user.id` is `decoded.sub` — a Cognito subject string. No row stands behind it,"* that `shows` carries no ownership column, and that the authorization tier *"never receives a resource identifier."* Its XK-3 Gate 2 is the middleware signature; its cross-keystone reach table names F-AUTH-1's surface as the tier model's missing resource-scoped member.

`roles.js` is that absence with handlers attached. **Promoting these eight to Tier 1 authenticates the caller and changes nothing about which show's data they reach**, because `req.query.show_id` still wins a precedence contest against a value that does not exist. XK-3 states the general form: *"F-AUTH-1 could close every open deployment track and this would be untouched."* This file is that sentence instantiated.

**Reported as an XK-3 instance.** Not minted as an FD. Not an amendment to XK-3. The Cross-Keystone Register is not edited by this revision; XK-3's body, gates, ownership and UNEVALUATED remedy status stand unchanged.

## §3.4 Containment, and its bound

`git grep -n "req.user?.show_id" origin/main -- src/routes/` returns **8 lines, all in `roles.js`**. The broader `req\.(query|body|params)\.show_id \|\| req\.user` pattern returns the same 8. **The idiom did not spread.**

**The bound.** This establishes containment of *this literal idiom*. It does not establish that caller-supplied tenancy is confined to `roles.js`. A handler written `const showId = req.query.show_id;` with no fallback is in the same substantive class and matches neither probe. FD-62 (F-Stats-1) already records three such sites on destructive paths. **No claim is made about the size of that class.**

## §3.5 Not asserted

- Whether `roles.js` reaches production traffic. It mounts at `src/app.js:687`, bare, after the global `optionalAuth` at `:236`, inside no environment gate. That establishes reachability in code, not exercise.
- Whether any caller has exercised it. That is **XK-3 Gate 3**, which is OPEN, requires live database contact, and prod is FROZEN. **No present-population claim is made in either direction**, per the posture XK-3 carries from F-Stats-1 v1.56 §59.4.
- What `AssetRoleService.getRolesForshow` does beyond its call signature. Not read.

---

# §4. The two v2.44 rulings

## §4.1 Shape 4 — not its own FD. RULED.

v2.44 §4.1 raised whether the instrument-disagreement shape warrants a separate finding. **It does not.**

Shape 4's three sites — `luxuryFilterRoutes.js:11`, `:32`, `seasonRhythmRoutes.js:16` — carry `optionalAuth` inline on a write declaration. That is sub-form (a), already F-AUTH-1's founding finding. What is distinctive is only that §21's G1 fails to report them, because its pattern is the literal `router\.` matched case-sensitively by `grep -E` and these files name their routers `luxuryFilterRouter` and `seasonRhythmRouter`.

**A regex-authoring defect in a probe is not a new vulnerability class.** The sites are inventoried in PE #51 and confirmed present by the 2026-08-16 pre-flight run. Shape 4 is recorded as the fourth documented miss shape under **FD-63 (F-AUTH-1)**, whose statement already concerns G1's inability to detect routes it should. This revision mints no FD.

**What the ruling does not dismiss.** The consequence remains on the record: a reader taking G1's zero as confirmation that PE #51 is discharged reads it wrongly, and nothing in the program's documents says otherwise. That is a hazard for whichever CP executes the sweep, and §4.2 declines to fix it by amendment.

## §4.2 PE #51 — not amended. RULED.

v2.44 §4.2 raised whether PE #51 requires amendment. **It does not.**

PE #51's inventory is correct. Every site named in Shapes 2, 3 and 4 appears in it — four explicit write-route entries, three `iconSlots` Pattern 5/6 entries, two file-level mounts — and the 2026-08-16 pre-flight confirms every hardcoded expectation MATCH.

**The adjacent issue is an accounting gap, not a false listing.** PE #51 states seven write routes. The two file-level mounts it inventories govern eleven further writes — `entanglementRoutes.js` 8, `authorNoteRoutes.js` 3 — which are not in that count because the entries record *mounts*, not the routes beneath them. An inventory that names a mount correctly and does not enumerate what the mount governs is incomplete in a way its own schema permits.

**Recorded, unamended.** A future revision may extend PE #51's counting convention. This one does not, and the eleven routes are carried in §1's table where they are counted.

---

# §5. Gate effects — none

Track G5 remains **BLOCKED** per v2.43 §4.2. Tracks G3 and G4 remain **pending re-validation** per v2.43 §4.3. Track G4 is not entered. v2.43 §4.1's REOPENED-QUALIFIED status is unchanged, and §2.4's scope sentence stands as written.

**The surface grew and the gate did not move.** 61 write routes became 99 in-scope handlers, and one file separated out as an XK-3 instance whose remedy F-AUTH-1 does not contain. None of that changes a gate that is already closed.

**§5.69 deliverable.** v2.37 §5.69 requires a program-wide surface enumeration at CP1 surface phase as a starting inventory baseline, filed after CP11 discovered ~22 files / ~130 handlers never enumerated. §1 and §2 are that deliverable for the sweep that closes FD-63 (F-AUTH-1). It is supplied here rather than as a standalone artifact because a standalone artifact carries no register authority.

---

# §6. Numeral disambiguation

Four distinct G-schemes are now live across the register. Per `Cross_Keystone_Register.md` §3, imported items retain their origin label in full on first reference.

- **CP12-G1 … CP12-G6** are the §21 verification greps. §1, §4.1 and v2.44 refer to **CP12-G1** when they say G1 unqualified; **v2.44 §6 recorded that imprecision and this revision inherits it rather than correcting v2.44's body.**
- **Track G3 … Track G6** are the deployment gates in §5.
- **Gate G1 … Gate G6** are F-AUTH-1's own v1.5 six-gate sequence — *"Locked at G1," "CONFIRMED at G1"* in v2.37 refer to this, not to a grep.
- **XK-3 Gate 1 … XK-3 Gate 4** are the Cross-Keystone Register's admission gates, always written in full per its own instruction, and unrelated to all three schemes above.

Further:

- **FD-63 (F-AUTH-1)** is v2.43's mint, not re-minted here. Unrelated to **§63 (F-Stats-1)** at F-Stats-1 v1.60 and to **PE #63**, which does not exist.
- **FD-62 (F-Stats-1)** is cited at §3.4 as three destructive sites with caller-supplied `show_id`. It is unrelated to **PE #62 (F-App-1 residue)**.
- **Shape 1–4** are v2.44's enumeration of G1 miss reasons. They are not Step 3 **Tier 1–4** dispositions, nor the pre-flight script's **Tier 1–3** confidence bands. §1's table indexes by Shape; §2's classification reasons in Tiers.
- **XK-2 and XK-3 are distinct and the distinction is load-bearing**, per the register: XK-2 is an enforcement failure where the tenant value is available and dropped; XK-3 is a substrate absence where the tenant value is caller-supplied and nothing can authorize it. `roles.js` is reported against **XK-3**.

---

# §7. What this revision establishes

- **Surface enumerated: 12 files, 106 handlers, 99 in scope after D20** (§1).
- **38 GET handlers recorded for the first time**, undispositioned, requiring §9.6 per-route classification (§2).
- **CP7's Item 10 "22 handlers" reconciles exactly** against `compositions.js`'s 29 minus 7 D20 (§1).
- **`roles.js` reported as an XK-3 instance** — eight handlers, tenancy exclusively caller-supplied, `req.user?.show_id` unsettable by any middleware in the codebase (§3).
- **Shape 4 RULED not a separate FD** (§4.1). **PE #51 RULED not amended** (§4.2).
- **Containment of the `req.user?.show_id` idiom established and bounded** — the idiom is confined to `roles.js`; caller-supplied tenancy as a class is not measured (§3.4).
- **§5.69's pre-CP surface deliverable supplied** (§5).

---

# §8. What this revision does not do

- Does not ship code, change any unit disposition, or alter any PR state.
- Does not mint an FD, an XK, or a PE. FD tail **FD-63 (F-AUTH-1)**; XK tail **XK-3**.
- Does not amend XK-3, the Cross-Keystone Register, or PE #51.
- Does not edit v2.37 §5.71, v2.43 §2.4, v2.44 §6, or any prior body.
- Does not classify any of the 38 GETs. §2 records candidates and inputs; every disposition is owed.
- Does not verify the `compositions.js` route-order hazard at runtime (§2).
- Does not read handler bodies beyond the sites cited, or `AssetRoleService`.
- Does not measure caller-supplied tenancy outside the literal idiom (§3.4).
- Does not make any claim about whether XK-3 Gate 3's principal population exists. **OPEN; requires live DB; prod FROZEN.**
- Does not change any gate. Track G5 remains blocked; Track G4 is not entered.
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact.** Derived entirely from git against `origin/main` at `77d9b995`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-16. Main at `77d9b995`. Predecessor: v2.44.*
*Type: Surface enumeration + two rulings + one XK-3 instance report. Rules v2.44 §4.1 and §4.2. Supplies §5.69's pre-CP deliverable. Mints no FD, no XK, no PE. Tail: FD-63. XK tail: XK-3. Ships no code. Changes no gate. No live database contact. [skip-automerge]*
