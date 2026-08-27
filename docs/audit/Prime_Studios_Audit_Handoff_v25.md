# Prime Studios Audit Handoff v25

| | |
|---|---|
| **Predecessor** | Audit Handoff v24. v25 supersedes v24 Sec 1, Sec 2, Sec 3, Sec 6, and the tail/status portions of Sec 7. **v24's analysis sections, its completion banner, and v23's correction banners stand.** |
| **Basis** | `origin/main` at `6aea0f73d8b0b0e1896f6eca9677af9d24c001ab`, derived live 2026-08-26. |
| **Author date** | 2026-08-26 |
| **Type** | Handoff. Rules nothing. Mints nothing. Changes no gate, finding, severity, owner, or disposition. |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios. |

---

> **CORRECTION MARKER — AMD7 HAS MERGED; SEC 4.1's AND SEC 8's UNMERGED
> FRAMING IS OVERTAKEN (added 2026-08-27, after `782d3b48`, additive).**
>
> **Correction authority:** `5ecbff113f79f7ebc6f35dfd5a6d39977cbe0b51`, PR #1134,
> which merged `docs/audit/v25_Owed_Index_Amd7_2026-08-26.md` to `main`. Present
> at `782d3b48`, blob `a3e02cb272f19c16c3afe17c9ce4f777b52e092b`.
> **`5ecbff113f79f7ebc6f35dfd5a6d39977cbe0b51` is an ancestor of `origin/main` at
> `782d3b48`, verified by `git merge-base --is-ancestor`.**
>
> **Two passages in the body below are overtaken:**
>
> - **Sec 4.1** closes: *"That document is on a branch and unmerged at this basis;
>   its disposition is open."* It is on `main`.
> - **Sec 8** records: *"Does not resolve Amd7's disposition. Sec 4.1 cites its
>   content; it is on a branch, unmerged, and may merge or be absorbed."* It
>   merged as a standalone document. It was not absorbed.
>
> **Both statements were true at v25's basis `6aea0f73` and neither is an error.**
> Amd7 merged three commits later, at the second of the three commits separating
> `6aea0f73` from `782d3b48`.
>
> **This marker does not make Amd7 authority.** Amd7's own header states that it
> rules nothing and mints nothing. Sec 4.1's citation hedge has two halves —
> *"on a branch and unmerged"* and *"cited for content, not as authority."*
> **The merge discharges the first. The second is untouched and is not settled
> here.**
>
> **Unaffected:** Sec 4.1's three defeaters, each verified at its own basis and
> none resting on Amd7; Sec 1's authority table and its blob column; Sec 8's
> remaining bullets; every gate, finding, severity, owner, and disposition.
> **Nothing is minted and nothing is ruled.**
>
> **This marker moves this document's blob.** `v25.md` was
> `226be252a62fe3001f4eb088b94e4e14271c2501` at `782d3b48`; adding this marker
> changes it while the revision number stays `v25`. **That is Sec 4.1 defeater 3
> occurring in this document.** It is disclosed banner-forwarding in Sec 5.5's
> sense, not an undisclosed in-place amendment, and the v26 author's item 2
> baseline comparison should read it as such. **The body below is unedited; only
> this marker is added.**
>
> The original v25 body remains below as the at-filing record.

---

> **SCOPE-STALENESS NOTICE — v24's COMPLETION BANNER SURVIVES THIS SUPERSESSION
> AND ITS SCOPE IS STALE.**
>
> v24's banner discharges Sec 6 item 10 on a **one-route** framing: `/search`
> dispatches to `/:id` and is dead. **The survey it did not have found six.**
> `Route_Shadowing_Survey_2026-08-22_DRAFT.md` records **six shadowed
> declarations in four files, five previously unknown, two distinct
> mechanisms**, all six dead, `next('route')` occurring **zero times in all of
> `src/`**, and **no shadowed declaration carrying authentication or ownership
> its live twin lacks.**
>
> **The banner's finding is not withdrawn — it is one of the six.** What is
> stale is its scope. **v25 is the only place this correction can live**,
> because a banner on a superseded document has no pointer forward and is
> discoverable only by a reader already looking for it.

---

# Sec 0. Why v25 exists

**v24 said the momentum was in the map. That is still true, and the map has now
begun correcting its own instruments.**

Since v24's basis `fec15be6`, **49 commits** landed on `main`. In that window the
register produced: the carriage rule (`v1.49`), a seven-link owed-index chain, an
eight-document draft-material block, three cross-cutting findings, and one
amendment to a filed finding's count. **The runtime system is unchanged by all of
it.** Limb 1 is open, Dimensions 3 and 5 are unperformed, PE #65 has a decision
specification and no decision.

**What is different from v24 is that two of v25's own checklist items were found
un-performable as written** (Sec 6 items 2 and 5, below), and the instrument they
name — **authority derived by sorting filenames** — is now recorded as unsound on
three independent grounds. **A handoff whose checklist cannot be executed is a
handoff that reports progress it did not make.** That is why v25 rewrites two
items rather than carrying fourteen forward.

**Sec 6 grew rather than shrank.** Fourteen items in, item 10 splits, **fifteen
out**. Four of the discharges are *perennial* — discharge does not close them.
v24's rule stands: shorten only by closing, superseding, or explicitly
classifying an item as a bounded exclusion. **Never by moving a runnable item
into Sec 7.**

---

# Sec 1. Current authorities

**Derived at `6aea0f73` by explicit numeric sort and live reads. This table is a
snapshot of a derivation, not authority. Sec 6 item 2 requires reproducing it.**

**Blob SHAs are recorded alongside revision numbers, in full.** A revision number
is not a content identifier; an in-place amendment moves the blob and leaves the
number alone. **This is the first authority table in this register that can be
diffed for that.**

**Full forty-character SHAs, not abbreviations.** This column exists to be
compared mechanically against the next handoff's. An abbreviated hash is a
convenient label and a weak identifier, and the whole point of the column is to
be an identifier.

| Layer | Authority on `main` | Blob at `6aea0f73` | Current face |
|---|---|---|---|
| F-AUTH-1 | `F-AUTH-1_Fix_Plan_v2.68.md` | `db62a38f6b2f2f055f3043e0bfe53f5b3e28e84b` | REOPENED-QUALIFIED. G3 PARTIALLY DISCHARGED, OPEN. Limb 1 **OPEN** — defined, not performed, not sized; `~700` estimate **WITHDRAWN**. Limb 3 open. G4 not enterable. FD-67 OPEN/P2; FD-68 OPEN/P1. |
| F-Deploy-1 | `F-Deploy-1_Fix_Plan_v1.49.md` | `7ed517797947b75b6c6f67de840ad7afd7ff9ff2` | **KEYSTONE CLOSED.** Carriage correction; carries v1.48's Amendment 1. Manual SSM dev dispatch authorized; push trigger **absent** (Sec 3.4). |
| F-Stats-1 | `F-Stats-1_Fix_Plan_v1.60.md` | `6b1e93a07c412951e96ac3299dbc3336561312ff` | Phase B live. Items 23 and 36 CLOSED. |
| F-App-1 | `F-App-1_Fix_Plan_v1.1.md` | `33766072ebf60229fcd33dfd6a4c55ed1f4fd2f1` | SHIPPED 2026-05-14, out of sequence; non-gating. Pattern 40 residue at PE #62. |
| Cross-keystone | `Cross_Keystone_Register.md` | `d277588c81cf9bedea52aa015f79311e769a57f9` | XK-1, XK-2, XK-3 admitted/owned; XK tail XK-3. **Blob unchanged across all 49 commits since v24.** |
| XK-1 evidence | `Paranoid_Exposure_Inventory_2026-08-07.md` | `3990b39bc94e7e6a5e95265ec1a2ae4c589e0cd7` | Banner-governed; read newest-first, re-derive before using any count. |
| Production-environment items | `Session_PE_Roster.md` | `89ef077e7382164de9892dc91b9b752fd023515b` | Tail PE #67. |
| Predecessor handoff | `Prime_Studios_Audit_Handoff_v24.md` | `a0977a8fa480854d51a00a8e9061187e1ad8f137` | Superseded in part by this document. |

**Register tails, derived at `6aea0f73`:**

| tail | value | method |
|---|---|---|
| FD | **FD-69**, minted then **retired at #1102** (spent on a duplicate). **FD-70 is the next available number and is not minted.** | Highest `FD-NN` across `docs/audit/` is 70, occurring twice, both declaring it *unminted and next-available*. |
| XK | **XK-3** | `Cross_Keystone_Register.md` face |
| PE | **PE #67** | `Session_PE_Roster.md` face |

**v24 Sec 1 reports the FD tail as FD-68. That is not an error at v24's basis** —
`FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md` records *"Mints
FD-69; FD tail advances FD-68 → FD-69"*, and v24's basis precedes it. **Recorded
so a reader holding both is not left to guess which is stale.**

## Sec 1.1 What this table's derivation covered

**`.md` only.** `.docx` revisions exist in this corpus. **Checked at `6aea0f73`:
no `.docx` maximum exceeds its `.md` counterpart** — F-AUTH-1 `v2.37` vs
`v2.68`; F-Stats-1 `v1.2` vs `v1.60`; Handoff `v11` vs `v24`; F-App-1 `v1.1`
both; F-Deploy-1 none. **No authority above is mis-derived by the exclusion.**
See Sec 5.4 for what remains unread.

---

# Sec 2. Keystone standing

| Keystone | Standing |
|---|---|
| F-AUTH-1 | Backend sweep REOPENED-QUALIFIED. **G3 PARTIALLY DISCHARGED, OPEN.** Limb 1 defined and open. Limb 3 assessment NOT COMPLETED. G4 **never entered** and not enterable; G5 blocked; G6 not reached. |
| F-Deploy-1 | **CLOSED** at v1.49. Recognizing its manual SSM path does not reopen it. |
| F-App-1 | SHIPPED; non-gating. |
| F-Stats-1 | Phase B live. Items 23 and 36 CLOSED. |
| F-Ward-1 | Queued. **Zero repository presence at this basis.** |
| F-Reg-2 | Queued. **Zero repository presence at this basis.** |
| F-Ward-3 | Queued. **Zero repository presence at this basis.** |
| F-Franchise-1 | Queued. **Zero repository presence at this basis.** Director Brain remains this keystone's resolution. |
| F-Sec-3 | Queued last in the locked sequence. |

**Zero repository presence is confirmed, not inferred.** v24 records these as
"Queued" at `fec15be6`; **that status does not travel** and is not carried here
as evidence of anything but its own filing.

**The locked sequence's order is unasserted.** Membership is nine and F-Sec-3 is
last; no ordering among the remainder is defined in any document read. **Two
documents assert about the sequence without defining it.** Carried, not hunted.

---

# Sec 3. G3 re-derived at `6aea0f73`

**Sec 6 item 5 asks for limb 1 status, limb 3 outcome, all five dimension
dispositions, and whether any revision entered G4. Performed here.**

| part | state | source revision |
|---|---|---|
| Limb 1 | **OPEN.** Unit: one recorded CP disposition. Population: the historical CP1–CP12 swept set. One judgment is a confirmation, not a re-derivation. Decomposable per CP; partial results hold. **`~700` estimate WITHDRAWN.** Not performed, not sized. | `v2.68` |
| Limb 3 | **open; ASSESSMENT NOT COMPLETED** | `v2.61`–`v2.68` |
| G4 | **never entered; not enterable** | every revision `v2.61`–`v2.68` |
| Dimension 1 | **PASS** — *carried historical*, "historical evidence, not re-stamped into a new combined assessment" | **`v2.60`** |
| Dimension 2 | **PASS** — current | `v2.61` |
| Dimension 3 | **NOT PERFORMED** — current | `v2.68` |
| Dimension 4 | **FAIL** — *carried historical*, "the last performed score recorded by `v2.59`; not re-performed" | `v2.61` |
| Dimension 5 | **NOT PERFORMED** — current | `v2.61` |

**`v2.61` is the last revision carrying a five-dimension face line, and it omits
Dimension 1.** Seven revisions have landed since; **all seven state Dimension 3
and nothing else.** A reader deriving G3 from the current face gets one
disposition of five. **This is why Sec 6 item 5 is rewritten.**

**Two of the five are not current scores**, and their sources say so. **v24 Sec 1
qualifies Dimension 1 and does not qualify Dimension 4, though both are carried
historicals** — see Sec 4.2.

## Sec 3.1 FD-67 and FD-68

Both **OPEN**. FD-67 P2, FD-68 P1. No remedy authorized, implemented, or tested.
FD-68's severity interaction with FD-65 remains unadjudicated.

## Sec 3.2 Dimension 3's live half

**NOT PERFORMED and unauthorized.** Requires corrected procedure plus explicit
host / shared-identity / freeze authorization.

## Sec 3.3 `v2.68`'s dependency SHA does not resolve on `main`

`v2.68` states it depends on `a4460f25` (F-Deploy-1 v1.49), *"which is on a
separate branch and not on `main` at this basis… That PR should merge first."*

**The merge order was honoured — v1.49's content is on `main`.** But `a4460f25`
**is not an ancestor of `origin/main`**: the squash landed the content under a
different commit. **The dependency is satisfied in substance and unreachable by
the SHA the document names.** Recorded, not corrected. Sec 4.4.

## Sec 3.4 The Actions path, derived

**Read from the GitHub Actions API before any YAML, per Sec 6 item 7.**

| workflow | path | API state | trigger |
|---|---|---|---|
| Deploy to Production | `deploy-production.yml` | **`disabled_manually`** (2026-06-02) | n/a — cannot be dispatched |
| Auto-merge to Dev | `auto-merge-to-dev.yml` | **`disabled_manually`** (2026-06-27) | n/a |
| Deploy to Development | `deploy-dev.yml` | `active` (2026-07-14) | **`workflow_dispatch` only — no `push` trigger** |
| Validate | `validate.yml` | `active` | — |
| Copilot cloud agent | `dynamic/copilot-swe-agent/copilot` | `active` | **no file in the tree** |

**The 30 most recent runs repo-wide (2026-08-24 → 2026-08-26) are all
`Validate`.** No deploy run of any kind. Nothing `queued` or `in_progress`.

**What this establishes:** the production deploy workflow cannot be triggered,
including by dispatch, and has not run in the observed window. **The Actions path
is closed at this basis.**

**What it does not establish:** that production hosts are frozen against SSM,
SSH, or console action. **No repository read reaches those. The residue is
Evoni's word.** Prod is carried as **FROZEN** on that basis and not on a
derivation.

---

# Sec 4. Method findings to carry

## Sec 4.1 Authority derived by sorting filenames is unsound

**Three independent defeaters, each verified at basis. Distinct mechanisms; not
collapsed.**

1. **The sort is not the sort asked for.** `git ls-tree --name-only` is
   byte-lexicographic on the full path. `v1.10` sorts above `v1.2`; `v2.12`
   above `v2.2`; `F-AUTH-1_*` precedes `F-App-1_*` because `U` < `p`. **The tail
   of that listing is `v10_session_brief.md`.**
2. **A correct derivation ages, silently.** v24 Sec 1 named `v2.61`/`v1.48` at
   `fec15be6`; 49 commits later the maxima are `v2.68`/`v1.49`. **v24 committed
   no error and says so in its own header.**
3. **Content moves and the number does not.** `v1.49` records PR #1105 appending
   74 lines in place to already-merged `v1.48` — blob `d4f382ba` → `0a31b603`,
   number unchanged. **The only defeater where performing the derivation
   correctly still returns the wrong answer.**

**Sec 1's blob-SHA column exists to close the third.** Nothing closes it without
a content identifier.

**Fuller treatment, including the prior-art reading, is at
`v25_Owed_Index_Amd7_2026-08-26.md`. That document is on a branch and unmerged
at this basis; its disposition is open.** Cited for content, not as authority,
and this citation does not assume it lands.

## Sec 4.2 An inconsistently-stale table is harder to catch than a stale one

v24 Sec 1 renders Dimension 1 as "PASS (prior basis)" and Dimension 4 as plain
"FAIL". **Both are carried historicals and both sources say so.** The table
qualifies one and not the other.

**The presence of some qualifiers reads as evidence that the unqualified entries
do not need one.** A uniformly stale table invites suspicion of every row; a
partially qualified one directs suspicion away from exactly the rows that still
need it. **Distinct mechanism. Recorded here first.**

## Sec 4.3 An instrument that answers a question adjacent to the one asked

**Observed repeatedly this session, in unrelated instruments:**

- A pre-push hook printing **"All checks passed"** while the push died — a true
  statement about the validation suite, read as an answer about the transfer.
  **`ls-remote` against the ref is the test; the hook's output is not.**
- A repository stop hook reporting uncommitted changes and prescribing "commit
  and push" while the uncommitted state **was the deliverable**, held pending an
  authorization deliberately withheld.
- A commit-count over the owed-index chain read as a corruption signal, in a
  corpus where the disclosed remedy **requires** the predecessor to move.
- A grep whose character class silently excluded the pattern it was written to
  find, returning zero matches that read as a mismatch.

**The general form: the check is correct about what it measures, and the
procedure written against its output has no term for the state the system is
actually in.** The prescription then fires hardest precisely where it is wrong.
**This is `v25_Owed_Index_Amd6_2026-08-23.md` §F2 at the level of a procedure's
vocabulary.**

## Sec 4.4 A dependency cited by a SHA the squash filter put out of reach

`Finding_Squash_Merge_Ancestry_Filter_2026-08-25.md` owns this class.
**Two instances observed in a single session, against a finding filed the day
before:**

| document | cites | ancestor of `origin/main`? |
|---|---|---|
| `Paranoid_Exposure_Inventory_2026-08-07.md` Banner 2 | `76a7f1ac` | **no** |
| `F-AUTH-1_Fix_Plan_v2.68.md` header | `a4460f25` | **no** |

**In both cases the dependency is satisfied in substance and unreachable by the
SHA the document names. The class is live, not historical.**

**A third candidate was tested and excluded.**
`docs/finding-authorship-sec3-amendment` @ `0742d590` is merged and undeleted,
and its tip is not an ancestor of `main` — **but nothing cites it.** There is no
dependency and no citation, so it exhibits the symptom without the mechanism.
**It belongs to Sec 7.1.** Recorded as a negative control: **two instances is a
live class; a third that only rhymes weakens it.**

## Sec 4.5 Case material carried from the draft-material block

Filed in the eight and not restated here: banner assertion decay as a class; a
precondition reporting PASS while the property was false; the left-right count's
unreliability on a shallow graph; the carriage principle applied once while the
practice continued; the handoff reading pre-amendment content under identical
revision numbers; facts that close correctly with no route back to the checklist
carrying them; a detector that could not distinguish the outcomes it existed to
distinguish; post-submission mutation of a gated artifact; `#NNN` autolinking in
any GitHub comment field.

**A sixth standing is available and adopted: DEMONSTRATED AGAINST A CONSTRUCTED
CONTROL** — a claim about an instrument's behaviour supported by a synthetic
system with known truth rather than by a read of the register. **It carries a
mandatory bound: such a claim must state it was not observed on the subject
repository.**

---

# Sec 5. Live carries and docket

## Sec 5.1 Highest-priority specific reads

1. **FD-66 deployed-schema/provenance read.** Evoni-owned, prod-gated. Bears on
   Dimensions 4/5.
2. **`JWT_SECRET` dev/prod environment-state read.** Evoni-owned, prod-gated.
   Bears on Dimension 5 and FD-65.

**Neither was performed by this handoff.**

**The `.md`-less `.docx` revisions are NOT listed here.** They are **explicitly
declined** at Sec 5.4 and carried as a bounded non-action at Sec 7.3. **A read
cannot be both highest-priority and declined**, and Sec 6's opening rule turns on
exactly that distinction.

## Sec 5.2 Active work, in order

1. **Limb 1.** Defined at `v2.68` and unperformed. Its own programme.
2. **FD-67/FD-68 remedies.** Require an authorizing revision and focused tests.
3. **PE #65.** Awaiting Evoni's topology choice; no code should infer one.
4. **Dimension 3/5 completion.** Requires corrected procedure plus explicit
   authorization.
5. **PE #63.** Retired at `36f11156`; reactivation limb 1 not establishable from
   the tree.

## Sec 5.3 Register facts resting on unfiled drafts

| # | fact | draft |
|---|---|---|
| 1 | FD-69's second retirement condition turns on evidence carried by the provenance instrument **when that instrument is filed** | `Production_State_Provenance_2026-08-22_DRAFT.md` |
| 2 | The route-shadowing class of six, and this document's scope-staleness notice | `Route_Shadowing_Survey_2026-08-22_DRAFT.md` |

**Both are unbounded — neither carries a retirement instruction.** The
draft-material block's third instance was bounded by its own absorption
condition and is discharged by this document's landing.

## Sec 5.4 The `.docx` class — EXPLICITLY DECLINED, with its standing history

**Every sweep this register has run has excluded `.docx`.** Three of the eight
draft-material documents state the exclusion independently, and none records
that the others had made it.

**`F-AUTH-1` `v2.9`, `v2.17` and `v2.19` exist as `.docx` with no `.md`
sibling.** Their contents are **unread**. Whether they carry material absent from
the `.md` chain is **unestablished in either direction**.

**v25 declines this rather than carrying it as an open row.** The decline is
explicit because an inherited row would read as newly noticed, and the standing
history is the load-bearing fact: **this has been open across every sweep that
ever ran, and the exclusion has outlived every sweep that made it.**

**Bound:** no authority in Sec 1 is mis-derived by the exclusion — checked at
`6aea0f73`, Sec 1.1. **The decline is about the contents, not the maxima.**

## Sec 5.5 In-place amendment — the population, reconciled

**Two counts in the draft-material block appeared to disagree. They do not.**

| basis | documents (all) | events (all) | documents excl. chain + `v1.48` | events excl. chain + `v1.48` |
|---|---:|---:|---:|---:|
| `7c508189` (the sweep's) | 14 | 18 | 7 | **9** |
| `6aea0f73` (this) | 21 | 27 | **14** | 18 |

**Four columns because two populations and two metrics are in play, and the
adjacent figures on one row do not count the same thing.** A document with three
commits carries two amendments; the chain and `v1.48` are excluded from the
right-hand pair because their in-place edits are disclosed banner-forwarding and
the carriage-rule case respectively.

**"Nine August amendments other than v1.48's" counts events; "the eight
uninspected" is those nine minus the one the sweep opened.** A three-commit file
carries two amendments. **Both figures were correct and counted different
things.**

**The population has doubled since the sweep.** At this basis, 14 documents
outside the chain and `v1.48` carry an in-place amendment, none of them
inspected by this handoff.

## Sec 5.6 Other live debt

- **G6 data-strand assessment** — G6 only.
- **FD-63 global-mount/probe disposition** — tied to FD-67 and limb 1.
- **XK-1's admission under §2.1 limb 2** — open status question; belongs to a
  ratifying revision.
- **Whether measurement corrections require ratification** — register question,
  referred by both the inventory and XK-1.
- **`F-Deploy-G1-AE`** — the ground stated for its P1 is contradicted in-corpus.
  Sec 7.2.
- **Bare `#NNN` across 279 documents** — remediation not attempted; it would mean
  editing 279 filed documents in place, the carriage defect at scale.

---

# Sec 6. Executable checklist for the v26 author

**Rule, inherited from v24: if Sec 7 or any other non-action section names a
specific read, that same read must appear here or be explicitly classified as a
bounded exclusion. A runnable obligation parked only as a non-action is dropped
in practice.**

**Header rules, governing all of Sec 6:**

> **H1 — A precondition asserted in prose is not asserted.** Paste the command
> line and its raw output for every check, tail stamp, and negative existence
> claim in this section.
>
> **H2 — Read `origin/main` explicitly.** Regardless of what POSITION returned,
> any read that must reflect `origin/main` uses `git show origin/main:path`.
> PASS guarantees you are not reading content **older** than `origin/main`; it
> does not guarantee you are reading `origin/main`, because ahead-commits shadow
> it with a clean tree throughout.

**Overage is justified per item at the foot of each entry, not in aggregate.**

---

**1. Establish position before any local read.** Class: **perennial**.

*Stated as one item because these are properties of a single readiness question.
Splitting them invites running the first and treating the tree as cleared.* **The
clause order is execution order and is forced, not stylistic**, except where
marked inherited.

**(a)** `git fetch origin --prune`. **Read its output.** Prune is silent when it
removes nothing and prints `- [deleted]` when it does. A remote-tracking ref
surviving a deleted or unborn branch answers *present* for something absent.

**(b)** `git log -1 origin/main`. **Do not carry a prior handoff's basis as an
expected answer.**

**(c) Enumerate open pull requests.** **By whatever capability this environment
provides**; `gh` is one such capability and may be absent, and a GitHub API read
satisfies this identically. An instruction resolving through exactly one tool is
not reproducible by a reader holding another. **State the method inline.** An
empty result is a negative existence claim. **If no capability is available,
record NOT PERFORMED** — an unperformed enumeration is an omission, not an
absence.

**(d) POSITION.** `git rev-parse HEAD`; `git rev-parse origin/main`. Point
lookups, depth-independent, safe before COMPLETENESS.

**(e) COMPLETENESS.** `git rev-parse --is-shallow-repository`. If `true`,
`git fetch --unshallow` before any ancestry, range, or history read, **then
re-assert and paste the result.** If `false`, **state why it is false** — a pass
is a property of container continuity, not of provisioning.

**(f) On POSITION FAIL only, and only after (e) reads `false`:**
`git rev-list --left-right --count origin/main...HEAD`. Nonzero *behind* is the
stale-worktree hazard. **Nonzero *ahead* with zero *behind* is ordinary unmerged
work, and the prescribed response to FAIL — bringing the worktree to
`origin/main` — discards it.**

**(g) RETRIEVABILITY.** A property to establish, not a command to run. **Mitigated
by H2.**

*Overage: this item is the precondition for every other item's validity. It
cannot be shortened without making the remainder unverifiable.*

---

**2. Derive the authority table.** Class: **perennial**. **Rewritten; v24's
item 2 is superseded.**

Numeric-sort **explicitly** — `sort -V` or equivalent. **Byte-lexicographic
listing is not numeric sort**, and `git ls-tree --name-only` returns
byte-lexicographic order.

For each family, state the maximum **and the file extensions the derivation
covered.** `.docx`-only revisions exist.

**A revision number is not a content identifier.** Record each authority's blob
SHA alongside its number, **in full — forty characters, not abbreviated** — so an
in-place amendment is visible at the next derivation and the column can be
compared mechanically rather than read.

**Read the prior handoff's recorded blob SHAs as a baseline for comparison
only.** A blob differing under an unchanged revision number is an in-place
amendment and is **reported**. **The prior table is never the source of the
current maxima.**

*Overage: v24's item named a derivation the corpus cannot perform as written.
Three independent defeaters are recorded at Sec 4.1. The blob-SHA and baseline
clauses are the only mechanism that closes the third; without them the item
restates a known-unsound instruction.*

---

**3. Cross-Keystone Register integrity.** Class: **perennial**.

Compare `Cross_Keystone_Register.md` against `origin/main` by **Git blob
identity** — `git rev-parse origin/main:path` — or `git diff --quiet`. **Assert
non-zero independently.**

**Do not round-trip repository text through a shell to compare bytes.** v24's
item names PowerShell specifically; **the hazard is shell re-encoding generally
and the instruction should be read environment-neutrally.** A shell that rewrites
encoding on redirect produces a clean-looking mismatch that measures the shell,
not the repository.

*Overage: the check is four lines and its failure mode is a false positive that
looks like repository divergence. v24 Sec 1.1 records it firing once. Retained
because a false alarm here sends a successor hunting a corruption that does not
exist.*

---

**4. Read correction banners before body sections.** Class: **perennial**.

Newest-first, in any document carrying them. **Where a banner and the body
disagree, the banner governs.** At this basis: `v2.59`, `v23`, XK-1, FD-66, and
every `v25_Owed_Index_*` link.

*Overage: this session recorded a filed conclusion resting on an unbannered body
read. The failure is silent — a body value reads as current because nothing in
the body says otherwise.*

---

**5. Re-derive G3.** Class: **perennial**. **Rewritten; v24's item 5 is
superseded.**

Limb 1 status, limb 3 outcome, G4 entry, and **all five dimension
dispositions**.

**The current F-AUTH-1 face is not the source for any dimension other than 3.**
Walk back to the last revision carrying a five-dimension face line and **state
which revision supplied each disposition.**

**Record for each whether it is a current score or a carried historical.** At
this basis Dimensions 1 and 4 are carried historicals and their sources say so.

*Overage: v24's item asks for five dispositions from a face that carries one.
Seven revisions have landed stating only Dimension 3. The walk-back is required
and lengthens with every such revision — see Sec 8 for the alternative this
handoff does not adopt.*

---

**6. PE #63.** Class: **one-time, DISCHARGED at this basis.**

Retired at `36f11156`, 2026-08-22 — **method retirement, not finding
retraction.** Reactivation limb 2 has not fired; **reactivation limb 1 is not
establishable from the tree** and requires a live GitHub read this register
gates.

*Overage: retained as an entry rather than dropped because the discharge is by
pre-existing retirement rather than by action, and a successor finding no
retirement action in the log would otherwise re-open it.*

---

**7. Enumerate workflows from the API before reading any YAML.** Class:
**perennial**. **Scope widened.**

**Enumerate — do not read a fixed list of names.** v24's item names three
workflows; **this repository has five, and one has no file in the tree.**
`dynamic/copilot-swe-agent/copilot` is `active` and **structurally invisible to
YAML-first enumeration.**

Keep each workflow's state separate. **Workflow-level `active` does not tell you
the trigger** — read the `on:` block separately.

*Overage: the item's own instruction is what surfaced a workflow no file-based
method can find. A successor reading three YAMLs would find three and believe
the enumeration complete.*

---

**8. FD-66 infrastructure read.** Class: **one-time, Evoni-gated.**

Has Evoni authorized/performed the deployed schema + provenance read? **If not,
record NOT PERFORMED; do not infer from migrations.**

*Overage: bears on Dimensions 4 and 5, neither of which can be scored without
it.*

---

**9. `JWT_SECRET` environment read.** Class: **one-time, Evoni-gated.**

Has Evoni authorized/performed the dev/prod state read? **If not, record NOT
PERFORMED; do not search for credentials.**

*Overage: bears on Dimension 5 and FD-65. The prohibition is the operative half.*

---

**10-A. Route shadowing — the finding.** Class: **one-time, DISCHARGED.**

**Six shadowed declarations in four files, five previously unknown, two distinct
mechanisms** — an exact duplicate `(method, path)`, and a literal path declared
after a parameterized path that matches it. **All six dead.** `next('route')`
occurs **zero times in all of `src/`**. **No shadowed declaration carries
authentication or ownership its live twin lacks.** Method for `/search` is at
`F-AUTH-1_Fix_Plan_v2.45.md` Banner 1.

*Overage: v24's item 10 is one item whose read is permanently discharged and
whose disposition is permanently open. The two-class scheme cannot label one
entry that is both.*

---

**10-B. Route shadowing — the disposition.** Class: **one-time, OPEN, gated.**

**Whether a class of six dead request-path routes warrants an FD.** Derived from
the survey, not from v24's one-route framing. **Remains open under limb 1.**

*Overage: the disposition is a minting decision and is not the v26 author's to
make. Carried so it is not lost with the discharged half.*

---

**11. FD-67/FD-68 remedy.** Class: **one-time, Evoni-gated.**

Has a remedy been authorized, implemented, and tested? **Check HTTP
classification and explicit placeholder behaviour separately.** FD-68's severity
interaction with FD-65 must be adjudicated.

*Overage: two findings with different severities and one shared remedy surface;
collapsing them loses the P1.*

---

**12. PE #65.** Class: **one-time, Evoni-gated.**

Has Evoni selected a topology branch? **A decision specification is not a
decision.** No code should infer one.

*Overage: the specification is complete, which is exactly what makes it look
decided.*

---

**13. Confirm prod-freeze status.** Class: **perennial. PARTIALLY DERIVABLE.**

**The Actions path is derivable from the repository and the API** — workflow
states, triggers, and recent runs. Sec 3.4 derives it at this basis.

**The remainder is not.** SSM, SSH, and console access reach production by paths
no repository read observes. **Confirm the residue live through the appropriate
authority before any prod / shared-Cognito / host action.**

**Do not report a derived Actions-path closure as a confirmed freeze.** They are
different claims and H1 governs both.

*Overage: v24 did not perform this check and said so. This handoff performs half
and names the half it cannot. The split is the item's substance.*

---

**14. F-Stats items 23 and 36.** Class: **conditional.**

Both CLOSED at this basis — item 23 at `v1.43`, item 36 by ruling at `v1.35`.
**Re-read from their closure revisions only if they become load-bearing.**

*Overage: closed items are carried only where a successor might reasonably
re-open them; these two were "open" on v23's face and the correction is one
revision deep.*

---

**Fifteen entries.** Longer than v24's fourteen because item 10 splits into a
discharged read and an open disposition. **Do not shorten by moving runnable
items into Sec 7.** Shorten only by closing, superseding, or explicitly
classifying an item as a bounded exclusion.

---

# Sec 7. Housekeeping and bounded non-actions

## Sec 7.1 Branches merged and undeleted

**`docs/finding-authorship-sec3-amendment` @ `0742d590`** was merged 2026-08-26
and **not deleted**. `Finding_Authorship_Record_Preservation_2026-08-24.md` §5
records that branch deletion returns **HTTP 403** on this transport — *"a policy
response, not a retention decision"*.

**The safeguard is accidental and nobody is maintaining it.** §3 of that finding
records that the branches preserve the only signal distinguishing an API-authored
commit from a locally-authored one. **v25 requests no retention and proposes no
convention change.** §8 of that finding puts three responses to Evoni and ranks
none.

## Sec 7.2 `F-Deploy-G1-AE` — the severity ground has moved

**Recorded, not a re-rating. AE's P1 stands until Evoni moves it.**

AE is rated P1 on an explicit stated ground: `F-Deploy-1_G1_Audit.md:1205`
records #722 characterizing the exposure as *"this way for months; not actively
burning but real exposure"* and states the rating rests on that.

**`Audit_Handoff_Delta_2026-07-04_id3_Window.md:155` records "SSH port 22
world-open — continuous internet brute-force visible in auth.log (AE class)"** —
five weeks after that rating, on the same port.

**AE is also one-fifth remediated and its row does not say so:** `tcp/22` on
`sg-05c3a6ed6eee7b3a6` was scoped to a single address 2026-08-22 under explicit
authorization, recorded at `v1.48`/`v1.49`, with change and rollback off-repo.
**The remaining four ports are documented-open and live-unverified** — no
artifact on `main` records any revoke, and every reference to their remedy is
prospective to the post-`[3]` sweep, which no document records as having run.

**The residual `/32` needs periodic re-scoping. AE's remedy is a one-time close.
A recurring obligation cannot be discharged by a one-time remedy, and AE's
closure would be the occasion on which it stops being tracked.**

**Bound:** the `auth.log` observation is **carried as filed and not re-verified**
— verification requires host contact the freeze forbids. Port 22 has since been
scoped, so the observed condition may no longer obtain. **Not asserted as
current.**

## Sec 7.3 Bounded non-actions

- **Prod enumeration generally** — deliberate freeze boundary.
- **The three `.md`-less `.docx` revisions** — Sec 5.4, explicitly declined.
- **The 14 in-place-amended documents outside the chain** — Sec 5.5, counted and
  uninspected.
- **Bare `#NNN` remediation** — the carriage defect at scale; not attempted.
- **`.docx` register documents' notation** — out of every sweep's scope.

---

# Sec 8. What v25 does not do

- **Mints nothing.** No FD, no XK, no PE. **FD tail FD-69 retired; FD-70 next
  available and unminted.**
- **Rules nothing.** Closes and reopens no finding; changes no gate, severity,
  owner, or disposition.
- **Does not re-rate `F-Deploy-G1-AE`.** Sec 7.2 records that its stated ground
  moved.
- **Does not perform or size limb 1**, advance Dimension 3, discharge limb 3,
  enter G4, or alter the freeze.
- **Does not amend v24**, its completion banner, or any revision named above. The
  scope-staleness notice at the head of this document is a correction carried
  *here*, not an edit *there*.
- **Does not require future F-AUTH-1 revisions to restate all five dimension
  dispositions.** Sec 6 item 5 places the burden on the reader's walk-back.
  **Requiring it of the face is the alternative fix and constrains how revisions
  are authored — that is Evoni's, and it is owed rather than declined.**
- **Does not resolve Amd7's disposition.** Sec 4.1 cites its content; it is on a
  branch, unmerged, and may merge or be absorbed.
- **Does not read the three `.md`-less `.docx` revisions.** Sec 5.4.
- **Does not delete, retain, or request retention of any branch.** Sec 7.1.
- **Does not contact** any host, AWS API, database, or Cognito endpoint. No
  endpoint exercised.

---

*Handoff. Rules nothing, mints nothing. Basis `origin/main` at `6aea0f73`,
2026-08-26. Local Git reads and GitHub API reads only. No host contact. Prod
FROZEN — Actions path derived at Sec 3.4, residue on Evoni's word.*
