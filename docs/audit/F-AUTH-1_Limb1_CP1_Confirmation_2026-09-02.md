| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP1 CONFIRMATION PASS** *One CP of twelve. 3 recorded dispositions read against code at CP1's own basis commit. 3/3 agree. Zero cannot-tell, explained per v2.68 §4.1.* |
| --- |

# F-AUTH-1 Limb 1 — CP1 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP — CP1 —
of the twelve-CP historical population Ruling 2 fixes. Second CP confirmed;
`F-AUTH-1_Limb1_CP10_Confirmation_2026-09-02.md` did CP10. Per Ruling 4, this
is a durable partial result: limb 1 discharges when all twelve CPs are
confirmed, not before.

**Basis:** `origin/main` at `cc8661ab01076a3fb0b9de68c6ead5de7358bfd4`,
2026-09-02.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Confirmation pass, not a re-derivation. Mints nothing. Adjudicates no new
Tier disposition — every row below states whether CP1's own recorded
ruling matches the code CP1 itself produced. Limb 1 **OPEN**; limb 3 open;
G4 not enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**.

---

# §1. Method, quoted before any read (`F-AUTH-1_Fix_Plan_v2.68.md` §2–§6)

**Ruling 1 (§2) — the unit is one recorded CP disposition, not one handler:**

> "Limb 1 audits the sweep's rulings — each place a CP recorded a
> disposition." "The denominator is non-uniform by construction."

**Ruling 2 (§3) — the population is the historical CP1–CP12 swept set, not
the present surface:**

> "Deriving the historical population is bounded, mechanical, and remains
> unperformed. It requires git history rather than the working tree —
> enumerate the declarations touched across the CP1–CP12 commit range."

**Ruling 3 (§4) — one judgment is a confirmation, not a re-derivation:**

> "Read what the CP ruled. Read the code it ruled about, at that CP's own
> basis. Record `agree` / `disagree` / `cannot-tell`." "**A limb 1 pass
> reporting no `cannot-tell` results is MORE suspect than one reporting
> several**" (§4.1).

**Ruling 4 (§5) — decomposable per CP, partial results hold:**

> "The CPs closed separately. A completed CP1 audit is a real result whether
> or not CP2 follows." "Limb 1 discharges when all twelve are done, and not
> before."

**Ruling 5 (§6) — the `~700` work estimate is WITHDRAWN** and does not size
limb 1. Not relied on here.

**This pass applies Ruling 3 to one CP (CP1), per Ruling 4's decomposition,
against the population Ruling 2 defines.**

---

# §2. Population — CP1's recorded dispositions, established

## §2.1 Locating CP1

```
$ git log --all --oneline --grep="CP1:" -i | grep -i "Step 3 CP1"
05cd536dd f-auth-1 step 3 CP1: F-AUTH-2 lazy-init + F-AUTH-3 5-handler migration + lazy-noop fallback removal

$ git log -1 --format='%H %ad %s' --date=short 05cd536dd
05cd536dd90703372cb0557b191b023156818ef6 2026-05-06 f-auth-1 step 3 CP1: ...

$ git merge-base --is-ancestor 05cd536dd origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR
```

**CP1's commit: `05cd536dd90703372cb0557b191b023156818ef6`, 2026-05-06,
confirmed an ancestor of `origin/main` at this basis.** This is **CP1's
basis commit** for §4 below.

## §2.2 Source 1 — the code commit's message body

```
$ git log -1 --format=%b 05cd536dd
```

Full body read (127 lines). Relevant to the disposition count (per-work-product
breakdown, quoted verbatim):

> "WP2 — F-AUTH-3 5-handler factory invocation
> - 5 handlers migrated (Option A scope per Decision 1 LOCKED):
>   * press.js line 455: GET /characters
>   * press.js line 501: GET /characters/:slug
>   * manuscript-export.js line 123: GET /book/:bookId/meta
>   * manuscript-export.js line 153: GET /book/:bookId/docx
>   * manuscript-export.js line 561: GET /book/:bookId/pdf
> - Each: replace `optionalAuth` with
>   `optionalAuth({ degradeOnInfraFailure: true })`.
> - Press.js POSTs (4 handlers — lines 361 /seed-characters,
>   531 /advance-career, 607 /generate-post, 696 /generate-scene)
>   REMAIN ON PLAIN optionalAuth — DEFERRED TO CP10 with Tier 1
>   (requireAuth) + aiRateLimiter on lines 607, 696 per worldEvents
>   reference model."

Also present, and excluded from the population at §2.4: **WP1** (`F-AUTH-2`
lazy-init refactor at `src/middleware/auth.js`) and **WP3** (lazy-noop
fallback removal at the same two files).

## §2.3 Source 2 — the closure document's version block

```
$ git log --all --oneline --diff-filter=A -- "docs/audit/F-AUTH-1_Fix_Plan_v2.24.md"
f00522235 docs(audit): F-AUTH-1 fix plan v2.24 — Step 3 CP1 closure ...

$ git log -1 --format='%H %ad %s' --date=short f00522235
f00522235b84062b49987d800317017c81ec0a7b 2026-05-06 docs(audit): F-AUTH-1 fix plan v2.24 ...

$ git show f00522235:docs/audit/F-AUTH-1_Fix_Plan_v2.24.md | sed -n '7p'
```

`v2.24` is CP1's closure document, adding commit `f00522235`. Its
**Document version** block (one paragraph) states, in relevant part:

> "v2.24 — Step 3 CP1 (F-AUTH-2 lazy-init refactor + F-AUTH-3 5-handler
> migration + lazy-noop fallback removal) approved at commit `05cd536d`.
> ... press.js scope correction: 6 handlers = 2 GETs + 4 POSTs (NOT all
> GETs as v2.23 §5.5 stated); 5 of 6 migrated CP1, 4 POSTs deferred CP10."

This corroborates the commit body's shape (5 Tier 3 migrations, 4 POSTs
deferred) at coarser, class-level granularity — it does not itemize the
individual line numbers, so per the same governing rule applied at the
CP10 pass (`F-AUTH-1_Limb1_CP10_Confirmation_2026-09-02.md` §2.3): where
one source itemizes and the other states only the class total, the
itemization governs. The commit body itemizes; it is read as governing
scope for §2.4.

## §2.4 The population: 3 recorded dispositions

Applying Ruling 1's boundary rule (scope at finest granularity named — file,
not handler; class totals that are itemized are counted by their
itemization; **a deferral is a disposition**) to the commit body's WP2
breakdown:

| # | scope | class | named lines |
|---|---|---|---|
| 1 | `press.js` | Tier 3 (`optionalAuth({ degradeOnInfraFailure: true })`) | 455, 501 |
| 2 | `manuscript-export.js` | Tier 3 (same factory) | 123, 153, 561 |
| 3 | `press.js` | deferred, remains plain `optionalAuth` | 361, 531, 607, 696 |

**WP1 and WP3 are not counted as separate dispositions**, for the same
reason WP1/WP2 were excluded from CP10's population
(`F-AUTH-1_Limb1_CP10_Confirmation_2026-09-02.md` §2.4): neither assigns or
changes a route's Tier. WP1 (`F-AUTH-2` lazy-init) hardens
`src/middleware/auth.js` itself and belongs to Step 1, a different keystone
step from the Step 3 per-route sweep limb 1 audits. WP3 (lazy-noop fallback
removal) replaces a defensive `try/catch` import guard with a direct
`require` at the same two files WP2 already covers — it changes *how* the
existing `optionalAuth` import is obtained, not *what Tier* any route
carries, and the commit body itself frames WP3 as closing a
"double-jeopardy" risk to WP1, not as a disposition of its own.

**This reaches 3, independently, from the commit body alone.** It matches
`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` §2's CP1 row (`press.js Tier 3;
manuscript-export.js Tier 3; 4 POSTs deferred to CP10` → **3**), filed
2026-08-23, itself a MEASURED, merged document using the same two sources.
As with the CP10 pass, this pass's population was built from §2.2/§2.3
before consulting that document's total — the two counts corroborate rather
than one citing the other.

---

# §3. CP1's basis commit, on the face

**`05cd536dd90703372cb0557b191b023156818ef6`** — found per §2.1's command,
confirmed an ancestor of `origin/main` at this document's basis. All reads
in §4 are `git show 05cd536dd:<path>` against this SHA, per Ruling 3.

---

# §4. Confirmation table — 3/3

| # | Disposition (scope · class) | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | `press.js` · Tier 3 migration (2 GETs) | `src/routes/press.js:455,501` | `optionalAuth({ degradeOnInfraFailure: true })` | Both lines carry exactly that factory invocation | **agree** |
| 2 | `manuscript-export.js` · Tier 3 migration (3 GETs) | `src/routes/manuscript-export.js:123,153,561` | `optionalAuth({ degradeOnInfraFailure: true })` | All three lines carry exactly that factory invocation | **agree** |
| 3 | `press.js` · 4 POSTs deferred to CP10, remain plain `optionalAuth` | `src/routes/press.js:361,531,607,696` | Plain `optionalAuth`, not migrated, not `requireAuth` | All four lines carry plain `optionalAuth` — `POST /seed-characters` (L361), `POST /advance-career` (L531), `POST /generate-post` (L607), `POST /generate-scene` (L696) | **agree** |

**3/3 agree. 0 disagree. 0 cannot-tell. Cannot-tell rate: 0/3.**

**Supporting reads, not separate dispositions (§2.4 excludes WP1/WP3 from
the count, but the underlying claims were checked for internal
consistency):**

- `src/routes/press.js:37` and `src/routes/manuscript-export.js:29` — both
  `const { optionalAuth } = require('../middleware/auth');`, a direct
  destructuring import with no `try/catch` lazy-noop fallback, matching the
  WP3 claim.
- `src/middleware/auth.js` — `getIdTokenVerifier`, `getAccessTokenVerifier`,
  and `getCognitoConfig` are present, with `_idTokenVerifier` /
  `_accessTokenVerifier` module-scope caches initialized to `null`, matching
  the WP1 claim.

---

# §5. Zero `cannot-tell` is reported, and the discriminator is answered

`v2.68` §4.1: *"A limb 1 pass reporting no `cannot-tell` results is MORE
suspect than one reporting several."*

- **All three dispositions name an exact file and exact line numbers**,
  stated by CP1's own commit body. The confirmation is a direct string-level
  read at CP1's own basis commit — not an inference about intent.
- **The deferral disposition (row 3) is the one row where a weaker read
  could have gone wrong.** Confirming a deferral means confirming an
  *absence* of change — that the four POSTs were **not** migrated. This was
  checked the same way as the other two: reading the literal middleware at
  each named line, not inferring it from the surrounding narrative. Had any
  of the four instead carried `requireAuth` or the Tier 3 factory, that
  would have been a **disagree**, not a silent pass.
- **CP1's record, like CP10's, states dispositions at file-and-line
  granularity in its commit body** rather than only in prose at cluster
  level — this is the property of the record that makes a clean read
  possible; it is not evidence that this pass drifted toward re-derivation.
  No Tier judgment was made here; every claim in §4 was already stated by
  CP1 and only checked against the code CP1 produced.

**This zero is explained, not clean, and CP1-specific: it does not predict
what CP2–CP9, CP11, or CP12 will show, and no claim is made about them
here.**

---

# §6. Tails, re-derived at this basis, not carried

```
$ grep -ro 'FD-70' docs/audit/ | wc -l
56

$ grep -r 'XK-4' docs/audit/ | wc -l
34

$ grep -r 'PE #69' docs/audit/ | wc -l
34
```

**Unchanged from `F-AUTH-1_Limb1_CP10_Confirmation_2026-09-02.md`'s own
read (56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`, or
`PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §7. What this document does not do

- **Performs limb 1 for CP1 only.** CP2–CP9, CP11, and CP12 remain
  unconfirmed (CP10 was confirmed separately). Limb 1 stays **OPEN** —
  Ruling 4 requires all twelve.
- **Does not re-derive or challenge any of CP1's Tier dispositions.** Every
  row above asks whether CP1's own code matches CP1's own recorded claim,
  not whether the claim was the right one to make.
- **Does not re-run or extend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s
  129-count**, and does not treat its CP1 row as authority for this pass's
  population — §2.4 built the population independently and notes where the
  two agree.
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1** or estimate remaining work. Ruling 5's withdrawal
  of the `~700` figure is not revisited.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including `F-AUTH-1_Fix_Plan_v2.24.md`,
  `v2.68`, `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, or
  `F-AUTH-1_Limb1_CP10_Confirmation_2026-09-02.md`.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All reads
local git at `cc8661ab0`, against CP1's basis commit `05cd536dd`. No host,
AWS, database, or Cognito contact. No endpoint exercised. Prod FROZEN.*
