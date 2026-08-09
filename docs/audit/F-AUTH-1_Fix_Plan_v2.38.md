| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Six-step coordinated single-PR plan.* |
| --- |

**Document version**

v2.38 — RULING REVISION. Mints nothing. Ships no code. Supersedes v2.37 on Status field (v2.37 Status line contradicts §5.71 closure marker) and G-namespace; documents Track 6 / Step 3 CP-namespace collision without resolving it; rules on Handoff v21 §4. No PE, FD, or XK numbers minted; PE #14 already covers the dev→main propagation gap. No gate changed, no unit disposition changed, no PR state changed. Derived entirely from git against origin/main at `baa2f10d`.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP CLOSED at CP12 (see v2.37 §5.71 keystone closure marker). DEPLOYMENT TRACKS OPEN: Track G3 self-review → Track G4 dev verification + soak → Track G5 prod cutover → Track G6 post-deploy soak. Track labels per §2.2 forward definitions. Track G5 is gated on the prod freeze — a structural gate external to this keystone, not an F-AUTH-1 prerequisite.*

---

# §1. Ruling — v21 §4 sequencing question

## §1.1 The question

Prime_Studios_Audit_Handoff_v21 §4 surfaced, without deciding, whether the locked sequence had been revised during the F-Deploy-1 v1.2x–v1.48 run. v21 recorded three facts: F-Deploy-1 CLOSED at Fix Plan v1.48; F-AUTH-1's latest committed artifact at v2.37 with no start/closure state inferred; F-Stats-1 Phase B live through v1.31.

v21 correctly declined to rule — sequence is a Fix Plan's ruling, not a handoff's. This revision rules.

## §1.2 Correction of fact underlying the question

v21 §3 records F-AUTH-1 as "Artifact on main (v2.37; §5.1 pre-flight deliverable #715, 2026-05-26)" and declines to claim start/closure status. **That reading is superseded.** v2.37's own document-version block records CP12 as the FINAL backend Step 3 CP and the F-AUTH-1 keystone closure CP per audit handoff v8 §4.1, with program-wide verification: CP12-G1 zero optionalAuth-on-writes (excluding the v2.37 §5.45 polymorphic factory); CP12-G2 zero lazy-noop residue; CP12-G4 zero F-AUTH-4 true positives; CP12-G6 zero legacy alias residue in scope. Scope delivered: ~95–100 unique route files, ~700–750 handlers, 12 backend CPs plus one Track 7 mini-CP. Backend suite 2245 → 2390 passing, zero regressions.

The 2026-05-26 pre-flight deliverable is not F-AUTH-1's latest state. It is its starting line.

**Current-state verification (this revision, origin/main at `baa2f10d`).** This is a verification of the state CP12 left, measured today. It is not a CP12-G entry and does not replicate CP12's session greps.

`requireAuth` resolves to 1,307 occurrences across 122 files under `src/routes`. Write-verb `optionalAuth` resolves to exactly one site — `worldStudio.js:2483`, the ratified CP3 D1 Tier 3 disposition, one of the six v2.37 §5.45 polymorphic factory invocations (press.js L455/L501, worldStudio L2483, manuscript-export L132/L162/L570). Consistent with post-CP12 state.

**Not established here.** Whether the 81-commit `origin/main..origin/dev` divergence reflects content divergence on the swept route files is not established by hash comparison and is not resolved by this revision. v2.37 records CP12 auto-merge to dev as pending integrator. Per-file inspection against `origin/dev` is owed at Track G4. **PE #14 owns the gap.**

## §1.3 The ruling — Option A, parallel execution ratified

**The locked sequence is not revised. It is clarified.**

F-AUTH-1's Tier 0 precedence (v2.37 §2, from audit handoff v8 §4.1) is a rule about *shipping mutation-route changes onto an unauthenticated surface*. Once the backend sweep closed at CP12, that surface no longer exists on the swept routes. The precedence rule was satisfied by CP12's closure, not suspended.

F-Deploy-1 (workflow and deployment posture) and F-Stats-1 Phase B (raw-SQL to ORM conversion on character_state) do not contend with auth-middleware disposition. Neither closed nor advanced by shipping mutation routes onto an unauthenticated surface. **Their proceeding was correct and is ratified.**

**Locked forward:** keystones whose work does not ship mutation routes onto an unauthenticated surface may proceed in parallel with F-AUTH-1's open deployment tracks. Keystones that do ship such routes remain bound by Tier 0 precedence and must verify against the CP12-G1 condition before proceeding. Adjudication is per keystone, on the record, in that keystone's own register.

## §1.4 F-AUTH-1 standing — structural gate, not prerequisite

**Backend: CLOSED.** No outstanding F-AUTH-1 code prerequisite exists.

**Deployment: OPEN.** Tracks G3 → G4 → G5 → G6 remain.

**Track G5 (prod cutover) is gated on the prod freeze.** This is a *structural* gate: a property of the production environment's posture, external to this keystone. It is not an F-AUTH-1 prerequisite, not a defect, and not a scope item. **No window is claimed by this revision.** Freeze status must be confirmed live before any prod-touching action; it must not be inferred from this document.

---

# §2. Supersede banner — v2.37 corrections

Per additive-supersede convention: v2.37's body is frozen and is not edited. The collisions below remain in v2.37 as evidence. Clean definitions and corrections apply forward from v2.38.

## §2.1 Status field

v2.37's Status line reads "Step 3 backend sweep is next phase." Its own version block records the sweep COMPLETE at CP12. The Status line was never advanced past Track 6 and is **stale as of v2.37's own authorship**. v2.38's Status line above is the current authority.

## §2.2 G-namespace collision

v2.37 uses `G1`–`G6` for two unrelated schemes in adjacent text: CP12's program-wide *verification greps* (G1 = zero optionalAuth-on-writes, G3 = aiRateLimiter coverage, etc.) and the *deployment tracks* (G3 self-review, G5 prod cutover). Both live. Same defect class as the CP-namespace collision in §2.3.

**Forward definitions, LOCKED v2.38:**

- **`CP12-G1` … `CP12-G6`** — CP12's program-wide verification greps. Retrospective, scoped to CP12 closure, closed. Always CP-prefixed when referenced.
- **`Track G3` … `Track G6`** — deployment stages. Forward, open. Always Track-prefixed when referenced.

Bare `G<n>` is ambiguous and must not be used in any F-AUTH-1 document going forward.

## §2.3 Track 6 / Step 3 CP-namespace collision (documented, not resolved)

v2.37 uses `CP10` for both Track 6 StoryEvaluationEngine and a Step 3 CP; `CP11` for both Track 6 PressPublisher and a Step 3 CP. Two tracks, one namespace — same defect class as §2.2.

Both tracks are closed (Track 6 at CP2–CP15, Step 3 at CP12). No forward collision is possible and no renaming is warranted. **First reference in any F-AUTH-1 document must carry the track label in full** — "Track 6 CP11", "Step 3 CP12". Candidate entry for the Handoff v21 §6 successor.

This section documents the collision; it does not supersede v2.37 on this point.

---

# §3. What this revision does not do

- Does not ship code, change any unit disposition, or alter any PR state.
- Does not mint PE, FD, or XK numbers.
- Does not resolve the main/dev propagation question (PE #14).
- Does not claim or open a prod window.
- Does not withdraw or amend v21. §1.2 corrects one reading in v21 §3; v21 stands otherwise.
- No live database contact. Derived entirely from git against origin/main at `baa2f10d`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-09. Main at `baa2f10d`. Predecessor: v2.37.*
*Type: ruling revision. Supersedes v2.37 on Status field (v2.37 Status line contradicts §5.71 closure marker) and G-namespace; documents Track 6 / Step 3 CP-namespace collision without resolving it; rules on Handoff v21 §4.*
*Mints nothing. Ships nothing. Claims no window.*
