| **PRIME STUDIOS** **EVIDENCE NOTE** *AE is one-fifth remediated, its row does not say so, and its severity rests on a characterization the corpus contradicts.* |
| --- |

# Evidence Note — F-Deploy-G1-AE: partial remediation, a stale row, and a residual rule its remedy cannot discharge

**Document version**

Evidence note. **Rules nothing. Mints nothing. Closes and reopens no finding.**
**Re-rates no severity.** Changes no gate, owner, or disposition. Ships no code.
**Contacts no host.** Prod **FROZEN**.

**Basis:** `origin/main` at `8fe3a8a3`, 2026-08-26. **Documents only — every
claim below is a read of a filed artifact via `git show origin/main:`. No AWS
call, no live security-group read.**

**Status**

Record. **Three observations, one of which bears on a severity Evoni holds.**

---

## §1 What AE is, on its face

`F-Deploy-1_G1_Audit.md:1189` and `:1205`:

> | AE | `episode-backend-sg` admits `0.0.0.0/0` on 22 / 3000 / 3002 / 80 / 443 | P1 | OPEN — post-[3] security sweep |

> **Finding F-Deploy-G1-AE (P1).** The prod box's security group is open to the
> world (ports 22 / 3000 / 3002 / 80 / 443) rather than scoped to the ALB /
> required sources. Source: #722 (`8043a591`), which records it as **"this way
> for months; not actively burning but real exposure."** Disposition: OPEN —
> post-[3] security sweep. **Severity P1: #722 assigns no explicit P-level and
> characterizes it as real-but-not-actively-burning**, sweep-priority below AF;
> rated P1 here on that basis.

**The item is registered, owned, severity-rated, and sequenced.** It is not
unowned and it is not unfiled.

## §2 Observation 1 — AE is one-fifth remediated and its row does not record it

**`tcp/22` was scoped to a single address on 2026-08-22** under explicit
authorization, recorded at `F-Deploy-1_Fix_Plan_v1.48.md:89` and carried at
`v1.49`. **Change and rollback are recorded off-repo.**

**AE's row at `8fe3a8a3` still reads as five ports admitting `0.0.0.0/0`.** A
reader deriving AE's state from the register gets a picture that is stale in the
*safe* direction for port 22 and cannot tell from the row which port that is.

**This is not a defect in v1.49.** v1.49 records the scoping and explicitly
declines to rule it — *"whether it warrants its own disposition is left open"* —
and F-Deploy-1 remains **CLOSED**. **The gap is that no AE-side artifact
received the update.**

## §3 Observation 2 — the other four ports: documented-open, live-unverified

**Stated as the two-sided claim it is, because one side is evidence and the
other is absence.**

**What the record says:** every filed reference to 3000 / 3002 / 80 / 443 on
this SG describes them as open. `F-Deploy-1_PhaseB_G2_Implementation_v1.2 §9.7`
(carried verbatim at v1.3 and v1.4):

> **F-Deploy-G1-AE: `episode-backend-sg` allows SSH and application ports from
> 0.0.0.0/0.** Specifically: port 22 (SSH), 3000, 3002, 80, 443 all allow
> ingress from any IP on the internet. **Port 3000 has a tighter rule (only from
> `sg-0bbe523f9dd31661a`), but the 0.0.0.0/0 rules are independent and active.**

**What the record does not contain:** **no artifact on `origin/main` records any
revoke, close, or scoping action against these four ports.** Searched: the SG
id, the SG name, and the post-[3] sweep. **Every reference to their remedy is
prospective** — "deferred to the post-[3] sweep", "AE/AF SG lockdown — post-[3]
sweep", "those remain the post-[3] sweep". **Nothing records that sweep having
run.**

**Live state is NOT established here and cannot be under the freeze.** The
documentary state is open; **absence of a recorded remediation is not proof of
non-remediation.** This is recorded as **documented-open, live-unverified** —
neither "four live legs" nor "a stale row" is asserted.

## §4 Observation 3 — the residual rule is owned by a remedy that cannot discharge it

**AE's remedy is a one-time close:** *"post-[3] security sweep"*, "tightening
prod's SG", scheduled once, below AF.

**The 2026-08-22 action did not close `tcp/22`. It scoped it to a dynamic
address**, and `v1.49` states the consequence:

> **The scoped rule is to a dynamic address and will need re-scoping when that
> address changes** — routine maintenance, not a one-time fix.

**A recurring obligation cannot be discharged by a one-time remedy.** When the
post-[3] sweep runs and closes AE, the `/32` rule's re-scoping requirement
survives the closure of the finding that carries it — **and AE's closure would
be the occasion on which it stops being tracked.**

**The item is not unowned. It is owned by a remedy of the wrong shape**, which
is a narrower and more durable defect than absence of an owner.

## §5 The severity ground has moved — RECORD, NOT A RE-RATING

**AE's P1 is explicitly grounded in a characterization**, per §1: #722 records
the exposure as *"not actively burning"*, and `G1_Audit.md:1205` states the
rating rests on that — *"rated P1 here on that basis."* `:1233` repeats it:
*"AD = P1, AE = P1 (real exposures, **not actively exploited**…)".*

**`Audit_Handoff_Delta_2026-07-04_id3_Window.md:155` records the contrary
observation:**

> - SSH port 22 world-open — **continuous internet brute-force visible in
>   auth.log** (AE class).

**#722 is 2026-05-28-era; the delta is 2026-07-04.** The later observation
post-dates the ground and is about the same port, on the same class.

**This note re-rates nothing.** Severity is Evoni's. **What is recorded is that
the stated ground for the current rating is contradicted within the corpus**,
and that the contradiction has sat in a handoff delta since 2026-07-04 without
reaching AE's row.

**Bound:** the delta's `auth.log` observation is **carried as filed and not
re-verified here** — verifying it requires host contact, which the freeze
forbids. **It is not asserted as current.** Port 22 has since been scoped (§2),
so the observed condition may no longer obtain; **that is precisely why the row
and the rating need a look rather than an assumption in either direction.**

## §6 Bounds

- **Documents only.** No AWS call, no host contact, no live SG read. All reads
  via `git show origin/main:` at `8fe3a8a3`.
- **§3 establishes the documentary record, not live state.** Absence of a
  recorded remediation is not proof of non-remediation.
- **§5's `auth.log` observation is carried from a filed delta, unverified, and
  not asserted as current.**
- **Off-repo evidence is not read.** The 2026-08-22 change and rollback are
  recorded off-repo and were not examined.
- **No commit is dated, and no correspondence is drawn** between the 08-22
  scoping and any specific prior observation.

## §7 What this note does not do

- **Does not re-rate AE.** §5 records that the ground moved. **P1 stands until
  Evoni moves it.**
- **Does not amend AE's row**, `G1_Audit.md`, or any G2 revision.
- **Does not mint.** No FD, no XK, no PE.
- **Does not assert** the four remaining ports' live state, in either direction.
- **Does not propose** a re-scoping schedule, a remedy reshape, or a procedure.
- **Does not reopen F-Deploy-1**, which remains **CLOSED**, and does not rule on
  `v1.49`, which recorded the scoping and declined to dispose it.
- **Does not classify** the residual rule as a new AD/AE/AF item. **AE already
  exists and this is its state, not a sibling.**
- **Does not contact** any host, AWS API, database, or Cognito endpoint. No
  endpoint exercised. **Prod FROZEN.**

---

*Type: evidence note, record only. Recorded, not ruled. Documents only — no live
state established.*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
