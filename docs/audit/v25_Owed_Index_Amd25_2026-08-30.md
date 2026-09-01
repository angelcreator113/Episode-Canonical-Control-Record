| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 25** *Two method findings. One is measured on `main` and traps a careful reader; the other is attested only, and says so.* |
| --- |

> ## ⚠ STATUS UPDATE — §AA4's "no database read" clause is UNSUPPORTED. Read this first.
>
> **§AA4 below restates Amd23 §Y3's inference: that filing the `SequelizeMeta`
> listing is an act requiring no database read, since that output already exists
> from the admissible run at Amd22 §X2. Nothing establishes that any party still
> HOLDS that output.** Amd23 §Y3 itself records that the listing was never filed
> as an evidence note. **Produced is not held.** See
> `v25_Owed_Index_Amd26_2026-08-31.md` §AB2, which convicts both documents on the
> same ground.
>
> **Measured:** no file on `origin/main` holds the 219-entry listing.
>
> **What is NOT superseded.** **§AA1's standing scheme stands**, and is the
> instrument later amendments use. **§AA2's squash-ancestry finding stands.**
> **§AA3 stands at its filed ATTESTED standing.** **The rest of §AA4's
> does-not list stands** — the clause corrected here is the parenthetical
> justification, not the entry it qualifies. **Availability of the listing is
> UNMEASURED, not disproved.**
>
> **§AA4's text is retained unaltered.**
>
> *Banner added 2026-09-01 on Evoni's ruling. Not a supersede.*

***Provenance:*** *route ruled by Evoni on 2026-08-30 — **chain amendment, method-only, both findings with standing marked**. **Push and merge are NOT ruled and are not assumed.** Rule 7 gates the push, the PR create and the merge separately, for doc-only changes explicitly (`F-Deploy-1_Fix_Plan_v1.5.md:165`; `Fix_Plan_v1.2.md:106`; `Session_PE_Roster.md:2208-2209, 2309-2310`).*

# v25 Owed Index — Amendment 25

**FILED 2026-08-30 on Evoni's authorization.** **Merge to `main` UNRULED.**

**AMENDMENT 25 to `v25_Owed_Index_2026-08-22.md`.** Adds §AA1–§AA4.

**Basis:** `origin/main` at `7eb8b3ef034fc5bb8c35ed82c986401ffac66d44`, 2026-08-30.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Carries two method findings at different standings and nothing else.** Records
no closure, corrects no predecessor, mints nothing. Ships no code.
Prod **FROZEN**.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     49
grep -r  'XK-4'  docs/audit/ | wc -l     27
grep -r  'PE #69' docs/audit/ | wc -l    27
Session_PE_Roster.md highest entry       PE #68
Owed Index chain tail (pre-Amd25)        v25_Owed_Index_Amd24_2026-08-30.md
```

**Movement since Amd24's basis (`3cef134d`, which read 45 / 23 / 23) attributed
rather than asserted: `+2` from Amd23 and `+2` from Amd24, each as predicted;
the cross-root evidence note contributed 0.**

**Note on the two instruments, carried because it is still live.** `FD-70` is
counted with `grep -o` (occurrences); `XK-4` and `PE #69` with
`grep -r | wc -l` (matching lines). **They are not the same unit.**

**This amendment's own contribution, measured after the text was final: +2 to
each of the three instruments** — from the block above and this note, its only
mentions. **A successor re-deriving once this lands should read 51 / 29 / 29.**
**The three tokens must appear in this file exactly twice each, in those two
places and nowhere else;** refer to them collectively and **re-measure after
writing rather than before.**

---

# §AA1. Standing, stated first because the two findings do not share it

**This amendment carries one MEASURED finding and one ATTESTED finding, and the
distinction is not cosmetic.**

| Finding | Standing | Who can check it |
| --- | --- | --- |
| §AA2 — the squash-ancestry trap | **MEASURED** on `origin/main` at this basis | **anyone with the repository** |
| §AA3 — the merge-on-absence timer | **ATTESTED** by the drafting session | **no second party** — the instruments were created and deleted inside one agent session and left no artifact |

**§AA3 is filed at the same standing Amd23's figures held before they were
pushed** — a claim about something only one party could observe. **The reviewing
party explicitly declined to sign it and was right to.** It is recorded because
the finding is worth having, and **flagged so no successor mistakes it for a
measured one.**

---

# §AA2. **MEASURED** — squash-merge severs ancestry and preserves content, and the careful check gives the wrong answer

**Measured at this basis:**

```
git merge-base --is-ancestor 06e0bd92 origin/main     ->  NO

blob comparison, branch head vs origin/main:
  v25_Owed_Index_Amd23_2026-08-30.md              b062fa5d = b062fa5d
  v25_Owed_Index_Amd24_2026-08-30.md              a948f8e8 = a948f8e8
  EvidenceNote_CrossRoot_Duplicate_Migrations…    78f13d98 = 78f13d98
```

**The commit did not become an ancestor. Every blob is byte-identical.**

**The trap:** a successor verifying whether work merged by running
`--is-ancestor` alone **concludes nothing landed**, on a correct command
returning a correct answer to the wrong question. **The reader who simply looks
at the file gets the right answer; the reader who reaches for the rigorous check
gets the wrong one.**

**This is Amd20 §V1's shape on a second surface.** §V1 records that `git log` on
`main` is not evidence of authorship because squash rewrites the author and drops
the trailer. **§AA2 records that commit ancestry is not evidence of merge status
for the same reason** — squash. §V1's rule is about authorship and does not reach
this.

**Rule.** *Merge status for this repository is established by CONTENT — blob or
path comparison against `origin/main` — not by commit ancestry.
`git merge-base --is-ancestor` returns NO for every squash-merged branch here and
is not evidence that work did not land.*

**Scope.** Every merge in this line of work is squashed. `main`'s last ten
commits are ten squash merges, `#1151` through `#1160`. **The rule applies to all
of them and to anything merged the same way.**

---

# §AA3. **ATTESTED** — a merge instrument that fires on the absence of a signal, armed as a default

**Attested by the drafting session; no artifact survives, and no second party
observed it. Read accordingly.**

**What was armed.** On each pull request in this line of work, the drafting
session scheduled a timed self-check-in instructing a later turn to merge if CI
was green. **The intent was a fallback against a dropped webhook.**

**The defect.** **A hook merges on a signal. A timer merges on the absence of
one.** If CI hangs, the subscription drops, or nothing is watching, **the timer
still fires** — so the failure mode it converts is precisely *"nobody was
observing,"* and it converts that into a merge rather than into a stop.

**Two things make it more than a single bad instrument:**

**§AA3.1 — it never fired, so nothing measured it.** On the run that prompted
this finding the CI event arrived roughly one minute ahead of the timer.
**That is a margin, not a safeguard**, and it was initially reported as
reassurance rather than as luck.

**§AA3.2 — it was a default, not a one-off.** One was armed on **every** pull
request in this session — ten of them. **So this is not an instrument that
happened to be badly designed. It is an instrument whose failure mode was never
examined BECAUSE IT WAS NEVER REACHED**, repeated ten times.

**That is the §V2 / §W-series class exactly**, applied to an execution instrument
rather than a reading one: **a correct-looking check, repeatedly used, whose
behaviour outside the happy path nobody had cause to look at.**

**What this does NOT say.** It does not say a merge was performed without a
ruling. **The merge at `#1160` was ruled by Evoni in plain words and the timer
did not execute it.** **The ruling made the merge legitimate; it did not make the
timer a sound instrument**, and the two questions are separate.

---

# §AA4. What this amendment does not do

- **Does not close `v25` Sec 6 item 8.** The reads are discharged per Amd22 §X9;
  **the disposition remains OPEN and Evoni-gated.**
- **Does not correct any predecessor.** Amd18 through Amd24 stand as filed.
  **§AA2 extends Amd20 §V1's shape to a second surface; it does not amend §V1.**
- **Does not assert that any merge in this line of work was unruled.** See the
  closing paragraph of §AA3.
- **Does not resolve Amd23 §Y3's unmeasured tree→ledger direction**, which still
  needs the `SequelizeMeta` listing filed as an evidence note — **an act
  requiring no database read, since that output already exists from the
  admissible run at Amd22 §X2.**
- **Does not decide which migration root is canon**, and does not touch Amd24
  §Z3's schema-bearing precondition on item 8.
- **Does not sweep or delete any branch.** The branch carrying this work remains
  on the remote; **94 `claude/` branches are present**, and that population is
  `v25` Sec 7.1's, not this amendment's.
- **Does not close items 9, 11 or 13**, the 8-A/8-B split, or the
  `100.50.2.212` / `10.0.20.224` identity question.
- **Does not reopen §H4**, CLOSED unperformed and permanently so for this
  authorship line.
- **Does not amend `v25` Sec 6's item count.** Fifteen entries stand.
- **Does not mint.** No FD, XK, or PE number.
- **Does not rule its own push or merge.**
- **Does not authorize a host session, an AWS call, a VPN, a bastion, an SSH
  tunnel, or SSM port forwarding.**

---

*Type: method amendment. Carries one measured finding and one attested finding,
with standings marked and not blended. Records no closure and no mint. Edits no
file outside `docs/audit/`. No host, AWS, database, or Cognito contact by any
agent session. Prod FROZEN.*
