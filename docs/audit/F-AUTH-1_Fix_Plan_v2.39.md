| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Six-step coordinated single-PR plan.* |
| --- |

**Document version**

v2.39 — G3 EVIDENCE REVISION. Mints nothing. Ships no code. Changes no gate; G3 remains OPEN. Records a partial discharge of Track G3 self-review: five of the six CP12 verification greps re-run against origin/main at `5ed3a839` and all five hold post push #37 (merge-resolution) and push #38 (cleanup-delete). Records that CP12-G4 has no canonical probe in v2.37 §21 and was therefore NOT run. Supersedes v2.37 on the G3 definition, naming §5.71 as governing over the gate-table wording. No PE, FD, or XK numbers minted. Derived entirely from git against origin/main at `5ed3a839`. No live database contact.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP CLOSED at CP12 (see v2.37 §5.71 keystone closure marker). DEPLOYMENT TRACKS OPEN: Track G3 self-review (PARTIALLY DISCHARGED — see §1; blocked on §2) → Track G4 dev verification + soak → Track G5 prod cutover → Track G6 post-deploy soak. Track labels per v2.38 §2.2 forward definitions. Track G5 is gated on the prod freeze — a structural gate external to this keystone, not an F-AUTH-1 prerequisite.*

---

# §1. Track G3 self-review — partial discharge

## §1.1 What was asked

v2.37 §5.71 defines Track G3 as: *adjudicator-driven audit pass over CP1–CP12 cumulative work; verify G1–G6 still hold post-merge-resolution + cleanup-delete; production-readiness assessment for G4.*

This revision discharges the middle clause only: whether the six CP12 verification greps still hold after push #37 (merge-resolution, `f5517eb0`) and push #38 (cleanup-delete, `c3c5dbb4`). CP12's G1–G6 verification ran at WP12, before both pushes. Nothing had re-run them since.

## §1.2 Result

Re-run against `origin/main` at `5ed3a839`, using the canonical probes at v2.37 §21 where they exist.

| Grep | CP12 recorded | This pass | Status |
|---|---|---|---|
| CP12-G1 — optionalAuth on writes | 0 excluding §5.45 polymorphic factory | 1 site: `worldStudio.js:2483` (the ratified CP3 D1 Tier 3 factory invocation) | **HOLDS** |
| CP12-G2 — lazy-noop residue | 0 program-wide | 0 | **HOLDS** |
| CP12-G3 — aiRateLimiter import+use | 211 lines program-wide | 211 | **HOLDS** |
| CP12-G4 — F-AUTH-4 obsolescence | 0 true positives | **NOT RUN** — see §2 | **UNVERIFIED** |
| CP12-G5 — `// PUBLIC:` markers | 25 cumulative | 25 | **HOLDS** |
| CP12-G6 — legacy alias residue | 0 in scope | 0 — one comment-only match at `scripts.js:9`, adjudicated below | **HOLDS** |

**Five of six hold. Pushes #37 and #38 disturbed nothing measured by these probes.**

**CP12-G6 adjudication.** The canonical probe (`authenticateToken` excluding `authenticateJWT`) returns one match: `scripts.js:9`, inside CP9's own §5.53 rationale comment recording the 5-instance conversion. The file's live import at line 12 is `const { requireAuth } = require('../middleware/auth');`. Comment-only; not middleware residue. Recorded here so a future pass does not re-triage it.

**Scope of G6 as run.** The §21 canonical probe covers `authenticateToken` only. v2.37 §5.41 later formalized G6-EXTENDED to cover the bare `authenticate` alias as well. This pass ran the canonical probe as written; the extended variant was not run and is not claimed.

## §1.3 What this pass does NOT establish

**This is a count-stability check, not a re-audit.** It verifies the numbers CP12 recorded still obtain. It does not re-examine any CP1–CP12 disposition judgment, does not re-classify any handler, and does not assess whether the tier assignments were correct. §5.71's "adjudicator-driven audit pass over CP1–CP12 cumulative work" and its "production-readiness assessment for G4" are **not discharged by this revision.**

## §1.4 G3 remains OPEN

Track G3 is partially discharged and remains open on two grounds: the §2 definition gap, and the §1.3 clauses not attempted. **No gate changes. G4 is not entered.**

---

# §2. CP12-G4 has no canonical probe

## §2.1 The gap

v2.37 §21 enumerates canonical program-wide probes for G1, G2, and G6 as exact commands. G3 and G5 carry hard counts that make their probes unambiguous. G4 has neither.

G4 appears throughout v2.37 only by outcome and by scattered description: "F-AUTH-4 obsolescence true positives," "AUTH-DISABLED banners," "F-AUTH-4 multi-line grep," "auth-weakening comment blocks," and one triaged false positive at `opportunityRoutes.js:36` (the `expired:` STATUS_FLOW state name). No revision states the command.

## §2.2 Why this revision does not supply one

A probe constructed from those descriptions would be a guess. A guessed security probe that returns zero is worse than an acknowledged gap, because **zero reads as safety**. This revision therefore records the gap and runs nothing.

Per the same reasoning, no best-effort or non-canonical result is offered.

## §2.3 Consequence

CP12's "G4 0 F-AUTH-4 obsolescence true positives (5 consecutive CPs at zero)" rests on twelve sessions of adjudicator judgment that no subsequent reader can reproduce. The finding is not disputed — it is unrepeatable.

**A verification gate that cannot be re-run is not a verification gate.**

## §2.4 What is owed

Either (a) a revision supplies the canonical G4 probe for §21, after which G4 can be re-run and G3's §5.71 clause fully discharged; or (b) a revision explicitly waives G4 re-verification with stated reasoning. **This revision selects neither.** Until one lands, Track G3 cannot fully discharge and Track G4 should not be entered on the strength of a five-of-six pass.

---

# §3. Supersede banner — G3 definition

Per additive-supersede: v2.37's body is frozen and is not edited. The divergence below remains in v2.37 as evidence.

## §3.1 The divergence

v2.37 defines Track G3 twice, incompatibly.

**Gate table:** *"Self-review passed. Every commit in the PR read end-to-end. Test coverage minimum: one authenticated + one unauthenticated test per sub-form…"*

**§5.71:** *"adjudicator-driven audit pass over CP1–CP12 cumulative work; verify G1–G6 still hold post-merge-resolution + cleanup-delete; production-readiness assessment for G4."*

The gate-table wording dates from F-AUTH-1's original shape: a six-step coordinated single PR. The program that actually ran was 12 backend CPs plus one Track 7 mini-CP across 38 pushes, ~95–100 route files and ~700–750 handlers. **"Every commit in the PR read end-to-end" has no referent** — there is no single PR, and the volume is not reviewable in the sense the gate table intends.

This is the same staleness class v2.38 §2.1 identified in the Status field: text correct when written, never advanced as the program grew. **Second instance in this document.**

## §3.2 Forward definition, LOCKED v2.39

**v2.37 §5.71 governs Track G3.** The gate-table G3 row is superseded as a definition and preserved in v2.37 as historical record.

The gate table's substantive test requirements — one authenticated and one unauthenticated test per sub-form, the F-Auth-5 decisionLogs test, the frontend interceptor's distinct AUTH_REQUIRED / AUTH_INVALID_TOKEN paths — are not withdrawn. Whether they were satisfied is not assessed here. What is superseded is the *"every commit in the PR"* review scope, not the coverage floor.

## §3.3 Not resolved here

Whether the gate-table G4/G5/G6 rows carry the same staleness is not assessed by this revision. Their wording predates the program's expansion by the same margin. A future revision should examine them before Track G4 is entered.

---

# §4. What this revision does not do

- Does not ship code, change any unit disposition, or alter any PR state.
- Does not change any gate. Track G3 remains OPEN; Track G4 is not entered.
- Does not mint PE, FD, or XK numbers.
- Does not supply, guess at, or run a probe for CP12-G4.
- Does not re-audit CP1–CP12 disposition judgments.
- Does not discharge §5.71's "production-readiness assessment for G4."
- Does not assess the gate-table G4/G5/G6 row wording (§3.3).
- Does not claim or open a prod window.
- No live database contact. Derived entirely from git against origin/main at `5ed3a839`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-09. Main at `5ed3a839`. Predecessor: v2.38.*
*Type: G3 evidence revision. Supersedes v2.37 on the Track G3 definition (§5.71 governs). Records CP12-G4 definition gap. Mints nothing. Ships nothing. Changes no gate.*
