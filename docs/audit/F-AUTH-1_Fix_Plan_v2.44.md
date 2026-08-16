| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Six-step coordinated single-PR plan.* |
| --- |

**Document version**

v2.44 — v2.43 §2.4's OWED POPULATION QUESTION, DISCHARGED. **Mints no FD.** FD tail remains **FD-63 (F-AUTH-1)**. Ships no code. Enumerates §21's G1 probe against `origin/main` and establishes that FD-63 (F-AUTH-1)'s mechanism has **four miss shapes, not one**, covering **61 write routes** rather than the 44 v2.43 recorded. Records the §21 G1 command verbatim and reproduces its zero. Raises two register questions — whether the instrument-disagreement shape warrants its own FD, and whether PE #51 requires amendment — and decides neither. Track G5 remains BLOCKED per v2.43 §4.2; this revision changes no gate. Derived entirely from git against `origin/main` at `7536993d`. No live database contact.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged. Track G3 — OPEN, pending re-validation. Track G4 — pending re-validation; not entered. Track G5 — **BLOCKED** per v2.43 §4.2, unchanged by this revision. Track G6 — not reached. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

**Basis note.** `src/` is byte-identical across `539b522d`, `5f79c634` and `7536993d`; the three intervening commits are documentation only. Source reads in this revision are equally valid at any of the three.

---

# §1. §21's G1 command, verbatim

v2.43 §2.1 characterised G1 from §5.71's reported output rather than from its command. The command is stated at v2.37 in the CP12 WP5 documentation pass:

> `grep -rn "optionalAuth" src/routes/ | grep -E "router\.(post|put|patch|delete)"`

A parallel draft form appears at v2.37 §4.3's Step 3 verification:

> `grep -rE "optionalAuth" src/routes/ src/app.js | grep -E "(post|put|patch|delete)" | grep -v "// PUBLIC:"`

Both are **line-oriented**. Both require `optionalAuth` and a write verb to appear **on the same physical line**. The §21 form additionally requires the literal string `router.` immediately preceding the verb, under `grep -E`, which is **case-sensitive**.

**Reproduced at `7536993d`.** PowerShell has no `grep`; the faithful equivalent is:

```
git grep -n "optionalAuth" origin/main -- src/routes/ | Select-String -CaseSensitive -Pattern "router\.(post|put|patch|delete)"
```

**Result: one line** — `worldStudio.js:2483`, the §5.45 polymorphic factory that §5.71(1) excludes by name.

**§5.71(1)'s "G1 0 optionalAuth-on-writes (excluding §5.45 polymorphic factory)" is literally true at current main.** This revision does not dispute the reported output. It records what the output does not measure.

**Method note.** The same command run **without** `-CaseSensitive` returns four lines. `Select-String` defaults to case-insensitive matching and `grep -E` does not. The casing difference is load-bearing and is the subject of §2.4.

---

# §2. Four miss shapes

FD-63 (F-AUTH-1) recorded one shape. Enumeration establishes four. Each is a distinct reason a write route reaching its handler under `optionalAuth` produces no G1 hit.

## §2.1 Shape 1 — bare declaration under the global mount (44 routes)

Recorded at v2.43 §1. Seven files — `animatic.js`, `compositions.js`, `continuityEngine.js`, `decisions.js`, `footage.js`, `roles.js`, `templateStudio.js` — carry no `requireAuth`, no `router.use`, no Item 15 marker. Their declarations carry no middleware at all; `src/app.js:236`'s global `app.use(optionalAuth)` governs.

**Why G1 misses it:** the file contains no `optionalAuth` token, so the first grep never emits a line to filter.

Unchanged from v2.43. Restated here for completeness of the shape enumeration.

## §2.2 Shape 2 — file-scope `router.use(optionalAuth)` (11 routes)

| File | Mount | Write routes |
|---|---|---|
| `entanglementRoutes.js` | `:40` | `:88` POST, `:124` PATCH, `:145` DELETE, `:166` PATCH, `:252` POST, `:265` POST, `:325` POST, `:360` PATCH — **8** |
| `authorNoteRoutes.js` | `:18` | `:60` POST, `:84` PUT, `:108` DELETE — **3** |

Neither file declares per-route middleware on any write. Both mount bare in `src/app.js` — `entanglements` at `:1276`, `author-notes` at `:1388` — inside `try`/`catch` require guards, not environment gates. Both mount after `:236`.

**Why G1 misses it:** `router.use(optionalAuth);` carries the token but no write verb, so the second grep drops it. The write declarations carry the verb but no token, so the first grep never emits them.

**Both files were in CP scope.** `entanglementRoutes.js` is named in CP6's 18-file planning cluster; §5.48's CP6 closure names the 13 files modified and it is not among them. Its cluster-mates `relationships.js`, `therapy.js` and `consciousness.js` all report 100% Tier 1 in the 2026-08-16 pre-flight run. `authorNoteRoutes.js` was moved to CP7 by the Item 13 Q13 redistribution; CP7's closure (§5.53) accounts for 22 of its 28 planned files and this is not one of them.

**Neither is exempt.** v2.37's genuine-public-read exemption list is `pageContent.js`, `manuscript-export.js` and `press.js`. §9.6 locks the governing rule: *"Writes always → requireAuth."* Neither file carries an Item 15 `// PUBLIC:` marker.

## §2.3 Shape 3 — multi-line declaration, middleware on a following line (3 routes)

`iconSlots.js` declares `optionalAuth` at `:21`, `:31`, `:41`, `:51`, `:61`, `:71`. Its write routes open at `:49` (POST), `:59` (PUT), `:69` (DELETE) — Pattern 5/6, with the middleware on line N+2.

**Why G1 misses it:** the token and the verb are on different physical lines. A line-oriented probe cannot join them.

**This limitation is documented in the pre-flight script's own header**, which states that Pass 1's same-line regex cannot match these three by design and that they surface in Pass 4 instead — *"correct behavior, not script drift."* The same limitation applies to §21's G1, which has no Pass 4 equivalent.

## §2.4 Shape 4 — router variable not named `router` (3 routes)

| Site | Declaration |
|---|---|
| `luxuryFilterRoutes.js:11` | `luxuryFilterRouter.post('/validate', optionalAuth, …)` |
| `luxuryFilterRoutes.js:32` | `luxuryFilterRouter.post('/quick-check', optionalAuth, …)` |
| `seasonRhythmRoutes.js:16` | `seasonRhythmRouter.post('/validate', optionalAuth, …)` |

Token and verb on the same line. These are the shape G1 was written to catch.

**Why G1 misses it:** the pattern is the literal string `router\.`, matched case-sensitively by `grep -E`. `luxuryFilterRouter.post` and `seasonRhythmRouter.post` end in `Router.post` with a capital R. They do not match.

Both files mount bare in `src/app.js` — `luxury-filter` at `:1433`, `season-rhythm` at `:1415` — inside require guards, after `:236`. Neither carries an Item 15 marker. `worldStudio.js:2483`, the one site G1 does return, uses lowercase `router.post` and is the ratified Tier 4 exemption carrying `degradeOnInfraFailure: true` and a `// PUBLIC:` rationale.

**This shape is instrument disagreement, not instrument blindness.** All three sites are hardcoded in the pre-flight script's `$PE51_ExplicitWriteOptionalAuth` inventory, and the 2026-08-16 run reports them **4 found / 4 expected — MATCH**. The pre-flight finds them because `Select-String` defaults to case-insensitive matching. G1 misses them because `grep -E` does not. **Two instruments read the same three sites from the same source and return opposite answers.**

`entanglementRoutes.js:40` and `authorNoteRoutes.js:18` are likewise hardcoded in `$PE51_FileLevelOptionalAuth`, reported **2 found / 2 expected — MATCH**. PE #51 therefore has all five non-Shape-1 files inventoried. What PE #51 does not carry is a count of the *write routes* those mounts govern: its stated total is 7 write routes — 4 explicit plus the 3 `iconSlots` — and the 11 writes under the two file-level mounts are not among them.

---

# §3. The discharged question

v2.43 §2.4 recorded: *"Whether other files share this shape is owed and not asserted."*

**Discharged. The population is 61 write routes across 12 files, in four shapes.**

| Shape | Files | Routes |
|---|---|---|
| 1 — bare declaration, global mount | 7 | 44 |
| 2 — file-scope `router.use(optionalAuth)` | 2 | 11 |
| 3 — multi-line declaration | 1 | 3 |
| 4 — router variable not named `router` | 2 | 3 |
| **Total** | **12** | **61** |

**Method.** Two instruments, agreeing. `git grep -L "requireAuth" origin/main -- src/routes/` returns 20 files; intersected with `git grep -l -E "router\.(post|put|patch|delete)" origin/main -- src/routes/`, the result is 12 files with write verbs and no `requireAuth` anywhere. `auth.js` is excluded as the login and refresh router, correctly unauthenticated and named in no CP scope. `export.js` is excluded as PE #13, `authMiddleware` rather than `optionalAuth`, deferred to Track 8. The remaining 10 files plus `entanglementRoutes.js` and `authorNoteRoutes.js` — which do contain `requireAuth`-adjacent imports but no `requireAuth` — comprise the 12.

**Bounded to `src/routes/`.** No claim is made about `src/controllers/`, about routers mounted from outside `src/routes/`, or about GET handlers that mutate. The `-L`/`-l` intersection is a file-level instrument and does not measure handler bodies.

---

# §4. Two register questions, raised and not decided

## §4.1 Does Shape 4 warrant its own FD?

FD-63 (F-AUTH-1) states that G1 **cannot detect** a route whose declaration carries no middleware. Shapes 1, 2 and 3 are instances of that mechanism — the probe is structurally unable to join a token to a verb.

Shape 4 is different in kind. The token and the verb are on the same line, in the shape G1 targets. The site is inventoried in PE #51 and confirmed present by a second instrument in the same week. G1's miss is a **regex-authoring defect** — a case-sensitive literal against a variable-naming convention the codebase does not follow uniformly — and its consequence is that a program reading G1's zero as confirmation of PE #51's discharge reads it wrongly.

**Whether that is FD-63's fourth shape or a separate finding is raised here and not decided.** This revision mints no FD. FD tail remains **FD-63 (F-AUTH-1)**.

## §4.2 Does PE #51 require amendment?

PE #51's inventory is **correct**. Every site this revision names in Shapes 2, 3 and 4 is in it, and the 2026-08-16 pre-flight confirms every hardcoded expectation MATCH.

Two candidate defects sit adjacent to it and neither is ruled here. First, PE #51 counts 7 write routes while the mounts it inventories govern 11 further writes that are not counted. Second, nothing in the record states that G1's zero does not discharge PE #51 — the two were read as consistent because both reported clean.

**Raised, not decided.** This revision mints no PE and amends no PE.

---

# §5. Gate effects — none

Track G5 is already **BLOCKED** per v2.43 §4.2. The population moving from 44 to 61 changes the size of the blocked surface and not the gate.

Tracks G3 and G4 remain **pending re-validation** per v2.43 §4.3. Track G4 is not entered.

v2.43 §4.1's REOPENED-QUALIFIED status is unchanged. §2.4's scope sentence stands as written: closure withdrawn for the seven Shape 1 files; for the remaining swept files G1's zero stands as observed output, not as closure proof.

**Shape 2, 3 and 4 files are not added to the withdrawal.** They are not files the sweep is recorded as having closed — `entanglementRoutes.js` and `authorNoteRoutes.js` are absent from their CPs' closure lists, and the `iconSlots`, `luxuryFilter` and `seasonRhythm` sites are live PE #51 inventory items awaiting the sweep rather than products of it. Withdrawing closure for them would assert a closure claim that was never made.

---

# §6. Numeral disambiguation

- **FD-63 (F-AUTH-1)** is v2.43's mint and is **not** re-minted here. It is unrelated to **§63 (F-Stats-1)** at F-Stats-1 Fix Plan v1.60, and to **PE #63**, which does not exist.
- **G1** in §1 and §2 is the §21 verification grep. It is **not** F-AUTH-1's own **Gate G1** (pre-flight complete) from the v1.5 six-gate sequence. v2.37 uses both senses of "G1" and v2.43 §6 disambiguated the greps only from other keystones' gates, not from F-AUTH-1's own. **Recorded as an imprecision in v2.43 §6**, correctable by a future revision; v2.43's body is not edited.
- **Tracks G3, G4, G5, G6** in §5 are gates, not greps.
- **Shape 1–4** in §2 are this revision's enumeration and are not Step 3 **Tier 1–4** dispositions, nor the pre-flight script's **Tier 1–3** confidence bands.
- **`src/app.js:236`** is the current global `optionalAuth` mount. v2.37 §4.3 cites `app.js:364` and its own G1 drift summary records `app.js:364 (v8) → src/app.js:330 (current)`. **Three values across three documents.** The 2026-08-16 pre-flight confirms `:236` MATCH against its 2026-05-21 baseline. Recorded; not reconciled.

---

# §7. What this revision establishes

- **§21's G1 command recorded verbatim** and reproduced at `7536993d`: one hit, the excluded polymorphic factory (§1).
- **Four miss shapes, not one** — bare declaration, file-scope mount, multi-line declaration, non-`router` variable name (§2).
- **61 write routes across 12 files** reach handlers under `optionalAuth` and produce no G1 hit (§3).
- **Shape 4 is instrument disagreement**: PE #51 and G1 read the same three sites and return opposite answers, the difference being case sensitivity (§2.4).
- **v2.43 §2.4's owed population question is DISCHARGED** (§3).
- **Bounded**: `src/routes/` only; no claim about controllers, external mounts, or mutating GETs (§3).

---

# §8. What this revision does not do

- Does not ship code, change any unit disposition, or alter any PR state.
- Does not mint an FD. Tail remains **FD-63 (F-AUTH-1)**. Does not mint an XK; tail remains **XK-3**. Does not mint a PE.
- Does not decide §4.1 or §4.2. Both are raised for ruling.
- Does not amend or re-state PE #51's inventory.
- Does not edit v2.37 §5.71, v2.43 §2.4, or any prior body. §6's note on v2.43's disambiguation is a recorded imprecision, not an edit.
- Does not extend v2.43's closure withdrawal to Shape 2, 3 or 4 files (§5).
- Does not change any gate. G5 remains blocked; G4 is not entered.
- Does not measure `src/controllers/`, routers mounted from outside `src/routes/`, or handler-body mutations on GET routes.
- Does not reconcile the three recorded values for the global mount line (§6).
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact.** Derived entirely from git against `origin/main` at `7536993d`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-16. Main at `7536993d`. Predecessor: v2.43.*
*Type: Discharges v2.43 §2.4's owed population question. Establishes four miss shapes at 61 write routes. Raises two register questions, decides neither. Mints no FD, no XK, no PE. Tail: FD-63. XK tail: XK-3. Ships no code. Changes no gate. No live database contact. [skip-automerge]*
