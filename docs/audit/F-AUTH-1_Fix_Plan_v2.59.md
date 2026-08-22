> **CORRECTION BANNER — DIMENSION 2 FAIL WITHDRAWN; DELIVERY-PATH STATUS
> UNSCORED (added 2026-08-22, after `8a016049`, additive).**
>
> **v2.59 §3's ruling that Dimension 2 was `PERFORMED — FAIL` is withdrawn.**
> The live workflow facts it records remain accurate at its basis:
>
> - `Auto-merge to Dev` was `disabled_manually`;
> - its YAML trigger was `claude/**`, not §5.71's historical
>   *"backup→dev auto-merge"* wording;
> - `Deploy to Development` was active and manual-dispatch-only;
> - its latest successful run was against `1844e56b`, not candidate
>   `ce305d34`; and
> - candidate `ce305d34` had not been deployed.
>
> **Those facts do not establish delivery-path failure.** v2.59 treated the
> absence of a reconciliation inside the F-AUTH-1 revision series as though it
> were the absence of an owning disposition anywhere:
>
> > *"no F-AUTH-1 revision reconciles this manual-main path with §5.71's
> > backup→dev auto-merge precondition."*
>
> That sentence is literally scoped and literally true. **It is not a
> sufficient premise for a cross-keystone delivery-path ruling.** The delivery
> mechanism is owned by F-Deploy-1, whose governing chain was outside v2.59's
> evidence set.
>
> **The omitted authority was not unknown. It was a known non-read.** Prime
> Studios Audit Handoff v23 Sec 8 had already recorded:
>
> > *"Does not read F-Deploy-1 v1.30, which is where `deploy-dev.yml`'s rewrite
> > and its API-layer posture would be authorized if they are authorized
> > anywhere."*
>
> v1.30 was on the docket by name while v2.59 was drafted. **The assessment
> nevertheless ruled on the delivery path without first reading the document
> it already knew might authorize that path.** This is not failure to discover
> an unknown dependency. It is failure to treat a known evidence gap as
> blocking a ruling that turned on it.
>
> **The completed read changes the interpretation materially.**
>
> - **F-Deploy-1 v1.30 §3/§5** specifies the replacement architecture: SSM
>   zero-inbound transport, no push trigger, no workflow-carried application
>   secrets, and separately gated re-enablement.
> - **v1.31** records the rewrite and its P1–P5 prerequisite register.
> - **v1.32–v1.42** carry those prerequisites through execution and make
>   re-enablement proposable.
> - **v1.43 §2** takes and executes the Rule 7 re-enablement ruling:
>   *"Enabling ≠ running: `workflow_dispatch` is the only trigger."*
> - **v1.43 §4** records the first green end-to-end dispatch and closes §4.3.
> - **v1.46 §4** records a second end-to-end verification dispatch against
>   `1844e56b`, all jobs green and box-confirmed.
> - **v1.48** closes G2, Phase B, and F-Deploy-1 while leaving only the future
>   **push-trigger** decision gated.
>
> **The current manual-main path is therefore not an undefined alternative to
> §5.71's path. It is the authorized, implemented, re-enabled, and field-proven
> successor path.** F-Deploy-1 is CLOSED; recognizing its existing disposition
> does not reopen or amend that keystone.
>
> **A second error followed from the same non-read.** v2.59 §3.2 repeated the
> workflow header's P1–P5 language as though the prerequisites remained gated.
> The later F-Deploy-1 chain closes them: P1–P3 explicitly, P4 by fold at first
> dispatch, P5 before re-enablement, followed by two green dispatch records.
> **Stale header framing was preferred over the owning register's later
> disposition.**
>
> ### The fourth instance — ours
>
> **This is the fourth recorded instance of one premise standing for the
> whole:**
>
> 1. v2.52 §1.1 — one quoted clause stood for a four-clause gate;
> 2. v2.55 §3.2 — one stated minimum stood for G4's whole precondition;
> 3. v2.55 §3.1 — one document's G3 specification stood for the union of two;
> 4. **v2.59 §3 — absence inside one keystone stood for absence of an owning
>    disposition across two keystones.**
>
> **The fourth is ours.** v1.30 was not an unknown dependency: v23 Sec 8 had
> named it as a non-read and identified it as the likely authority for the
> workflow rewrite. The known gap was scheduled and still was not treated as
> blocking a ruling that depended on it. This is direct evidence for v2.56
> §2.1's conclusion: **documenting a hazard class does not retire it.**
>
> ### Governing corrections
>
> The following v2.59 statements are withdrawn to the extent stated:
>
> - **Document version:** *"Dimensions 1, 2 and 4 were performed"* is corrected
>   to **Dimensions 1 and 4 performed; Dimension 2 withdrawn to UNSCORED;
>   Dimensions 3 and 5 NOT PERFORMED.**
> - **Document version:** the delivery path is not an established hard blocker.
>   The evidence-validity blocker at Dimension 4 remains.
> - **§1 table:** Dimension 2's `PERFORMED — FAIL` cell is withdrawn and is
>   **UNSCORED pending v2.60**.
> - **§1 ruling:** *"The FAIL findings at Dimensions 2 and 4 are real"* is
>   corrected to **Dimension 4's FAIL stands; Dimension 2 has no current
>   score.**
> - **§3:** the live workflow observations stand; the FAIL ruling, the
>   *"unreconciled manual path"* conclusion, the implication that P1–P5 remain
>   open, and the *"undefined transport contract"* conclusion are withdrawn.
> - **§7:** the first two blocker rows — delivery-path reconciliation and
>   candidate-not-deployed/deployed-SHA proof — are withdrawn as blockers.
>   Candidate non-deployment remains an observed fact and is not scored here.
> - **§8 item 1:** the requirement to *"select and reconcile the G4 delivery
>   path"* is withdrawn. F-Deploy-1 already selected and proved the path.
> - **§9:** *"Delivery-path viability failed"* is withdrawn and replaced by
>   **"Delivery-path viability unscored; re-assessment owed at v2.60."**
> - **Footer:** *"Dimensions 1, 2 and 4 performed"* is corrected accordingly.
>
> **No corrected Dimension 2 score is made by this banner.** Determining PASS
> versus INCONCLUSIVE requires assessment work against the current path and the
> full F-Deploy-1 authority chain at a new stamped basis. That belongs to
> v2.60, not to a correction instrument.
>
> **Withdrawal of a FAIL is not progress toward PASS.** Dimension 2 is now
> less established, not more: three of five dimensions lack a completed score
> where two did before — Dimension 2 UNSCORED, Dimensions 3 and 5 NOT
> PERFORMED. This correction licenses no G4 entry, scheduling, dispatch, or
> readiness inference.
>
> **The top-level outcome does not change.** Dimensions 3 and 5 remain NOT
> PERFORMED, and Dimension 2 is now UNSCORED. **ASSESSMENT NOT COMPLETED
> stands.** Limb 3 remains OPEN and UNDISCHARGED. G4 remains not enterable. No
> gate, finding, severity, freeze, or keystone disposition changes.
>
> **Unaffected:** Dimension 1 PASS; Dimension 4 FAIL; Dimensions 3 and 5 NOT
> PERFORMED; all §4–§6 findings; the §7 blocker rows unrelated to delivery-path
> interpretation; and every non-action at §10.
>
> The original v2.59 body remains below as the at-filing record.

| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *G3 limb 3 assessment. **ASSESSMENT NOT COMPLETED.*** |
| --- |

**Document version**

v2.59 — **PERFORMS THE v2.58 LIMB 3 ASSESSMENT TO THE LIMIT OF AUTHORIZED
EVIDENCE. OUTCOME: ASSESSMENT NOT COMPLETED.** Dimensions 1, 2 and 4 were
performed; Dimensions 3 and 5 were only partially performed and therefore are
**NOT PERFORMED** under v2.58 §1.2. Limb 3 remains **OPEN and UNDISCHARGED**.
G4 remains **not enterable**. Two hard blockers were established without
contacting a deployed host: the delivery path specified by §5.71 is disabled
and unreconciled with the current manual path (§2), and current repository
behavior makes multiple locked G4 assertions false or non-discriminating
(§3, §4). Those facts do not convert an incomplete assessment into NO-GO.

FD tail remains **FD-66**; XK tail remains **XK-3**; PE tail remains **PE #67**.
Candidate and assessment basis: `origin/main` at
`ce305d34f9da238d017ee2213c88036ba5575b98`, 2026-08-22. No deployed host
contacted. No AWS call issued. Prod FROZEN.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED**, unchanged. **G3 — PARTIALLY
DISCHARGED, OPEN**: v1.5 clauses 1–4 and §5.71 limb 2 discharged; limbs 1 and 3
open. **Limb 3 assessment: NOT COMPLETED. G4 — not enterable.** G5 — BLOCKED.
G6 — not reached. FD-63, FD-64, FD-65 and FD-66 remain open; FD-65 remains P0.
PE #64 remains OPEN/P1 and PE #65 remains OPEN/P2. Prod remains FROZEN.*

---

# §1. Assessment protocol and outcome

This assessment applies `F-AUTH-1_Fix_Plan_v2.58.md` without changing its
scope. It names one candidate, assigns an explicit status to every dimension,
and separates observed blockers from the readiness ruling.

| Dimension | Status | Summary |
|---|---|---|
| 1. Candidate integrity | **PERFORMED — PASS** | Candidate named; CI green; divergence re-derived; no dev-only route content |
| 2. Delivery-path viability | **PERFORMED — FAIL** | §5.71 auto-merge path disabled; current manual-main deploy path unreconciled and has not deployed the candidate |
| 3. G4 procedure executability | **NOT PERFORMED** | Repository half performed and failed several assertions; live dev/restart/observability/authorization half not attempted |
| 4. Evidence validity | **PERFORMED — FAIL** | Green G4 observations cannot establish several claims the checklist reads as establishing |
| 5. Authority and external blockers | **NOT PERFORMED** | Document status read; live freeze authorization, credential path, and shared-pool action authority not obtained |

**Ruling: ASSESSMENT NOT COMPLETED.** v2.58 §3 requires this outcome whenever
one or more dimensions is NOT PERFORMED. Dimensions 3 and 5 are not complete,
so limb 3 remains OPEN. **The FAIL findings at Dimensions 2 and 4 are real and
would support NO-GO only after all five dimensions are performed.** A known
blocker does not authorize skipping the rest of the scope.

## §1.1 What would have been required for NO-GO

NO-GO under v2.58 is a completed assessment whose readiness result is
negative. It discharges limb 3 and leaves G4 unenterable. This assessment does
not reach that state because completing Dimensions 3 and 5 requires live facts
and authority not supplied here. **Calling this NO-GO would falsely record
that the freeze/authority and procedure-executability dimensions were
assessed.**

---

# §2. Dimension 1 — candidate integrity: PERFORMED — PASS

## §2.1 Candidate and CI

**Candidate:** `ce305d34f9da238d017ee2213c88036ba5575b98`, the v2.58 squash on
`origin/main`.

GitHub Validate run `32567058811`, event `push`, completed **success** against
that exact SHA. The required F-AUTH-1 test artifacts are present, including:

- four FD-63 shape-lock suites under `tests/unit/routes/`;
- `tests/integration/f-auth-1-fd63.test.js` for runtime anonymous rejection;
- `tests/integration/f-auth-1-g3-clause3.test.js` for persisted
  `decision_logs.user_id`; and
- interceptor distinction coverage in middleware/frontend tests.

**CI passing is recorded as candidate integrity, not as readiness or runtime
proof.** Dimension 4 states its limits.

## §2.2 `origin/main` / `origin/dev` divergence re-derived

At the stamped basis:

| Measure | Result |
|---|---|
| `origin/main` | `ce305d34` |
| `origin/dev` | `dc18b83d` |
| merge-base | `880c8dd7` |
| main-only commits | **238** |
| dev-only commits | **81** |
| dev-only commits touching `src/routes` | **0** |
| distinct dev-only `src` paths | **2** |
| `src/routes` files differing at tips | **18** |

The two dev-only source paths are:

- `src/middleware/aiRateLimiter.js`; and
- `src/migrations/20260718000000-create-episode-scripts-and-feed-posts.js`.

Both have identical blob hashes on `origin/main` and `origin/dev`. **The
v2.56 §4 shape reproduces at the new basis:** dev holds no `src/` content main
lacks; the 18 route differences are main advancing. Counts changed, so none
were inherited.

## §2.3 Independent open obligation

v2.57 §2.1 remains controlling: §5.71 limb 1 is **UNATTEMPTED**. Dimension 1
does not perform the ~700-handler adjudicator audit and does not convert
candidate identity into disposition correctness. Even a future limb 3 GO would
not make G4 enterable while limb 1 remains open.

---

# §3. Dimension 2 — delivery-path viability: PERFORMED — FAIL

## §3.1 The §5.71 path is disabled

§5.71 describes G4 as:

> *"backup→dev auto-merge succeeds (post cleanup-delete); dev environment runs
> F-AUTH-1 program-wide for soak period; integration test pass; smoke test
> pass."*

`.github/workflows/auto-merge-to-dev.yml` instead triggers on pushes to
`claude/**`. GitHub's workflow API reports it **`disabled_manually`**. Its most
recent run was 2026-06-27 against `880c8dd7`; it has not processed this
candidate or any later `docs/**` branch.

**The trigger mismatch and disabled state are separate findings in one file.**
The `claude/**` trigger also makes `[skip-automerge]` inert on `docs/**`
branches. That token-scope issue does not explain the disabled state, and the
disabled state does not resolve the trigger mismatch.

## §3.2 A different manual path exists and is not reconciled

`.github/workflows/deploy-dev.yml` is API-state **active** and has only a
`workflow_dispatch` trigger. Its own header says:

- no push trigger exists;
- runtime re-enablement is a separate Rule 7 gate;
- first-dispatch prerequisites P1–P5 are gated; and
- deployment targets a dedicated dev backend through SSM.

The workflow's most recent successful run was 2026-07-21 against `main` at
`1844e56b`, not the candidate. It supplies a plausible current deployment
mechanism, but **no F-AUTH-1 revision reconciles this manual-main path with
§5.71's backup→dev auto-merge precondition.**

## §3.3 Deployed-SHA proof is absent

No workflow has deployed `ce305d34` to dev. The assessment therefore cannot
name a deployed candidate SHA or prove frontend/backend coherence for it.

**Dimension 2 FAIL:** the specified path is disabled; the available path is a
different, manually gated mechanism whose prerequisites and relationship to
G4 have not been ruled. G4 cannot enter on an undefined transport contract.

---

# §4. Dimension 3 — G4 procedure executability: NOT PERFORMED

The repository half was performed. The live half was not.

## §4.1 Repository findings — locked checks currently fail

### F-Auth-2 boot behavior contradicts G4

v1.5 §6.1 and §7.1 require:

- valid Cognito env vars: boot succeeds;
- either required env var missing: boot fails immediately with a named error;
- placeholder values: boot fails immediately.

Current `src/middleware/auth.js` says the opposite. Verifiers are
lazy-initialized; `getCognitoConfig()` is called on first verifier use, not at
module load. Missing values produce runtime `AUTH_CONFIG_MISSING`, **not a boot
crash**. Placeholder strings are nonempty and pass `getCognitoConfig()`; no
placeholder rejection exists there.

These are not stale line numbers around equivalent behavior. **The behavior
G4 requires is absent by design in current source.** A dev boot exercise cannot
pass the locked checklist without either changing code or superseding the
checklist.

### The global `optionalAuth` regression check is false

v1.5 §7.7 requires:

> *"`app.js` no longer applies global optionalAuth."*

Current `src/app.js:236` applies `app.use(optionalAuth)`. v2.43 and FD-63
already establish the consequence: route declarations with no middleware can
reach handlers under the global anonymous fallback while escaping the G1
probe. **The checklist item fails at the candidate.**

### Step 6b remains open while §7.6 requires it

v1.5 §7.6 requires the Step 6 interceptor contract and mid-session refresh
behavior. Current `src/middleware/auth.js:484` still states that the duplicate
`authenticateToken` implementation is removed in a later **Step 6b**. The
frontend interceptor has distinct `AUTH_REQUIRED` and `AUTH_INVALID_TOKEN`
paths, but the backend consolidation the checklist names is not complete.

## §4.2 Applicability is not enough

Every file named by the §7 checklist still exists, but existence does not make
the 2026-05 checklist current. The three contradictions above prove that a
line-by-line applicability reconciliation is required before G4 execution.
This assessment found no later revision that restates §7 against current route
paths and locked dispositions.

## §4.3 Live half — NOT PERFORMED

The following required facts were not attempted:

- whether the candidate can be deployed to the actual dev host;
- whether deploy-dev prerequisites P1–P5 currently hold;
- whether a process kill/restart can be authorized and observed;
- whether uptime, restart, memory, and error-log instrumentation are available;
- whether a human can own the complete two-hour alert window; and
- whether the full failure/restart discipline can be executed on that host.

Those facts require a deployed-host read and, for some steps, future live
operations. **No deployed-host contact was authorized in this session.** Under
v2.58 §1.2, partial repository evidence plus an unattempted live half yields
Dimension 3 **NOT PERFORMED**, not FAIL or INCONCLUSIVE.

---

# §5. Dimension 4 — evidence validity: PERFORMED — FAIL

## §5.1 What a green soak can establish

v2.52 §2.1 remains the controlling discrimination:

- sustained `requireAuth` execution can expose runtime ordering,
  middleware-resolution, and deployed-environment failures that static tests
  cannot; but
- it cannot establish token scarcity, closed authentication exposure, or
  persistence correctness it does not inspect.

A properly instrumented G4 could still provide useful runtime evidence. The
problem is the larger claim the current gate/checklist invites a reader to
make from it.

## §5.2 FD-65 makes auth success non-discriminating

FD-65 remains OPEN/P0. Anonymous callers can obtain valid USER tokens that
satisfy `requireAuth`. A soak in which every request is authenticated and every
authenticated request is anonymous can remain green. **Authenticated 200s and
stable uptime cannot establish that the authentication surface is secure.**

## §5.3 FD-64 proves a green assertion can pass on broken behavior

`tests/integration/f-auth-1-fd63.test.js` intentionally asserts that anonymous
`GET /api/v1/roles` does not return `401/AUTH_REQUIRED`. FD-64 records that it
passes on a **500** because `getRolesForshow` is misspelled. The test is valid
as a tier lock and invalid as evidence that the route works.

This is the concrete discriminator v2.58 requires: a G4 assertion must state
whether it proves auth disposition, HTTP correctness, handler completion, or
persistence. **"Not 401" is not "200"; a response can satisfy the auth claim
while failing the route.**

FD-64 is therefore not automatically a blocker to all G4 work. It is a blocker
to any G4 conclusion that treats the `roles.js` response as functional
readiness without asserting the expected success status and behavior.

## §5.4 FD-66 limits persistence and audit claims

FD-66 remains OPEN. Its migration-built measurement left broken schema
surfaces and explicitly did not establish deployed database state. The
`decision_logs` pilot is repaired, but `GET /api/v1/audit-logs` remains the
worked control that returns 500 on the measured path.

A green response-path soak cannot establish audit persistence or deployed
schema parity. Any §7 assertion whose handler reaches a model in FD-66's open
population must read persistence or schema evidence explicitly; otherwise the
assertion is non-discriminating for that claim.

## §5.5 FD-63 is recorded, not over-promoted

FD-63's route surface was remediated at `8ba2b95c`; four static shape suites and
one runtime anonymous-rejection suite now exist. The finding remains open
because the original probe is structurally incomplete and its closure ruling
was never made.

**This assessment does not call FD-63 itself a new hard readiness blocker.**
Whether the 95-handler dispositions are correct belongs to limb 1. What blocks
an evidentiary overclaim here is narrower: G4 manual exercise and soak cannot
substitute for that adjudication.

**Dimension 4 FAIL:** the current checklist does not preserve these
claim/instrument boundaries, so a green G4 result could be read as proving
properties its instruments do not observe.

---

# §6. Dimension 5 — authority and external blockers: NOT PERFORMED

## §6.1 Document-derived status

The following are established without live infrastructure contact:

- G3 limb 1 is UNATTEMPTED;
- prod is recorded FROZEN;
- PE #64 is OPEN/P1 and records one shared Cognito pool for dev and prod;
- PE #65 is OPEN/P2 and no target pool topology has been selected;
- the PE #64 enumeration question is closed; and
- no credential discovery is authorized by v2.58.

## §6.2 Shared identity infrastructure defeats the dev label

G4 §7.1, §7.2, §7.3 and §7.6 require Cognito-dependent boot, token, JWKS,
refresh, and authenticated/unauthenticated behavior. Under PE #64, those
operations address shared production identity infrastructure even when the
application host is labelled dev.

**The assessment cannot assume those actions are permitted under freeze.** It
must obtain an explicit authorization whose scope names the shared pool and
states which reads and writes are allowed. No such authorization was supplied
for this assessment.

## §6.3 Required live/authority facts — NOT PERFORMED

Not attempted:

- live confirmation of the freeze and any exception for G4 identity actions;
- credential path for the shared Cognito operations;
- whether G4 can avoid creating, mutating, or refreshing identity records;
- deployed-host access authorization;
- whether PE #65's unresolved topology changes the allowed G4 identity path;
  and
- operator availability/authority for restart and the two-hour soak.

A previous metadata count does not answer these questions. **Dimension 5 is
NOT PERFORMED.** Treating the recorded freeze as a readiness FAIL would be
wrong: the missing object is the authorization decision, not a measured
infrastructure property.

---

# §7. Blockers established despite the incomplete outcome

These are facts established by performed dimensions. They do not discharge
limb 3.

| Blocker | Owner / next ruling |
|---|---|
| §5.71 auto-merge path disabled; trigger does not match the named backup→dev path | F-AUTH-1/F-Deploy delivery-path reconciliation; Rule 7 for any workflow enablement |
| Candidate has not been deployed; deployed SHA unprovable | Delivery-path owner after mechanism is selected |
| G4 boot-fail/placeholder assertions contradict current lazy runtime behavior | F-AUTH-1 revision must restore behavior or supersede checklist |
| §7.7 global-optionalAuth assertion is false | FD-63 / limb 1 disposition and checklist reconciliation |
| Step 6b remains open while §7.6 requires it | F-AUTH-1 Step 6b owner |
| FD-65 makes a green authenticated soak non-probative for scarcity/security | FD-65 issuance decision/remediation |
| Checklist permits response-shape overclaims demonstrated by FD-64 and FD-66 | Assertion-by-assertion §7 restatement |
| Shared Cognito actions lack freeze-scoped authorization | Evoni / prod-freeze authority; PE #64 and PE #65 inputs |

**No blocker is resolved here.** Their presence means a completed assessment
on the same facts would not be GO. It does not mean the current incomplete
assessment is NO-GO.

# §8. Resumption requirements

To resume limb 3 without changing v2.58's scope:

1. land a ruling selecting and reconciling the G4 delivery path;
2. reconcile v1.5 §7 against current source, especially F-Auth-2 boot behavior,
   global `optionalAuth`, and Step 6b;
3. obtain explicit authorization for deployed-host reads and shared Cognito
   operations under freeze, with a supplied credential path or operator-run
   evidence;
4. establish deploy-dev prerequisites, observability, restart authority, and
   soak ownership; and
5. restart the assessment at a new stamped `origin/main` basis, re-performing
   all five dimensions rather than carrying PASS/FAIL cells forward.

If that work discovers that v2.58's five dimensions are malformed or missing a
sixth dimension, v2.58 §4 requires a superseding scope revision before another
assessment begins.

---

# §9. What v2.59 establishes

- Candidate integrity passed at `ce305d34` (§2).
- Delivery-path viability failed (§3).
- Procedure executability and authority/external blockers were not fully
  performed (§4, §6).
- Evidence validity failed (§5).
- The governing outcome is **ASSESSMENT NOT COMPLETED**; limb 3 remains open
  and G4 remains not enterable (§1).
- Eight blockers/resumption obligations are recorded without resolving or
  reprioritizing them (§7, §8).

# §10. What v2.59 does not do

- **Does not discharge limb 3, select NO-GO, or enter G4.**
- **Does not perform limb 1** or assess ~700 disposition judgments.
- **Does not deploy any candidate, dispatch or enable a workflow, restart a
  process, run §7, or begin a soak.**
- **Does not contact a deployed host, issue an AWS call, search for
  credentials, or exercise shared Cognito.**
- **Does not resolve or reclassify FD-63, FD-64, FD-65, FD-66, PE #64, PE #65,
  PE #67, or the prod freeze.**
- **Does not carry this assessment's cells to a future basis.** Every dimension
  must be re-performed when the blockers permit a new assessment.
- **Changes no gate. Prod FROZEN.**

---

*Type: Limb 3 assessment. Outcome ASSESSMENT NOT COMPLETED under v2.58 §3.4.
Dimensions 1, 2 and 4 performed; Dimensions 3 and 5 NOT PERFORMED. Records hard
blockers without selecting NO-GO. Limb 3 OPEN; G3 PARTIALLY DISCHARGED, OPEN;
G4 not enterable. Ships no code. Mints nothing. FD tail FD-66; XK tail XK-3;
PE tail PE #67. No deployed host contacted. No AWS call issued. Prod FROZEN.
[skip-automerge]*
