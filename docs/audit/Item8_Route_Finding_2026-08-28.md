# Item 8 — the route finding: why the FD-66 infrastructure read was not performed — 2026-08-28

**DRAFT — SUPERSEDED PENDING CORRECTION. Committed to branch, not filed.** Its reasoning is defective in six sections; see `Item8_Correction_Handoff_2026-08-28.md`. Held for Evoni's go.

**Basis:** `origin/main` at `8f9662b31110094225bfe2b982c196d56161b740`, 2026-08-28.

**Type.** Finding and disposition record. Derived from the tree. **No AWS call
issued. No deployed host contacted. No database connection attempted. No
endpoint probed. No credential value read, printed, or sought. Prod FROZEN.**

**What this document is for.** `v25` Sec 6 **item 8** was authorized, scoped, and
then not performed. **The reason is a finding in its own right and was not
previously recorded anywhere**, because the read had never been attempted. A
successor that does not have this will rediscover it the same way: by preparing
the read and finding no way to run it.

---

# §R1. The disposition

> **Item 8 — NOT PERFORMED.** The canon instance has a public endpoint
> (`PubliclyAccessible=True`, `Prime_Studios_Audit_Handoff_v19.md:22`), but its
> security group `sg-002578912805d1930` was live-enumerated on 2026-07-14 as
> carrying four specific ingress rules and no wildcard
> (`F-Deploy-1_Fix_Plan_v1.42.md` §4, amending `F-Deploy-G1-AF`'s dev leg).
> **Whether any route from the operator's current location is permitted is NOT
> ESTABLISHED and was not tested.** `F-Deploy-G1-AF` remains open as a class
> finding; its prod and staging legs stand as filed. **Every other recorded
> route is a host action**, including the 2026-06-25 read performed from the
> box. **No route was used.**

---

# §R2. What was established before the read stopped

**Authorization was given and is not the blocker.**

- **Item 13's residue — CONFIRMED.** Evoni attested on 2026-08-28 that **no SSM,
  SSH, or console contact reached the prod box since 2026-08-27**, `v25`'s last
  touch. Prod is carried **FROZEN** on that attestation, per `v25:239–241`:
  *"No repository read reaches those. The residue is Evoni's word."*
- **The read was authorized, scoped read-only**, with no connection string
  permitted in any agent environment and no AWS call, credential inspection, or
  endpoint probe authorized.
- **The scope was narrowed and confirmed.** FD-66 §6.4.1, §7.1 and §6.5 — the
  last read independently by two sessions in agreement — establish that the read
  is a **database read, not a host action**: four-way provenance discrimination,
  bidirectional column capture, catalog queries only. **That work stands and
  does not need redoing. What is missing is a route, not a specification.**
- **The identity check and its abort were drafted and committed in advance**, so
  the comparison could not be fitted to the result. Expected values, derived
  independently by two sessions before any attempt:
  `current_database() = episode_metadata`, `inet_server_addr() = 10.0.20.224`,
  `transaction_read_only = on`
  (`F-Deploy-1_Phase2A-Step3_Complete_Handoff_2026-06-25.md:28-29`, *"Confirmed
  by DATA, not name string (naming inversion holds)"*).

**The sequence stopped at execution, not at authorization.**

---

# §R3. The route problem, which is the finding

## §R3.1 The canon instance is VPC-private at the address the register records

`10.0.20.224` is a VPC-private address. **It is not reachable from an ordinary
operator workstation, nor from any agent session**, without one of: an SSH
tunnel through the box, SSM port forwarding, a VPN, or a bastion.

**Each of those is a host action**, and the read's authorization explicitly did
not extend to one. **Widening it by implication was declined by Evoni**, which
is why the sequence stopped rather than finding a way around.

## §R3.2 The historical precedent is a host session

The 2026-06-25 read that produced the expected identity values was performed
**from the box**: `F-Deploy-1_Phase2A-Step3_Complete_Handoff_2026-06-25.md`
records box identity as *"instance-id `i-02ae7608c531db485`, hostname
`ip-172-31-26-1`, self-reported via instance metadata."* **Instance metadata is
readable only from the instance.** So the one recorded successful performance of
this class of read was a host session.

## §R3.3 The public endpoint, and the correction that governs it

**The canon instance carries `PubliclyAccessible: true`.** Corroborated in four
independent places — `Prime_Studios_Audit_Handoff_v19.md:22`,
`F-Deploy-1_Fix_Plan_v1.37.md:163` (*"corroborated twice"*),
`F-Deploy-1_Canon_SG_Containment_Finding_2026-06-14_DRAFT.md:95`, and
`F-Deploy-1_FD40_Canon_Credential_Rotation_Gate_Record_DRAFT.md:167` — and
**amended nowhere.** Its public FQDN is recorded at
`F-Deploy-1_Session_Outcome_2026-06-12.md:26`.

**A public endpoint is not a permitted route.** Reachability is governed by the
security group, and the canon SG's state was amended after the finding that is
usually cited for it.

**`F-Deploy-1_PhaseB_G2_Implementation_v1.4.md:480` (2026-07-09)** states
`F-Deploy-G1-AF`: all three RDS security groups permit 5432 from `0.0.0.0/0`,
naming the dev RDS SG `sg-002578912805d1930` among them, and calls prod's
database internet-facing.

**`F-Deploy-1_Fix_Plan_v1.42.md` §4 (2026-07-14) amends the dev leg:**

> *"F-Deploy-G1-AF's claim of 5432-from-0.0.0.0/0 on the dev RDS SG
> (sg-002578912805d1930) is CONTRADICTED by live enumeration 2026-07-14: four
> specific ingress rules, no wildcard. Either the wildcard was removed between
> the 05-28 discovery and the 07-10 W1 session, or AF misattributed it to this
> SG. AF's prod/staging legs are UNTOUCHED by this read and stand as filed; only
> the dev leg is amended."*

**`sg-002578912805d1930` is the canon instance's security group** —
`FD40_Runbook_Reconciliation_EditSet_DRAFT.md:102`: *"Canon SG
`sg-002578912805d1930` (guards canon RDS at `10.0.20.224`…)"*. **The amended leg
is the leg that governs this read.**

**Consequence.** The canon endpoint is public but its ingress is four specific
rules as of 2026-07-14. **Whether any route from the operator's current location
is among them is NOT ESTABLISHED**, is two months stale, **and was not tested.**
Testing it would be an endpoint probe, which was not authorized.

## §R3.4 `F-Deploy-G1-AF` is not closed, and its silence has a scope explanation

**Sweep at this basis:** `G1-AF` / `FD-34` occur in `F-Deploy-1_Fix_Plan_v1.6`
(13), `v1.7` (3), and `v1.42` (1); **zero in every other revision including the
current authority `v1.49`.**

**This is the same trailing-off shape as FD-31 and FD-66 and it means neither
closure nor continuation on its own.** **No closure statement exists anywhere in
the corpus.** The newest carrier of any kind is
`F-Deploy-1_[3]_Master_Runbook_DRAFT.md` (2026-07-31), which records **AF as a
class finding across all three RDS security groups**, citing the AF birth record
(`8043a591` / #722) and #808/#809.

**AF's prod and staging legs stand as filed and are untouched by the dev-leg
amendment.** `v1.4:480` records the staging picture as more complicated than the
class statement suggests — the staging-named SG's ingress is `10.1.0.0/16`-only,
and the public-facing rule sits on a differently-named SG in the default VPC.
**Not re-derived here and not relied on.**

## §R3.5 A drafting failure, recorded because it is the same class the day produced

**An earlier draft of this disposition stated that the canon instance's security
group "allows 5432 from anywhere," citing `F-Deploy-G1-AF`.** That was taken
from `v1.4:480` (2026-07-09) **without checking whether the leg naming this SG
had been amended.** It had been, five days later, on live enumeration.

**Eighth instance of the pattern this day produced**, and the first pointing
toward *more* exposure than exists rather than less. **The safer direction to be
wrong in, and still wrong.**

**`v1.42` §4's own disclosure names the same mechanism, filed in July:**
*"This correction also felled the first draft of the W1 ruling's leg 2, which
argued from the stale AF filing — caught in review before execution; the
drafter's stale-register reasoning is the disclosure."* **The AF filing has now
produced this defect at least twice, six weeks apart, in different sessions.**

---

# §R4. Consequence for items 9 and 11

**Stated because the three gated items are not three independent blockers.**

- **Item 9** (`JWT_SECRET` dev/prod environment-state read) is an environment
  read **on the deployed host**. It is unambiguously a host action and is
  blocked by the same boundary, more directly than item 8.
- **Item 11** (FD-67/68 remedy) requires adjudicating FD-68's severity
  interaction with FD-65, and **item 9 bears on FD-65** — so item 11 sits behind
  item 9's outcome.

**All three gated items are downstream of one problem: no authorized non-host
route to deployed infrastructure has been established.** **That is one blocker,
not three**, and resolving it would move all three at once.

**Not ruled here**, and no route is recommended. **The decision of whether to
authorize a host session, or to establish a non-host route, is Evoni's and is
not taken in this document.**

---

# §R5. What this document does not do

- **Does not state that the canon instance is reachable from any location**, and
  **does not test reachability.** §R3.3.
- **Does not use, recommend, or endorse the public endpoint as a route.**
- **Does not re-derive the canon SG's current ingress rules.** The `v1.42` §4
  enumeration is **2026-07-14 and is carried at its source**, not re-derived at
  this basis. Re-deriving it is an AWS call and was not authorized.
- **Does not rule on `F-Deploy-G1-AF`'s status, severity, or closure.** It is
  carried as open on the absence of any closure statement, and its prod and
  staging legs are carried as filed.
- **Does not re-derive `PubliclyAccessible`.** Four corroborating sources, none
  newer than 2026-07-14, amended nowhere. **Carried, not established at this
  basis.**
- **Does not close, reopen, or re-scope FD-66.** FD-66 is carried as open on
  `v25:614`, `v25:349` and `v25_Owed_Index_Amd11:657`, all newer than the last
  Fix Plan revision to mention it.
- **Does not mint.** No FD, XK, or PE number.
- **Does not authorize a host session, an AWS call, a VPN, a bastion, an SSH
  tunnel, or SSM port forwarding.**
- **Does not perform items 9 or 11**, and does not infer anything about them
  beyond the shared-blocker observation at §R4.
- **Items 8, 9 and 11 remain Evoni-gated and NOT PERFORMED.** No search for
  credentials was made.

---

*Drafted 2026-08-28. Basis `8f9662b31110094225bfe2b982c196d56161b740`. Derived
from the tree. No AWS call issued. No deployed host contacted. No database
connection attempted. No endpoint probed. Prod FROZEN.*
