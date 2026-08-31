| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 26** *Three measured findings. One is a claim this chain already made about itself and did not apply; one is a safeguard that does not reach what it looks like it reaches; one defeats the instrument this register added to catch exactly that.* |
| --- |

***Provenance:*** *route ruled by Evoni on 2026-08-31 — **chain amendment, three measured findings, no register number.** **Push, PR create and merge are NOT ruled and are not assumed.** Rule 7 gates each separately, for doc-only changes explicitly (`F-Deploy-1_Fix_Plan_v1.5.md:165`; `Fix_Plan_v1.2.md:106`; `Session_PE_Roster.md:2208-2209, 2309-2310`).*

# v25 Owed Index — Amendment 26

**FILED 2026-08-31 on Evoni's authorization.** **Push, PR create and merge
UNRULED AT FILING — a reader finding this document on `main` is reading it after
some of those gates were passed, and should read §AB5 for what this amendment
rules rather than this line for what it did not.**

**AMENDMENT 26 to `v25_Owed_Index_2026-08-22.md`.** Adds §AB1–§AB5.

**Basis:** `origin/main` at `9c448d85501a66d6c5e4beaa30b3400bdfc0e6db`, 2026-08-31.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Carries three measured findings and nothing else.** Records no closure, corrects
no predecessor's standing, mints nothing. Ships no code. Rules nothing on `v25`
Sec 6 item 8. Prod **FROZEN**.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     51
grep -r  'XK-4'  docs/audit/ | wc -l     29
grep -r  'PE #69' docs/audit/ | wc -l    29
Session_PE_Roster.md highest entry       PE #68
Owed Index chain tail (pre-Amd26)        v25_Owed_Index_Amd25_2026-08-30.md
```

**Amd25 predicted 51 / 29 / 29 for a successor re-deriving after it landed. All
three read as predicted.** The prediction is recorded as confirmed rather than
restated.

**Note on the three instruments, carried because it is still live.** The first is
counted with `grep -o` (occurrences); the second and third with `grep -r | wc -l`
(matching lines). **They are not the same unit.**

**This amendment's own contribution, measured after the text was final: +1 to
each of the three instruments** — from the tails block above, its only mentions,
because the note immediately preceding this one refers to them collectively
rather than by token. **A successor re-deriving once this lands should read
52 / 30 / 30.** **The three tokens appear in this file exactly once each, in the
tails block and nowhere else.**

**Recorded because the instruction earned it:** this paragraph first stated
`+2` and `53 / 31 / 31`, carried over from Amd25's shape, where the note *did*
name each token. **Measurement after writing returned `1 / 1 / 1` and the
prediction was corrected before filing.** Amd25's rule to *re-measure after
writing rather than before* caught a wrong tail prediction on its first
application by a successor.

**Exclusivity, measured immediately before this number was taken.** Zero open
mergeable pull requests (`git ls-remote origin 'refs/pull/*/merge'` → 0, control
`refs/pull/*/head` → 1160); no `Amd26` or higher on any of 165 remote tips;
highest pull-request number `#1161`, merged. **Every observable mint path was
empty and Evoni granted the pen explicitly.** **This is not a proof of
exclusivity** — §AB4's closing note records why the machine-local form of that
check cannot see the case it exists to see.

---

# §AB1. Standing, stated first, because the last amendment had to

**All three findings in this amendment are MEASURED on `origin/main` at this
basis and are reproducible by anyone holding the repository.** No finding here is
attested, and none rests on evidence a reader cannot check.

**This is a deliberate narrowing and the reason is recorded.** A fourth finding
was available and was dropped: the current platform-level state of the
`Auto-merge to Dev` workflow, and its recent run history, were reported to the
drafting session by a second session over a GitHub API this container cannot
reach. Amd25 §AA1 defines the attested slot in a table row, rendered here as it
stands on `main` rather than paraphrased:

```
| §AA3 — the merge-on-absence timer | **ATTESTED** by the drafting session | **no second party** — the instruments were created and deleted inside one agent session and left no artifact |
```

**Three cells: the finding, the standing, and who can check it.** The standing is
defined as attested **by the drafting session**, and the third cell's ground is
that the evidence was created and destroyed inside one session. **A claim taken
from a session the drafting session cannot audit is not that** — a second party
does exist, it is simply one this author cannot check. Filing it there would
record provenance the author does not hold as though the author held it —
**which is §AB2's defect, committed inside the amendment written to correct it.**

**The row is rendered whole because this amendment convicts two predecessors on
exact quotation.** An amendment that quotes precisely when convicting and loosely
when justifying itself gives away the asymmetry.

**So layer 1 is not asserted in either direction in this document.** See §AB3.4.

---

# §AB2. **MEASURED** — "produced" recorded as "held", in two merged amendments, unbannered

**The claim.** `v25_Owed_Index_Amd23_2026-08-30.md:153-156` states what would
close its own unmeasured tree→ledger direction, and then says of it:

> No new database read is required — the listing was already produced by the
> admissible run at Amd22 §X2. Filing that output is a durability act, not a new
> read.

`v25_Owed_Index_Amd25_2026-08-30.md` §AA4 restates it in its own words: the
filing is *"an act requiring no database read, since that output already exists
from the admissible run at Amd22 §X2."*

**Both are on `main`. Neither carries a correction banner.**

## §AB2.1 The defect is an inference, not a factual error

**Nothing in either document establishes that any party still holds the
listing.** Amd23 itself, thirteen lines earlier at `:140-142`, records the
opposite side of the same fact: *"This amendment's author holds the nine reported
entries, **not the listing**. The listing was read by the operator and reported
in summary; **it was never filed as an evidence note**."*

**Produced, reported in summary, never filed — and then treated as retrievable.**
The step from *was produced* to *is available to file* is unstated and unmeasured
in both documents. **It is the whole of the claim's load.**

## §AB2.2 The negative, measured on `main`

**Instrument and threshold stated, per H1. All paths on `main`, every extension,
token anywhere on the line:**

```
git ls-tree -r --name-only origin/main | while read f; do
  n=$(git show "origin/main:$f" | grep -oE '20[0-9]{12}[-_]' | wc -l)
  [ "$n" -ge 20 ] && printf "%6s  %s\n" "$n" "$f"
done | sort -rn

    49  scripts/bootstrap-sequelize-meta.js
    40  docs/audit/F-App-1_Fix_Plan_v1.md
    29  docs/ENVIRONMENT_STATUS_REPORT.md
    28  scripts/migrations/mark-migrations-done.js
    26  scripts/migrations/episode_metadata_backup_20260205-090638.sql
    26  scripts/migrations/episode_data_only_20260205-090824.sql
    21  scripts/migrations/fix-migration-state.js
```

**The listing has 219 entries. The densest holder on `main` has 49.** No file on
`origin/main` holds it. **A filename search returns nothing.**

## §AB2.3 What this does and does not establish

**Establishes:** the listing is not held on `origin/main`, and the claim that
filing it requires no new read is **unsupported by the repository**.

**Does not establish:** that the listing is unavailable. **Availability remains
UNMEASURED.** A terminal scrollback, an untracked local file, or an operator's
workstation could hold it, and this amendment measured none of those. **A bounded
workstation search was reported to the drafting session by the operator and is
recorded here as reported, not as measured** — the same discipline §AB1 applies
to the second session.

**Consequence, stated as owed rather than ruled:** discharging Amd23 §Y3 **may
require a fresh read under Addendum A's gate.** Both documents say it does not.
**Neither established that.**

## §AB2.4 What is owed

**Correction banners on Amd23 and Amd25** are owed and are not placed by this
amendment — **Amd26 corrects no predecessor's standing and does not edit files
outside its own.** Whether the banners are placed, and by whom, is Evoni's.

---

# §AB3. **MEASURED** — the `[skip-automerge]` predicate does not cover 28 of the branches it appears to

## §AB3.1 What is armed, in the tree, today

`git show origin/main:.github/workflows/auto-merge-to-dev.yml`:

```
on:
  push:
    branches:
      - 'claude/**'
```

**A live push trigger on the entire `claude/**` namespace, present on `main` at
this basis.** This is the first link of the 2026-06-27 AllStopped cascade
(`docs/audit/F-Deploy-1_AllStopped_CauseClosed_WorkflowCascade_2026-07-01.md`).

**Read separately, per `v25` Sec 6 item 7's rule that workflow-level state does
not tell you the trigger.** **The tree holds four workflow files, so
`auto-merge-to-dev.yml` has three siblings with files, and their triggers at this
basis are:**

```
deploy-dev.yml           on: workflow_dispatch:                      (no push key)
deploy-production.yml    on: workflow_dispatch: (confirm + reason inputs)
validate.yml             on: pull_request [main,dev]; push [main,dev]; workflow_dispatch
```

**`deploy-dev.yml` carries no `push:` key. The gated state holds, verified rather
than remembered.**

**Four files is not four workflows, and this section will not repeat item 7's
documented failure.** Item 7 records that **this repository has five workflows
and one has no file in the tree** — `dynamic/copilot-swe-agent/copilot`, which it
describes as `active` and **structurally invisible to YAML-first enumeration**.
Its overage warns that *"a successor reading three YAMLs would find three and
believe the enumeration complete."* **A successor reading four YAMLs would do the
same thing.**

**The fifth workflow's trigger is not readable from the repository and is NOT
ASSERTED here.** Reading it requires the API this container cannot reach — the
same bound §AB3.4 states for platform state and run history, applied one section
earlier. **What is asserted is the enumeration's shape: four files, five
workflows, one unreadable from the tree.**

## §AB3.2 The in-repository safeguard, and its exact reach

`auto-merge-to-dev.yml:59-66` gates the downstream steps on an opt-out token:

```
- name: Check for [skip-automerge] opt-out token
    if echo "$COMMIT_MSG" | grep -qi '\[skip-automerge\]'; then
  → skip=true; downstream steps: if: steps.skip-check.outputs.skip != 'true'
```

**The predicate reads `github.event.head_commit.message` — the pushed head commit
only.** Introduced at `1f548aed`, `#705`, 2026-05-17T13:21:25-04:00
(`ci(deploy): add [skip-automerge] opt-out token to auto-merge-to-dev (A-1b)`).

## §AB3.3 The measurement

**Scope derived from the repository, not imported.** The cut is the predicate's
own introduction commit: a branch whose head predates `1f548aed` is not a
coverage gap, because the predicate did not exist. **Integer epoch comparison
(`%ct`), not string comparison of ISO timestamps — offsets in this corpus are
mixed (`-04:00` and `+00:00`) and lexicographic comparison across them is
unsound.**

```
claude/** tips on the remote                      94
  tips whose head postdates 1f548aed              76
    head commit carries [skip-automerge]          48
    head commit carries NO token  -> UNCOVERED    28
```

**Newest uncovered tip: `claude/sg-identity-reconciliation-e316y1`,
2026-08-29T01:07:41+00:00 — two days before this basis.** The full list of 28 is
derivable by the instrument above and is not reproduced here.

**94 agrees with Amd25 §AA4's recorded population.**

**Bound, stated:** committer date is not push time. A branch pushed recently
carrying an older commit is excluded, so **76 is a lower bound and 28 is a lower
bound.** That is the safe direction for a coverage-gap finding.

## §AB3.4 What is NOT asserted

**Whether the `Auto-merge to Dev` workflow is currently enabled at the platform
level, and whether it has fired recently, are NOT MEASURED FROM THE DRAFTING
CONTAINER and are not asserted in either direction.** The GitHub API is
unreachable from here; the 403 is a budget exhaustion, and the discriminating
header is on the 403 itself:

```
GET /repos/.../pulls?state=open   ->  HTTP 403
  x-ratelimit-limit: 60   x-ratelimit-remaining: 0   x-ratelimit-used: 60
  x-ratelimit-resource: core
  body: {"message":"API rate limit exceeded for 35.196.153.210. ..."}
```

**This is `v25` Sec 6 item 13 performed on itself, not borrowed by analogy.**
Item 13 states the Actions path is derivable *"from the repository **and the
API**"*. **In a container without the API, item 13's own derivation is half
available:** states and triggers from the tree, run history not. **A derived
Actions-path reading is not a confirmed freeze, and this amendment does not
report one as such.**

**The finding does not depend on layer 1.** It is that a predicate exists and 28
branch tips fall outside it. **That is true whether the workflow is enabled or
disabled**, and it is what a re-enable would act on.

---

# §AB4. **MEASURED** — a shell form that produces a false MOVED in `v25` Sec 6 item 2's blob column

**`v25` Sec 6 item 2 added a full-SHA blob column whose entire value is that an
in-place amendment cannot hide behind an unchanged revision number.** The
following defeats it by producing a positive where none exists.

## §AB4.1 The mechanism

`git rev-parse <rev>:<path>` on a path absent at that revision **prints the
path-spec to stdout and exits 128**:

```
git rev-parse 6aea0f73:docs/audit/v25_Owed_Index_Amd25_2026-08-30.md
  exit 128
  stdout: '6aea0f73:docs/audit/v25_Owed_Index_Amd25_2026-08-30.md'
```

**The first characters read as a hexadecimal blob SHA.** In a column of forty-
character hashes, a truncated or column-formatted rendering of that string is
indistinguishable from a moved blob — **a false MOVED, in the one column added
because false negatives were the known hazard.**

## §AB4.2 Three forms, two of which are unsafe, and they do not look different

```
A   v=$(cmd || echo ABSENT)        -> '<rev>:<path>\nABSENT'   BROKEN
B   v=$(cmd) || v=ABSENT           -> 'ABSENT'                 SAFE
C   git ls-tree <rev> -- <path>    -> '' , exit 0              SAFEST
```

**Form B is sound only as a bare assignment.** Prefixed by `local`, `declare`,
`export` or `readonly`, **the exit status becomes the builtin's, the builtin
succeeds, and the `||` never fires:**

```
local v=$(failing cmd)      -> exit status 0     <- the mask
bare  v=$(failing cmd)      -> exit status 128

local v=$(cmd) || v=ABSENT     -> '<rev>:<path>'    BROKEN
local v; v=$(cmd) || v=ABSENT  -> 'ABSENT'          SAFE
```

**This is the case that bites in practice.** A per-row lookup in a derivation
script lives in a function, and `local v=$(...)` is the idiom anyone would reach
for. **It fails identically to form A and reads identically to form B.**

**It is also worse than form A.** Form A emits the path-spec *and* the fallback —
two lines, visibly wrong. **The `local` form emits the bare path-spec alone,
which looks exactly like a clean field.**

## §AB4.3 Rule

*Existence at a revision is established with `git ls-tree <rev> -- <path>`, which
returns empty at exit 0 for an absent path and therefore has nothing that can be
mistaken for a SHA. `git rev-parse <rev>:<path>` is not to be used inside a
command substitution with a fallback, and not to be used with a `local`,
`declare`, `export` or `readonly` prefix on the assignment.*

## §AB4.4 Why this is filed rather than fixed silently

**Two independent sessions built item 2's authority table at this basis. One
produced two false MOVED rows from this mechanism and caught them before
reporting. The other's table was correct — and it was correct because it happened
to use form B as a bare assignment, not because its author knew form B was the
safe one.** The instrument survived by luck and the luck was legible only in
hindsight.

**That is the `§V2` / `§W`-series class and Amd25 §AA3.2's class exactly: a
correct-looking check whose behaviour outside the happy path nobody had cause to
look at.** Here it was reached, by one of two parties, once.

**A closing note on what this implies for exclusivity.** The two sessions were
demonstrably in different containers — one shallow, one not. **A machine-local
check for a competing session cannot see a session on another machine, which is
the only case it exists to detect.** No such session is evidenced; that is not
the same as none.

---

# §AB5. What this amendment does not do

- **Does not close `v25` Sec 6 item 8.** Reads discharged per Amd22 §X9;
  **disposition remains OPEN and Evoni-gated.** Does not touch the 8-A/8-B split.
- **Does not correct any predecessor.** Amd18 through Amd25 stand as filed.
  **§AB2 records that two of them carry an unsupported inference; it places no
  banner and edits neither.**
- **Does not assert the platform state or run history of any workflow.** §AB3.4.
- **Does not re-rate `F-Deploy-G1-AE`**, or touch AD or AF.
- **Does not rule on re-enabling the `deploy-dev.yml` push trigger**, which
  remains gated behind `[3]` closing and the Phase B G1 α/β shared-box
  re-assessment.
- **Does not resolve `v25` Sec 6 item 5.** Amd10 §J3 withdrew the walk-back and
  offered replacement text; **that text is proposed, not adopted**, and which
  text governs is Evoni's.
- **Does not close items 9, 11 or 13**, though §AB3.4 performs item 13's
  repository half and names the half it cannot.
- **Does not sweep, delete, or request retention of any branch.** The 94
  `claude/**` branches are `v25` Sec 7.1's population, not this amendment's.
- **Does not decide which migration root is canon.**
- **Does not mint.** No FD, XK, or PE number.
- **Does not rule its own push, PR create, or merge.** Three separate confirms.
- **Does not authorize a host session, an AWS call, a database read, a VPN, a
  bastion, an SSH tunnel, or SSM port forwarding.**

---

*Type: chain amendment. Three findings, all measured, all reader-checkable; one
available finding deliberately dropped for want of auditable provenance, and the
drop recorded at §AB1. Records no closure and no mint. Edits no file outside its
own path. No host, AWS, database, or Cognito contact by any agent session. Prod
FROZEN.*
