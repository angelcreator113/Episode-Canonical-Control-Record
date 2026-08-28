| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 13** *A true scoped claim was widened once, reproduced twice, and widened again. Item 7 already forbade it.* |
| --- |

# v25 Owed Index — Amendment 13

**Ruled in full by Evoni, 2026-08-28. Five decisions at §M8 — §M8.1 through
§M8.5 — are RULED, and no question in this amendment is left open for want of
one.** Where a ruling was to leave a question open, §M8.3, it is recorded as a
ruling and the question passes to `v26` on that footing.

**AMENDMENT 13 to `v25_Owed_Index_2026-08-22.md`.** Adds §M0–§M9.

**Basis:** `origin/main` at `bed437b1db4f58c8fc7f751cb1d7d009a8eb0d97`, 2026-08-28.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Rules nothing about any finding. Mints nothing.** Ships no code. Changes no
gate, severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; **ASSESSMENT NOT COMPLETED**. FD tail **FD-69** (retired at #1102),
**FD-70 next-available and unminted**; XK tail **XK-3**; PE tail **PE #68**.
Prod **FROZEN**.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     9      occurrences
grep -r  'FD-70' docs/audit/ | wc -l     9      matching lines
grep -rl 'FD-70' docs/audit/ | wc -l     6      files
grep -r  'XK-4'  docs/audit/ | wc -l     0
grep -r  'PE #69' docs/audit/ | wc -l    0
Session_PE_Roster.md highest entry       PE #68
```

**All nine `FD-70` lines were read individually; every one declares it
next-available and unminted.** The tail claim rests on that reading, not on the
count.

**A prior revision of this draft asserted *eight* and named no instrument. See
§M7.4.**

---

# §M0. Why this amendment exists

**Two sessions worked `v25` Sec 6 at this basis from different environments.
Each caught defects in the other's report. Both had reproduced the same false
claim, inherited from a filed document.**

The claim is `v25_Owed_Index_Amd11_2026-08-28.md` §K2.2 line 382:
*"`auto-merge-to-dev.yml` is the only workflow in the repository with an
automatic `push` trigger."*

**`.github/workflows/validate.yml` carries `push` on `[main, dev]` and
`pull_request` on `[main, dev]`, and is `active`.**

**This amendment records the propagation, the correction, and the compliance
failure — and it declines to file a new method rule, because the rule that
would have caught this was already filed and correct.**

---

# §M1. The widening is locatable to one line, and it was reproduced three times

## §M1.1 The chain

| step | locus | text | scope |
|---|---|---|---|
| origin | `Prime_Studios_Audit_Handoff_v25.md:120` | *"Manual SSM dev dispatch authorized; push trigger **absent** (Sec 3.4)"* | **the dev path. TRUE.** |
| widening | `v25_Owed_Index_Amd11_2026-08-28.md:382` | *"the only workflow in the repository with an automatic `push` trigger"* | **the repository. FALSE.** |
| re-cite | `v25_Owed_Index_Amd11_2026-08-28.md:384` | *"v25 Sec 1's 'push trigger absent' **for the dev path** is confirmed"* | **the dev path. TRUE.** |

**The widening and a correct citation of the unwidened original sit two lines
apart in one paragraph.** Both were written in the same sitting.

Two sessions then reproduced line 382 without re-deriving it. One of the two
widened it a second time, from *"the only automatic `push` trigger"* to
*"zero live automatic triggers on tracked YAML"* — dropping the `push` scope,
which would not have saved the claim in any case, since `validate.yml`'s
automatic trigger **is** a `push`.

**One true scoped claim, one widening, two reproductions, one further
widening.**

## §M1.2 Every instance carried the disproof on its own page

**This is the load-bearing fact and it defeats the obvious causal story.**

- `Amd11` **line 372** records `validate.yml`'s triggers correctly — *"`pull_request` + `push` on `[main, dev]`, `workflow_dispatch`"* — **ten lines above the prose that contradicts it.**
- Both later reports printed `validate.yml`'s `on:` block or its trigger row **in the same message** as the false assertion, one from `origin/main` YAML directly.

**Three documents, three correct records, three wrong conclusions.**

## §M1.3 The causal claim that was offered, and withdrawn

An intermediate draft attributed the propagation to
`Prime_Studios_Audit_Handoff_v25.md` Sec 3.4, whose `Validate` row leaves the
trigger cell as `—`, reading as *none* rather than as *not derived*.

**Withdrawn by its author.** A blank cell cannot cause an error in three
documents that each contained the right answer, and at least one instance is on
the record as having printed the correct triggers from the tree in the same
message. **§M2 keeps the cell as a defect on its own merits and not as this
one's cause.**

**Recorded rather than dropped**, on `Amd12` §L1.1's ground: a correction whose
wrong path disappears leaves a successor unable to tell whether the conclusion
was reasoned to or arrived at.

## §M1.4 The rule already existed, and this is a compliance failure against it

`Prime_Studios_Audit_Handoff_v25.md` Sec 6 **item 7**, as filed, prescribes
precisely the sweep that catches §M1. **None of the three derivations ran it.**

**Therefore this amendment files no new method rule for §M1.** The defect is
non-compliance with a correct existing instruction, not a missing instruction
and not a blank cell.

**Evoni's ruling 2 keeps this section here — §M8.2.** It is filed inside this
amendment and **is not a carry**; a `v26` author enumerating findings should not
pick it up as an eighth.

> **CORRECTED IN DRAFT, RECORDED RATHER THAN REVERTED SILENTLY.** A prior state
> of this paragraph read *"Evoni has ruled that it files separately"* and routed
> the compliance finding to `v25_Owed_Index_Amd14_2026-08-28.md`. **Both were
> wrong.** Ruling 2 as received in the drafting channel keeps §M1.4 here, and
> `git cat-file -e origin/main:docs/audit/v25_Owed_Index_Amd14_2026-08-28.md`
> returns *does not exist in 'origin/main'*; no such file exists in the tree or
> the working copy. **The drafting party cannot account for that paragraph from
> its own edits** — see §M7.8. **It is a pointer that dangles into nothing,
> which is §M7.7's other half: the failure mode that announces itself, and did.**

---

# §M2. `Prime_Studios_Audit_Handoff_v25.md` Sec 3.4 — the `Validate` trigger cell

**A second and independent defect.** Sec 3.4's table, verbatim at this basis:

```
| Validate | `validate.yml` | `active` | — |
```

**Every other row carries a trigger. This one carries an em-dash**, and it is
also the only row whose state cell carries no date. **A blank cell answers
*did I record this*; it reads as *what is it*.** That is
`Prime_Studios_Audit_Handoff_v25.md` Sec 4.3's own family — an instrument
answering a question adjacent to the one asked.

**It sits directly above** Sec 3.4's own sentence that the thirty most recent
runs repo-wide were all `Validate` — which is what a constantly-firing
automatic trigger looks like.

**Correct value, derived at this basis:**
`push` on `[main, dev]`, `pull_request` on `[main, dev]`, `workflow_dispatch`.

**This document is the amending authority for that cell**, subject to §M8.

---

# §M3. `Amd11` §K2.2's uniqueness clause — corrected, and what replaces it

**`Amd11` §K2.2 line 382 is withdrawn.** Its surrounding paragraph is otherwise
sound: workflow-level state and trigger do dissociate in both directions, and
line 384's dev-path citation is correct and unaffected.

**This document is the amending authority. `Amd11` is not edited in place**, per
`Amd12` §L3.3's convention, subject to §M8.

**Three replacement formulations were produced across the two sessions, each
narrower than the last, each still wider than the sweep backing it.** A fourth
is not offered. **What is filed instead is a sweep with its bounds stated:**

> **Swept:** `git ls-tree -r --name-only origin/main .github/` — 23 paths, full
> listing, at `bed437b1`.
>
> `.github/` contains **four** workflow files and **one** `dependabot.yml`. No
> other `.yml` or `.yaml` at any depth.
>
> Of the four workflows, **two declare automatic triggers**:
>
> | file | automatic triggers | permissions | reach |
> |---|---|---|---|
> | `auto-merge-to-dev.yml` | `push` on `claude/**` | **no top-level `permissions` block**; mints an App token via `actions/create-github-app-token@v1` from `secrets.APP_ID` / `secrets.APP_PRIVATE_KEY` (line 82) | write |
> | `validate.yml` | `push` + `pull_request` on `[main, dev]` | `contents: read` (top-level, line 10; no job-level override) | read-only CI — jobs `cost-audit`, `route-validation`, `tests`, `frontend-tests`; **zero `secrets.` references** |
>
> `deploy-dev.yml` — `workflow_dispatch` only; `contents: read` + `id-token: write` (OIDC).
> `deploy-production.yml` — `workflow_dispatch` only, two required inputs.
>
> **EXCLUDED, and the exclusions are the substance:**
> **(1) Workflow enablement states are not tree-derivable** — see §M5.
> **(2) The copilot surface** — `active`, with run history, **triggers not
> derivable from any file.** That is PE #68 territory and is not ruled here.
> **(3) `dependabot.yml`'s security-update state** — see §M4.

**This form does not strengthen under paraphrase**, which is the property the
three prior formulations lacked.

---

# §M4. `.github/dependabot.yml` — an automatic surface outside `workflows/`

**Named by neither report's enumeration.** Tracked YAML, carrying an automatic
schedule, **outside `.github/workflows/` and returned by no `list_workflows`
call.** A sweep of the workflows directory does not find it; an API workflow
enumeration does not return it.

```
version: 2
updates:
  - package-ecosystem: npm, directory: /,         schedule: monthly, open-pull-requests-limit: 0
  - package-ecosystem: npm, directory: /frontend, schedule: monthly, open-pull-requests-limit: 0
```

Last touched `5cfe56b000c80293fe8a328b7efea9bc84f14003`, 2026-02-14 —
*"clean up CI - remove pr-checks workflow, streamline deploy-dev, disable
Dependabot PRs."*

**No write or deploy reach. Version-update PRs are capped at zero. It is
suppressed by one integer, not disabled.**

## §M4.1 The residue, and it points the opposite way from the commit message

**Derivable from the tree, and all that stands unqualified on a tree read:**

> `dependabot.yml` sets `open-pull-requests-limit: 0` for both ecosystems.
> **The file expresses no security-update setting.**

**§M4.1a — a third source class, labelled rather than smuggled.**

An earlier draft of this amendment asserted that the limit governs version
updates only and that security updates are a repository-level setting, **as a
flat claim with no source.** It was neither a tree read nor an API read.
**Filing an unsourced platform-behaviour claim inside the amendment that
documents §M1's pattern would have been the fourth instance of it.**

**It is resolvable, and it was resolved.** This is **neither a tree read nor an
API read.** It is labelled **VENDOR DOCUMENTATION** and carries the weight of
that class only.

**Source, retrieval date, and verbatim text, carried so the class has a
checkable instance rather than a badge on a paraphrase:**

| # | source | retrieved | verbatim |
|---|---|---|---|
| 1 | `docs.github.com/en/code-security/dependabot/dependabot-security-updates/customizing-dependabot-security-prs` | 2026-08-28 | *"set the open-pull-requests-limit key to 0"* — as the documented means of applying an ecosystem's configuration to security updates only |
| 2 | `docs.github.com/en/code-security/reference/supply-chain-security/troubleshoot-dependabot/dependabot-errors` | 2026-08-28 | *"separate limits for security and version update pull requests"* — so open version-update PRs cannot block a security-update PR |
| 3 | `docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates` | 2026-08-28 | *"enable or disable Dependabot security updates for an individual repository"* — via Settings → Advanced Security |

**Reach, and the nearest existing fit is §M5's — which is not the same as being
its case.** These were retrieved by one party. **The other party's environment
returns `EGRESS_BLOCKED` for `docs.github.com` at the network proxy and cannot
read the source at all.**

**Two disanalogies to §M5, named rather than glossed:**

**(1) §M5 carries a reproducing anchor and this section carries none.** §M5's
unverifiable API figures sit beside tree halves — the four `on:` blocks and the
copilot path's absence — that **reproduce byte-for-byte in both environments**,
about the same objects. **§M4.1a has no such half, and cannot have one in
principle:** the objects described are GitHub's platform behaviour, which no
repository read reaches. URLs, date, verbatim text, and the conclusion drawn
from them all rest on a single unreproduced read.

**(2) §M5's asymmetry is a transient budget; this one is standing policy.** The
anonymous rate limit carried a published reset. **`EGRESS_BLOCKED` does not
reset.** A convention shaped for *"the other party can perform this read later"*
is not obviously the convention for *"one party's environment forbids the
read."*

**Consequence, stated plainly:** carrying URL, date and verbatim text makes the
quotation checkable **by a future reader with reach**. **It is vacuous within
this exchange — no party present can check it.** That is a weaker guarantee
than §M5's and the difference is not cosmetic.

**Whether §M5's convention should extend to this class, or whether the class
needs its own, is a register question and is NOT decided here.** §M9 reserves
it. **A prior revision of this section concluded that no new convention was
needed — which settled, inside §M4.1a, the question §M9 reserves to Evoni.
Withdrawn.** Recorded rather than silently deleted, because a document that
reserves a ruling in one section and takes it in another has taken it.

**What the class does not do:** it does not establish anything about *this*
repository. Sources 1–3 are statements about platform behaviour, not reads of
`angelcreator113/Episode-Canonical-Control-Record`.

## §M4.2 The consequence, stated as a possibility and not a finding

`5cfe56b0`'s commit message reads *"disable Dependabot PRs."* **The
configuration as written is the documented recipe for security-only PRs.**

**Version updates are suppressed. Security updates are governed by a setting
this session cannot read** — not in the tree, and requiring an authenticated
repository-settings read that neither party performed.

**If that setting is on, the repository holds an automatic pull-request-opening
surface that is returned by no `list_workflows` call, found by no sweep of
`.github/workflows/`, and named by neither report's enumeration.**

**NOT ESTABLISHED in either direction. NOT INFERRED.** The conditional is
recorded because the enablement state is a one-call read for a party holding
the capability, and because **the standing autonomous-PR pattern concerns
exactly this kind of surface** — `Session_PE_Roster.md:2146` and `:2307`, and
`v25_Owed_Index_Amd12_2026-08-28.md:31`. **Whether it bears on PE #68 is not
ruled here** — that question is reserved.

**A prior revision cited this to `Prime_Studios_Audit_Handoff_v25.md` Sec 7.2.
That is wrong and is corrected here.** `grep -ic 'autonomous.PR'` over `v25`
returns **0**; Sec 7.2 is `F-Deploy-G1-AE — the severity ground has moved`.
**The bad citation resolved to a coherent, unrelated, plausible section — F1's
shape, recurring inside the revision that fixed F1.** See §M7.7.

**The file tells you version updates are suppressed. It does not tell you the
surface is quiet, and on the vendor documentation it is the wrong file to ask.**

---

# §M5. Items 1(c), 7's API half, and 13's Actions closure — performed by one party only

**Performed** by the session holding an authenticated GitHub channel. **Method
stated inline, per item 1(c): GitHub MCP, `list_pull_requests` and
`list_workflows`, authenticated as `angelcreator113` (id 212567798), confirmed
by `get_me`.**

- **1(c) — zero open pull requests.** Empty array from a successful
  authenticated read.
- **7 — `total_count: 5`.** `deploy-dev.yml` `active`; copilot `active`;
  `validate.yml` `active`; `deploy-production.yml` **`disabled_manually`**;
  `auto-merge-to-dev.yml` **`disabled_manually`**.
- **13 — `deploy-production.yml`: 76 runs, last #76 at `2026-05-16T06:49:59Z`,
  `workflow_dispatch`, failure; workflow `updated_at 2026-06-02T17:51:16-04:00`.
  `deploy-dev.yml`: 2961 runs, last `2026-07-21T14:55:26Z`.
  `auto-merge-to-dev.yml`: 1677 runs, last `2026-06-27T12:40:02Z`.**
  Copilot surface: **6 runs, most recent `2026-08-03T18:39:20Z`**, event
  `dynamic`.

**Reach, in `Amd12` §L1.3's form.** The other session held no authenticated
capability: 18 anonymous calls across two distinct egress IPs
(`34.24.201.81`, `35.196.141.6`), all exhausted, one **429** among the 403s.
**Every figure in this section is one party's read and is unverified by the
other.**

**A re-confirmation of these figures by the party that took them is
transcription fidelity, not a second read** — the channel would be the same
channel. **No successor should count it as independent verification**, and none
is claimed here.

The tree halves — the four `on:` blocks and the copilot path's absence
by literal-path `cat-file -e` — **reproduce byte-for-byte in both
environments.**

## §M5.1 Item 13's split is preserved

**The Actions path to production is closed at this basis** — the workflow is
`disabled_manually`, its only trigger is `workflow_dispatch`, which a disabled
workflow does not serve, and it has not run in three months.

**The residue — SSM, SSH, console — is NOT PERFORMED and is not derivable.**
These are different claims and they are not collapsed. **§M1's correction does
not disturb this**: `validate.yml` reaches no host, declares `contents: read`,
and references no secrets.

## §M5.2 A method note for item 1(c), and its bound

**`https://api.github.com/rate_limit` is unmetered and returns HTTP 200 while
`core` is exhausted**, isolating budget exhaustion from proxy or network denial
in one call rather than by repetition. **Bound: this addresses the anonymous
case only.**

**The stronger disclosure for item 1(c) is to name the capability *and the
identity it authenticated as*** — an authenticated empty array and an anonymous
rate-limited failure are the same shape on the page.

---

# §M6. Item 1(f)'s third FAIL case — a harness-provisioned worktree

**Item 1(f) names two FAIL cases: nonzero-*behind* (stale worktree, bring to
`origin/main`) and nonzero-*ahead*/zero-*behind* (ordinary unmerged work, do
not discard).**

**A third occurred.** One session's provisioned worktree presented:

```
is-shallow-repository          true        (.git/shallow, 3 grafts)
rev-list --count HEAD          50
origin/main                    6b0900be    (2026-08-22, #1097 — 47 behind)
HEAD                           bed437b1    (correct from the start)
```

**POSITION read FAIL on entry, on a worktree that was exactly correct.** The
ahead-commits were already on the real remote `main`; the remote-tracking ref
was simply stale. **Under a naive FAIL response that reads as 47 commits of
unmerged work. It is zero.**

**Only `1(a)` distinguishes them**, which is why item 1's clause order is
forced. This run is live evidence for a rule previously asserted on reasoning.

## §M6.1 H2 is load-bearing, not careful

**After the fetch, local `refs/heads/main` remained stale at `6b0900be`, 47
behind.** `git show main:path` returns six-day-old content **silently**. H2's
instruction to read `git show origin/main:path` is not conservatism in this
environment; it is the only correct read.

## §M6.2 Correction to that session's own working

Before unshallowing, `rev-list --count`, `merge-base --is-ancestor`, and
`rev-list --left-right --count` were run on the shallow graph. **All three were
unsound when taken** and are superseded by the post-unshallow values.
**`--is-ancestor` returning non-zero on a shallow graph means *unknown*, not
*no*.**

---

# §M7. Withdrawals and self-application

**§M7.1 — `f375`. Withdrawn as to the filed document.** A correction was filed
against `Amd12` §L2 for recording the `amd11` branch tip as `f375`.
**`grep -c 'f375'` over `Amd12` returns 0.** §L2 as filed reads `f37e3516` and
always did. **The wrong prefix existed only in a prose summary**, where it was a
transcription error between tool output and report. **Placing a defect on a
filed document that does not contain it is `Amd12` §L3.2's shape and is
withdrawn on that ground.** Full value: `f37e35166a050435708b4d2471f232f9bff50836`.

**§M7.2 — the branch count.** `158` and `157` were both correct instruments
pointed at different objects: `git branch -r | wc -l` counts the
`origin/HEAD -> origin/main` symref line; the harness clone sets no
`origin/HEAD` and had none to count. **`git ls-remote --heads origin` is the
count and returns 157. `git branch -r | wc -l` is not a branch-count
instrument.**

**§M7.3 — a Sec 5.5 citation collision, reproduced.** One report cited
*"14 documents / 18 events"* without naming the column. **Those digits are the
*excl. chain + `v1.48`* pair on the `6aea0f73` row and simultaneously the
*all* pair on the `7c508189` row.** The figure was right; the citation form
reproduces the exact ambiguity Sec 5.5 was written to defuse. **Cite the basis
and the column, or neither.**

**§M7.4 — a count taken from a truncated display, inside the document that
files §M7.2.** An earlier revision of this amendment's Status block asserted
`FD-70` occurs **eight** times. The figure came from
`grep -rn 'FD-70' . | head -8` — **the length of a deliberately truncated
display, reported as a count.** No instrument was named. **`head -N` is a
display bound, not a count**, exactly as `git branch -r | wc -l` is not a
branch count. **Twenty lines separated the defect from its own statement.**
Corrected by pasting three instruments and their outputs, per H1 — **not by
selecting whichever instrument returns eight**, which would be reconstruction
of intent rather than derivation.

**§M7.5 — the attribution pattern, named because it is now three.** A
characterization attributed to a party whose words do not contain it:

| # | attributed to | attributed content | record |
|---|---|---|---|
| 1 | Evoni | *"you reversed the earlier answer…"* | three words, none of them that — `Amd12` §L3.2, withdrawn there |
| 2 | `Amd12` §L2 | the value `f375` | `grep -c 'f375'` returns 0 — withdrawn at §M7.1 |
| 3 | a party's own prior message | that §M4.1's platform claim was supplied hedged, *"not tree-derivable either way"* | the message states it in bold with no hedge |

**Instance 3 is self-directed, which is the only structural difference.** In
each case the correction's *direction* depends on the misattributed premise:
whether a hedge was dropped or never existed decides whose defect §M4.1 is.
**Named as a recurrence, not minted.** Whether three instances constitute a
class, and whether that class is `Amd11` §K2.4's or a distinct one, is **not
decided here** — §K2.4.1a leaves the parent question open and this amendment
does not close it.

**§M7.6 — this document lands inside its own subject.** It is drafted by a
session that reproduced §M1's claim, corrects a document it relied on, and
proposes an entry against an item it failed to comply with. **Stated on its own
face**, per `Amd10` §J6 and `Amd12` §L1.5.

---

**§M7.7 — two wrong-locus citations, the second inside the fix for the first.**
Both produced by this draft, both caught in review:

| # | as cited | what is actually there | corrected to |
|---|---|---|---|
| 1 | `v25:132` for the dev-path push-trigger claim | the FD-tail row — *"FD-70 is the next available number"* | `v25:120` |
| 2 | `v25` Sec 7.2 for the standing autonomous-PR pattern | `F-Deploy-G1-AE — the severity ground has moved`; the phrase occurs **0** times in `v25` | `Session_PE_Roster.md:2146`, `:2307`; `Amd12:31` |

**Neither citation resolved to nothing.** Both landed on real, coherent,
topically plausible text — which is the failure mode, because a successor
following either finds something and stops. **A citation that dangles announces
itself; a citation that lands on the wrong thing does not.**

**Instance 2 was written into the revision whose purpose included fixing
instance 1.** Recorded on that ground rather than as two transcription slips.
**Not minted as a class**, and its relation to §M7.5's is not ruled.

---

**§M7.8 — two adjacent sites in this draft changed outside the drafter's
account, in a single transition.** §M1.4's closing paragraph changed from
*"whether that belongs in the same instrument … is not decided here"* to **an
assertion that Evoni had ruled it files separately, plus a pointer to a
non-existent `v25_Owed_Index_Amd14_2026-08-28.md`** — and its **heading**
changed in the same direction.

**A reviewing party traced the transition across six versions it had received.
The flip occurs exactly once**, at one revision boundary, **affecting both sites
in the one section.** It did not recur, and it did not reappear above a site
that had just been corrected: **the heading persisted only because subsequent
revisions fixed the paragraph and not the heading.**

**Two candidates, both mundane, both named so a reader need not supply a third:**

1. **A revision drafted under the opposite assumption and incompletely
   reverted.** One event, two adjacent sites, one section — the shape fits, and
   the trace localizes it to a single transition rather than to repeated
   interference.
2. **Two lineages exchanged as attachments rather than edited through one
   file.** Under that topology, *an edit one party made is absent from the
   other's copy* and *an edit one party did not make is present in it* are both
   ordinary hand-merge outcomes. **No shared writable path and no lost revert
   are required.**

**Weight, corrected downward from an earlier revision of this section**, which
recorded it as two independent unaccountable edits and a correction that
reappeared. **The trace supports neither.** **No mechanism is asserted and the
question is not adjudicated.**

**Residue, kept because it is what is actually unresolved:** the drafting party
still **cannot identify which of its own edits produced the flip**, and the
transition falls inside its own revision sequence. **That is a gap in the
drafter's account, not evidence of anything beyond it.**

**The durable consequence is untouched and is the reason this section exists at
all: a draft that changes outside its drafter's account is not a trustworthy
artifact merely because its current text reads correctly.** **Any version
proposed for filing is re-derived and re-checked in full immediately before the
commit, not assumed stable from the last review.**

---

# §M8. Carriage and instrument — RULED

**Ruled by Evoni, 2026-08-28, in the drafting session's own channel.**

**Provenance, stated precisely because §M7.5 is in this document, and the three
rulings do not all have the same provenance.**

- **Ruling 1 is Evoni's own words**, given in prose after the drafting party
  argued a position. It is quoted, not paraphrased.
- **Rulings 2 and 3 are selections against question wording written by the
  drafting party.** They are the choices made. **They are not Evoni's words and
  are not quoted as such.**

**The distinction is kept because a selection against drafted option text is not
the selector asserting the drafter's premise.** A parallel session encoded a
contested reconstruction into the only two options it offered and then reported
the resulting click as a ruling. **That is §M7.5's shape moved one step
earlier — words put in a party's mouth *before* the fact, where a selection
converts the drafter's framing into the selector's ruling.** Recorded here
because this document's own rulings 2 and 3 are selections and a successor
should know which weight each carries.

## §M8.1 Ruling 1 — carriage: route (a), after (b) on a corrected price

**RULED IN EVONI'S WORDS:** *"i did choose b"* … *"yes i agree a is better."*

**The sequence, which is the record, and it is not a single ruling:**

1. **(b) was put at a stated cost of one blob move.** That figure was wrong and
   it was the drafting party's.
2. **Evoni chose (b) on that price.**
3. **The true cost was derived:** under a both-targets reading (b) moves
   **three** blobs — `v25`, `Amd11`, `Amd12` — and additionally invalidates
   `Amd11` §K3's authority table and both item 2 derivations at this basis.
4. **(a) was argued on the corrected price**, on the ground that its costs are
   **temporary and already routed** while (b)'s are **permanent**.
5. **Evoni ruled (a).**

**(b) is not deleted from this record.** A superseded ruling and a ruling never
made are different objects, and only the record separates them. **A decision
taken on a wrong price is not the same object as one taken on the right price** —
this section argued that before it had the sequence that demonstrates it.

**Effect. `Prime_Studios_Audit_Handoff_v25.md` and
`v25_Owed_Index_Amd11_2026-08-28.md` are UNTOUCHED. No pointer banner is placed
on either.** This amendment is the sole authority for §M2's `Validate` trigger
cell and §M3's uniqueness clause, per the additive-supersede convention and
`Amd12` §L3.3's own choice.

**No blob moves on their account.** `v25` stays at
`d8beaca0ad6b655ea560cf75d1cb02df3f52adc6`; `Amd11` stays at
`b94848f8a7d1b3c48bfb71a3fc4ff13049e43d96`. **`Amd11` §K3's authority table and
both item 2 derivations at this basis remain correct.** `v25` Sec 5.5's
in-place-amendment population does not increment on their account.

**The accepted cost, restated rather than dropped:** nothing inside `v25` points
a `v26` author from Sec 3.4's blank cell to this amendment, and **Sec 6 item 4
does not rescue it** — item 4 reads correction banners, and under (a) there is
none, so it never fires.

**Two existing routes cover it, which is why the cost is temporary:**
**(1)** the cold-session protocol reads the Owed Index chain tail before the
handoff body, and this amendment filed under (a) **is** that tail;
**(2)** `v26` supersedes `v25` Sec 3 by the same convention under which `v25`
superseded `v24`'s Sec 1, 2, 3 and 6 — **the blank cell ceases to be authority
when `v26` lands**, and this amendment supplies its `v26` author the correct
value.

**(b) remains available at no deferral cost.** Banners are additive; placing
them later requires no correction to this amendment. **The reverse does not
hold**, and that asymmetry is the ground ruling 1 was taken on.

## §M8.2 Ruling 2 — instrument: §M1.4 files inside this amendment

**§M1.4's compliance failure against `v25` Sec 6 item 7 stays here.** It is not
split into a separate instrument.

**It is not an eighth carry.** §M1.4 indicts compliance with an existing correct
rule; §M2–§M7 record facts and corrections. **A `v26` author carrying findings
forward should not carry §M1.4 as one** — see §M9.

## §M8.3 Ruling 3 — VENDOR DOCUMENTATION: left open, passes to `v26`

**The class is neither admitted nor rejected.** §M4.1a labels one use, carries
its three sources with retrieval date and verbatim text, and names two
disanalogies to §M5. §M9 declines to ratify.

**The question passes to `v26` open:** whether the register admits vendor
documentation as a source class, on what weight, and whether §M5's reach
convention extends to a party barred by standing egress policy rather than by a
resetting budget.

## §M8.4 Ruling 4 — the owed `Amd12` forward-pointer banner: PLACED

**Flagged as unruled across four revisions, deliberately not assumed in either
direction. Ruled 2026-08-28: place it.**

**Ruling 1's scope was `v25` and `Amd11` — the two §M2/§M3 targets, and it did
not reach the chain.** The chain convention is separate: each amendment places
the prior link's forward pointer, as `Amd12` did for `Amd11`. **This ruling is
independent of ruling 1 and does not disturb it** — no banner is placed on `v25`
or `Amd11`, and their blobs do not move.

**Placed on filing. `v25_Owed_Index_Amd12_2026-08-28.md`'s blob moves under an
unchanged filename** — `v25` Sec 4.1 defeater 3, disclosed banner-forwarding in
Sec 5.5's sense, the category Sec 5.5 already excludes from its right-hand pair.
**Under ruling (a) it is the only blob that moves.**

```
before placement   34f9ac0df1105fa0d074ced2ced4fad59aea0c66
after  placement   9ba6c13cf2c2404982a00614117316622c4d1f2f
```

**The post-placement value above was MEASURED after the banner was written, by
`git hash-object` over the file on disk. It was not predicted, and no value was
written into this document before the banner existed.**

**`Amd6`'s absent pointer banner is untouched** — placing it requires first
ruling which of two candidate forward-pointers is correct, `Amd7` §G6, and that
ruling is not this amendment's to make.

---

## §M8.5 Ruled — the live PE #68 reproduction is NOT in this amendment

**RULED IN EVONI'S WORDS:** *"i agree Not in Amd13. Amd13 is the trigger claim.
Keep it that way."*

**The repository is public, derived and not assumed:** unauthenticated
`upload-pack` returns **200** where a nonexistent-or-private path returns
**401**, and a credential-free clone of the full 5232-commit history completed.
**The word is load-bearing** — on a private repository an unauthenticated
request is answered 401 indistinguishably from a nonexistent one, and the
semantics of both sessions' readings turn on it.

At this basis two sessions returned **different write postures on the same
`receive-pack` endpoint for this repository, minutes apart**: one a
populated advertisement, one HTTP 401 with GitHub's body text *"No anonymous
write access,"* no credential/extraheader/askpass keys, no token environment,
no proxy. **Neither session holds a credential in repository configuration** — no
credential, extraheader or askpass keys, no token environment, no credential
embedded in `remote.origin.url`, in either.

**Narrowed by a control both sessions ran, and derivable from both rather than
one: the divergence is `receive-pack`-specific.** On `upload-pack` the two
sessions behave identically — bogus path **401**, target **200**. **They part
only on the write service.**

**The session that received the populated advertisement has an egress proxy
set; the session that received 401 has none.** In that session the REST API is
proxy-gated while the git wire protocol is served. **Whether the proxy supplies
credential material or forwards to an environment already holding it is NOT
distinguished by these observations**, and no stronger mechanism is asserted.
Two sessions, one bit.

**The finding is the asymmetry, and it requires both parties' reads** — neither
can attest the other's, per §M5's convention.

**It is not filed here.** It belongs to `Session_PE_Roster.md`'s docket, and
**routing it is Evoni's.** **PE #68's open question stays open, its decline
unchanged, and nothing here alleges that any past pull request or workflow run
was proxy-mediated.** No push was attempted; **no credential value was read,
printed, or sought.** The gate observed is **advertise-stage only** and does not
establish that a push would complete.

---

# §M9. What this amendment does not do

- **Does not amend `Amd11` or `v25` in place.** §M2 and §M3 are the amending
  authorities, per the additive-supersede convention, subject to §M8.
- **Does not mint.** No FD, no XK, no PE. FD-70 remains next-available and
  unminted.
- **Does not offer a fourth formulation of the automatic-trigger claim.** §M3
  files a bounded sweep with named exclusions instead.
- **Does not establish whether Dependabot security updates are enabled for this
  repository**, in either direction. §M4.2 states the consequence as a
  conditional and **does not infer the antecedent.** The read is available to a
  party holding an authenticated repository-settings capability; neither party
  here held one.
- **Does not ratify VENDOR DOCUMENTATION as a source class, and does not rule
  that §M5's convention extends to it.** §M4.1a labels one use, carries its
  sources, and names two disanalogies to §M5. **Whether the register admits the
  class, on what weight, and under whose convention is a register question and
  is not decided here.** A prior revision of §M4.1a concluded otherwise and is
  withdrawn there.
- **Does not offer §M1.4 as a carry.** It records non-compliance with an
  existing correct rule, `v25` Sec 6 item 7. **A `v26` author enumerating
  findings from this amendment should not carry it as an eighth.** §M8.2.
- **Does place the owed `Amd12` forward-pointer banner**, ruled by Evoni —
  §M8.4. **It amends no text in `Amd12`; it points and carries nothing.** Its
  post-placement blob is measured, not predicted.
- **Does not file the live PE #68 reproduction.** Ruled out of this amendment
  by Evoni; it belongs to `Session_PE_Roster.md`'s docket and its routing is
  hers. §M8.5. **PE #68's open question and its decline are unchanged.**
- **Does not mint §M7.5's attribution recurrence as a class**, and does not rule
  whether it falls under `Amd11` §K2.4. §K2.4.1a's parent question stays open.
- **Does not verify §M5's API figures.** They are one session's read and the
  reach is stated.
- **Does not rule on the copilot surface's triggers or its relation to the
  standing autonomous-PR pattern.** **PE #68's open question is untouched.**
- **Does not rule** on `Prime_Studios_Audit_Handoff_v25.md` Sec 4.4's class,
  `F-Deploy-1_Fix_Plan_v1.49.md`'s prior-art citation standing, `v25` Sec 6
  item 10-B, `Amd10` §J1.1's class, the operational-text class, whether `Amd11`
  §K1.3.2's or §K2.4's shapes name families, or what *"filed"* means.
- **Does not place `Amd6`'s absent pointer banner.** That requires first ruling
  which of two candidate forward-pointers is correct — `Amd7` §G6 — **and that
  ruling is not this amendment's to make.**
- **Items 8, 9, 11 and 12 remain Evoni-gated and NOT PERFORMED.** None is
  inferred and **no search for credentials was made.**
- **Does not touch production.** No host, AWS, database, or Cognito contact. No
  endpoint exercised.

---

**Owed on filing, per the chain convention — RULED and DISCHARGED, see §M8.4.**
This amendment owed `Amd12` a forward-pointer banner. **It is placed.**

```
v25_Owed_Index_Amd12_2026-08-28.md   34f9ac0df1105fa0d074ced2ced4fad59aea0c66
                                  -> 9ba6c13cf2c2404982a00614117316622c4d1f2f
```

**`v25` Sec 4.1 defeater 3 occurring again** — content moves, filename and
number do not — disclosed banner-forwarding in Sec 5.5's sense. **The forward
value was measured after placement and never predicted.** Under ruling (a) it is
the only blob this filing moves: `v25` stays at `d8beaca0…` and `Amd11` at
`b94848f8…`.

---

*Type: amendment, derivation and record only. Edits no file outside
`docs/audit/`. No host, AWS, database, or Cognito contact. No endpoint
exercised. Prod FROZEN.*
