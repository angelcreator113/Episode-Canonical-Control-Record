# F-AUTH-1 — PE #65 resolution: Branch B ruled, §9.10 re-specified — 2026-08-28

**FILED 2026-08-28 on Evoni's authorization.** Branch, re-costing, pointer
decision and filename were each ruled by her; the rulings are recorded at §1,
§5A and §5B with her words quoted.

**Basis:** `origin/main` at `17978f96529509a5a459274816b92821f6ea5d67`, 2026-08-28.
Derived from documents and from a read-only repository read of the Cognito
config surface. **No AWS call issued. No deployed host contacted. Prod FROZEN.**

**Authorities read newest-first before drafting**, per `v25` Sec 6 item 4:
`PE #64` Amendments 3, 2, 1; `F-AUTH-1_PE64_Identity_Ownership_Resolution_2026-08-25.md`
§§5–8; `F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md` **including its
correction banner**; `PE #65`; `PE #66` Amendment 1.

---

## 1. The ruling

**RULED BY EVONI, 2026-08-28, in her own words: `b`, then `b stands`.**

**Branch B — create a new pool designated canonical prod; the existing shared
pool is retained as dev; identities that belong in prod are migrated into the
new pool.**

**Provenance discipline.** This is a two-character prose ruling on a question
put in prose. It is quoted, not paraphrased, and no option text is attributed to
Evoni. The branch descriptions are the decision document's, not hers.

## 2. The premise the first ruling was made on, withdrawn

**Recorded rather than dropped**, on `Amd12` §L1.1's ground: a correction whose
wrong path disappears leaves a successor unable to tell whether the conclusion
was reasoned to or arrived at.

**Both drafting sessions ran the branch analysis off withdrawn body text.** The
decision document's Branch A body refers to *"the two non-Evoni identities."*
**Its own correction banner, added 2026-08-24 at line 3, withdraws that** —
`PE #64` Amendment 1 established a **count only** and ruled externality
**NOT ESTABLISHED**. Both sessions read the branch bodies by search and read
past the banner. **That is `v25` Sec 6 item 4 — a filed, correct rule, quoted
approvingly by both parties earlier in the same session and not run.**

**And a newer authority superseded even the banner.** `PE #64` Amendment 3
(2026-08-25) points to `F-AUTH-1_PE64_Identity_Ownership_Resolution_2026-08-25.md`:

> **All three accounts are controlled by Evoni. No external identity exists
> within the three-account set.**

Established by two independent sources, neither treated as sufficient alone: one
authorized `ListUsers` narrowed by email relation, which found all three
addresses differ from the known operator address and left ownership
**NOT ESTABLISHED**; and Evoni's direct attestation, which settled it.

**Effect on the ruling.** Branch A's *"unexamined strangers promoted to prod"*
cost does not exist. **The argument first given for B is withdrawn.** B was
re-ruled after the correction, on other grounds. **A's residual cost is
forward-looking, not retrospective:** future identities entering the shared pool
inherit prod status silently, with no signal at the moment it happens.

## 3. What B's execution precondition turned out to be

The decision document states that Branch B *"requires knowing who the three
identities are… as a precondition of execution."*

**That precondition is already discharged.** The 2026-08-25 resolution answers
it. **B does not reopen `PE #64`'s closed enumeration read** — that read was
closed at the *count*; the *ownership* question was separately scoped,
separately authorized, and answered three days later. **No new authorization is
owed on this axis.**

## 4. §9.10 re-specified — PE #65 Defect 1 resolved

**§9.10 as written, quoted in full. Section heading at `F-AUTH-1_Fix_Plan_v1.5.md:599`;
the remedy clause AND the trigger clause are both at `:605` — cited separately
because a citation landing near the right text is still a wrong locus:**

> *"split Cognito pools — separate dev pool with separate Client ID, prod pool
> retained as canonical user store, env config updated per environment."*

**Defect 1 is that the plan clause describes Branch A's mechanics while the
trigger clause describes Branch B's consequence — and both are on `:605`. The
contradiction is intra-line, not cross-section**, and the block was carried
byte-comparable across eight revisions without anyone reading its second half
against its first. **Carriage is the operation that does not interrogate what it
carries** — PE #65 Defect 3, at the tightest scale the corpus offers. Under B the plan clause is
not ambiguous, it is **wrong**, and it is replaced rather than glossed.

| # | §9.10 clause | disposition under B |
|---|---|---|
| 1 | *"separate dev pool with separate Client ID"* | **REPLACED.** No new dev pool is created. The **existing shared pool is retained as dev**, with its existing client. |
| 2 | *"prod pool retained as canonical user store"* | **REPLACED — this clause is false under B.** No prod pool exists to retain. **A new pool is created and designated canonical prod.** |
| 3 | *"env config updated per environment"* | **NO BLOCKER ESTABLISHED AT THIS BASIS — see §5.2.** Two per-environment PM2 manifests exist on `main`, so the clause has a target. An earlier draft marked this BLOCKED on a premise that does not hold. **That is not the same as establishing executability**, and the difference is the margin this document insists on elsewhere. |
| 4 | trigger: *"once a non-Evoni user exists… the split becomes a data-migration problem rather than a config change"* | **RETAINED AS THE OPERATIVE DESCRIPTION.** B *is* a data migration. The trigger's *mechanism* is correct; its *predicate* is not — see below. |

**The trigger's predicate is separately defective and is NOT repaired here.**
`PE #64` Amendment 2 records that *"non-Evoni user"* is a proxy for *"a record
that must not remain in prod,"* and that the equivalence is nowhere examined.
**Under B the predicate is moot for execution** — all three accounts are Evoni's
and the migration set is therefore known — **but the proxy defect survives for
any future identity.** It is named, not resolved.

## 5. Costing against real config and sequencing

**PE #65 closes when a branch is chosen *and costed against real config and
sequencing*, per the decision document's own resolution path. This section is
that costing.**

### 5.1 The config surface — derived, four variables, one read site

```
src/config/environment.js:32-37    cognito: { userPoolId, clientId, clientSecret, region }
                                   ← COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID,
                                     COGNITO_CLIENT_SECRET, COGNITO_REGION
readers:  src/config/environment.js, src/middleware/auth.js   (only two files)
templates: .env.example, frontend/.env.example
```

**Names only; no values read, printed, or sought.** The surface is small: four
environment variables, one construction site, two reading modules.

### 5.2 WITHDRAWN — the blocker rested on two independently stale premises

**An earlier draft of this section held that Branch B is not executable, because
§9.10 clause 3 (*"env config updated per environment"*) presupposes two
environments and `F-Deploy-G1-G` establishes one box, one PM2 process group, one
`.env`. Both premises are stale. The section is WITHDRAWN, not patched.**

**Premise 1 — the configuration claim. FALSE at this basis.**

```
ecosystem.config.js       episode-api-prod-hotfix   env_production{ NODE_ENV:'production' }
ecosystem.dev.config.js   episode-api               "NO env_production blocks belong in this file"
introduced 1844e56b, 2026-07-21 (#943) — "ecosystem config split - root prod-only, new dev manifest"
```

**Two per-environment manifests have existed on `main` since 21 July.** Clause 3
has a target: the prod manifest's `env_production` block, distinct from the dev
manifest's.

**And `F-Deploy-G1-G` does not say what was attributed to it.** In the
register's own words: *"The G1 audit found shared COMPUTE (F-Deploy-G1-G, single
EC2/PM2)… The alpha/beta isolation premise was compute-only — data isolation was
never established."* **Shared compute is not a configuration constraint.**
Reading it as one widens a compute finding into a configuration finding — on the
exact finding whose own text records that its scope was misread once already.

**Premise 2 — the hazard claim. STALE.** A second draft replaced premise 1 with
**FD-31** (`F-Deploy-G1-AG`, P0): prod running on the dev-named RDS instance
while the on-disk `.env` points at an empty prod-named instance, such that a
reload silently swaps prod onto the empty database. The argument was that clause
3 is itself that trigger.

**FD-31 is CLOSED.** Derived by sweep at this basis, not by citation:

```
F-Deploy-1_Fix_Plan_v1.27.md  FD-31: 15 mentions — "CLOSED at v1.20 (2026-07-06)"
v1.28 … v1.49  (22 consecutive revisions, through the current authority)  ZERO mentions
```

**The sweep is the ground; v1.27's sentence is corroboration only.** v1.27 also
states *"not reopened by any subsequent revision"* — **that clause was true as
of v1.27 and its authority stops there.** Citing it as covering the current
basis would be the same defect this section is withdrawing, one layer up. The
interval v1.27 could not vouch for is covered by the sweep.

**The precedent, carried at its source and not re-derived here.**
`F-Deploy-1_Fix_Plan_v1.27.md` records **FD-52** — revisions v1.23–v1.26
restated FD-31 as open by citation without reading its closing revision, and
attached *"G2 §4.2 BLOCKED on FD-31"* to it; those restatements were ruled
**VOID, not superseded** — and **FD-53**, the generalized mechanism: *a
verification's authority does not extend past what it verified.* **Neither FD-52
nor FD-53 appears in `F-Deploy-1_Fix_Plan_v1.49.md` (zero occurrences).** They
are asserted at `v1.27` and their current standing is **NOT ESTABLISHED here.**

**So the FD-31 half is a repeat of what `F-Deploy-1_Fix_Plan_v1.27.md` records
as FD-52 — same number, same route.** **Stated at `v1.27`'s authority, not at
this basis**, consistent with the bound two paragraphs above: FD-52 and FD-53
return zero in `v1.49` and their current standing is NOT ESTABLISHED here. Recorded as a worked example rather
than deleted, because a successor reaching for FD-31 as a gate will reach the
same way.

**What survives, derived at this basis:**

- **Clause 3 has a target**; per-environment manifests exist. **No blocker to it
  is established at this basis.**
- `F-Deploy-G1-G` establishes **no** configuration constraint.
- **No blocker to Branch B is established at this basis.**
- **The prod freeze is untouched by any of the above.** B remains a
  deploy-surface change on a **FROZEN** box, and that gate never rested on
  FD-31. *"FD-31 being CLOSED does NOT lift the prod freeze"* — asserted on
  three `[3]` documents, **not re-derived at v25**, carried at its source.
- `Prime_Studios_Audit_Handoff_v20.md:52` carries a standing `[3]` Step-0 item,
  *"fresh FD-31/FD-38 abort re-verify (untrusted from all prior)."* **Asserted at
  v20; not traced to v25; not relied on here.**

### 5.3 The migration, and why it is cheaper than first priced

**Cognito does not transplant users between pools.** A migrated identity is
re-created, re-authenticated, or Lambda-migrated on next login.

**Two facts reduce this cost sharply:**

- **All three accounts are Evoni's** (§2). The migration set is three records
  held by one person, not an unknown user population.
- **`§6.1` of the 2026-08-25 resolution: password currency is UNESTABLISHED.**
  Control of the accounts does not establish that any recorded password is
  current or that any account can presently complete password authentication.
  No authentication or token issuance was attempted.

**If password currency is unknown for accounts the operator controls, a
reset-on-first-login migration is not a burden B imposes — it is a step that may
be owed regardless.** **The password-export problem is therefore not B's
principal cost — full stop, with no successor named.** An earlier revision of
this sentence named §5.2 as the principal cost. **§5.2 is withdrawn**, and
naming any principal cost would in any case overreach §8, which concludes that
**no ordered execution sequence yet exists to cost against.**

### 5.4 A surviving bound that touches execution

**`§6.2` of the same resolution: `USER_PASSWORD_AUTH` remains document-sourced**,
from `docs/COGNITO_USER_POOL_SETTINGS.md`. `ListUserPoolClients` does not return
`ExplicitAuthFlows`, and `DescribeUserPoolClient` was deliberately not called
because its response may include `ClientSecret`, outside the authorized
no-secret boundary. **The new prod pool's client configuration cannot be
specified against an AWS-verified auth-flow setting at this basis.**

### 5.5 A coupling with item 11 that neither docket records

`src/middleware/auth.js` is both a Cognito config reader **and** the site of
`COGNITO_CONFIG_PLACEHOLDERS` and `COGNITO_INFRA_ERROR_NAMES`. **`v25` Sec 6
item 11 — the FD-67/FD-68 remedy — names *"explicit placeholder behaviour"* as
one of its two surfaces.** B repoints the values; item 11 changes how the same
module behaves when those values are placeholders. **Same file, two dockets, no
cross-reference between them.** Named here so sequencing is deliberate. **Not
adjudicated.**

## 5A. Branch A re-costed — RULED

**RULED BY EVONI, 2026-08-28, in her own words:** *"recost a"*.

`F-AUTH-1_PE64_Identity_Ownership_Resolution_2026-08-25.md` §7 records that the
costing *"is now overstated where it depends on unknown ownership"*, declines to
amend it, and states that re-costing *"requires its own ruling and pointer
decision."* **Both are now ruled — the re-cost here, the pointer at §5B.**

**Why re-cost a branch that was not chosen.** So the comparison B was chosen
over is accurate on the record. A decision left standing against a costing the
register itself calls overstated invites a later reader to reopen it on the
wrong figures.

| | as filed 2026-08-22 | re-costed 2026-08-28 |
|---|---|---|
| Cost to the existing three accounts | *"not a small one"* — possible blind promotion of debris | **≈ nil.** All three Evoni-controlled; promotion is correct placement |
| Irreversibility | promotion of the three is irreversible | **defused for the three**; survives for identities not yet in the pool |
| Delay cost | *"blind-promotion set grows"* | **grows only with new identities.** Rate is a function of the signup surface, **which no document here holds** |
| Residual risk | framed as record exposure | **relocated to the operator model** — forward-looking, unbounded in principle |
| Execution cost | Low — one new pool, one config change per environment, no migration | **re-examined, unchanged: Low.** Nothing in the ownership resolution bears on execution mechanics |

**A's genuine cost survives, with its subject corrected.** The filed costing's
sharpest line — *"the branch that costs the least effort and the branch whose
worst consequence produces no signal are the same branch"* — was written about
the three existing identities. **It is true instead of every future one, which
is the larger and unbounded set.**

**Net: Branch A is cheaper than the filed costing states, and its risk is
smaller in the near term and less bounded in the long term. This narrows the
cost gap in A's favour and does not reverse §1** — the operator-model argument
is the ground B was re-ruled on and is untouched by the re-costing.

**Not claimed:** the operator model is stated as a class, **not quantified.**
Quantifying it needs knowledge of the signup surface no document here holds, and
it is not inferred.

## 5B. Pointer decision — RULED

**RULED BY EVONI, 2026-08-28, in her own words:** *"d"* — **standalone document
plus a pointer-only chain amendment**, and separately, this filename.

**Effect.** This document is filed under its own name and is the amending
authority for the Branch A costing and for §9.10.
**`v25_Owed_Index_Amd16_2026-08-28.md` points to it and carries nothing.**
**No banner is placed on `F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md`,
on `Session_PE_Roster.md`, or on any Fix Plan revision**, and
`358262c569ddc665ff3978b5ae713c272efe2e39` does not move.

**Route (a) alone was withdrawn as an orphan.** It was safe for `Amd13`,
`Amd14` and `Amd15` because each is a chain link and the cold-session protocol
reads the chain tail first. **A standalone ruling inherits none of that** — the
decision document's banner points *backwards*, the roster is not edited, and
§9.10 is absent from `v2.68`. Nothing filed would name it.

**(d) is not a new convention.** It is the pattern used on 2026-08-25:
`PE #64` **Amendment 3** — *"This amendment points; it does not carry"* —
pointing at `F-AUTH-1_PE64_Identity_Ownership_Resolution_2026-08-25.md`.
**Named and pointed at, rather than named or pointed at.**

**Filename provenance, recorded because two drafts existed.** Two same-basis
drafts of this ruling were produced under different names. **Evoni selected this
one.** The other, `F-AUTH-1_Decision_CognitoPoolTopology_Ruling_2026-08-28.md`,
is **superseded and not filed**; its §P2 re-cost and its `:605` citation are
folded in here at §5A and §4. **A pointer-only amendment naming a path that
diverges by one character carries a closure and points at nothing** — the
filename is verified byte-exact with `git cat-file -e` as a pre-commit gate, not
by eye.

## 6. NOT RULED

- **Whether §9.10's P1 is re-recorded into the current Fix Plan authority.**
  §9.10 occurs **zero times in `F-AUTH-1_Fix_Plan_v2.68.md`** and lives at
  `F-AUTH-1_Fix_Plan_v1.5.md:605`. **Re-recording is a Fix Plan revision — the
  only instrument that mints FD numbers — and is owed separately.**
- **§5.2's runtime-configuration question — MOOT, and the question is kept
  readable rather than struck.** §5.2 is withdrawn; the three runtime options it
  offered addressed a blocker that is not established at this basis. The options
  are not wrong in themselves — they answer a problem this document no longer
  finds.
- **The trigger predicate's proxy defect** (§4). Named, moot for this execution,
  unresolved for future identities.

## 7. What this document does not do

- **Does not execute anything.** No AWS resource created, renamed, repurposed,
  or read. No migration performed or scheduled.
- **Does not amend `F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md`,
  `PE #64`, `PE #65`, or the 2026-08-25 resolution in place.** Route (a)
  precedent: **this document is the amending authority; targets untouched.**
- **Does not close `PE #64`** or change its severity. `PE #64` remains **P1,
  OPEN**, trigger **PARTIALLY EVALUATED**.
- **Does not re-record §9.10's P1 into the current Fix Plan.** §9.10 has been
  absent from the authority since `v2.38` (`PE #64`'s subject). **Re-recording
  is a Fix Plan revision and mints its own FD; that is not this document's to
  do.**
- **Does not mint** an FD, XK, or PE number. FD-70 remains next-available and
  unminted.
- **Discloses no Cognito identifier, client ID, secret, username, email, or
  account attribute.** Config variables are referred to by name only.
- **Contacts no host, dispatches no workflow, issues no token, performs no AWS
  read or write. Prod FROZEN.**

## 8. Whether PE #65 closes

**PE #65 closes when a branch is chosen and costed against real config and
sequencing.** A branch is chosen (§1). **The costing is not complete**, and the
reason is not the one an earlier revision of this section gave.

**Corrected, because the earlier reason committed the error §5.2 exists to
correct.** That revision held that §5.2's withdrawal removed *"the half that
addressed sequencing."* **§5.2 was the executability analysis** — it asked
whether B can proceed at all. **The sections bearing on sequencing all survive
it:** §5.3 (migration cost), §5.4 (the auth-flow bound touching execution), and
§5.5, which says *"named here so sequencing is deliberate"* in its own words.

**What is actually absent is smaller and older.** §5.1 gives the config surface;
§5.3–§5.5 give three constraints on ordering. **No section assembles them into
an ordered execution sequence with its gates.** **That gap predates §5.2's
withdrawal and would exist even if §5.2 had stood.**

**Recommendation, not a ruling: PE #65 remains OPEN**, and this document is
recorded as the re-specification it owed.

**Two earlier reasons are superseded and both are kept readable.** The first
held PE #65 open because a blocker made sequencing conditional — **no blocker is
established at this basis** (§5.2). The second held that §5.2's withdrawal
removed the sequencing analysis — **it did not; §5.3–§5.5 survive.**

**The standing reason is the one above:** the constraints exist and **nothing
assembles them into an ordered sequence with its gates.** **Closing PE #65 now
would file a specification whose execution order was never derived — a worse
defect than one whose blocker is named, because a named blocker announces itself
and an unassembled sequence does not.**

**What a completing session owes is not a redo of §5.2.** It is the step no
section produced: **an ordered execution sequence with its gates**, assembled
from §5.1's surface and §5.3–§5.5's constraints, against the per-environment
manifests that do exist, under the standing prod freeze, and against `v25`
Sec 6 **item 13**'s residue — *"confirm the residue live through the appropriate
authority before any prod / shared-Cognito / host action"* — which is filed,
perennial, and unchanged by anything here.

---

*Type: decision record and specification. Derived from documents and one
read-only repository read. Edits no file. No AWS call, no host contact, no
endpoint exercised. Prod FROZEN.*
