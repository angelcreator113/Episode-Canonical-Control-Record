| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 11** *Two wrong figures in an operational header, derived against the full run history and left for a separate decision to apply. Three reads Amendment 10 recorded NOT PERFORMED, performed — and the reason it recorded for them, corrected.* |
| --- |

# v25 Owed Index — Amendment 11

**AMENDMENT 11 to `v25_Owed_Index_2026-08-22.md`.** Six items. Adds §K0–§K6.

**Basis:** `origin/main` at
`54d163bdeabcb4b5daddeb6a7eebe65924551e87`, 2026-08-28.
`v25_Owed_Index_Amd10_2026-08-27.md` measured at §K6, after this commit's
banner is placed, not before.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Rules nothing about any finding. Mints nothing.** Ships no code. Changes no
gate, severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; **ASSESSMENT NOT COMPLETED**. FD tail **FD-69** (retired at #1102),
**FD-70 next-available and unminted**; XK tail **XK-3**; PE tail **PE #68**.
Prod **FROZEN**.

**On the PE tail.** This document's reads were performed at `54d163bd`, where
the tail is **PE #67**. **`PE #68` is minted by the commit preceding this one in
the filing sequence**, appending to `Session_PE_Roster.md` and moving that file's
blob from `89ef077e7382164de9892dc91b9b752fd023515b`. **The tail on this face is
stated as of filing, not as of the derivation basis**, because a tail is the
value most likely to be read out of a document and carried elsewhere, and
*"correct at its stated basis"* is the defence §K1.3.2 records this register
declining to accept. **This document mints nothing; PE #68 is minted by its own
commit.**

---

# §K0. Why this amendment exists

**Its first item records two wrong figures in operational text that no register
document addresses, carried into this session from a prior conversation by
hand.**

`.github/workflows/deploy-production.yml`'s header block is not a register
document. Nothing in `docs/audit/` cites it, no banner governs it, and no sweep
has ever swept it. **It is nevertheless the text a person re-enabling production
deployment reads first**, and two of its figures were wrong.

The correction existed only in a prior conversation's working memory. **It was
recorded nowhere on `main` — by decision, not by omission** — and would have
been lost with the session. **§K1 files the derivation. It does not edit the
file**, and the header carries no citation to this document — see §K1.3 and
§K6.

**Its second group is three reads Amendment 10 recorded NOT PERFORMED, together
with a correction to the reason it recorded.** §J6 records `api.github.com`
returning HTTP 403 with `core: 0/60`. This session reached the same data through
an authenticated capability, and **the reads are performed here.**

**The dispositions are discharged, not contradicted** — an instrument
unavailable to one session and available to another discharges an omission; it
does not make the omission an error. **The stated cause is a different matter
and is corrected at §K2.4:** the 403 was per-request, not per-session, and the
reads were available on retry throughout. **§J6 is wrong about why, not about
what.**

---

# §K1. `.github/workflows/deploy-production.yml` header — two wrong figures

**The block is headed "READ BEFORE RE-ENABLING OR RUNNING THIS WORKFLOW".**
Verified live at this basis before any edit, blob
`2af62603cc58e3b6a638b1e26c65f249df256f65`, lines 1–29.

## §K1.1 Bullet 1 — the last successful run

**Filed text:** *"The last successful run of this workflow was 2026-05-09."*

**2026-05-09 is a successful run. It is not the last one.** Four successful
runs postdate it:

| run # | conclusion | `run_started_at` | run id |
|---:|---|---|---|
| 67 | success | `2026-05-09T23:01:59Z` | `25614031858` |
| 70 | success | `2026-05-10T12:29:11Z` | `25628747381` |
| 71 | success | `2026-05-10T22:51:55Z` | `25641992216` |
| 74 | success | `2026-05-11T00:10:59Z` | `25643628535` |
| **75** | **success** | **`2026-05-11T13:09:45Z`** | **`25672174389`** |

**Run #75 is the last successful run of this workflow.** Run #76
(`2026-05-16T06:49:59Z`, failure) is the last run of any conclusion; there has
been none since.

**Independently re-derived through a different channel.** The drafting party of
Amendment 10 re-ran the population against `api.github.com` **anonymously, with
a retry loop**, and returned **76 of 76, 76 distinct run numbers**, the same
five successes, the same last success at `2026-05-11T13:09:45Z`, and the same
single `(actor, id)` pair. **This session's read used an authenticated
proxy-injected channel at 15000/hr; theirs used the anonymous per-IP budget.**
**Two channels with different credentials, different clients and different
failure modes returned the same population.** That is stronger than the
agreement Amendment 10 §J1.2 warns about, where both parties reached a table
through a chosen window of the same instrument — **but the bound is what carries
the claim, and the bound is the total, in both derivations.**

**Bound.** The read covers **all 76 runs**, not a window. `total_count` for
workflow `224506683` is 76; the listing returned 30 + 30 + 16 across three
pages, `run_number` 76 down to 1, contiguous. **`per_page: 100` was not
honoured and the first page returned 30** — had the page been taken for the
population, the tail would have been read as complete at run #47 and every
figure here would still have looked derived.

## §K1.2 Bullet 2 — "six weeks" follows from neither anchor

**Filed text:** *"Files on the box are dated 2026-06-27, six weeks after that
last successful run."*

| anchor | to 2026-06-27 | in weeks |
|---|---:|---|
| 2026-05-09 (the header's own) | 49 days | **exactly 7w** |
| 2026-05-11 (the true last success) | 47 days | **6w5d** |

**"Six weeks" is 42 days, which lands on 2026-06-20 from the first anchor and
2026-06-22 from the second. It follows from neither.** The figure is not a
rounding of either interval in the direction rounding would take it: from the
header's own anchor the true interval is *seven* weeks, and the filed figure
rounds away from it.

## §K1.3 What this amendment establishes, what it proposes, and what is untouched

**Established here:** both figures are wrong, on the derivations at §K1.1 and
§K1.2. **This amendment does not edit the file.** Correcting operational text
that gates an unfreeze decision is a separate decision from recording that it
is wrong, **and this document is only the second.**

**Proposed, not applied.** Against blob
`2af62603cc58e3b6a638b1e26c65f249df256f65`, lines 13–20:

> ```
> #   * PRODUCTION IS ROUGHLY THREE MONTHS BEHIND main. The last successful run
> #     of this workflow was 2026-05-11 (run #75, 2026-05-11T13:09:45Z). Running
> #     it now is a large change, not a routine deploy, and production is under
> #     freeze.
> #
> #   * THE CODE ON PRODUCTION DID NOT COME FROM THIS WORKFLOW. Files on the box
> #     are dated 2026-06-27, six weeks and five days after that last successful
> #     run. What wrote them is NOT ESTABLISHED. Anything reasoning from "the
> #     deployed SHA" is reasoning about this record, not about the box.
> ```

**Comment-only; `on:`, `permissions:` and `jobs:` unchanged. No citation to this
document is added to the block** — see §K6.

**The proposal is anchored to the blob it quotes.** If
`.github/workflows/deploy-production.yml` moves by any other route, **the
quoted text is stale and must be re-derived against the new blob** rather than
applied.

### §K1.3.1 This is the corpus's first proposal aimed outside `docs/audit/`

**Disclosed because it is a first use, not because it is doubtful.**

Amendment 10 §J3 and §J4 propose replacement text for **`v26`'s Sec 6** — a
future register document, inside the corpus, under the same conventions the
proposing document obeys. **§K1.3 proposes text for a workflow file: an
operational artefact outside `docs/audit/`, with no family maximum, no banner
convention, and no supersede mechanism.** No prior instance exists in this
corpus.

**Recorded deliberately, in the form the filename entries use for §C3's
defect.** A silent first use is how a convention gets minted by usage, which is
the move this register has declined at §J1.1 and at Amendment 9 §I4. **This
amendment mints no convention and asserts none; it discloses that it is the
first of a shape a successor may find has become one.**

### §K1.3.2 Two pre-filing defects in this document, and they are not the same shape

**Disclosed in the form Amendment 10 §J1.2 and §J2.2 use for their own
pre-filing errors.**

**First — the assert-form.** An earlier draft of §K1.3 asserted the correction
as applied. It was written alongside a sibling commit carrying the edit, and
**it asserted an effect this document does not produce.** Two separate decisions
land as two separate commits, so **there is a guaranteed interval in which the
assert-form is false on `main`.** The assert-form and the decision separation
cannot both hold.

**Second — a withdrawal whose consequences were not propagated.** An earlier
draft placed a provenance line in the workflow header's foot. **That line was
withdrawn.** Four statements elsewhere in this document had been written to
depend on it:

| location | statement | status after the withdrawal |
|---|---|---|
| §K0 | *"the header now cites this document"* | **false** |
| §K6 | *"the **edited** file's exclusion…"* | false |
| type line | *"One comment-only **edit to a workflow file**"* | false |
| Amd10 pointer banner | *"files a correction **to** the header"* | misleading |

**§K0's was false independently of merge order** — not contingent on any
decision, not a hedge against an ordering. **It was correct when written and
became false when something else was removed.**

**The two defects are not the same shape and this section does not merge them.**
Every instrument failure catalogued in Amendments 9, 10 and this one — chosen
windows, singular patterns against plural text, glob-vs-literal paths, a denial
parsed as data, a quoted block compared against a diff's added lines — is a
**read whose scope fell short of the claim built on it.** Nothing was
mis-measured here. **A change was withdrawn and its dependents elsewhere were
not revisited**, and the residue read as current because nothing adjacent
disagreed.

**`Prime_Studios_Audit_Handoff_v25.md` Sec 4.2 records the reading half** — an
inconsistently-stale document is harder to catch than a stale one. **This is an
instance on the writing side of the same object.** No prior instance is known to
this document.

**Recorded, not named, and not generalised.** **Whether this constitutes a
distinct family, and whether it warrants a rule, are not decided here** — the
treatment Amendment 10 §J1.1 gave its third instance and Amendment 9 §I4 gave
its own. This document mints no category by usage.

**The count is not asserted, because it inherits Amendment 9 §I4's undefined
term.**

- **In filed text on `main`: `n = 1`** — §K0's, above.
- **Including pre-filing drafting: `n = 2`.** A second is reported by the
  drafting party: moving Amendment 9's pointer banner from above the masthead to
  below it left Amendment 10 §J6's blob assertion stale, and it was re-measured
  only because the change was immediate and that sentence was already being
  touched.

**Which count is right turns on what "filed" means, and Amendment 9 §I4 records
that no definition of the term appears anywhere in the corpus.** §I4 declined to
choose, counted its own class under neither, and warned that **selecting the
reading that makes a count higher is the move
`v26_Draft_Material_Attention_2026-08-27.md` withdrew four generalisations for.**
**The same restraint applies here and the reading is not chosen.**

**The second instance is unfiled and VERIFIED. Its artefact is derived here; its
position in the drafting order is not.**

**Derived.** The superseded commit `0253081d` was supplied as a patch against
`4acc6231` — **verified an ancestor of `origin/main` by
`git merge-base --is-ancestor`** — applied into a clean worktree at that base,
and the resulting files hashed **from their bytes**:

| file | computed | claimed | |
|---|---|---|---|
| `v25_Owed_Index_Amd9_2026-08-27.md` | `67d82dcc7ee4a91e72685192d0febd175e22eea1` | same | **MATCH** |
| `v25_Owed_Index_Amd10_2026-08-27.md` | `a5a8bb2410967e259d9891c59917dd743dbbe4dd` | same | **MATCH** |

**A blob's SHA-1 is a function of its bytes, so neither container trusted the
other's object store.**

**Both halves of the instance are present in that state.** Amendment 9 carries
the pointer banner at **lines 1–2, above the masthead**, which is displaced to
line 23. Amendment 10 `:368–370` asserts *"moves Amendment 9's blob …
`503a3c29…` → `67d82dcc…`"*. **The assertion is true of that state.** On `main`
Amendment 9 is `4ab1faa5…` and §J6 reads that value, correctly. **The banner
then moved, and the assertion would have become false in place had it not been
re-measured.**

**Attributed, and not derivable from the artefact.** That `0253081d` preceded
`3ec93ca0` **as an amend of the same drafting line**, rather than as an
independent branch or a later reconstruction, rests on a reflog. **A reflog is
local-only and cannot be shipped.** The patch carries two blobs and a commit; it
does not carry its own position in a drafting order.

**The split matters and is not pedantry.** **Two blobs and a commit are
consistent with many histories.** What makes this an instance of the mechanism —
a change made and a dependent elsewhere left unrevisited — **is the sequence,
and the sequence is the half that remains on the drafting party's account.**
**The evidence half is closed. The mechanism half is attributed.**

**An earlier draft of this section called the instance unverifiable, on the
ground that `67d82dcc…` occurs nowhere in `docs/audit/` on `main`.** That
negative is true and it does not support the conclusion. **`main` cannot contain
a pre-filing draft state by construction**, so the search space excluded the
object by definition rather than failing to find it. **The instrument answered a
question adjacent to the one asked** — `v25` Sec 4.3's shape — **and returned the
answer that fitted the conclusion already reached.** Corrected.

**The verification path is content-addressing and is open from either
container.** A blob's SHA-1 is a function of its bytes: **producing the content
and hashing it settles the question without either party trusting the other's
object store.** Until that is done here, the instance is **recorded on the
drafting party's account**, and a count resting on it is not yet a derived count
**in this document** — a statement about this document's reach, not about the
instance's existence.

**This is why the instance is a sharper example than a filed one would be.** A
state that reached a branch, was superseded, and never reached `main` is
**precisely the case the word "filed" would have to adjudicate.** §I4 could
state that no definition exists; **this supplies an artefact the definition would
have to rule on.**

**Both figures are basis-dependent in §I4's sense** and neither is a fixed
property of the corpus.

**Both defects were found by sweeping this document for the shape rather than
for the specific error**, after two claims in one session had been wrong about
where a claim's scope ended. **The narrower hypothesis would not have reached
§K0.** All corrected before filing.

**The freeze is untouched.** Each of the block's three standing grounds is
independent of both figures:

- **"Roughly three months behind `main`"** measures production against `main`,
  not against a run date. Unaffected in either direction.
- **"What wrote them is NOT ESTABLISHED"** is the bullet's operative claim. It
  turns on the files not having come from this workflow, **which the correction
  strengthens**: the gap is real under either anchor.
- **Port 22 / SSH scoping** shares no term with either figure.

**No gate, finding, severity, owner, or disposition moves. Prod remains
FROZEN.** **Nothing in this amendment changes the file**, and the correction
being unapplied leaves the block wrong in the two figures named and correct in
everything that bears on the freeze.

---

# §K2. `v25` Sec 6 items 1(c), 7, and 13's API half — performed

**Amendment 10 §J6 records all three NOT PERFORMED**, with the reason stated:
*"`api.github.com` returned HTTP 403 with `core: 0/60`, reset
`2026-08-27T23:49:35Z`."* **That entry is correct at its basis and is not an
error.** This session held an authenticated capability that the anonymous
per-IP limit does not govern.

**Method stated inline, per item 1(c)'s requirement:** GitHub MCP server,
tools `list_pull_requests` and `actions_list`. Every call returned a result
object, not an error body. **No result here is a parse of a denial.**

## §K2.1 Item 1(c) — open pull requests

**Zero.** `list_pull_requests`, `state: open`, `perPage: 100` — empty array
returned. **This is a negative existence claim from a successful read**, not a
blocked read recorded as absence.

## §K2.2 Item 7 — workflows enumerated from the API

**Five. `total_count: 5`.** Enumerated, not read from a fixed list of names.

| workflow | path | state | `on:` trigger, read separately |
|---|---|---|---|
| Deploy to Development | `.github/workflows/deploy-dev.yml` | `active` | `workflow_dispatch` **only** |
| Copilot cloud agent | `dynamic/copilot-swe-agent/copilot` | `active` | **no file in tree; not derivable** |
| Validate | `.github/workflows/validate.yml` | `active` | `pull_request` + `push` on `[main, dev]`, `workflow_dispatch` |
| Deploy to Production | `.github/workflows/deploy-production.yml` | **`disabled_manually`** | `workflow_dispatch` only, two required inputs |
| Auto-merge to Dev | `.github/workflows/auto-merge-to-dev.yml` | **`disabled_manually`** | `push` on `claude/**` |

**`dynamic/copilot-swe-agent/copilot` confirmed absent from the tree** by
`git cat-file -e origin/main:dynamic/copilot-swe-agent/copilot` — a literal
path, not a glob. **Item 7's finding holds: a YAML-first enumeration finds four
of five and reports the enumeration complete.**

**Workflow-level state does not give the trigger, and here the two dissociate
in both directions.** `auto-merge-to-dev.yml` is the only workflow in the
repository with an automatic `push` trigger, and it is disabled. `deploy-dev.yml`
is active and cannot fire without a human. **v25 Sec 1's "push trigger absent"
for the dev path is confirmed at this basis.**

## §K2.3 Item 13 — the Actions half of the freeze, derived

**Derived, and it holds at this basis:**

- `deploy-production.yml` is `disabled_manually`. Its only trigger is
  `workflow_dispatch`, which a disabled workflow does not serve.
- **No `push`, `schedule`, `workflow_run`, or `repository_dispatch` trigger
  reaches it.** It cannot fire automatically even if re-enabled.
- **Its last run of any conclusion is run #76, `2026-05-16T06:49:59Z`.** The
  workflow's `updated_at` is `2026-06-02T17:51:16-04:00`, consistent with the
  manual disable postdating the last run.

**The residue is NOT DERIVABLE and is recorded as such, not as closure.** SSM,
SSH, and console access reach production by paths no repository or Actions read
observes. **v25 item 13's split stands: this is a derived Actions-path closure
and it is not a confirmed freeze.** The distinction is the item's substance and
is repeated here because §K1 edits the file whose header asserts the freeze.

## §K2.4 Amendment 10 §J6's stated cause is wrong — the disposition survives, the reason does not

**A correction to filed text on `main`, and it is the drafting party's own.**

**§J6 records:** *"All three were **NOT PERFORMED** at this basis:
`api.github.com` returned HTTP 403 with `core: 0/60`, reset
`2026-08-27T23:49:35Z`."*

**That attributes to a session-level block what was a per-request lottery.**

**Reported by the drafting party, from their container:** three egress addresses
were observed across the session — `34.139.224.102`, `34.73.218.115`,
`35.196.153.210` — **rotating per request**. GitHub's anonymous limit is
per-IP on a shared pool, **so each pool member carried its own 60/hr budget and
tenants outside the session drew on the same budgets.** A 403 meant *that
address* was exhausted at *that moment*. **It was never a property of the
session.** Three consecutive requests returned 403, 403, 200. **A retry loop
obtained 76 of 76 in eight attempts.**

**A second denial shape was reported in the same container:** `urllib` received
403 where `curl` received 200 **on the same URL seconds apart** — a
User-Agent-dependent denial **that is indistinguishable from a rate limit in its
status code.**

**What survives and what does not.** The three items **were** NOT PERFORMED by
that session, and recording them as an omission rather than an absence was
correct — **`v25` Sec 6 item 1(c)'s rule is right and §J6 applied it
correctly.** **What is wrong is the stated cause**, and a cause is not
decoration: a successor reading *"core 0/60"* concludes the read was
unavailable, when it was available on retry the whole time.

### §K2.4.1 The general form, which is worth more than the instance

**When a 403 is per-request rather than per-session, "record NOT PERFORMED with
the reason" and "retry" are indistinguishable from a single sample.**

Item 1(c)'s rule — *a blocked read is an omission, not an absence* — **is
correct and silently assumes the block is stable.** Nothing in the rule says to
establish stability before recording the cause, and **a single 403 carries no
signal about which kind it is.** The rate-limit body even names the exhausted
address, which reads as a property of the caller and is a property of one pool
member.

**Recorded, not named and not generalised**, on the same footing as §K1.3.2.

### §K2.4.1a Whether this is a distinct shape or a subtype is NOT decided

**An earlier draft of this section asserted it as a third shape. That asserted a
taxonomy, and the assertion is withdrawn.**

**The case for subtype is strong and is stated first.** A single 403 from one
pooled address has a scope of **one request to one address**. The claim built on
it was **this session is blocked**. **That is the scope of a claim exceeding the
scope of the read** — the family recorded at Amendment 9 §I5 and Amendment 10
§J1.1. **On this reading the non-stationarity is not a different mechanism; it
is a different reason the read's scope was narrow.**

**What does differ is the remedy, and the difference is real.**

| | static object | varying object |
|---|---|---|
| why the read fell short | the bound was chosen, not the structure's | the sample was one draw from a changing condition |
| countermeasure | **bound at the structure's own edges** | **resample** |
| does the other countermeasure help? | resampling a fixed table adds nothing | **a perfectly bounded single sample is still wrong** |

**Bounding is the whole of this register's instrument discipline, and against a
varying condition it does nothing.** A read bounded flawlessly at one request's
own edges still returns *this address, this moment*. **That is a countermeasure
gap, and it is the strongest ground for treating the case separately.**

**It is not decided here.** Distinguished **by remedy**, not established as a
distinct mechanism, **and arguably a subtype of the scope family.** The register
declined to name a class at Amendment 10 §J1.1 on three instances, and declined
to resolve *"filed"* at Amendment 9 §I4; **naming a shape here on one instance
would be that move made quietly.** The question is recorded and left open.

**It stays outside §K1.3.2's tally under either reading** — a count already
blocked on an undefined term should not absorb a contested member, and whether
this belongs to that family is precisely what is undecided.

### §K2.4.2 Reach of this section

**The egress rotation and the `urllib`/`curl` divergence are attributed, not
derived here.** This session's reads ran through an authenticated
proxy-injected channel at **15000/hr** and were **never subject to the anonymous
per-IP budget**, so this container **cannot reproduce the condition** and did
not attempt to. **§J6's text is verified on `main` at lines 363–366**; its cause
is corrected on the drafting party's account.

**§J6 is not amended in place.** It stands as its at-filing record and **this
section is the correction authority**, per the additive-supersede convention
§J6 itself invokes.

---

# §K3. `v25` Sec 6 item 2 — the authority table, re-derived

**By explicit `sort -V`, covering `.md` and `.docx`.** Full forty-character
blobs at `54d163bd`.

| Layer | Authority on `main` | Blob at `54d163bd` | vs `6aea0f73` |
|---|---|---|---|
| F-AUTH-1 | `F-AUTH-1_Fix_Plan_v2.68.md` | `db62a38f6b2f2f055f3043e0bfe53f5b3e28e84b` | unchanged |
| F-Deploy-1 | `F-Deploy-1_Fix_Plan_v1.49.md` | `7ed517797947b75b6c6f67de840ad7afd7ff9ff2` | unchanged |
| F-Stats-1 | `F-Stats-1_Fix_Plan_v1.60.md` | `6b1e93a07c412951e96ac3299dbc3336561312ff` | unchanged |
| F-App-1 | `F-App-1_Fix_Plan_v1.1.md` | `33766072ebf60229fcd33dfd6a4c55ed1f4fd2f1` | unchanged |
| Cross-keystone | `Cross_Keystone_Register.md` | `d277588c81cf9bedea52aa015f79311e769a57f9` | unchanged |
| XK-1 evidence | `Paranoid_Exposure_Inventory_2026-08-07.md` | `3990b39bc94e7e6a5e95265ec1a2ae4c589e0cd7` | unchanged |
| Production-environment items | `Session_PE_Roster.md` | `89ef077e7382164de9892dc91b9b752fd023515b` | unchanged |
| Predecessor handoff | `Prime_Studios_Audit_Handoff_v24.md` | `a0977a8fa480854d51a00a8e9061187e1ad8f137` | unchanged |

**All eight unchanged across the three commits from `6aea0f73` to `54d163bd`.**
**Item 3 is discharged by the same read** — `Cross_Keystone_Register.md`
compared by Git blob identity, `d277588c…`, asserted non-zero independently and
not round-tripped through a shell.

**`.docx` maxima, checked:** F-AUTH-1 `v2.37` vs `v2.68`; F-Stats-1 `v1.2` vs
`v1.60`; Handoff `v11` vs `v25`; F-App-1 `v1.1` both; F-Deploy-1 none. **No
authority above is mis-derived by the `.md` restriction.** Sec 5.4's decline of
the `.docx` *contents* is untouched.

## §K3.1 One blob moved under an unchanged revision number, and it is disclosed

**`Prime_Studios_Audit_Handoff_v25.md`:**

| commit | date | blob |
|---|---|---|
| `a4d6ab5cc6040b1293f79a1675ae7985ec3fb962` | 2026-08-26 17:34:56 | `226be252a62fe3001f4eb088b94e4e14271c2501` |
| `9d4ea804c3524a05862cf7ac3a248723ba49e815` | 2026-08-27 14:28:37 | `d8beaca0ad6b655ea560cf75d1cb02df3f52adc6` |

**This is the Amd7 correction marker landing, and v25's own marker predicts it
by name** — it records the `226be252…` value and states that adding the marker
changes it. **Two commits, two blobs, one revision number, fully disclosed.**
**Reported as item 2 requires, and it is not an undisclosed in-place
amendment.** Both commits verified ancestors of `origin/main` by
`git merge-base --is-ancestor`.

---

# §K4. Amendment 10's corrections, verified independently at this basis

**Verified, not restated.** Each was re-measured at the structure's own bounds
without reference to Amendment 10's figure.

- **§J1's nine.** `F-AUTH-1_Fix_Plan_v2.60.md`, counted from the header at 307
  **until the pipes stop** — 11 pipe-lines, ending at 317, first non-pipe line
  318. **Nine data rows. Confirmed.** The bound is the table's, not a chosen
  window, and the count does not depend on knowing where the table ends in
  advance.
- **§J2.3's trap.** `v2.68`'s `**Status**` marker is at line 49; the block runs
  to the `---` at 53 and reads *"Ruling. Five dispositions, all definitional. No
  measurement is taken."* **A plural-safe dimension scan over that block returns
  nothing. Confirmed: `v2.68` carries no dimension on its Status face**, and the
  word *five* sits four lines below the marker.
- **§J3's supplier attributions.** `v2.59:198` is
  `# §2. Dimension 1 — candidate integrity: PERFORMED — PASS`. `v2.59:127` reads
  *"**Unaffected:** Dimension 1 PASS; Dimension 4 FAIL; Dimensions 3 and 5 NOT
  PERFORMED"*. `v2.60:303` is `# §6. Dimension 2 score`. **All three confirmed.**

## §K4.1 §J3's mandatory-reading instruction does not carry its own warning to the line it names

**`v2.59:127` is itself an instance of the hazard §J3 names**, and §J3 does not
say so at the point of use.

The line reads:

```
> **Unaffected:** Dimension 1 PASS; Dimension 4 FAIL; Dimensions 3 and 5 NOT
```

**Two singulars and one plural, carrying four dimensions on one line.**

§J3 states the plural-safe rule in general terms — *"`Dimensions 3 and 5` does
not match a singular pattern"* — and separately instructs that **`v2.59`'s
correction banner is mandatory reading for Dimensions 1 and 4**, citing line
127. **It does not state that the mandated line is the rule's own example.**

**The consequence is specific and silent.** A reader who executes §J3's
instruction with a singular `Dimension [1-5]` scan gets `Dimension 1` and
`Dimension 4` back — **exactly the two dimensions the instruction sent them to
find.** The scan appears to succeed. What it drops is `Dimensions 3 and 5`,
whose NOT PERFORMED status is on the same line and is the half a reader
checking G3 completeness most needs. **A wrong instrument returns the expected
answer here, so nothing signals the miss.**

**§J3's holding is unaffected** — D1 and D4 are carried historicals, preserved
by name at `v2.59:127`, and that stands. **This records where the instruction
and its own warning need to be adjacent and are not.** Routed to `v26`'s Sec 6
as an addition to item 5's replacement text, not as a correction to §J3:

> **When reading `F-AUTH-1_Fix_Plan_v2.59.md`'s correction banner for
> Dimensions 1 and 4, read line 127 plural-safe.** It carries four dimensions —
> `Dimension 1`, `Dimension 4`, and `Dimensions 3 and 5` — and **a singular
> scan returns exactly the two you came for while dropping the other two
> silently.**

**§K4 takes no position on §J1.1's fourth-instance question**, which
Amendment 10 recorded and declined to rule.

---

# §K5. `v25` Sec 6 item 1(a) — a pruned remote-tracking ref, observed

**Recorded because item 1(a) exists to catch exactly this and it fired.**

`git fetch origin --prune` at the head of this session printed:

```
- [deleted]         (none)     -> origin/claude/prime-studios-audit-register-8qhqcj
```

**The remote-tracking ref was present in the clone and the branch does not
exist on `origin`.** Before the prune, `git branch -a` listed
`remotes/origin/claude/prime-studios-audit-register-8qhqcj` — **a ref answering
*present* for something absent**, which is the failure item 1(a) names in
those words.

**On whose branch this is.** The name was supplied to this session by its
execution harness as a development target. **It was not chosen by Evoni, was
not named in any conversation, and is not a register artefact.** An earlier
draft of this section called it *the designated branch* without saying who
designated it, **which states a premise about a person that did not come from
that person.** Corrected before filing. **The observation about item 1(a) does
not depend on the branch's provenance** — any ref in that state would exhibit
it.

**No conclusion in this document rests on it.** It is recorded because item 1(a)
is perennial and this is the first session in the register to observe its
warning fire rather than restate it.

---

# §K6. What this amendment does not do, and its disclosures

- **Does not rule on `Prime_Studios_Audit_Handoff_v25.md` Sec 4.4's class.**
- **Does not rule on `F-Deploy-1_Fix_Plan_v1.49.md`'s prior-art citation
  standing.**
- **Does not rule on `v25` Sec 6 item 10-B** — whether a class of six dead
  request-path routes warrants an FD. **That is a minting decision.** FD tail is
  unmoved: **FD-69 retired, FD-70 next-available and unminted.**
- **Does not decide whether Amendment 10 §J1.1's instances constitute a class.**
- **Does not decide whether §K1.3.2's second defect names a family**, nor
  **whether §K2.4's case is a distinct shape or a subtype of the
  scope-exceeds-read family** — see §K2.4.1a. **Both are recorded and left
  open.**
- **Does not decide what "filed" means.** Amendment 9 §I4 records the term as
  undefined corpus-wide; §K1.3.2's count is stated under both readings and
  asserted under neither.
- **Does not amend Amendment 10's text in place.** §J6's three NOT PERFORMED
  entries stand as their at-filing record; **this document discharges them and
  is the discharging authority.**
- **Does not perform `v25` Sec 6 items 8, 9, 11, or 12.** All four are
  **Evoni-gated and NOT PERFORMED**: FD-66's infrastructure read, the
  `JWT_SECRET` environment read, the FD-67/FD-68 remedy, and PE #65's topology
  branch. **None is inferred, and no search for credentials was made.**
- **Does not perform item 5's G3 re-derivation as a new score.** §K4 verifies
  the attributions Amendment 10 §J3's table rests on. **The dispositions are
  §J3's and are not re-derived here.**
- **Does not re-read F-Stats items 23 and 36** (item 14, conditional). Both
  CLOSED; neither became load-bearing in this session.
- **Does not edit `.github/workflows/deploy-production.yml`.** §K1 establishes
  that two of its figures are wrong and §K1.3 proposes replacement text.
  **Applying it is a separate decision and is not taken here.**
- **Does not touch production.** No host, AWS, database, or Cognito contact. No
  endpoint exercised.

**This amendment moves Amendment 10's blob.**
`4ccad2a80af4e24563ec4b467a935f29aacfdaf1` →
`8f4c42a95305748e4d67d855dda01168e552394a`, under an unchanged filename, by
the pointer banner placed in this commit. **That is
`Prime_Studios_Audit_Handoff_v25.md` Sec 4.1 defeater 3 occurring here**, and it
is disclosed banner-forwarding in Sec 5.5's sense. **Both values are measured
after the banner was placed, not predicted before it.**

**On this amendment's filename.** `v25_Owed_Index_Amd11_*` inherits §C3's
defect, deliberately, per §E10 and per Amendments 7 through 10's statement of
the same choice. **`Amd11`, like `Amd10`, sorts before `Amd2`
byte-lexicographically.** `sort -V` orders it correctly; `git ls-tree
--name-only` does not.

**On the subject file's exclusion from the authority sweep.**
`.github/workflows/deploy-production.yml` is outside `docs/audit/` and no family
maximum covers it. **§K1's correction is therefore invisible to item 2's
derivation, and this entry is the address.**

**A provenance line pointing here was drafted into the block's foot and
withdrawn before filing.** The header is operational text read under time
pressure by a person deciding whether to run a production deploy. **A register
citation there sends that reader into a corpus they would have to navigate in
order to evaluate a code comment**, which is a cost paid at the worst moment
for a benefit owed to the sweep. **Sweep-invisibility is an argument for an
entry in this document, not for text in that file.**

---

*Type: amendment, derivation and record only. **Edits no file outside
`docs/audit/`.** No host, AWS, database, or Cognito contact. No endpoint
exercised. Prod FROZEN.*
