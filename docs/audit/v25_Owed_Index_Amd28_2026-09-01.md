| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 28** *Item 8 is recorded NOT PERFORMED as a read of canon, with the reason. The blocker is credential location, not authorization and not a failed gate. Two findings about how the register reached the conclusion that the credential is unreachable, one of which is that it has not fully checked.* |
| --- |

> ## ⚠ STATUS UPDATE — §AD2's disposition is CORRECTED. Read this first.
>
> **§AD2 below records `v25` Sec 6 item 8's read as NOT PERFORMED. That is
> wrong.** The read was performed on **2026-08-29** by the operator, over the
> operator-workstation route identified at the route finding §R1.1, with evidence
> at `docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt`. **See
> `v25_Owed_Index_Amd18_2026-08-30.md` §T1 and
> `v25_Owed_Index_Amd29_2026-09-01.md` §AE1.**
>
> **What was not performed is the Addendum A/B FOLLOW-UP reads** — a distinct
> instrument, authorized separately on 2026-09-01, blocked by credential
> location. **This amendment collapsed the two.** The Status block's unqualified
> *"No canon read was performed"* is wrong on the same terms and for the same
> reason.
>
> **Corrected position:** item 8's read **PERFORMED 2026-08-29, DISCHARGED**; the
> Addendum A/B follow-up reads **AUTHORIZED and NOT PERFORMED**; item 8's
> **DISPOSITION remains OPEN and Evoni-gated**.
>
> **What is NOT superseded.** **§AD3 stands** — SSM Parameter Store is unchecked.
> **§AD4 stands** — §R1.1 established reachability and never addressed
> authentication. **§AD5 stands.** **§AD2.1's reason stands as to the FOLLOW-UP
> reads**, and **§AD2.2 and §AD2.3 stand.** **Whether the 2026-08-29 read scores
> Dimensions 4 and 5 is NOT decided by this banner** and remains open.
>
> **§AD2's text is retained unaltered.**
>
> *Banner added 2026-09-01 on Evoni's ruling. Not a supersede.*

***Provenance:*** *route ruled by Evoni on 2026-09-01 — **chain amendment, one disposition and two findings, no register number.** **Push, PR create and merge are NOT ruled and are not assumed.** Rule 7 gates each separately.*

# v25 Owed Index — Amendment 28

**FILED 2026-09-01 on Evoni's authorization.** **Push, PR create and merge UNRULED AT FILING — a reader finding this document on `main` is reading it after some of those gates were passed, and should read §AD6 for what this amendment rules rather than this line for what it did not.**

**AMENDMENT 28 to `v25_Owed_Index_2026-08-22.md`.** Adds §AD1–§AD6.

**Basis:** `origin/main` at `74e18e80d7e40b497851a60adb30d7e3bd6d979c`, 2026-09-01.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Records one disposition and two findings.** Mints nothing. Ships no code.
**No canon read was performed. No AWS call was made. No host was contacted.**
Prod **FROZEN**.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     53
grep -r  'XK-4'  docs/audit/ | wc -l     31
grep -r  'PE #69' docs/audit/ | wc -l    31
Owed Index chain tail (pre-Amd28)        v25_Owed_Index_Amd27_2026-09-01.md
```

**Amd27 predicted 53 / 31 / 31. All three read as predicted.**

**Note on the three instruments, carried because it is still live.** The first is
counted with `grep -o` (occurrences); the second and third with `grep -r | wc -l`
(matching lines). **They are not the same unit.**

**This amendment's own contribution, measured after the text was final: +1 to
each** — from the tails block above, its only mentions. **A successor re-deriving
once this lands should read 54 / 32 / 32.**

**Exclusivity, measured immediately before this number was taken.** Zero open
mergeable pull requests; no `Amd28` or higher on any of 168 remote tips. **This
is not a proof of exclusivity** — Amd26 §AB4.4's limit is unchanged.

---

# §AD1. Standing

| Item | Standing | Who can check it |
| --- | --- | --- |
| §AD2, §AD2.1 — the disposition and its reason | **RECORDED**, on Evoni's ruling | n/a — a ruling, not a measurement |
| §AD2.2, §AD2.3 — the non-canon read and what it established | **ATTESTED** by the drafting session, **corroborated by the operator** | the operator; output on their workstation, not in the repository |
| §AD3 — Sec 2.5's conclusion outruns its evidence | **MEASURED** on `origin/main` at this basis | **anyone with the repository** |
| §AD4 — §R1.1 established reachability, never authentication | **MEASURED** | **anyone with the repository** |
| §AD5 — the control run and what it demonstrated | **ATTESTED** by the drafting session, **corroborated by the operator** who ran it and pasted the output | the operator; the output file is on their workstation, not in the repository |

**§AD2.2 and §AD2.3 carry the SAME control run as §AD5, at the SAME standing.**
The row above exists because the values live under the disposition heading, where
a successor looking up item 8 will find them, and the disposition's own standing
label — *a ruling, not a measurement* — would otherwise discourage exactly the
scrutiny §AD2.2 was written to invite.

**§AD5 is attested, not measured, and is marked so.** The 45-line output exists on
the operator's workstation and in a session transcript. **The instrument it ran,
and every property claimed of that instrument, ARE on `main` and measured** —
which is the distinction Amd26 §AB1 draws and Amd27 §AC1 refined.

---

# §AD2. **DISPOSITION** — item 8 is NOT PERFORMED as a read of canon

`v25` Sec 6 item 8, on `main`, is four lines:

> **8. FD-66 infrastructure read.** Class: **one-time, Evoni-gated.**
> Has Evoni authorized/performed the deployed schema + provenance read? **If not,
> record NOT PERFORMED; do not infer from migrations.**
> *Overage: bears on Dimensions 4 and 5, neither of which can be scored without it.*

**AUTHORIZED: YES.** Evoni authorized the Addendum A/B read on 2026-09-01.

**PERFORMED: NO.** **RECORDED: NOT PERFORMED as a read of canon.**

**Dimensions 4 and 5 remain unscoreable.** That is a real cost and is not
mitigated by anything in this amendment.

## §AD2.1 The reason, which is the part not already on `main`

**The blocker is CREDENTIAL LOCATION.** It is not authorization — that was given.
It is not a failed identity gate — the gate was never reached against canon. It
is not the instrument — the instrument is frozen, filed, and demonstrated
working.

`F-Deploy-1_PROD_SplitBrain_HAZARD.md` Sec 2.5, verbatim:

> `aws secretsmanager list-secrets` returns nothing. The G2 contract's assumed
> `episode-metadata/dev/database` secret does not exist. Real creds live in on-box
> process env / on-disk `.env`. The dev-instance working password currently exists
> **only** in the running process's launched environment -- no on-disk file holds it
> (the on-disk `.env` carries the *prod* password).

**Both credentials are on the frozen prod box.** The `-dev` password exists only in
a running process's memory; the `-prod` password is in the on-disk `.env` on the
same box. **Reading `-prod` instead is not an alternative route — it is the same
host session.**

**`NOT PERFORMED` alone would read as "nobody got round to it." The reason makes
it "this cannot be done from the permitted route," which is a different claim and
the true one.**

## §AD2.2 What WAS performed, and what it is not — **ATTESTED**, corroborated by the operator

**Standing, stated here and not only in §AD1's table:** the values below come from
an output file on the operator's workstation, not from this repository. **They are
attested by the drafting session and corroborated by the operator who ran the
command and pasted the result. They are not measured and no reader of `main` can
check them.** The instrument that produced them is on `main` and is measured.

**A read was performed against a NON-CANON instance** and is recorded here so that
no successor mistakes it for the canon read:

```
0a-prime  database episode_metadata_test | server_addr 127.0.0.1
          client_addr 127.0.0.1 | server_port 5434
QUERY 3   5 rows, populated
```

**The gate FAILED on case (C1) — loopback convicts — which is correct.** Per
Addendum B as filed, under (C1) no filing of case (d) or case (e1) as a read of
CANON survives. **QUERY 3's populated rows are a fact about
`episode_metadata_test` on port 5434 and carry no canon evidence.** They are not
outcome (i) and not outcome (ii). **They are not compared against either in this
amendment and must not be.**

**The instance was selected by explicit libpq environment variables**
(`PGSERVICE` empty, confirmed in the originating shell), sourced from the
application's `.env`. Not a service file, not a profile, not a default.

## §AD2.3 What the run did establish — **ATTESTED**, same standing as §AD2.2

- **Windows psql `\ir` resolves**, single session, GUC persists, five sections in
  order, exit 0. Amd27 §AC6's measurable-but-unmeasured item is now measured.
- **The identity gate fired against a real mistake**, not a test: an instance
  holding the audit schema, reached under a filename asserting canon.
- **The instrument's read-only construction held.** `QUERY 0b` reported the
  session COULD write (`off | off`) and nothing did, because no statement in the
  include chain is capable of writing. Re-verified at this basis: **zero write
  verbs outside comments in Addendum A and Addendum B.**

**Neither safeguard was the thing under test when it fired.**

---

# §AD3. **MEASURED** — Sec 2.5's conclusion rests on a check of the store its own plan rejected

## §AD3.1 The evidence Sec 2.5 offers

**One command: `aws secretsmanager list-secrets`.** The token `ssm` and the phrase
`parameter store` do not appear anywhere in
`F-Deploy-1_PROD_SplitBrain_HAZARD.md`. Measured at this basis.

## §AD3.2 The store that was not checked

`F-Deploy-1_Canon_Credential_Durability_Plan_2026-06-12.md`:

```
:16   Store decision | AWS SSM Parameter Store, SecureString, KMS-encrypted, us-east-1
:50   Decision: SSM Parameter Store SecureString, NOT Secrets Manager
:67   Parameter name: /episode-metadata/canon/db_password
:18   Status | DRAFT -- scoping complete; awaiting review + commit.
             Execution (the single put-parameter) is a separate gated session.
```

**Sec 2.5 concluded exhaustion from a check of Secrets Manager, which this plan
explicitly declined at `:50` in favour of SSM Parameter Store. SSM HAS NOT BEEN
CHECKED.**

## §AD3.3 What this does and does not establish

**Does NOT establish that SSM holds the credential.** The plan is `DRAFT`, its
single `put-parameter` recorded as unexecuted, and at `:59-61` it states there was
no prior SSM usage in the tree as of 2026-06-12. **SSM is probably empty. Probably
is not measured, and that assertion is now approximately three months old.**

**Does establish that the register's conclusion outruns its evidence.** The claim
is *creds are on-box only*; the check covers one of at least three places.

```
1  SSM Parameter Store   NEVER CHECKED — the store the plan chose
2  §R1.1's route         reachability established, authentication never asked (§AD4)
3  Secrets Manager       checked, empty — the only one that was
```

## §AD3.4 The check that would answer it, and why not the obvious one

**The obvious check is defective in the way this register is currently cataloguing.**
`aws ssm get-parameter --name /episode-metadata/canon/db_password` fires on that
exact path not existing and would be read as *no SSM parameter holds the
credential*. It returns "absent" while the credential is present if the path
differs — the plan anticipates siblings at `:77` under the same root — if the
region differs, since SSM is region-scoped, or if `--with-decryption` lacks KMS
permission, which returns `AccessDenied` rather than absence.

**The check that answers the question does not need the name:**

```
aws ssm describe-parameters --region us-east-1
```

**Enumerates rather than probes**, needs no KMS decrypt, returns names and
metadata only. `--region` explicit because the plan pins `us-east-1` at `:16` and
a differing CLI default returns a clean empty answer to a different question.

## §AD3.5 It is NOT authorized and was NOT made

**No AWS call was made by any session in reaching this finding.** The route
finding records Evoni's scoping of the item 8 authorization at `:360-361`:

> **Authorization: CROSSED.** Evoni, in the message authorizing 1b:
> *"No AWS call, credential inspection, or endpoint probe is authorized."*

`describe-parameters` falls squarely inside that excluded class. **It is a change
to the item 8 authorization scope, not an action that merely fails to appear in a
prohibition list**, and §R3.6 exists because the one time an AWS-adjacent action
was taken inside this item without a ruling, it became a filed finding.

**Recorded as the cheapest available next step, requiring a scope ruling from
Evoni. Not urgent: item 8 is NOT PERFORMED in every branch, and this call changes
only which reason is recorded.**

---

# §AD4. **MEASURED** — §R1.1 established reachability and never addressed authentication

## §AD4.1 The measurement

`docs/audit/v25_Sec6_Item8_Route_Finding_2026-08-29.md`, 516 lines:

```
password      0
passwd        0
pgpass        0
authenticat   0
credential    8
```

**All eight `credential` hits are agent-facing** — prohibitions on what an agent
may inspect, disclaimers that no credential was involved, the session's own
credential-presence disclosure, and two citations to the credential durability and
rotation documents. **Not one asks whether the OPERATOR can authenticate.**

## §AD4.2 Why this is a gap and not an omission

**The document is acutely credential-aware, and that awareness points entirely at
the agent's constraints.** It cites the canon credential durability plan by name,
twice. It analysed the route as a purely network question anyway: the `/32`, the
security group, `PubliclyAccessible=True`.

**Reachability and authenticability are independent preconditions and only the
first was examined.** `Sec 2.4` records the prod instance as internet-open on
5432, which is the trap stated plainly: **reachable and unauthenticable look
identical from a distance, and §R1.1 measured the first.**

**A successor reading §R1.1 concludes the read is performable from the
workstation**, because §R1.1 says the route exists and does not say the credential
is elsewhere.

## §AD4.3 §R1.1 and this amendment are SEQUENTIAL, not conflicting

**Two documents on `main` now record item 8 NOT PERFORMED for different reasons,
which is the shape that makes a successor ask which governs. It is stated here so
they do not have to.**

- **The route finding** established that **no agent session** may use §R1.1, and
  left the operator's use of it open.
- **This amendment** establishes that **the operator cannot either**, because
  §R1.1 was never a claim about authentication.

**§AD4 NARROWS §R1.1. It does not replace it, correct it, or re-rate it.**
§R1.1's route analysis stands as filed and unamended; what is added is that the
route it established is **necessary and not sufficient.**

---

# §AD5. **ATTESTED** — the control run, and the two safeguards that fired unasked

**Standing: attested by the drafting session, corroborated by the operator.** The
output file is on the operator's workstation. **What is measured and on `main` is
the instrument**, its read-only construction, and the gate's readings.

**The control was designed to hit an empty throwaway instance and prove Windows
`\ir`. It hit a populated dev database instead**, selected by inherited
environment nobody had examined.

**It therefore produced the DANGEROUS shape rather than the harmless one** — a
well-formed five-row schema table that reads like the finding QUERY 3 exists to
detect — **and the gate held anyway.**

**A conversational pre-registration written before that run predicted five rows of
ZEROS and tied its rule to that prediction. The run returned populated rows, so
the sentence written in session described a case that did not occur.** The clause
that governed is on `main`, in Addendum B: it binds on the gate — *under (B),
(C1), (C3) or (D)* — and contains no reference to what QUERY 3 returned.

**That is Amd26 §AB2's argument demonstrated on the first run after filing.** A
reading that lives in a session can only cover the cases that session imagined. A
reading that lives in a committed object binds on the condition. **The committed
one held because the transcript one was wrong.**

---

# §AD6. What this amendment does not do

- **Does not close item 8.** It records the disposition item 8's own text
  instructs — `NOT PERFORMED` — with the reason. Whether item 8 as a register
  entry closes is Evoni's.
- **Does not score Dimensions 4 or 5.** They remain unscoreable.
- **Does not touch the 8-A/8-B split**, which Amd27 §AC3.5's search found
  undefined anywhere on `main`, all extensions.
- **Does not authorize, request, or make any AWS call.** §AD3.5 records
  `describe-parameters` as requiring a scope ruling from Evoni.
- **Does not authorize a host session**, a VPN, a bastion, an SSH tunnel, SSM
  port forwarding, or any contact with the frozen prod box. The `-dev` credential
  being hard to reach is the finding, not a problem to solve.
- **Does not select a canon endpoint.** Choosing between `episode-control-dev` and
  `episode-control-prod` partially answers the question item 8 exists to record,
  and is Evoni's.
- **Does not compare QUERY 3's control-run rows against outcome (i) or (ii).**
- **Does not correct, re-rate or place a banner on §R1.1**, the route finding, the
  split-brain hazard document, or the durability plan. §AD3 and §AD4 record that
  two conclusions outrun their evidence; they amend neither document.
- **Does not correct any predecessor.** Amd18 through Amd27 stand as filed.
  Amd26 §AB2's owed banners on Amd23 and Amd25 remain owed and unplaced.
- **Does not resolve `v25` Sec 6 item 5**, or close items 9, 11 or 13.
- **Does not mint.** No FD, XK, or PE number.
- **Does not rule its own push, PR create, or merge.** Three separate confirms.

---

*Type: chain amendment. One disposition, two measured findings, one attested and
marked so at §AD1. No canon read performed; no AWS call made; no host contacted.
Records no closure and no mint. Edits no file outside its own path. Prod FROZEN.*
