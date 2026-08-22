| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Dimension 2 reassessment only. **DELIVERY-PATH VIABILITY PASS.*** |
| --- |

**Document version**

v2.60 — **RE-SCORES v2.58 DIMENSION 2 ONLY: PERFORMED — PASS.** Reads the
full owning authority chain, F-Deploy-1 v1.30→v1.48, against current workflow
text and GitHub API state. The manual SSM `workflow_dispatch` path is the
authorized successor to §5.71's historical backup→dev auto-merge wording; it
is implemented, re-enabled, twice field-proven, currently active, and unchanged
since its latest end-to-end verification at `1844e56b`.

**No other dimension is re-performed or re-scored.** v2.59's top-level
**ASSESSMENT NOT COMPLETED** outcome stands. Dimension 1's prior PASS and
Dimension 4's prior FAIL are not carried to this new basis as a combined
assessment; Dimensions 3 and 5 remain NOT PERFORMED and unchanged because no
deployed-host or shared-production-identity authorization has been supplied.
Limb 3 remains **OPEN and UNDISCHARGED**. G4 remains **not enterable**.

FD tail remains **FD-66**; XK tail remains **XK-3**; PE tail remains **PE #67**.
Basis: `origin/main` at
`4318a9840e8b782c3a7b544e725a8fd0473c1a94`, 2026-08-22. Repository and GitHub
metadata only. No workflow dispatched. No deployed host contacted. No AWS call
issued. Prod FROZEN.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED**, unchanged. **G3 — PARTIALLY
DISCHARGED, OPEN**: §5.71 limbs 1 and 3 remain open. **Limb 3 assessment:
NOT COMPLETED. Dimension 2 PASS at v2.60 basis; Dimensions 3 and 5 NOT
PERFORMED. G4 — not enterable.** G5 — BLOCKED. G6 — not reached. Prod remains
FROZEN.*

---

# §1. Scope and relationship to v2.59

v2.59's governing correction banner withdrew Dimension 2's FAIL to **UNSCORED
pending v2.60**. It required a new assessment against:

1. the current delivery mechanism;
2. the full F-Deploy-1 owning-authority chain; and
3. a new stamped basis.

This revision performs exactly that reassessment. **It does not reopen the
five-dimension assessment as a whole.** v2.58 §4 item 6 and v2.59 §10 prohibit
silently carrying old cells into a new combined basis. Therefore:

- Dimension 2 receives a new score at `4318a984`;
- Dimensions 1, 3, 4 and 5 receive no new score here;
- v2.59's ASSESSMENT NOT COMPLETED outcome remains the governing top-level
  outcome; and
- no inference is available from Dimension 2 PASS to G4 readiness.

## §1.1 Discriminator

Dimension 2 passes if the named candidate can be delivered to dev through a
path that is:

- selected and authorized by the owning register;
- implemented in repository text;
- enabled at the GitHub API layer;
- previously exercised end-to-end;
- capable of carrying frontend and backend from one source SHA; and
- capable of proving which SHA supplied the deployed artifact.

**It does not require the current candidate already to have been deployed.**
Deployment is a G4 operation. Treating pre-deployment as delivery-path failure
would require G4 to have begun before its entry assessment could pass.

---

# §2. Owning authority — complete chain

## §2.1 v1.30 selects the replacement architecture

F-Deploy-1 v1.30 §3/§5 rejects runner→SSH transport and specifies the
`deploy-dev.yml` rewrite:

- SSM RunCommand, zero new inbound rules;
- target the dedicated dev backend;
- remove workflow-carried application secrets;
- retain a scoped restart trap;
- land and review the rewrite before re-enablement; and
- make re-enablement a separate Rule 7 decision.

**This is a replacement, not an incomplete variant of §5.71's auto-merge
wording.** §5.71 predates the F-Deploy-1 rewrite and names the deployment path
that existed when it was written.

## §2.2 v1.31–v1.42 implement and clear prerequisites

- v1.31 records the rewrite and P1–P5 prerequisite register.
- v1.32 closes P1: instance-role SSM permission and registration.
- v1.36 closes P3 and confirms P4's code path state.
- v1.38 closes P2: GitHub OIDC provider and deploy role.
- v1.40 closes P5 at the substrate level.
- v1.42 closes the memory hard gate and makes re-enablement proposable.

The workflow header still phrases P1–P5 prospectively. **That header is design
provenance, not current prerequisite disposition.** The later Fix Plan chain
governs status.

## §2.3 v1.43 authorizes and proves first dispatch

v1.43 §2 records the Rule 7 re-enablement decision and execution:

> *"Enabling ≠ running: `workflow_dispatch` is the only trigger."*

`Deploy to Development` changed from `disabled_manually` to active while
`Auto-merge to Dev` and `Deploy to Production` remained disabled. v1.43 §4
records successful run `29359414179` against `c25a9db6`: tests, build, S3/SSM
delivery, migrations, PM2 restart, and health all completed. The dedicated dev
box served the deployed backend.

## §2.4 v1.46 verifies the current artifact path

v1.46 §4 records verification dispatch `29841468909` against `1844e56b`:

- test, build, and deploy all successful;
- dev-only ecosystem manifest exercised;
- SSM box confirmation;
- `HEALTH:200`; and
- frontend/backend package repoints exercised end-to-end.

## §2.5 v1.48 closes F-Deploy-1 without withdrawing manual dispatch

v1.48 closes G2, Phase B, and F-Deploy-1. Its standing-gates line leaves only
`deploy-dev.yml`'s future **push trigger** as a deliberate gated decision.
It does not withdraw, disable, or reopen manual `workflow_dispatch`.

**Current authority by function:**

| Function | Authority |
|---|---|
| Architecture and transport | v1.30 §3/§5, FD-57 |
| Rewrite design and prerequisite model | v1.31 |
| Prerequisite execution | v1.32–v1.42 |
| Re-enablement and first green dispatch | v1.43 |
| Latest end-to-end field verification | v1.46 |
| Keystone close and retained push-trigger gate | v1.48 |

Recognizing this chain changes no F-Deploy-1 disposition and does not reopen the
closed keystone.

---

# §3. Current path at v2.60 basis

## §3.1 Repository continuity

`.github/workflows/deploy-dev.yml` has **no commit and no textual diff** between
`1844e56b` and `4318a984`. The field-proven workflow body is the current body.

Current text establishes:

- trigger: `workflow_dispatch` only;
- target: instance tag `Name=episode-dev-backend`;
- credentials: GitHub OIDC → `episode-gha-deploy-dev`;
- transport: S3 artifact + SSM RunCommand;
- application secrets: none carried by the workflow;
- frontend build and backend dependencies produced in one build job;
- one archive named `episode-metadata-${{ github.sha }}.tar.gz` containing
  frontend and backend artifacts; and
- scoped PM2 restart before health verification.

## §3.2 API state and run history

GitHub's workflow API reports:

| Field | Value |
|---|---|
| Workflow | `Deploy to Development` |
| ID | `224506682` |
| State | **active** |
| Path | `.github/workflows/deploy-dev.yml` |

Recent history preserves the two governing field events:

| Run | Head | Result | Authority record |
|---:|---|---|---|
| `29359414179` | `c25a9db6` | success | v1.43 §4 |
| `29841468909` | `1844e56b` | success | v1.46 §4 |

No later run changes the mechanism's status. Lack of a dispatch for the current
candidate means G4 has not begun; it does not make the path unavailable.

## §3.3 Frontend/backend coherence

The workflow checks out one dispatch head, builds the frontend, copies `src`,
`scripts`, the frontend `dist`, nginx config, package manifests, and the
`ecosystem.dev.config.js` into one `deploy/` tree, then archives that tree once.
The deploy job downloads that same artifact and extracts its frontend and
backend legs on the same target.

**The path cannot select one frontend SHA and another backend SHA within a
single successful dispatch.** Both legs derive from `${{ github.sha }}` and one
archive.

## §3.4 Deployed-SHA proof path

The workflow provides a concrete proof chain for a future G4 dispatch:

1. GitHub run metadata records `headSha`.
2. The build archive filename includes `${{ github.sha }}`.
3. The S3 key is namespaced under `${{ github.sha }}`.
4. The SSM command passes `DEPLOY_SHA='${{ github.sha }}'` to the on-box script.
5. The on-box output prints the artifact SHA before extraction.
6. A successful deploy run ties that artifact to restart and health results.

The run record plus its SSM job output is the evidence that proves the deployed
candidate SHA. **No inference from "latest main" is required.**

This does not claim the SHA is persisted forever in an on-box marker. If G4
requires a post-run independent host read after workflow logs expire, that is a
Dimension 3 observability question, not a failure of the delivery path to
identify what it deployed.

---

# §4. Historical wording reconciliation

§5.71 says:

> *"backup→dev auto-merge succeeds (post cleanup-delete)."*

That wording describes the pre-F-Deploy-1 propagation mechanism. F-Deploy-1
later replaced it because the old auto-merge/deploy cascade could reach shared
production infrastructure. The replacement preserves the readiness purpose:
prove that a reviewed candidate can reach isolated dev through a controlled
path before runtime verification and soak.

**Ruling:** for G4 readiness after F-Deploy-1 v1.48, §5.71's transport phrase
resolves to the authorized manual `workflow_dispatch` path on `main`. The
historical auto-merge mechanism is not a second required path and need not be
re-enabled for F-AUTH-1.

`Auto-merge to Dev` remaining `disabled_manually` and its `claude/**` trigger
remain independent workflow observations. They do not make the selected manual
path nonviable and are not altered here.

---

# §5. Non-actions sweep — negative authority check

Before this reassessment, every matching *"what this does not do"*,
*"what this does not establish"*, *"not done"*, exclusion, and out-of-scope
section was swept across:

- F-AUTH-1 Fix Plan revisions; and
- tracked handoff documents.

**Population:** 48 sections / 746 extracted lines at `4318a984`. Candidate
obligations were collapsed by unique read rather than counted as raw repeated
carriage.

## §5.1 Result for Dimension 2

**No additional unread authority bearing on delivery-path viability was
found.** F-Deploy-1 v1.30→v1.48 is the complete owning chain identified by the
sweep and by the v2.59 banner. No second cross-keystone document names another
transport, re-enablement state, or prerequisite disposition that changes this
score.

This negative result is recorded so a successor can distinguish *checked and
clean* from *not checked again*.

## §5.2 Live parked reads found outside Dimension 2

The sweep did find concrete runnable debt, deliberately not folded into this
reassessment:

1. **FD-66 deployed-schema/provenance read** — bears on Dimensions 4/5;
2. **`JWT_SECRET` dev/prod environment read** — bears on Dimension 5 and
   FD-65;
3. **`compositions.js` route-order runtime verification** — limb 1/checklist
   applicability;
4. **G6 data-strand assessment** — G6 only;
5. **G3 limb 1 adjudicator pass** — independently open;
6. **G4 §7 runtime assertions** — Dimension 3;
7. **FD-63 global-mount/probe disposition** — limb 1 / procedure follow-up;
8. **PE #63 re-derivation** — already promoted into v23 Sec 6's executable
   checklist.

The controlled placement comparison for Handoff v24 is also recorded as
material, not ruled here: PE #63 appeared in both v23 Sec 8 and executable Sec
6 and remained runnable; v1.30 appeared only in Sec 8 and did not fire. **A
specific read obligation must appear in the executable checklist, not only in
a non-actions section.**

The highest-priority v24 carry items from this sweep are the FD-66
infrastructure read and `JWT_SECRET` environment read, both Evoni-owned and
prod-gated, followed by `compositions.js` route ordering for limb 1.

No item in §5.2 changes Dimension 2's score.

---

# §6. Dimension 2 score

Against v2.58 §2.2 and §1.2:

| Requirement | Evidence | Result |
|---|---|---|
| Mechanism identified | Manual `workflow_dispatch` on `main` | PASS |
| Owning authority | F-Deploy-1 v1.30→v1.48 | PASS |
| Repository implementation | Current `deploy-dev.yml`, unchanged since `1844e56b` | PASS |
| API enabled | Workflow ID 224506682 = `active` | PASS |
| Frontend/backend coherence | One checkout, one `${{ github.sha }}` archive | PASS |
| Field exercise | Green runs `29359414179`, `29841468909` | PASS |
| Deployed-SHA proof path | run `headSha` → SHA archive/S3 key → `DEPLOY_SHA` → SSM output | PASS |
| Historical path reconciled | F-Deploy replacement governs §5.71 transport wording | PASS |
| Additional authority sweep | No second delivery-path authority found | PASS |

**RULING: DIMENSION 2 — DELIVERY-PATH VIABILITY — PERFORMED, PASS.**

The current candidate can be delivered through an authorized, active,
field-proven path that preserves frontend/backend coherence and supplies a
specific deployed-SHA evidence chain. This ruling authorizes no dispatch and
does not claim the candidate is already deployed.

---

# §7. Effect on limb 3 and G4

**No top-level outcome changes.** v2.59 remains ASSESSMENT NOT COMPLETED.

- Dimension 2's score moves from UNSCORED to PASS.
- Dimensions 3 and 5 remain NOT PERFORMED; neither is touched.
- Dimension 4's FAIL remains the last performed score recorded by v2.59; it is
  not re-performed here.
- Dimension 1's prior PASS is historical evidence, not re-stamped into a new
  combined assessment.
- Limb 3 remains OPEN and UNDISCHARGED.
- G4 remains not enterable.

**Dimension 2 PASS is not progress toward G4 entry in the sense of a gate
advance.** It removes an uncertainty created by v2.59's withdrawn ruling. It
does not perform the live/authority work, cure the procedure defects, complete
limb 1, or make the evidence-validity FAIL disappear.

Three of the five dimensions remain failed-or-unperformed in the latest
recorded dispositions: Dimension 3 NOT PERFORMED, Dimension 4 FAIL, Dimension 5
NOT PERFORMED. No reader may compress one corrected PASS into readiness.

---

# §8. What v2.60 establishes

- F-Deploy-1 v1.30→v1.48 is the complete owning authority for the current dev
  delivery path (§2).
- The field-proven workflow body is unchanged and API-active (§3).
- The path preserves frontend/backend coherence and provides a deployed-SHA
  proof chain (§3.3, §3.4).
- §5.71's historical auto-merge wording resolves to the authorized manual path
  after F-Deploy-1's replacement (§4).
- The non-actions sweep found no second unread authority bearing on Dimension 2
  and identified parked reads for later dimensions/v24 (§5).
- Dimension 2 is PERFORMED — PASS (§6).
- v2.59's ASSESSMENT NOT COMPLETED outcome stands; limb 3 remains open; G4
  remains not enterable (§7).

# §9. What v2.60 does not do

- **Does not re-perform or re-score Dimensions 1, 3, 4, or 5.**
- **Does not change v2.59's ASSESSMENT NOT COMPLETED outcome.**
- **Does not discharge limb 3, perform limb 1, enter G4, or schedule G4.**
- **Does not dispatch, enable, disable, or edit any workflow.**
- **Does not deploy the candidate, contact a host, restart a process, run §7,
  or begin a soak.**
- **Does not perform the FD-66 infrastructure read, the `JWT_SECRET`
  environment read, or the `compositions.js` runtime check.** They remain v24
  carry material under their existing owners and gates.
- **Does not reopen, amend, or change any disposition in F-Deploy-1.**
- **Does not contact AWS, shared Cognito, or any deployed host. Prod FROZEN.**

---

*Type: Dimension 2 reassessment only. Reads F-Deploy-1 v1.30→v1.48 and current
workflow/API state. Records the non-actions sweep as a negative authority
check. Rules Dimension 2 PERFORMED — PASS. Re-scores no other dimension.
v2.59 ASSESSMENT NOT COMPLETED stands; limb 3 OPEN; G4 not enterable. Ships no
code. Mints nothing. FD tail FD-66; XK tail XK-3; PE tail PE #67. No workflow
dispatch, host contact, AWS call, or shared Cognito action. Prod FROZEN.
[skip-automerge]*
