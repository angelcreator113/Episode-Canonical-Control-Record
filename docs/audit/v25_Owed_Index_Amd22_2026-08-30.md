| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 22** *The two outstanding reads were performed. §T2.2's mechanism is identified, §T2.4 resolves, and the ledger is shown not to record what is in the database — within one session. The first run was inadmissible; the defect was the instrument's.* |
| --- |

***Provenance:*** *route ruled by Evoni on 2026-08-30 — **chain amendment**. **Push and merge are NOT ruled and are not assumed.** Rule 7 gates the push, the PR create and the merge separately, for doc-only changes explicitly (`F-Deploy-1_Fix_Plan_v1.5.md:165`; `Fix_Plan_v1.2.md:106`; `Session_PE_Roster.md:2208-2209, 2309-2310`).*

***Citation note, stated because Amd21 §W3 got this wrong.*** *This amendment cites `EvidenceNote_Item8_Followup_Reads_Addendum_A_2026-08-30.sql`, which is **not on `main` at this amendment's basis**. It sits beside this file on the same branch and **arrives in the same merge**, so the citation resolves the moment this amendment exists on `main`. That is deliberate and is not the §W3 defect, which was an amendment freezing a hash of a file that existed nowhere and was never going to.*

# v25 Owed Index — Amendment 22

**FILED 2026-08-30 on Evoni's authorization.** **Merge to `main` UNRULED.**

**AMENDMENT 22 to `v25_Owed_Index_2026-08-22.md`.** Adds §X1–§X9.

**Basis:** `origin/main` at `169e41925733b85ca081623264763ac48992336c`, 2026-08-30.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**This amendment carries findings from a performed read.** Ships no code.
Prod **FROZEN**.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     43
grep -r  'XK-4'  docs/audit/ | wc -l     21
grep -r  'PE #69' docs/audit/ | wc -l    21
Session_PE_Roster.md highest entry       PE #68
Owed Index chain tail (pre-Amd22)        v25_Owed_Index_Amd21_2026-08-30.md
```

**Movement since Amd21's basis (`af0d40ac`, which read 41 / 19 / 19) attributed
rather than asserted: `+2 / +2 / +2` = Amd21 itself, as Amd21 predicted.**
**Addendum A contributes 0 / 0 / 0, measured.**

**Note on the two instruments, carried because it is still live.** `FD-70` is
counted with `grep -o` (occurrences); `XK-4` and `PE #69` with
`grep -r | wc -l` (matching lines). **They are not the same unit.**

**This amendment's own contribution, measured after the text was final: +2 to
each of the three instruments** — from the block above and this note, its only
mentions. **A successor re-deriving once this lands should read 45 / 23 / 23.**
**The three tokens must appear in this file exactly twice each, in those two
places and nowhere else, prose or quoted;** refer to them collectively and
**re-measure after writing rather than before.**

---

# §X1. The first run was INADMISSIBLE. The defect was the instrument's.

**Recorded first because it is the author's error and because the rule it
tripped was the author's own.**

The frozen instrument's `QUERY 0` was written as a bare `transaction_read_only`
reference. **That is a GUC, not a column.** The statement errored:

```
ERROR: column "transaction_read_only" does not exist
```

**Identity and posture shared one `SELECT`.** So the error took
`current_database()` and `inet_server_addr()` down with it. **The gate did not
merely fail — it destroyed the identity evidence it existed to capture**, in the
one run it was written for.

**Under the frozen instrument's own pre-registered rule the first run was NOT
ADMISSIBLE as a read of canon**, whatever `QUERY 1` and `QUERY 2` returned. That
rule was applied rather than waived.

**The instrument's frozen hash is unchanged.**
`EvidenceNote_Item8_Followup_Reads_Instrument_2026-08-30.sql`,
`sha256 dbdadcc5272640f4811da17f4910e7856cd12510b325ae95251f9dbfacb7ec3b`,
170 lines. **The correction was filed as a dated addendum citing that hash, not
as an edit to the frozen body** — Addendum A,
`sha256 fe55aa55d878720fab35340fef4a56816796dccdf848cc19ca12945c1972eb50`,
102 lines. Addendum A fixes the gate to `current_setting(...)`, **splits identity
into its own statement so no single failure can take the rest with it**, and adds
`QUERY 3`.

---

# §X2. The re-run is ADMISSIBLE

```
database      episode_metadata
server_addr   10.0.20.224
server_port   5432
read_only     on            current_user  postgres
```

**Identity recorded, posture recorded separately.** All findings below come from
that session.

---

# §X3. **§T2.2's mechanism is IDENTIFIED**

`20260721000000-create-ui-overlay-types` is present in `SequelizeMeta`, with
everything through `20260807000000`.

**Post-January schema reached this database through Sequelize migrations
recorded in `SequelizeMeta` — not through the `pgmigrations` ledger that stops
at 2026-01-22.** Both ledgers exist on the same database and **record different
eras and different systems.** Amd18 §T2.2 recorded this path as unidentified;
**it is now identified, and §T2.2's open question on that point closes.**

**The second witness holds.** `20260719000000-career-pipeline-links` is in the
ledger, and all six of its columns are on the database.

---

# §X4. **The ledger does not record what is in the database** — single-session

**The finding, and the one that matters.** Three tables, all from the one
session at §X2, no inference across sources:

| `SequelizeMeta` records applied | The migration creates | That session saw |
| --- | --- | --- |
| `20240101000003-create-thumbnails` | `thumbnails` with `episodeId`, `s3Bucket`, `s3Key`, `fileSizeBytes`, `mimeType` | `thumbnails` with `episode_id`, `s3_bucket`, `s3_key`, `file_size_bytes`, `mime_type` — **zero camelCase** |
| `20240101000004-create-processing-queue` | `processing_queues` | `processing_queue`; **no plural** |
| `20260208110001-create-decision-logs-table` | `decision_logs` | **no such table** |

**This is the frozen instrument's case (d), and it fired as a CONTRADICTION, not
a confirmation** — which is what the pre-registration named it, in advance,
precisely because it was the outcome most likely to be read as agreement.

**Case (e1) fires; case (e2) does not.** `20260208110001` is in the ledger and
`decision_logs` is absent. **Case (e0) closes the escape:** that migration's own
`down()` is `dropTable`, which would remove both the table and its ledger row, so
**a clean rollback cannot produce this state.** Either the table was dropped
outside the migration system, or the row was written without the effect landing.

**`20260818000000-add-deleted-at-to-decision-logs` is absent from the ledger.**
**The §7.1.1 pilot was never applied.** Its status is unchanged, not complicated.

**Consequence.** **`SequelizeMeta` cannot be relied on as a record of what this
database contains.** FD-66 §7.1 steps 2–3 call for a baseline; **a baseline
cannot be built against a ledger that does not record what is there.**

---

# §X5. **§T2.4 resolves to the low branch**

```
decision_log              0 rows
character_state           3    newest 2026-02-18
career_goals             22    newest 2026-02-18
character_state_history  36    newest 2026-02-20
world_events             53    newest 2026-04-02
```

**`decision_log` is empty.** Under the pre-registered reading that is a
**tidy-up**, and FD-66 §7.1.1's pilot becomes a low-stakes create-or-rename
decision rather than a data problem.

**Every newest row predates F-App-1's removal** (`6bfd99e2`, 2026-05-14).
**There is no live write path to any of the five.** The larger finding the
pre-registration named as possible **did not occur.**

**`reltuples = -1` on four tables** means they have never been analyzed. Worth
knowing; **not a finding.**

---

# §X6. Two limits, and the first is the cross-source leg failing

**§X6.1 — the capture's relationship to this session is UNESTABLISHED.**

**It is tempting to say the 2026-08-29 capture and this session read the same
instance, because the address matches what the register believes canon to be.
That inference does not hold, and it was pre-registered as the thing to watch.**

**Measured:** `EvidenceNote_Canon_Schema_Capture_2026-08-29.txt` and
`EvidenceNote_Canon_pgmigrations_2026-08-29.txt` contain **zero** identity
values — no `current_database()`, no `inet_server_addr()`, no address. They are
bare result sets. **The address `10.0.20.224` appears in the register in older
F-Deploy documents, not in the capture.** Matching this session's address
against the register's prior belief is **a cross-source inference of exactly the
kind `QUERY 3` was added to eliminate**, and the register carries the
`100.50.2.212` / `10.0.20.224` identity question **OPEN**.

**So: the §X4 contradiction is established WITHIN the §X2 session. The
capture's relationship to that session is unestablished.** What this costs is
the corroboration — capture and live agreeing column-for-column on
`decision_log` (11), `processing_queue` (6) and `thumbnails` (19) **is agreement
between two reads whose sameness is assumed rather than shown.** Suggestive, not
evidential.

**§X4 does not depend on it.** `QUERY 3` was added for this reason and did its
job.

**The asymmetry, which is the part that bears on §T2–§T4.** The frozen
instrument's rule is that a run without its gate in the output is not admissible
as a read of canon, whatever else it returned. **Applied to the 2026-08-29
capture, the capture does not meet that standard.**

**Measured, and stated exactly, because a successor greps.** Amd18 contains
**zero** occurrences of `episode_metadata`, `inet_server_addr` or
`current_database`. It contains **two** occurrences of `10.0.20.224` — at
lines 397 and 474 — and **both carry the identity question OPEN** rather than
settling it.

> **Amd18 names the address only to carry its identity question open, and never
> records which database answered the read that §T2–§T4 rest on. The instance
> for that read exists nowhere in the register.**

**That is stronger than an omission.** §T1 establishes the **ROUTE** — the
operator's workstation, no agent session touching the instance — and the
**POSTURE**. **The register was already careful about the address, and still
ended up resting findings on a read whose provenance it does not record.** The
address attached to that capture exists only in an operator statement made in
conversation, which never entered the register.

**This is not a reason to discard the capture.** Attestation is what the
register has for that read, and Amd18 §T1 says on its face that the operator ran
the query. **It is a reason to state the standard difference plainly: the
2026-08-30 run was held to a stricter identity standard than the read §T2–§T4
rest on.** **A successor relying on §T2–§T4 should know that those findings'
instance is unnamed on `main`**, and that §X4's is not.

**Recorded because the opposite was asserted one turn earlier** — that the
capture "recorded `10.0.20.224`" — **by reading an operator statement made in
conversation as a property of the artifact.** That is §X8.2's failure exactly:
a diff run against the nearest available text rather than against the artifact
the claim was about.

**Attribution, stated because this document got it wrong first.** That claim was
made by **the reviewing party, not this document's drafting author**, and was
withdrawn by them on being challenged. **An earlier revision of this section
credited it to the drafting author** — a misattribution running in the
self-flattering direction, which is the worse direction, corrected here before
merge rather than after.

**The count, with its members named so it is not recomputed differently.**
**This is the SECOND operand failure, and the first after the clause naming it
was written.** The set is: (1) diffing an authored message against a record of
it and reporting the result as a finding about a *document* that was never
read; (2) this one. **The trailer and the shallow-clone cases are NOT members**
— those were one-sided measurements under §V2, where the check never reached a
second side at all. **An operand failure is a complete two-sided diff run
against the wrong second side**, which is a different shape and was identified
as new when the clause was written. **Counting the §V2 cases here would give
four and would blur the distinction the clause exists to draw.**

**§X6.3 — the failure modes are DISJOINT, and that is why the second party
worked.** With members verified and authors attached:

| Shape | Members | Author |
| --- | --- | --- |
| **Operand failure** — a complete two-sided diff run against the wrong second side | the §W3 correction attempt; the capture-address claim at §X6.1 | **both the reviewing party's** |
| **§V2 one-sided measurement** — a correct check that never reached a second side | the trailer claim; the shallow-clone claim | **both the drafting author's** |
| **Neither, cleanly** | Amd19 §U2's Path B attribution | **JOINTLY OWNED — see below** |

**Members are listed rather than counted, deliberately. A count of three would
hide that one of them is contested.**

**Why §U2 is not in the second row.** **It was ruled joint, and unsplittable, at
the time it was found.** The attribution originated in the reviewing party's
reading of the capture; it was drafted and merged by this document's author; and
neither caught it. The distinction then accepted stands: ***"the author did not
check"* and *"two readers did not check"* are different failures with different
fixes**, and both were true. **A single-owner column destroys that, which is the
whole finding in that case.**

**And it bundles two errors.** **Reading FD-66 §7.1's list as complete** is the
one-sided measurement. **Inferring Path B provenance from a list of literals** is
a different mistake — an unsupported inference, not an incomplete read. **Only
the first belongs in a §V2 column at all.** **Amd20 §V2's own table bundles them
the same way** — its claim column states the inference while its measured column
states the read. **That is merged text and is not amended here; it is recorded
so a successor reading §V2's third row knows what it contains.**

**Neither party caught their own. Each caught the other's, every time.** **Two
and two is still disjoint, and the mechanism below does not depend on the
contested member.**

**This is a mechanism for Amd21 §W2, not a restatement of it.** *"A second party
helps"* is satisfiable by a second reader with the same habits, and would not
have helped here. **What the record shows is that the second party worked
BECAUSE THE FAILURE MODES DID NOT OVERLAP** — the shallow clone was invisible to
the drafting author and obvious to the reviewer; the address provenance was
invisible to the reviewer and obvious to the drafting author.

**It is deliberately NOT filed as a rule.** **Nobody chooses their reader's
failure modes**, so it changes what no one does, and the test Amd21's §W-series
was brought under rejects additions on exactly that ground. **It is recorded as
an observation about why the precondition holds, and it is checkable: the
membership lists above are on `main`, with authors attached.**

**One caution against reading it too confidently, and it has now fired three
times.** **Two readers produced OPPOSITE attributions of these same events**, in
the exchange that established attribution mattered — each assigning the other's
shape to themselves. **Then an earlier revision of this very section entered the
jointly-ruled §U2 member as single-owner**, in the section warning that
attribution goes wrong.

**That is the third instance of a guard failing inside the document that states
it** — after Amd18 §T6.2's guard failing its own author, and the item 8 route
finding's grep warning becoming the grep target. **It strengthens the caution
rather than undermining the table: the distribution above is the one that
survived checking the text, and is not the one either party reported from
memory.**

**§X6.2 — `QUERY 3`'s reading was not pre-registered.** The frozen instrument
covers `QUERY 0`, `1` and `2`. **`QUERY 3` and its readings were written in
Addendum A after the first run**, and Addendum A carries no freeze. **The
contradiction it confirms was predicted in advance from the capture**, so this is
not fitting after the fact — **but the distinction is real and is recorded rather
than elided.**

---

# §X7. Two findings held open, not folded in

**§X7.1 — the `thumbnails` column order, as HYPOTHESIS not conclusion.**

```
id episode_id url size_bytes created_at updated_at | thumbnail_type s3_bucket
s3_key file_size_bytes width height position_seconds generated_at quality_rating
mime_type width_pixels height_pixels format
```

The table carries **duplicate-purpose pairs** — `size_bytes` and
`file_size_bytes`, `width`/`height` and `width_pixels`/`height_pixels`. Read with
the column order that looks like an **original table of six**, with the
migration's *intent* appended later in snake_case.

**On that reading the migration's content reached the database and its naming did
not** — something applied its columns with `underscored` semantics rather than the
file's camelCase. **This is a hypothesis with specific evidence, not a
conclusion.** It is a better account than *"the migration ran,"* which the naming
rules out. **Not resolved here.**

**§X7.2 — migration re-dating and timestamp collisions.** Of the nine ledger
entries with no same-named file in the tree, **six are re-dated, not absent**:

```
20260315000000 -> 20260615000000      20260320000000 -> 20260625000000
20260315100000 -> 20260615120000      20260307140000 -> 20260307210000
20260208000000 -> 20260208000002      20260710000000 -> 20260323000000
```

**Three are genuinely absent under any name**:
`create-episode-orchestration-tables`, `create-story-calendar-system`,
`add-base-still-url`.

**Re-dating has produced collisions**: `20260625000000` and `20260307210000` each
carry **two** files. **A database that ran these under the old names will run
them again under the new ones.** **This is a separate finding from §X4 and is
recorded, not folded into it.**

---

# §X8. Two method clauses, held for this amendment when they were raised

**Both were ruled on 2026-08-30 to ride here rather than be filed alone.
Recorded now because this is that amendment.**

**§X8.1 — Amd21 §W2's scope limit, stated positively.** §W2 says a solo
successor can follow every rule in good faith and satisfy none. **Its scope
limit is stated only negatively**, and a cautious reader could take it as a bar
on proceeding. **It is not.**

> **A solo successor MAY perform the reads, run the greps, and file findings.
> What they MAY NOT do is record any of it as checked.** **The rules govern what
> may be CLAIMED, not what may be DONE.** *"Satisfy none of them"* describes the
> standing of the claims, not a prohibition on the work.

**§X8.2 — Amd21 §W1's operand.** §W1 says *restate independently and diff*.
**It does not say what to diff against**, and a diff run against the nearest
restating text returns a real result about the wrong thing — which reads as a
finding.

> **§W1's diff must be run against the ARTIFACT THE CLAIM IS ABOUT**, not
> against the nearest text restating it.

**Neither amends Amd21.** §W2 and §W1 stand as filed; these state a scope and an
operand those sections left implicit.

---

# §X9. What this amendment does not do

- **Does not close `v25` Sec 6 item 8.** The reads are discharged; **the
  disposition remains OPEN and Evoni-gated.** **Nothing here closes it.**
- **Does not close items 9, 11 or 13**, the 8-A/8-B split, or the
  `100.50.2.212` / `10.0.20.224` identity question — **which §X6.1 relies on
  being open and does not resolve.**
- **Does not reopen §H4**, CLOSED unperformed and, per Amd18 §T6.3, permanently
  so for this authorship line. **This amendment is not the missing check.**
- **Does not resolve §X7.1 or §X7.2**, both held open by design.
- **Does not assert that the 2026-08-29 capture and the §X2 session read the
  same instance.** See §X6.1.
- **Does not amend the frozen instrument.** Its hash stands; the correction is
  an addendum.
- **Does not amend `v25` Sec 6's item count.** Fifteen entries stand.
- **Does not mint.** No FD, XK, or PE number.
- **Does not rule its own push or merge.**
- **Does not authorize a host session, an AWS call, a VPN, a bastion, an SSH
  tunnel, or SSM port forwarding.** **The reads were performed by the operator
  at the workstation. No agent session contacted the database at any point.**

---

*Type: findings amendment. Records one inadmissible run and one admissible one,
identifies §T2.2's mechanism, establishes a single-session ledger contradiction,
resolves §T2.4, holds two findings open, and carries two method clauses held for
it. Records no closure of any `v25`
Sec 6 item. Edits no file outside `docs/audit/`. No host, AWS, database, or
Cognito contact by any agent session. Prod FROZEN.*
