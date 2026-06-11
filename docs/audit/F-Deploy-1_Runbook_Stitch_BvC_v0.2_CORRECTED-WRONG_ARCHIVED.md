# CORRECTED-WRONG — ARCHIVED FOR PROVENANCE. DO NOT APPLY ANY BLOCK FROM THIS FILE.

**Status (2026-06-11):** This v0.2 "RECONCILED" stitch is retained ONLY as an audit record. Its sound blocks (A, B, C1, D, E, F, G) already landed on main via **#776**. Its Block **C2** was correctly NOT applied — and its **Finding-2 is FALSE.**

**Finding-2 ("there is no F-Deploy-G1-AE; canon carries AF + AD only") is incorrect.** Verified against live `origin/main` 2026-06-11:
- **AE is a real, defined P1 finding.** `F-Deploy-1_G1_Audit.md:1205` — F-Deploy-G1-AE: `episode-backend-sg` (the prod **box** SG) admits `0.0.0.0/0` on 22/3000/3002/80/443. Severity AD/AE = P1 settled in Handoff v14.
- **AF is a DISTINCT finding.** `F-Deploy-1_G1_Audit.md:1207` — F-Deploy-G1-AF (P0): the prod **RDS** SG `sg-0164d0b20fbebacbb` admits `0.0.0.0/0` on 5432. Different resource from AE (box SG vs RDS SG).
- **Therefore the "AD/AE" in `F-Deploy-1_[3]_Master_Runbook_DRAFT.md` Sec 7 step 8 is CORRECT and must NOT be "corrected" to AD-only.** The master runbook is right; this draft was wrong.

How the inversion was caught: a B-vs-C cleanup nearly applied Finding-2 as a fix to correct canon; a repo-wide grep for the finding code refuted the premise before any edit. Retained as a live example of the stale-but-coherent-read trap — a confident, well-formatted draft asserting a correction to state that was already correct.

---
# F-Deploy-1 — [3] Runbook Stitch: fold Strategy B code-reconcile as Phase 2A (DELTA, DRAFT v0.2 — RECONCILED)

> **ADDITIVE DELTA. APPLY AGAINST LIVE #762; AUTHORIZES NO BOX ACTION; PRIMES NOTHING.**
> v0.2 supersedes the v0.1 stitch (`F-Deploy-1_Runbook_Stitch_BvC_2026-06-10_DRAFT.md`,
> on main). Changes from v0.1, all from verifying anchors against the LIVE #762 blob and
> reconciling Phase 2A 3–4 against the actual `B_Install_Method` note (the seam v0.1
> flagged as its one open item):
>   1. Install-Method seam CLOSED — Phase 2A steps 3–4 confirmed faithful to the note's
>      C1/C2 controls and four-tuple P1; no mechanics changed.
>   2. Security-sweep finding-codes CORRECTED — canon (PreFlight v1.4 step 8) carries
>      **AF** + **AD** only; there is **no F-Deploy-G1-AE**. v0.1/Brief "AF/AE" was a slip.
>   3. Snapshot encryption CARRIED — PreFlight step 8 omits it; Session Brief Sec 5 flags
>      it as the unencrypted rollback anchor. Carried into the 2B sweep step explicitly,
>      sourced to the Brief, marked not-in-PreFlight.
>   4. Fuller 2B label ADMITTED with real sourced steps — route-fix and security-sweep
>      now trace to PreFlight v1.4 (route-loading section; step 8), satisfying #762's
>      no-invented-steps rule. Not stubs.
>   5. P1 build-host pre-pin REGISTERED as a pre-Session-B [3]-spec item in Sec 11.
>   6. Instance-ID discipline NOTED — do not propagate #762 front-matter's
>      `i-02ae7608c531db485` into any Phase 2A step; identity asserts by IP/VPC +
>      `current_database()`/`inet_server_addr()` only (naming-inversion / split-brain
>      standing hazard). This is a discipline note, not a doc edit.
> Box stays FROZEN; FD-31 OPEN; [3] not primed.

## How to apply (read first)

- **Target file (authoritative):** `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md`
  (#762, live HEAD blob — verified against `bacdf44d`-era structure this session).
- **Anchors verified against the LIVE file** (not a paste). Section line anchors as read:
  Sec 0 @23, Sec 1 @43, Sec 2 @61, Sec 3 @129, Sec 4 @144, Sec 5 @187, Sec 6 @204,
  Sec 7 @213, Sec 8 @277, Sec 9 @293, Sec 10 @302, Sec 11 @312. Front-matter table ends
  with the `Standing constraint` row immediately before `## Sec 0`.
- **Mutation discipline preserved.** Every box-mutating step is left un-templated; only
  the read-only parity probe is fenced.
- **Rule 7:** this is a draft. You confirm and execute every edit. The gate is at
  PR-create/merge, not at local edit.

---

## BLOCK A — Supersession marker

**Anchor (VERIFIED):** immediately after the front-matter table's `Standing constraint`
row, before `## Sec 0`.

```
> **Additive supersession (2026-06-10, reconciled 2026-06-11) — Strategy B code-reconcile folded in.**
> This runbook is extended to fold Strategy B's code reconciliation into the [3] window
> as **Phase 2A** (plus a pre-window off-box build). Prior revisions scoped the window as
> credential + topology + security only; that scope is now incomplete — the code
> reconciliation carries the window's newest risk-bearing mechanics (disk thin-margin,
> zero-swap operating caveat, parity gate) and belongs on the master phase map, not in a
> parallel "authoritative" sequence. The B track's method, gating, and constraints bind
> into the Phase 2A gates from three 2026-06-10 artifacts:
> - `F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md` — method, C1/C2 extract controls, abort posture.
> - `F-Deploy-1_ProdBox_HeadroomCheck_2026-06-10_DRAFT.md` — disk/memory headroom; disk is the binding axis (thin-but-fits), zero-swap operating caveat.
> - `F-Deploy-1_BvC_SelectionLean_Consolidated_2026-06-10_DRAFT.md` — B is the selected lean; C parked-not-killed. Phase 2A assumes B; if the call ever reverts to C, this phase is replaced, not edited.
>
> No box action authorized; [3] not primed.
```

---

## BLOCK B — Phase-map rows + 2B rename

**Anchor (VERIFIED):** Sec 3 phase-map table (@129). Insert a `pre-2A` row at the top of
the body rows and a `2A` row immediately before the existing `**2**` row.

```
| **pre-2A** | Off-box build to parity target (arch/libc HIGH, Node/npm best-known) | NO — workstation/build-host | NO | Parity Sequencing #767 Sec 3 | Pre-window prep; no box session |
| **2A** | Strategy B code reconcile: parity confirm gate → stream-extract built tree to a PARALLEL path → stand up parallel process; serving tree/process untouched | YES — additive only (parallel tree + process) | NO (additive; the flip is in 2B) | B Install-Method (C1/C2); Parity #767 (gate); Headroom (disk/swap); Selection-Lean (lean) | The [3] window — opens the box-mutating window, before cutover |
```

**2B rename (RECONCILED — fuller label, per the Finding-2 decision):** rename the existing
`**2**` row's "What" to:

```
Cutover (Phase 2B): credential rotation + restart-to-align (port 3002→3000, --env production) + Template Studio route fix + post-cutover security sweep
```

This fuller label is now honest to the reconciled Sec 7 body (Block C2 below adds the
route-fix and sweep steps with sources). Existing step numbers inside Sec 7 do **not**
renumber for the 2A insert (additive discipline); the route-fix and sweep steps are
appended as new numbered Sec 7 steps with citations.

---

## BLOCK C1 — New phase body: Sec 7A

**Anchor (VERIFIED):** new `## Sec 7A — PHASE 2A`, immediately before the existing
`## Sec 7 — PHASE 2` (@213). Existing Sec 7 becomes "Phase 2B" in prose.

*(Body identical to v0.1 BLOCK C — mechanics confirmed faithful to the Install-Method
note this session; reproduced here so the reconciled stitch is self-contained. The
five-step Phase 2A: parity confirm gate (read-only four-tuple) → disk precheck (read-only)
→ stream-extract to PARALLEL path C1 (gated, un-templated) → parallel-process standup
(gated, un-templated, zero-swap caveat) → canon verify by current_database()/
inet_server_addr() + seven-table unfiltered fingerprint. Plus the Sec 7 step-5 append
making restart-to-align the additive flip with the old tree RETAINED as standing
rollback.)*

> APPLY NOTE: copy the BLOCK C body verbatim from v0.1
> `F-Deploy-1_Runbook_Stitch_BvC_2026-06-10_DRAFT.md` on main — it is unchanged and
> verified. Not re-pasted here to avoid divergence between two copies of the same
> gated-mutation text. (v0.1 BLOCK C, Sec 7A body + the step-5 append.)

---

## BLOCK C2 — Reconciled fuller Sec 7 (route-fix + security sweep as sourced steps)

**Anchor (VERIFIED):** inside the existing `## Sec 7 — PHASE 2` (→ 2B) execution list
(@213–276), AFTER the existing step 5 (restart-to-align + its embedded AG integrity gate).
Append as new numbered steps. These satisfy #762's no-invented-steps rule — each cites a
source.

```
6. **[ROUTE FIX] Template Studio route-loading fix** (PreFlight v1.4 — route-loading
   section; tied to F-Deploy-G1-H port-3000 / `--env production` restart). The pre-#746
   topology left the box with a "Template Studio routes failed to load" condition; the
   restart-to-align (step 5) re-launches against the corrected ecosystem so the routes
   load. Confirm the routes resolve post-restart as part of the same verification pass.
   No separate restart; this is a consequence of step 5 landing correctly.

7. **[SECURITY SWEEP] Post-cutover security sweep** (PreFlight v1.4 step 8). Three items:
   a. **Close `0.0.0.0/0` on the RDS security group(s)** — the prod RDS SG currently
      allows 5432 from `0.0.0.0/0` (F-Deploy-G1-AF, live). Lock to the required sources.
      Rule 7 — confirm SG identity and the post-change rule set before applying.
   b. **Migrate AWS static keys → instance profile** — `AWS_ACCESS_KEY_ID`/`SECRET` in
      `.env` (F-Deploy-G1-AD) replaced by an EC2 instance profile.
   c. **Encrypt the insurance snapshot** — *NOTE: not in PreFlight step 8; carried from
      Session Brief Sec 5.* The insurance snapshot
      `episode-control-dev-prefreeze-insurance-20260530` is currently UNENCRYPTED and is
      the rollback anchor. Encrypt it (copy-to-encrypted, AD-adjacent) **before** it is
      ever needed under pressure — not during an active rollback. No finding-code (Brief
      labels it AD-adjacent); do not invent one.
   All three are reversible/additive security posture changes, not topology changes;
   un-templated, assemble at session time.
```

**Cross-doc seam closed:** the Session Brief Sec 5 listed the sweep as AF/AE + snapshot +
AD; PreFlight step 8 lists AF + AD only. Reconciled set = **AF (SG)** + **AD (instance
profile)** + **snapshot encryption (Brief Sec 5, not-in-PreFlight)**. There is no AE.

---

## BLOCK D — Consequent abort conditions (Sec 8)

**Anchor (VERIFIED):** Sec 8 bullet list (@277), grouped before the Phase 2 post-restart
bullets.

*(Identical to v0.1 BLOCK D — four Phase 2A abort bullets: parity four-tuple mismatch →
clean pre-write abort; disk residual won't hold tree → abort before extract + C2 cleanup;
OOM during standup (zero swap = hard OOM) → abort standup, tear down parallel process,
id 3 unaffected; parallel-process canon verify fails → abort before 2B flip. Copy verbatim
from v0.1 BLOCK D on main.)*

---

## BLOCK E — Consequent rollback edit (Sec 9)

**Anchor (VERIFIED):** Sec 9 (@293), after the existing two-deep rollback text.

*(Identical to v0.1 BLOCK E — code-layer rollback paragraph: old serving tree + process
retained through 2A and the 2B flip; revert serving to retained old process if flip
misbehaves; distinct from the DB snapshot/dump DATA-layer rollback; do not delete retained
old tree/process until the 2B post-restart integrity gate passes green. Copy verbatim from
v0.1 BLOCK E on main.)*

---

## BLOCK F — Old-file retired pointer

**Target file (VERIFIED present on main):**
`F-Deploy-1_Combined_Restart_Master_Runbook.md`.
**Anchor:** very top, above the existing title/banner.

*(Identical to v0.1 BLOCK F — SUPERSEDED banner pointing at #762 as the authoritative [3]
runbook, now extended with Phase 2A. Copy verbatim from v0.1 BLOCK F on main.)*

---

## BLOCK G — NEW: P1 build-host pre-pin registered in Sec 11

**Anchor (VERIFIED):** Sec 11 "Session boundaries" (@312). Insert a pre-Session-B prep
bullet BEFORE the existing "Session A" bullet (the off-box build precedes the window but
is its own non-box prep), OR as a sub-note under Session B's open-conditions — placement
your call. Drafted as a standalone pre-window bullet:

```
- **Pre-Session-B prep (off-box, no box touch):** Off-box Strategy B build per the
  P1 parity sequencing note (`F-Deploy-1_P1_Parity_Sequencing_2026-06-10_DRAFT.md` Sec 3).
  Build host pinned to best-known parity: arch HIGH (AWS control-plane), libc HIGH
  (recorded prod OS), Node/npm MEDIUM (best-known prior record). `npm ci` against the
  committed lockfile; verify the tree starts off-box BEFORE the window. The P1 parity
  four-tuple is *confirmed-or-aborted* at the Phase 2A parity gate (Sec 7A step 1) —
  a MEDIUM-tier mismatch aborts cleanly pre-write and the build is re-pinned + rebuilt.
  This ordering dependency (build provisioned before parity is confirmed) is recorded so
  a future session does not trip over it. [3]-spec item; authorizes nothing.
```

---

## What this reconciled delta does NOT do

- Does NOT authorize, schedule, or begin [3], Phase 0, Phase 2A, or any box action.
- Does NOT provide paste-runnable extract, standup, flip, restart, rotation, SG-change, or
  snapshot-encrypt commands — every mutation un-templated; only the read-only parity probe
  is fenced.
- Does NOT select a strategy — records B as the lean and builds the phase B requires; C
  stays parked-not-killed and would replace, not edit, Phase 2A.
- Does NOT propagate the #762 front-matter instance ID into any new step — identity by
  IP/VPC + `current_database()`/`inet_server_addr()` only.
- Does NOT invent a finding-code for snapshot encryption (Brief: "AD-adjacent").

---
*Reconciled additive delta (v0.2) folding Strategy B's code reconciliation into the #762
[3] master runbook as Phase 2A. Anchors verified against the live blob this session;
Install-Method seam closed (3–4 confirmed faithful); security-sweep codes corrected to
AF+AD (no AE); snapshot encryption carried from Brief Sec 5 as not-in-PreFlight; fuller
2B label admitted with route-fix + sweep as sourced steps (PreFlight v1.4); P1 build-host
pre-pin registered in Sec 11; instance-ID discipline noted. Authorizes nothing; box stays
FROZEN; FD-31 OPEN; [3] not primed.*
