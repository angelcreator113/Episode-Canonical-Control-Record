# Finding — the register's authorship record is preserved by a transport failure

| | |
|---|---|
| **Purpose** | Corrects a carried register item, and records that the only surviving per-document authorship signal is preserved by a condition nobody chose. Cross-cutting; belongs to no keystone. |
| **Basis** | `main` at `f77829fbbf26604266e68c358515b45cf49bf48b`, confirmed by `git ls-remote --heads origin main`. |
| **Standing** | Observation. **Mints nothing.** No FD, no XK, no PE. Closes no finding, changes no gate, disposition, owner or severity. **Proposes no change to any convention.** |
| **Discipline** | By-role throughout. **No email address appears in this document.** Author identities are named in the form the record uses. |
| **Authority note** | Local git reads only. No AWS call, no host contact, no workflow dispatch. Prod **FROZEN**. |

---

## §1 The correction, and it is to a claim made in the course of this finding

The carried item read **"four API-authored commits with misleading authorship, unfiled."**

In the exchange that produced this document it was asserted that the item was *misdescribed rather than miscounted* — that squash-merge attributes every commit to one identity, so **"there is no set of four to find."**

**That assertion is false, and the read that followed refutes it.** Branch-level authorship is heterogeneous. Across all branches not merged into `main`:

| Author name as recorded | Commits |
|---|---|
| Evoni | 168 |
| Claude | 31 |
| github-actions[bot] | 29 |
| angelcreator113 | 8 |
| TySteamTest | 6 |
| copilot-swe-agent[bot] | 2 |
| Ubuntu | 1 |

The API-authored set **is** findable, and it is findable precisely because the branches still exist. The error was reasoning from `main`'s uniformity to the whole repository without reading the branches — the same shape as the costing error earlier in this session: a conclusion drawn at one basis when the disambiguating evidence sat one command away.

## §2 What `main`'s first-parent history records

**The last 30 first-parent commits on `main` carry one author identity — `angelcreator113` — with `GitHub` as committer on each.** That is 30 of 30, including every document filed in this session, whose branch commits were authored `Claude`.

This is the squash-merge convention operating **as designed**. Squash discards the branch commits' authorship and attributes the resulting commit to the merging account. `main`'s ancestry stays thin, which is what the convention is for.

**Consequence, stated narrowly:** `git log` on `main` is not an authorship record for this register. Any derivation of who-wrote-what from first-parent history returns one answer for every commit it examines.

## §3 What the branches record, and what deletion would remove

> **Amended 2026-08-25**, basis `main` at `8fe3a8a3`. The table below previously
> carried one author per branch, and the closing paragraph reported **six**
> `angelcreator113`-authored commits against the carried item's four. Both were
> wrong. The corrected count is **four**; the cause is recorded in §3.1, a
> second-order defect in §3.2, and the superseded open question in §3.3.
>
> **Scope of this amendment is §3 alone.** §1's whole-repository author table
> covers a different and much larger population and was **not re-measured**.
> §9's second bound ("§3 records a count discrepancy it does not resolve") and
> the version block's basis line are **stale as of this amendment and are not
> corrected here**, being outside the authorized scope. Both are named so the
> omission is deliberate and findable rather than an oversight.

On the merged-but-undeleted branches specifically:

| Branch | Commits ahead | Authors, counted per commit |
|---|---|---|
| `claude/branch-a-costing` | 1 | angelcreator113 ×1 |
| `claude/branch-a-selection-record` | 1 | angelcreator113 ×1 |
| `claude/pe65-topology-pointer-banner` | 1 | angelcreator113 ×1 |
| `docs/f-auth-branch-a-prerequisite` | 3 | **angelcreator113 ×1, Evoni ×2** |
| `claude/check-cannot-fail-class` | 1 | Claude ×1 |
| `claude/dim3-token-acquisition` | 1 | Claude ×1 |
| `claude/rollback-scope-p6` | 2 | Claude ×2 |
| `claude/v25-sec6-prep-1cu9c0` | 1 | Claude ×1 |
| **Total** | **11** | **angelcreator113 ×4, Claude ×5, Evoni ×2** |

Commits-ahead counts are identical at the original basis `f77829fb` and at
`8fe3a8a3`; the correction is to authorship attribution, not to branch state.

The branches do not merely preserve authorship in general. **They preserve the
only signal that distinguishes an API-authored commit from a locally-authored
one** — the distinction the carried item is about. On `main` both appear
identically. Delete the branches and the distinction is not degraded; it is
gone, with no record that it ever existed.

### §3.1 The six was a schema defect, not a miscount

The superseded table paired one **Author of its commits** with a **Commits
ahead** count per branch. Summing that column across the `angelcreator113` rows
gave six.

`docs/f-auth-branch-a-prerequisite` is authorship-heterogeneous **inside the
branch** — one commit authored `angelcreator113`, two authored `Evoni`. A
one-author-per-row schema cannot express that, so the row attributed all three
of its commits to a single author and the column over-counted by exactly two.
Six minus two is four.

**The durable finding is the schema, not the arithmetic.** Any table pairing a
single author with a per-branch commit count fails the same way on the first
heterogeneous branch it meets, and it fails *silently*: the row is well-formed,
the column sums correctly from it, and nothing in the output indicates that a
branch carried more than one author. The corrected table counts authors per
commit, which is the granularity the claim actually requires.

### §3.2 The section under-represented the distinction it exists to defend

This section argues that branches preserve authorship signal `main` destroys.
**Its own table erased `Evoni` from the merged-but-undeleted population.** Two
commits authored `Evoni` were reported as authored `angelcreator113`, in the one
section of this document whose purpose is to establish that branch-level
authorship is heterogeneous where `main`'s is uniform.

That is a sharper defect than a wrong total. A wrong total is visibly a number
and invites checking. A table rendering a mixed-authorship branch as
single-authored reproduces, at smaller scale, precisely the flattening §2
attributes to squash-merge — and it did so inside the argument against that
flattening.

### §3.3 The superseded open question, and the population it was asked about

The superseded text asked whether all six `angelcreator113`-authored commits
arose from the API-transport period, or whether some predate it.

**Answer: none predate it.** The four are authored 2026-08-24, 19:20–22:18 UTC.
The five `Claude`-authored commits in the same population begin at 22:37 UTC the
same day. The recorded attribution changes between 22:18 and 22:37 UTC; all four
sit before that boundary, and none is separated from the others by it.

**But the question was posed about six commits, two of which are not in the
set.** A reader resolving it without noticing that the population changed
obtains a correct answer to a question about the wrong population. The question
is closed **as restated here, over four commits** — not as originally written.

**Bound.** The count of four is established by direct measurement. **The
classification of any individual commit as API-authored is inference, not
proof.** It rests on four mutually corroborating signals — recorded author
identity, author-email domain class, timezone offset, and position before the
22:18–22:37 UTC boundary — none of which independently establishes how a given
commit was produced. **No commit is individually classified here.**

**The carried item needs no correction.** It read four; four is right.

## §4 Two sound conventions, jointly destructive

**This is not a defect in squash-merge.** The convention works exactly as specified and delivers what it is for.

**Nor is delete-after-merge wrong.** It keeps the branch list legible and is standing practice here.

The finding is that **the two are individually sound and jointly destructive of a record neither was written to protect.** Squash-merge removes authorship from `main`; delete-after-merge removes the branch that still held it. Each convention is complete on its own terms. Neither has a clause about authorship, because neither was written with authorship in view. **No party made a decision to discard it.**

## §5 The safeguard is accidental, and nobody knows it is load-bearing

The branches survive because branch deletion returns **HTTP 403** on this transport, while creates and updates on the same credential succeed. That is a policy response, not a retention decision.

**It could change without notice.** If the block lifts and the standing convention runs, the branches go, and §2's uniform history is the only record.

Recording it is the point: a safeguard nobody chose, nobody documented, and nobody is maintaining will not survive the first cleanup pass that succeeds.

## §6 Tested against `obligation-outlives-its-reason`, and it is not an instance

The carried item was a candidate for the class filed earlier this session. **It was tested and does not qualify. It is not cited as an instance.**

The class requires an obligation's **stated ground to be discharged elsewhere** while the obligation survives on unstated ground. Here the ground was never discharged: the commits still exist and are still misattributed at branch level. What changed is that transport recovered, so the set stopped growing. **The ground did not die; it froze.**

It rhymes with the class — an item whose significance shifted while its text stayed put — but the defining mechanism is absent. Forcing the citation would have made the class look better supported than one instance and one negative control warrant.

**Worth recording that the temptation to cite it came from §1's false assertion.** Under that framing the item did look like a description of nothing. The correct reading removes both the framing and the instance.

## §7 Existing practice already carries authorship in document text

This is **named as established practice, not proposed as a remedy.**

Of 361 markdown documents under `docs/audit/` at this basis, **197 carry an in-body author line**, 128 of them in one canonical form naming both the model and the operator. Those lines are document content. They survive squash-merge, and they survive branch deletion, because they are inside the file rather than in its commit metadata.

That is why deleting the branches of documents that carry such a line costs less than deleting the branches of those that do not. **The practice is uneven — 197 of 361 — and no document is amended here to extend it.**

## §8 Not resolved in this document

Three responses are visible. **None is recommended, ranked, or adopted:**

- stop deleting merged branches;
- change the merge convention;
- rely on in-body author lines, per §7, and accept that commit metadata is not the record.

**This is Evoni's decision.** It is stated as the open term rather than deferred silently.

## §9 Bounds

- **§2's finding covers the last 30 first-parent commits, not the register's full history.** Whether the pattern holds further back is **unread**, and nothing here implies it does.
- **No commit is individually classified** as API-authored or locally authored. §3 records a count discrepancy it does not resolve.
- **The distinct author identities in §1 are reported as the record states them.** Whether any is external, or whether several are held by one person, is the open `PE #64` question and is **not touched here** — no inference is drawn from shared or differing identity strings.
- **The 403 is observed, not diagnosed.** Why deletes are refused while creates succeed is unestablished.
- **No claim is made that authorship metadata ought to be preserved.** The finding is that its loss would be unrecorded and unchosen, which is a different claim.

## §10 What this document does not do

- Does not mint. No FD, no XK, no PE.
- Does not amend any document, extend the §7 practice, or add an author line anywhere.
- Does not delete, retain, or request retention of any branch.
- Does not propose or adopt a convention change. §8.
- Does not cite `obligation-outlives-its-reason`. §6.
- Does not resolve the `PE #64` identity question. §9.
- Changes no gate, disposition, owner or severity. No live contact of any kind.

---

## Version block

| Field | Value |
|---|---|
| Document | `docs/audit/Finding_Authorship_Record_Preservation_2026-08-24.md` |
| Date | 2026-08-24 |
| Basis | `main` at `f77829fb` |
| Corrects | The carried item's description, and a false assertion made about it in this session. §1 |
| Reads | `git log --first-parent origin/main`; per-branch `git log origin/main..<branch>`; `git grep` over `docs/audit/*.md` |
| Mints | Nothing |
| Resolves | Nothing. §8 states the open decision |
| Operations performed | None |

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-08-24. Basis `main` at `f77829fb`. Observation only. Mints nothing. No live contact.*
