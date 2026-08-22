| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Limb 3 scope specification. Rules no readiness outcome.* |
| --- |

**Document version**

v2.58 — **SPECIFIES THE SCOPE AND OUTCOME MODEL FOR G3 §5.71 LIMB 3.**
Rules no readiness outcome, performs no assessment, and changes no gate. G3
remains **PARTIALLY DISCHARGED, OPEN** per v2.57 §2; §5.71 limbs 1 and 3 remain
unattempted. G4 remains **not enterable**. FD tail remains **FD-66**; XK tail
remains **XK-3**; PE tail is **PE #67**. Derived from documents and repository
metadata against `origin/main` at
`ddfffef5f9d4c63f4260cd35a176214a3f283fce`. No deployed host contacted. No
AWS call issued. Prod FROZEN.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED**, unchanged. **G3 — PARTIALLY
DISCHARGED, OPEN**: v1.5 clauses 1–4 and §5.71 limb 2 discharged; limbs 1 and 3
open. **G4 — not enterable.** G5 — BLOCKED. G6 — not reached. FD-63, FD-64,
FD-65 and FD-66 remain open; FD-65 remains P0. PE #64 remains OPEN/P1 and PE
#65 remains OPEN/P2. Prod remains FROZEN; confirm freeze status live before
any prod-touching action.*

---

# §1. The object specified here

v2.37 §5.71 gives G3 three activities:

> *"adjudicator-driven audit pass over CP1–CP12 cumulative work; verify G1–G6
> still hold post-merge-resolution + cleanup-delete; production-readiness
> assessment for G4."*

v2.57 §1.3 rules that §5.71 is a partial re-specification of the same G3 as
v1.5 §6.1. v2.57 §2.1 preserves limb 2's discharge and records limbs 1 and 3
as **UNATTEMPTED**. v2.56 §2 rules that limb 3 is the precondition whose
function is to authorize G4 entry and that G4 is not enterable while it is
unperformed.

**The phrase *"production-readiness assessment for G4"* has never been
enumerated.** Four words name an obligation; no revision states what must be
read, what counts as a completed assessment, what outcomes are available, or
what a negative outcome does to the limb. This revision supplies that missing
specification before the assessment is run.

## §1.1 Definition

**The §5.71 limb 3 production-readiness assessment is a stamped ruling on
whether one named F-AUTH-1 candidate may enter G4 and whether G4 can produce
valid evidence.**

It asks five questions:

1. Is the candidate complete and internally identified?
2. Can that exact candidate be delivered to dev through a live, authorized,
   provable path?
3. Can every operation G4 requires actually be performed and observed?
4. Would the resulting observations discriminate the properties G4 is meant
   to establish?
5. Are the external authorities, freezes, and independent blockers satisfied?

**"Production-readiness" does not make this a production assessment.** G4 is
the dev deployment, verification, restart, and soak gate. Limb 3 assesses
readiness to enter that gate, which is the last dev stage before G5's
production cutover. It neither inspects production generally nor substitutes
for the Pre-G5 readiness check at v1.5 §6.2.

## §1.2 Completion rule

**Every dimension in §2 must carry an explicit status. Silent absence is not
an assessment result.** A dimension is one of:

- **PERFORMED — PASS**: the required facts were read and no blocker was found;
- **PERFORMED — FAIL**: the required facts were read and a blocker was found;
- **PERFORMED — INCONCLUSIVE**: the authorized read was performed, but the
  evidence cannot decide the dimension on its stated discriminator;
- **NOT PERFORMED**: the required read or operation was not attempted — for
  example because authorization was withheld, access was unavailable, or the
  assessment stopped before reaching it.

**INCONCLUSIVE and NOT PERFORMED are not synonyms.** INCONCLUSIVE is an
observed result from an attempted dimension. NOT PERFORMED is the absence of a
result. Treating the second as the first would let a blocked assessment read as
an evaluated one.

---

# §2. The five dimensions

## §2.1 Dimension 1 — candidate integrity

The assessment must:

- name the exact `origin/main` SHA proposed for G4;
- confirm the F-AUTH-1 changes and required tests claimed by the register are
  present at that SHA;
- re-derive v2.56 §4's `origin/main` / `origin/dev` divergence measurement at
  the assessment basis rather than inherit its count;
- establish whether any dev-only source content would be carried or lost;
- identify all open G3 obligations and state that limb 3 does not perform or
  discharge limb 1; and
- identify any branch-base or propagation condition that makes the candidate
  different from the artifact a reviewer believes is entering G4.

**This is candidate identity, not the limb 1 adjudicator audit.** The
~700-handler qualitative disposition review remains limb 1 and must not be
compressed into a checksum, green test suite, or clean branch comparison.

## §2.2 Dimension 2 — delivery-path viability

The assessment must:

- identify the actual mechanism that moves the named candidate to dev;
- establish that the mechanism exists, is enabled at both repository-text and
  repository-API layers, targets the intended branch, and is authorized;
- establish that frontend and backend candidate versions can be delivered
  coherently;
- name the evidence that will prove the deployed SHA rather than infer it from
  a successful workflow; and
- reconcile the mechanism with §5.71's G4 wording: *"backup→dev auto-merge
  succeeds (post cleanup-delete)."*

**Known input, not assessed here:** `.github/workflows/auto-merge-to-dev.yml`
is present and declares `on.push.branches: ['claude/**']`, while GitHub's API
reported the workflow **`disabled_manually`** at this basis. The same trigger
scope makes `[skip-automerge]` inert on `docs/**` branches: two operational
questions in one workflow, neither a substitute for the other. The assessment
must re-read both file and API state at its own basis and rule what follows; v2.58
makes no readiness finding from the observation.

## §2.3 Dimension 3 — G4 procedure executability

Against v1.5 §6.1's G4 row and §6.4 failure path, the assessment must establish
that the following can be performed on the named candidate:

- backend deployment to dev;
- valid Cognito env values boot successfully;
- a missing required env value boot-fails with a named error;
- placeholder env values boot-fail;
- frontend deployment with the matching interceptor contract;
- the full v1.5 §7 verification checklist, checked for applicability against
  current routes and implementation rather than assumed current;
- a process kill and clean restart with auth re-verified;
- a two-hour dev soak with uptime, restart, log-spam, error, and memory
  observability; and
- human availability for alerts throughout the soak.

The assessment must also confirm that G4's failure rule can be followed:
diagnose the failure, return to the appropriate earlier gate, and rerun all of
G4 including a fresh two-hour soak. **No interrupted soak receives partial
credit.**

**Limb 3 does not execute any item in this list.** It establishes that each is
available, authorized, and observable.

## §2.4 Dimension 4 — evidence validity

For every G4 operation, the assessment must state what a green result would and
would not establish. At minimum it must classify:

- CI success versus runtime behavior;
- authenticated success versus token scarcity or authorization correctness;
- manual route exercise versus the per-sub-form test minimum;
- server uptime versus absence of silent authorization bypass;
- a green soak versus properties no soak instrument observes; and
- a working response path versus persistence correctness behind that response.

Known constraints to re-read at the assessment basis:

- v2.56 §4.3 holds that while FD-65's issuance half is open, a green soak can
  authenticate anonymous callers and establish neither scarcity nor security;
- FD-63 remains open and G3/G4 were placed pending re-validation after four
  miss shapes were established;
- FD-64 is a correctness finding outside F-AUTH-1's authentication surface and
  must be related to a G4 assertion before it is called a blocker; and
- FD-66 leaves broken audit/schema surfaces and likewise requires
  assertion-by-assertion classification rather than automatic promotion to a
  G4 blocker.

**An open finding is not automatically a readiness blocker.** The assessment
must identify the G4 claim it defeats. Conversely, a finding cannot be omitted
merely because its owner is another item if it makes a G4 observation
non-discriminating.

## §2.5 Dimension 5 — authority and external blockers

The assessment must establish:

- the disposition of every independent G3 obligation, including limb 1;
- whether any required dev action touches production or shared infrastructure;
- the live prod-freeze posture and the exact authorization governing any such
  action;
- whether required credentials/access exist without searching for or exposing
  credentials in the assessment session;
- whether PE #64's shared Cognito pool makes a nominally dev-scoped auth action
  production-touching; and
- whether PE #65's unresolved target topology changes what G4 is permitted to
  exercise or what its results mean.

**Known constraint, not ruled here:** PE #64 records one shared Cognito pool
for dev and prod. A G4 login, token, JWKS, or identity operation against that
pool is not made dev-only by the caller's environment label. If the required
read or operation is freeze-gated and authorization is not given, the
corresponding dimension is **NOT PERFORMED**, not INCONCLUSIVE.

---

# §3. Outcome model

The assessment has four top-level outcomes.

| Outcome | Required dimension state | Effect on limb 3 | Effect on G4 |
|---|---|---|---|
| **GO** | All five dimensions performed; no hard blocker; evidence sufficient | **DISCHARGED** | Limb 3 permits entry, subject to every other G3 obligation and authority |
| **NO-GO** | All five dimensions performed; one or more hard blockers established | **DISCHARGED** | **NOT ENTERABLE** until blockers are removed and readiness is reassessed where required |
| **INCONCLUSIVE** | All five dimensions performed; at least one attempted dimension yields evidence that cannot decide its discriminator | **DISCHARGED** | **NOT ENTERABLE**; the unresolved discriminator is named |
| **ASSESSMENT NOT COMPLETED** | One or more required dimensions is **NOT PERFORMED** | **REMAINS OPEN** | **NOT ENTERABLE**; no readiness ruling exists |

## §3.1 A NO-GO is a completed assessment

**NO-GO means the assessment succeeded and readiness failed.** It discharges
limb 3 because the required assessment was performed against the complete
scope and produced a ruling. It does not mean G4 is ready, and it does not
close G3.

This distinction is load-bearing. *"Limb 3 discharged"* records completion of
an assessment. *"G4 enterable"* records its favorable outcome plus satisfaction
of every other live G3 obligation. Conflating them would turn completion of a
negative check into permission to proceed.

## §3.2 A GO is necessary and not sufficient while limb 1 is open

Even a GO on limb 3 does not enter G4 by itself. v2.57 §2.1 records limb 1 as
UNATTEMPTED and G3 as OPEN. **G4 entry requires the union of G3's live
specifications, not limb 3 alone.** This revision does not sequence limb 1 and
limb 3 relative to each other; it only prevents either from standing for the
whole.

## §3.3 INCONCLUSIVE is an evaluated state

INCONCLUSIVE is available only when every required dimension was performed.
It records that the evidence itself fails to discriminate — not that a read
was skipped, gated, unavailable, or inconvenient. The assessment must state
which discriminator failed and why another authorized read would or would not
resolve it.

## §3.4 ASSESSMENT NOT COMPLETED preserves the absence

If any required dimension is NOT PERFORMED, the instrument stops with
ASSESSMENT NOT COMPLETED. It must list each missing dimension, the reason, and
the authorization or evidence needed to resume. **No result from another
dimension fills the blank.** A known blocker does not authorize skipping the
remaining dimensions if the instrument intends to discharge limb 3.

---

# §4. Assessment protocol

1. **This scope specification lands first.** The assessment uses a later,
   separately stamped `origin/main` basis.
2. **Every dimension receives its own evidence table** with status, source,
   result, and discriminator.
3. **Live reads are listed before execution and authorized at their real
   infrastructure scope.** A dev label does not soften a shared-prod action.
4. **No credential discovery.** The operator supplies the credential path or
   executes the read; the assessment does not scan env vars, home directories,
   SSM, or local config for credentials.
5. **No silent scope amendment.** If assessment work discovers a sixth required
   dimension or shows one of these five is malformed, the outcome is
   ASSESSMENT NOT COMPLETED. A superseding scope revision lands before the
   assessment restarts.
6. **Figures are re-derived at basis.** Counts, branch divergence, workflow
   state, open-item status, and route/checklist applicability are not inherited
   from v2.56, v2.57, or this revision.
7. **The assessment states consequence and ruling separately.** A blocker
   existing is a fact; NO-GO is the ruling. All green conditions existing is a
   fact; GO is the ruling.

---

# §5. What v2.58 establishes

- Limb 3's object is a readiness ruling on one named candidate's entry into G4
  and on G4's ability to produce valid evidence (§1.1).
- Five dimensions are required: candidate integrity, delivery path, procedure
  executability, evidence validity, and authority/external blockers (§2).
- Every dimension must be explicitly PERFORMED–PASS, PERFORMED–FAIL,
  PERFORMED–INCONCLUSIVE, or NOT PERFORMED (§1.2).
- Four top-level outcomes exist, including ASSESSMENT NOT COMPLETED for silent
  or gated absence (§3).
- GO, NO-GO, and INCONCLUSIVE discharge limb 3; ASSESSMENT NOT COMPLETED does
  not (§3).
- A NO-GO discharge does not make G4 enterable; a GO is still insufficient
  while limb 1 or another G3 obligation remains open (§3.1, §3.2).
- The assessment must be a later instrument on a later stamped basis (§4).

# §6. What v2.58 does not do

- **Does not perform limb 3 or select GO, NO-GO, INCONCLUSIVE, or ASSESSMENT
  NOT COMPLETED.**
- **Does not perform limb 1**, review ~700 disposition judgments, or change any
  prior clause/limb disposition.
- **Does not enter, authorize, schedule, or execute G4.** It deploys nothing,
  runs no §7 assertion, restarts no process, and begins no soak.
- **Does not perform the Pre-G5 readiness check**, assess G5 rollback, or open a
  production window.
- **Does not resolve or reclassify FD-63, FD-64, FD-65, FD-66, PE #64, PE #65,
  or PE #67.**
- **Does not treat the observed disabled workflow state as a readiness ruling.**
  It records the observation so the later assessment must re-read rather than
  discover the dimension midstream.
- **Contacts no deployed host, issues no AWS call, changes no workflow, and
  changes no gate. Prod FROZEN.**

---

*Type: Scope specification. Defines §5.71 limb 3's five required dimensions,
dimension statuses, four assessment outcomes, and gate effects. Performs no
assessment. Rules no readiness outcome. G3 remains PARTIALLY DISCHARGED, OPEN;
G4 not enterable. Ships no code. Mints nothing. FD tail FD-66; XK tail XK-3;
PE tail PE #67. No deployed host contacted. No AWS call issued. Prod FROZEN.
[skip-automerge]*
