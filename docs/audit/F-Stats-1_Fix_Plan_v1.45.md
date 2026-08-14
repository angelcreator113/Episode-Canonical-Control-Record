# F-Stats-1 Fix Plan v1.45
*Additive-supersede on v1.44. Mints §48. Retracts v1.44 §47.7's F-AUTH-1 instance report. Mints no finding.*

## What changed in v1.45

**v1.44 §47.7's F-AUTH-1 instance report is RETRACTED.**
`worldStudio.js:2483` is not an unresolved F-AUTH-1 sub-form (a) instance. It is
the **ratified CP3 D1 Tier 3 site**, dispositioned at F-AUTH-1 v2.37 and
independently confirmed at v2.38 §1.2, v2.39 §1.2, and v2.42 §1.3. **Four
ratifications.** v1.44 reported it as needing attention; that is a live
instruction to re-litigate a settled decision and it is withdrawn here.

**v1.44 §47.5's characterisation of option 2 is CORRECTED.** It described
re-scoping F-AUTH-1 as a fix-sequence decision. It is not a re-scope, and its cost
was understated on two counts — §48.3.

**§35.5's exclusion of class 1 from F-AUTH-1 is UPHELD on a new and stronger
basis.** §35.5 justified it by symptom: *"every handler declares `requireAuth` and
passes every CP12 grep."* The actual basis is categorical: **F-AUTH-1 operates at
route granularity and class 1 operates at row granularity** — §48.4.

**No finding is minted.** Class 1's reach remains established per v1.44 §47.3 and
its homing remains owed. This revision corrects the record and does not decide.

---

## §48 — retraction, correction, and the granularity basis

### §48.1 Basis

Basis `51add405` (v1.44, #1017). Derived from F-AUTH-1 Fix Plan revisions on
`origin/main`, read via `git show origin/main:`. **F-AUTH-1's tail is v2.42** — 16
fix-plan revisions across a v1 and a v2 series. No live database contact.

### §48.2 The retraction

v1.44 §47.7 reported:

> `worldStudio.js:2483` declares `optionalAuth` on a write — **F-AUTH-1 sub-form
> (a)**. […] Recorded as an instance report for whoever executes F-AUTH-1.

**This is withdrawn.** F-AUTH-1 v2.37's CP3 D1 disposition reads:

> **D1 WorldStudio mixed disposition (REVISED FROM STRICT MATRIX):** 1 Tier 3
> (line 2483 generate-ecosystem-preview — req.user consumed for ownership tagging)
> + 17 Tier 4 GETs (read-only published catalog) + 34 mutation handlers Tier 1
> (22 POST + 6 PUT + 6 DELETE; mutations require auth regardless of
> req.user-consumption matrix).

The site is deliberately Tier 3, and the rationale comment sits **directly above
the route declaration** at line 2482:

> `// PUBLIC: World ecosystem preview generation with ownership-when-authenticated;
> degraded auth tolerated for audience growth — see Audit Handoff §4.1`

F-AUTH-1 v2.42 §1.3 records this comment as a **new false-positive class** for
§5.57's keyword probe, precisely because it uses auth-weakening vocabulary in the
structural position where a true positive would live. **The same shape that made
it a false positive for F-AUTH-1's probe made it a false positive for v1.44's
read.**

**What v1.44 got right, and the wrong inference drawn from it.** §47.7 recorded
that 2483 is the only write among 53 routes declaring `optionalAuth`, and the only
site invoking it with options rather than as a bare reference — *"which suggests
the degradation was deliberate."* **The observation was correct and the evidence
was sufficient.** It was recorded as suspicion and reported as a finding rather
than followed to the ratification it pointed at.

**Method note.** v1.44 read the route declaration and not the line above it.
Auth-weakening vocabulary is a signal only when nothing accounts for it, and
**the accounting convention in this repository is a rationale comment immediately
preceding the declaration** — F-AUTH-1 item 15 requires one on every Tier 3 and
Tier 4 marking. Reading a route's auth posture means reading the comment block
above it, not the declaration line alone.

This joins the accumulated method-hazard set alongside §28's window and
`Measure-Object` hazards, §36.4's probe hazard, §39.5's prose-population hazard,
§40.6's fit-to-authority hazard, §41.5's four, §42.6's table-beats-prose hazard,
§43.7's null-control hazard, §45.6's carve-out-omission hazard, §46.4's
shape-without-model hazard, and §47.6's malformed-probe hazard.

**The unverified cost adjacency at §47.7 is not withdrawn, and is re-framed.**
v1.44 noted conditionally that if this handler invokes the file's `claude()`
helper, an unauthenticated request would trigger third-party API spend. **That
remains unverified and is not an F-AUTH-1 defect either way** — the Tier 3
marking is a ratified product decision described in its own rationale as
*"degraded auth tolerated for audience growth."* If the cost exposure is real it
is a question against that decision, not an auth finding, and it is not F-Stats-1's
to raise. Recorded, unowned, unverified.

### §48.3 Correction to v1.44 §47.5's option 2

v1.44 §47.5 offered: *"Re-scope F-AUTH-1 to cover post-authentication
authorization rather than authentication alone"*, costed as a fix-sequence change
because F-AUTH-1 sits first in the locked sequence.

**Both halves are wrong.**

**It is not a re-scope; it is a category change.** F-AUTH-1 already covers
authorization — see §48.4. What it does not cover is a different *granularity*.

**Its cost was understated.** F-AUTH-1's status at v2.42:

> *BACKEND STEP 3 SWEEP CLOSED at CP12 (see v2.37 §5.71 keystone closure marker).
> DEPLOYMENT TRACKS OPEN: Track G3 self-review → Track G4 dev verification + soak
> → Track G5 prod cutover → Track G6 post-deploy soak. […] Track G5 is gated on
> the prod freeze.*

**The backend sweep is closed and the keystone is in deployment.** Widening it
would reopen a closed sweep mid-deployment, against a track sequence whose G5 is
already gated on the prod freeze. That is a materially larger action than "a
fix-sequence decision," and v1.44 described it from a remembered characterisation
of F-AUTH-1 rather than from its live status line.

**Option 2 is not viable** and should not be carried forward as a live option.

### §48.4 The granularity basis — why class 1 is not F-AUTH-1's

F-AUTH-1's model is a **five-tier route-level access classification**:

| Tier | Shape | Covers |
|---|---|---|
| 1 | `requireAuth` | Mutations; auth required regardless of `req.user` consumption |
| 2 | `requireAuth + authorize(['ADMIN'])` | Admin tooling, audit logs, internal financial/system data |
| 3 | `optionalAuth`, `req.user` consumed for ownership tagging | Public-with-attribution |
| 4 | Public read-only | Published catalog reads |
| 5 | Env-gated mount | Non-production-only surfaces |

The `authorize()` helper at `middleware/auth.js:300` takes a role array and is in
production use across `admin.js`, `auditLogs.js`, `templates.js` and `assets.js`.

**Every tier answers one question: which callers may reach this endpoint.** That
is authorization, and F-AUTH-1 unambiguously covers it — 39 occurrences of
authorization vocabulary in v2.37 against zero in v2.2 and v1.5, so the coverage
arrived with the tier model rather than being present throughout.

**Class 1 asks a different question: which rows may this handler touch once the
caller is inside.**

`PUT /world/:showId/arc/phase/:phase` is **correctly Tier 1**. It declares
`requireAuth`; it is a mutation; F-AUTH-1's model disposes of it completely and
correctly. **And it still writes another show's arc**, because the tier model
governs endpoint reachability, not row reachability.

**A route can be perfectly tiered and still cross tenants.** That is the
categorical gap, and it is why §35.5's conclusion holds. §35.5 reached the right
answer from a symptom — *"passes every CP12 grep"* — and the symptom is explained
by the category: **CP12 greps for auth declarations, and class 1's instances all
have correct auth declarations.**

*Stated at the strength of the evidence:* 20 of v2.37's 39 authorization
occurrences were read. The tier model is unambiguous across those 20. The
remaining 19 were not examined and could in principle contain a row-level clause,
though none of the 20 hints at one.

### §48.5 What this leaves

**Class 1's reach is established** (v1.44 §47.3) and **its homing is owed**.

Of v1.44 §47.5's three options, **option 2 is withdrawn** as non-viable per §48.3.
The live options are:

1. **Mint as its own finding class** — new number, new owner.
2. ~~Re-scope F-AUTH-1~~ — **withdrawn**.
3. **Record reach established, defer minting** — the posture v1.44 took and this
   revision continues.

**A framing v1.44 did not record:** minting and scheduling are separable. A
finding can be minted — given a number, made citable, its reach and severity on
the record — without taking a position on where it sits in the locked fix
sequence. **v1.44 §47.5 treated minting as inherently a fix-sequence decision.
It is not.**

This revision does not mint. It corrects the record so that the mint, when taken,
is taken against accurate F-AUTH-1 state.

---

## What this revision does not do

- **Does not mint any finding class.** Class 1 remains established-and-homeless.
- Does not decide class 1's homing, or take any of §48.5's options.
- Does not disturb v1.44 §47.3's reach finding, which stands.
- Does not assess or reopen F-AUTH-1. **Its backend sweep is CLOSED at CP12 and
  its deployment tracks are its own.** This revision reads its scope and asserts
  nothing about its execution.
- Does not read v2.37's remaining 19 authorization occurrences.
- Does not verify whether `worldStudio.js:2483` invokes `claude()`, or raise the
  cost question against a ratified Tier 3 decision.
- Does not survey class 1's extent across the remaining 20 `:showId` files.
- Does not establish reach for classes 2–6.
- Does not audit any file. **No source file is read in this revision.**
- Does not reopen open items 41 or 23, closed at v1.43.
- Does not resolve §39.4 defect 1 or defect 3.
- Does not mint an FD, PE, or XK number.
- Does not lift any gate. **F-AUTH-1's Track G5 remains gated on the prod
  freeze; nothing here bears on it.**
- Does not enumerate prod. **Prod remains FROZEN and this revision confers no
  authority to touch it.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.45 | 2026-08-14 | **v1.44 §47.7's F-AUTH-1 instance report RETRACTED.** `worldStudio.js:2483` is the **ratified CP3 D1 Tier 3 site** — *"req.user consumed for ownership tagging"* per F-AUTH-1 v2.37's D1 disposition, independently confirmed at v2.38 §1.2, v2.39 §1.2 and v2.42 §1.3, with the required item-15 rationale comment at line 2482. v2.42 §1.3 records that same comment as a new false-positive class for §5.57's probe — **the shape that fooled F-AUTH-1's probe fooled v1.44's read.** v1.44's own evidence (sole `optionalAuth` write of 53 routes; sole options-form invocation) was correct and pointed at the ratification; it was recorded as suspicion and reported as a finding. **Method hazard: reading a route's auth posture means reading the rationale comment above the declaration, not the declaration alone** — F-AUTH-1 item 15 requires one on every Tier 3 and Tier 4 marking. **v1.44 §47.5's option 2 CORRECTED and WITHDRAWN**: it is not a re-scope but a category change, and F-AUTH-1's **backend sweep is CLOSED at CP12** with deployment tracks G3→G6 open and G5 gated on the prod freeze — widening it would reopen a closed sweep mid-deployment, not amend a queued one. **§35.5's exclusion of class 1 from F-AUTH-1 UPHELD on a categorical basis (§48.4):** F-AUTH-1's five-tier model (requireAuth / +authorize(['ADMIN']) / optionalAuth-with-ownership-tagging / public-read / env-gated) answers **which callers may reach an endpoint**; class 1 asks **which rows a handler may touch once inside**. `PUT /world/:showId/arc/phase/:phase` is correctly Tier 1 and still writes another show's arc. Authorization vocabulary: 39 occurrences in v2.37, 1 in v2.42, zero in v2.2 and v1.5 — coverage arrived with the tier model; 20 of 39 read. **Minting and scheduling are separable** — v1.44 treated them as one decision. **No finding minted.** Mints no FD. No live DB contact. Prod FROZEN, untouched. §48 minted. Basis `51add405`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.44. Tail: **FD-61**.
- Mints: **§48**.
- Closes: **nothing**.
- **Retracts: v1.44 §47.7's F-AUTH-1 instance report.** `worldStudio.js:2483` is
  ratified Tier 3; no F-AUTH-1 action is owed and none should be taken on v1.44's
  authority.
- **Corrects and withdraws: v1.44 §47.5's option 2** as non-viable.
- Upholds: **§35.5's exclusion of class 1 from F-AUTH-1**, on the categorical
  basis at §48.4 rather than §35.5's symptom-based one.
- Records: the granularity distinction (route-level versus row-level); §48.2's
  method hazard; the separability of minting from scheduling.
- **Mints no finding class, issues no number, claims no ownership.** Class 1's
  homing remains owed.
- Carries: v1.44 §47.3's reach finding (unchanged); the class 2 candidate at
  `opportunityRoutes.js:258`; the class 5 instance in `arcRoutes.js`; open items
  22, 24, 6; all other items carried from v1.44. Open items 41 and 23 remain
  **CLOSED** per v1.43.
- Defers: class 1's homing and extent; classes 2–6's reach; §39.4 defect 1
  (label-only) and defect 3 (unruled); §44.8 (satisfied for `worldEvents.js`,
  unruled generally); XK-1's remedy and population question.
- Forward-points: nothing new.
- Changes no unit disposition, no PR state, no gate. `worldEvents.js`'s 112
  dispositions stand unaltered. **F-AUTH-1's dispositions, tracks and gates are
  untouched.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.44; no destructive rewrite. v1.44's body is not
  modified; §47.7's retraction and §47.5's correction live here.
- **Numeral disambiguation:** *finding class 1 (F-Stats-1 §35.5)* is unrelated to
  *F-AUTH-1's Tier 1*, to any FD-1, §1, or open item 1. **F-AUTH-1 section and
  revision numbers cited here (§5.57, §5.71, v2.37, v2.42) belong to F-AUTH-1's
  register and are unrelated to F-Stats-1's.** §48 is minted in v1.45; section
  numbers and their minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

v1.44 established that finding class 1 reaches beyond `worldEvents.js` and, in the
same revision, reported a settled F-AUTH-1 decision as an open one. **The first
result stands. The second is withdrawn here.**

The error is worth stating plainly because its shape recurs: v1.44 collected the
right evidence — a lone `optionalAuth` write, invoked with options, among
fifty-two routes that were not — and stopped one line short of the comment that
explained it. **F-AUTH-1's own probe was fooled by the same comment**, and v2.42
minted a false-positive class for it. Two independent readers, one accounting
convention, the same miss.

What the correction bought is a better answer to the question v1.44 was actually
asking. §35.5 excluded class 1 from F-AUTH-1 because its instances pass CP12.
**They pass CP12 because CP12 greps auth declarations and class 1's instances have
correct ones.** F-AUTH-1's five tiers govern which callers may reach an endpoint;
class 1 governs which rows a handler may touch once the caller is inside. A route
can be perfectly tiered and still write another tenant's data.

**That is a categorical gap, not an oversight in either keystone's scope**, and it
is why the class remains homeless after both were checked against it.

Two of v1.44's three options survive: mint it, or keep deferring. **Re-scoping
F-AUTH-1 is withdrawn** — its backend sweep closed at CP12 and it is in
deployment. And minting need not settle where the work sits in the locked
sequence; **a finding can have a number before it has a schedule.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-14. Main at `51add405` (#1017). Predecessor: v1.44.*
*Minted: §48. Retracted: v1.44 §47.7's F-AUTH-1 instance report. Withdrawn: v1.44 §47.5's option 2. Closed: nothing. Mints no finding class, no FD. Tail: FD-61. [skip-automerge]*
