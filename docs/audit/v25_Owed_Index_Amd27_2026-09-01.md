| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 27** *Three findings from the filing cycles of Amd26 and Addendum B, NOT sharing a standing — see §AC1. One is a fabricated measurement by the drafting session. One is item 2's principle arriving outside the repository. One is Addendum B's own subject, reproducing five times in tools that have nothing to do with Postgres.* |
| --- |

***Provenance:*** *route ruled by Evoni on 2026-09-01 — **chain amendment, three findings, no register number.** **Push, PR create and merge are NOT ruled and are not assumed.** Rule 7 gates each separately.*

# v25 Owed Index — Amendment 27

**FILED 2026-09-01 on Evoni's authorization.** **Push, PR create and merge UNRULED AT FILING — a reader finding this document on `main` is reading it after some of those gates were passed, and should read §AC5 for what this amendment rules rather than this line for what it did not.**

**AMENDMENT 27 to `v25_Owed_Index_2026-08-22.md`.** Adds §AC1–§AC6.

**Basis:** `origin/main` at `1f59aaf656534d4241c68217067745f9ed077fda`, 2026-09-01.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Carries three findings and nothing else. They do NOT share a standing; §AC1
states the split before any of them is read.** Records no closure, corrects
no predecessor's standing, mints nothing. Ships no code. Rules nothing on `v25`
Sec 6 item 8, whose disposition remains **OPEN** and Evoni-gated. Rules nothing
on whether the Addendum A/B read proceeds. Prod **FROZEN**. **No read has been
performed.**

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     52
grep -r  'XK-4'  docs/audit/ | wc -l     30
grep -r  'PE #69' docs/audit/ | wc -l    30
Session_PE_Roster.md highest entry       PE #68
Owed Index chain tail (pre-Amd27)        v25_Owed_Index_Amd26_2026-08-31.md
```

**Amd26 predicted 52 / 30 / 30 for a successor re-deriving after it landed. All
three read as predicted**, and were confirmed on landing by two parties in
different containers. The prediction is recorded as confirmed rather than
restated.

**Note on the three instruments, carried because it is still live.** The first is
counted with `grep -o` (occurrences); the second and third with `grep -r | wc -l`
(matching lines). **They are not the same unit.**

**This amendment's own contribution, measured after the text was final: +1 to
each of the three instruments** — from the tails block above, its only mentions,
because the note immediately preceding this one refers to them collectively
rather than by token. **A successor re-deriving once this lands should read
53 / 31 / 31.**

**Exclusivity, measured immediately before this number was taken.** Zero open
mergeable pull requests; no `Amd27` or higher on any of 167 remote tips. **Evoni
granted the pen on 2026-08-31 and it has not been reassigned.** **This is not a
proof of exclusivity** — Amd26 §AB4.4's closing note records why a machine-local
check cannot see the case it exists to detect, and that limit is unchanged.

---

# §AC1. Standing, stated first, because the last two amendments did

**The three findings in this amendment do NOT share a standing, and the split
runs through the first one.** Amd26 §AB1 could open by saying every finding was
measured; this one cannot, and saying so anyway would be §AC2's own defect.

| Finding | Standing | Who can check it |
| --- | --- | --- |
| §AC2 — the value `9ada19b7…` is not an object in this repository | **MEASURED** on `origin/main` at this basis | **anyone with the repository** |
| §AC2 — that value was asserted in prose by the drafting session on 2026-08-31 | **ATTESTED** by the drafting session | **the operator who received the instruction** — a real second party, unlike Amd25 §AA3's case |
| §AC3 — the transfer-path substitution and its remedy | **MEASURED** | **anyone with the repository** |
| §AC4 — five instances of the check-shape | **MEASURED**, each reproduced in a scratch repository | **anyone with git** |

**Why §AC2 splits.** That `9ada19b7…` resolves to nothing is measured and
trivially true of most hex strings; it is not a finding. **The finding is that a
drafting session produced it and stated it as an expectation** — and that fact
lives in a session transcript. Amd26 §AB1 dropped an entire finding rather than
file provenance a reader could not check, and §AC2 must not quietly do the
opposite in a document about values asserted without measurement.

**The attested half is corroborable, which §AA3's was not.** Amd25 §AA3 was
attested with *no second party* because its instruments were created and
destroyed inside one agent session. Here the operator received the instruction
and acted on it, so a second party exists and can confirm or deny. That does not
make it measured. **It makes it attested with a named corroborator, and a
successor should treat it accordingly.**

---

# §AC2. **PART MEASURED, PART ATTESTED** — a forty-character hash asserted without measurement

## §AC2.1 The claim — **ATTESTED**, corroborable by the operator

**This subsection is the attested half. §AC2.2 is the measured half. They are
kept apart deliberately.**

On 2026-08-31, during the Amd26 filing cycle, the drafting session instructed the
operator to verify a blob and stated the expected value in prose:

> That should print `9ada19b71d64b7bfb0cbcbb0daa8c88ee20f0c46`.

**No command produced that value.** It was not a mis-copy of another object, not
a stale reading, and not an abbreviation error.

**Standing:** attested by the drafting session. **The evidence is a session
transcript, which no reader of this repository holds.** The operator received the
instruction, executed against it, and reported the mismatch — so a second party
can corroborate or contradict this, which is why it is filed at all rather than
dropped under Amd26 §AB1's rule. A successor must not read §AC2.1 as measured
merely because §AC2.2 is.

## §AC2.2 The measurement

```
git cat-file -t 9ada19b71d64b7bfb0cbcbb0daa8c88ee20f0c46
  fatal: remote error: upload-pack: not our ref
      9ada19b71d64b7bfb0cbcbb0daa8c88ee20f0c46

git ls-tree origin/main -- \
  docs/audit/EvidenceNote_Item8_Followup_Reads_Instrument_2026-08-30.sql
  100644 blob 2dea6e116cafb8061cc6ce3dda56a97ecc731f34
```

**The asserted object does not exist in this repository and never has.** The
actual blob is `2dea6e11…`. **The operator's independent reading was correct and
the drafting session's was invented.**

## §AC2.3 Why this is filed rather than left in a transcript

**This is Amd26 §AB2's defect in its stronger form.** §AB2 convicts two merged
amendments of recording something *produced* as though it were *held*. §AC2
records something **never produced at all** as though it were measured, by
§AB2's own author, on the same day §AB2 was filed.

It is also the class that most resists later detection. A blob SHA cannot be
eyeballed for plausibility, and the register's `v25` Sec 6 item 2 column exists
precisely because forty characters are compared mechanically rather than read.
**A fabricated value entering that column would not announce itself.**

## §AC2.4 The mechanism, and the rule that caught it

**Every measured claim in that session carried its command and raw output. That
one was written in prose.** Prose is the only place a fabricated measurement
fits, because a pasted output cannot be produced without running something.

*RULE: a blob SHA, commit id, sha256, byte count or line count appears only
accompanied by the command that produced it, in the same message or the same
document section. A bare value in prose is UNMEASURED until shown otherwise.*

**The rule is not new — it is H1, applied to conversational instruction rather
than to filed text.** The gap was that H1 was understood to govern documents.

## §AC2.5 A second, lesser instance, recorded for completeness

Later in the same session the drafting session asserted that a clause was present
on `main` in Amd26 §AB3.1, and "verified" it. **Two different clauses had been
called by the same name**, and the one verified was not the one in question. The
reviewing party settled it without reading either: **the filed blob and the
reviewed draft were the same object, so a clause proposed after that draft froze
could not be inside it.** Recorded because the remedy is the general one — blob
identity answers presence questions that reading answers slowly and wrongly.

---

# §AC3. **MEASURED** — `v25` Sec 6 item 2's principle, arriving in the transfer path

## §AC3.1 What happened

Two distinct contents existed under one identical filename. The name resolved to
the wrong one, and the wrong one was copied to the destination path and read by
`git hash-object` before anything was staged.

```
stale      a284c46c2f850af3bedad423d036f5bf0024b9d6   10626 bytes   206 lines
corrected  b39db53b2c881fa5823a59035f090574ac50535c   11716 bytes   225 lines
filename   EvidenceNote_Item8_Followup_Reads_Addendum_B_2026-08-31.sql  (both)
```

**The stale content is the version whose consistency check voids every run**,
including a correct one, and whose range list carried a false completeness claim.
It was the file on the operator's disk, under the correct name, when the transfer
was believed complete.

**`a284c46c` does not resolve in this repository and is not expected to.** It was
a draft that existed only in the drafting container and the operator's download
directory; it was never committed and never pushed. **A successor running
`git cat-file -t a284c46c` will get `not an object`, exactly as they will for
§AC2's fabricated value, and the two are not the same thing.** §AC2's value was
never produced by anything; `a284c46c` was produced, held in two places, and read
by `git hash-object` on the operator's disk — its absence from the object store
is what "the wrong file was caught before it was staged" looks like. Recorded
because the distinction is invisible to the command a successor would reach for.

## §AC3.2 This is item 2, one layer out

`v25` Sec 6 item 2, on `main` at `:516-519`:

> **A revision number is not a content identifier.** Record each authority's blob
> SHA alongside its number, **in full — forty characters, not abbreviated** — so
> an in-place amendment is visible at the next derivation and the column can be
> compared mechanically rather than read.

**Item 2 legislates this for the repository. The same defect occurred in the
transfer path, where item 2 does not reach.** A filename is an identifier; it is
not a content identifier; and nothing in the download-and-copy sequence compared
content until the hash check fired.

**The hash check is the transfer-layer equivalent of item 2's blob column, and it
caught the substitution the identifier could not see.** It is the reason this is
a finding and not an incident.

## §AC3.3 The remedy, which is item 2's own and not a weaker analogue

The drafting session first proposed that *draft filenames should differ between
rounds*. **That is the weaker form** — it prevents the collision but leaves the
operator selecting by proxy, which in this instance meant comparing 11716 bytes
against 10626 by eye. **Read rather than compared, which is what item 2 was
written against.**

*RULE: a transferred draft carries its own content hash in its filename —
`..._Addendum_B_2026-08-31.b39db53b….sql` — so the transfer identifier IS a
content identifier. Selection becomes mechanical, and `git hash-object` at the
destination closes the loop with the same value at both ends.*

**Applied on the round it was found**, not deferred to this amendment. The
corrected file reached `main` under a hash-bearing carrier name.

## §AC3.4 A second hazard the same remedy closed

**Three separate transfers stripped the dashed date** from the filename —
`2026-08-31` arriving as `20260831`. `docs/audit/` carries **zero** compact dates
and 177 dashed ones **at this basis** — the 177th being Addendum B's own
filename, which landed in the merge this amendment documents. A compact name
drops a file out of the family it was named for, and the sort position the
`.sql` extension was chosen for is lost.

The hash-carrier remedy closed this **structurally rather than by vigilance**:
the destination filename is now typed literally in the copy command and the
source name is discarded after selection. **Neither the source's bytes nor the
source's name can reach the destination unchecked.**

## §AC3.5 The same principle a third time — identifiers that omit what disambiguates them

**Three identifier collisions occurred in the same cycle, from both parties.**
They are recorded together because separately each reads as a lapse, and together
they are §AC3.2's principle applied to identifiers generally rather than to
filenames alone.

| Identifier | What it omitted | Whose |
| --- | --- | --- |
| `§AB3.1 clause` | **which** clause — two different proposals had been given the same name, one landed and one did not | drafting session |
| `a13c26bd` | **which namespace** it resolved in — it named a real file that was produced and used, but is not a git object | reviewing session |
| `a second clone` | **which** clone the ordinal counted from — the drafting session's, not the reviewing session's | drafting session's phrasing, reviewing session's reading |

**In each case the identifier was well-formed and the referent was wrong**, and
in each case the disambiguator existed and was simply not carried: a blob SHA, a
namespace, a name instead of an ordinal.

*RULE, the same one as §AC3.3: put the disambiguator in the identifier. A blob
SHA rather than a clause name. A full forty characters, or the command that
resolves it, rather than an eight-hex token. A named party rather than an
ordinal.*

**Recorded from both sides deliberately.** The first and third were the drafting
session's; the second was the reviewing session's; the third was resolved in the
drafting session's favour and the first against it. **Filing only the drafting
session's instances would make this a record of one party's lapses rather than of
a pattern, and the pattern is the part worth having.**

## §AC3.6 The enabling condition

**The drafting session's copy command omitted `-Force`**, and the practice of
downloading successive drafts under an identical filename is a transfer path with
no versioning at all. Recorded as the author's, not the operator's.

---

# §AC4. **MEASURED** — Addendum B's subject, reproducing five times outside Postgres

## §AC4.1 The shape

`EvidenceNote_Item8_Followup_Reads_Addendum_B_2026-08-31.sql:132`, now on `main`:

> a check that fires on one condition, mistaken for a check that closes the
> question

Addendum B exists because the frozen instrument's admissibility gate has that
shape. **Five instances were measured in a single day, in four tools, of which
only the first concerns Postgres.**

## §AC4.2 The five

| # | Check | Fires on | Mistaken for |
| --- | --- | --- | --- |
| 1 | Frozen instrument's admissibility gate (`:38`) | **absence** of output | identity established |
| 2 | `--hard` precondition, "nothing is staged" | staged changes | working tree safe |
| 3 | `git diff --cached --stat` | a change exists | the right bytes are staged |
| 4 | `git status --porcelain`, glossed as an `M`-check | modified tracked file | no local work |
| 5 | `git status --porcelain`, any form | working-tree state | **no local work of any kind** |

**Instances 2 through 5 were introduced by the drafting session, each after the
preceding one had been found and corrected**, and each in a recovery sequence
written to prevent the previous failure.

## §AC4.3 Measurements

**Instance 2** — a repository with an unstaged edit to a tracked file:

```
git status --porcelain      M tracked.txt   ?? newfile.sql
staged changes: 0        -> the precondition PASSES
git reset --hard origin/main
  tracked.txt : reverted to origin        <- the edit is destroyed
  newfile.sql : survived (untracked)
```

**Instance 4** — a staged addition, an unstaged deletion, a rename:

```
A  added.txt
 D gone.txt
R  old.txt -> renamed.txt
?? u.sql

lines matching a leading M in either column : 0
lines that are NOT '??'                     : 3
after --hard: added.txt GONE, rename reverted, deletion undone
```

**Instance 5 — the sharpest, and the reason the class is worth filing.** A local
commit on `main` that is not on `origin/main`:

```
git status --porcelain                    []          <- EMPTY
git rev-list --count origin/main..HEAD     1          <- a commit is at risk

git merge --ff-only origin/main
  hint: Diverging branches can't be fast-forwarded ...
  local.txt : PRESERVED                               <- refuses loudly

git reset --hard origin/main
  local.txt : GONE                                    <- discards silently
```

**Every other instance printed something. This one prints nothing**, and empty
output is read as *I looked and found nothing wrong* when it means *I cannot see
this class of thing at all.* Those are indistinguishable at the point of use and
only the second is true.

## §AC4.4 What generalizes

**The finding is not about `inet_server_addr()`.** It is about how checks get
described once they are believed to work: the description narrows to the
condition the check fires on, and the gap between that condition and the question
being asked closes silently in the reader's head.

*RULE: where a destructive command is guarded by a precondition, prefer the
non-destructive command that fails on its own. `git merge --ff-only` over
`git reset --hard` plus a check. `git ls-tree` over `git rev-parse <rev>:<path>`
plus a fallback. A command that refuses is stronger than a check a human must
honour, because the check's blind spots are invisible and the refusal is not.*

## §AC4.5 The scope gap, recorded alongside

A blob-identity chain proves the right bytes arrived under the right name. **It
cannot see what arrived alongside them** — a stray `git add` of a different path
leaves every blob check passing. Adopted during the same cycle and recorded here:

```
git diff --stat <base> <target>            -> 1 file changed, 225 insertions(+)
git rev-list --left-right --count <base>...<target>   -> 0  1
```

**Content and scope are orthogonal and both are required.** The Addendum B filing
carried the blob through eight transitions and the scope check through two.

---

# §AC5. What this amendment does not do

- **Does not close `v25` Sec 6 item 8.** Disposition remains **OPEN** and
  Evoni-gated. Does not touch the 8-A/8-B split.
- **Does not rule whether the Addendum A/B read proceeds.** No read has been
  performed. Prod **FROZEN**.
- **Does not correct any predecessor.** Amd18 through Amd26 stand as filed.
  §AC2 records a fabrication by Amd26's own author; **it places no banner on
  Amd26 and does not re-rate it.** Amd26 §AB2's own owed banners on Amd23 and
  Amd25 remain owed and unplaced.
- **Does not edit, supersede or re-rate** the frozen instrument, Addendum A or
  Addendum B.
- **Does not resolve `v25` Sec 6 item 5.** Amd10 §J3's replacement text is
  proposed, not adopted, and which text governs is Evoni's.
- **Does not close items 9, 11 or 13**, and makes no inference toward them.
- **Does not rule on** re-enabling the `deploy-dev.yml` push trigger, or on the
  28 `claude/**` tips Amd26 §AB3 records as uncovered by the layer-2 predicate.
- **Does not mint.** No FD, XK, or PE number.
- **Does not rule its own push, PR create, or merge.** Three separate confirms.
- **Does not authorize** a host session, an AWS call, a database read, a VPN, a
  bastion, an SSH tunnel, or SSM port forwarding.

---

# §AC6. One thing left unmeasured, named rather than assumed

**Windows psql `\ir` path resolution is UNTESTED.** Addendum B includes Addendum A
by bare filename with no separator, resolved against the including file's own
directory. That behaviour was measured on Linux psql **16.13 and 16.15, in two
containers**. It was not measured on the psql the operator will actually run.

The case is the mildest available and documented behaviour is not
platform-specific. **That is an expectation, not a measurement, and it is
recorded as one.**

**It is measurable without touching canon, and this is not merely a gap.** `\ir`
path resolution is **platform** behaviour, not instance behaviour. It resolves
identically against any PostgreSQL, so a throwaway local instance on the
operator's own machine settles it exactly as the two Linux containers did — and
`QUERY 0a-prime` against localhost returns a loopback address, which case (C1)
correctly convicts as a failed gate. **The gate refusing to treat localhost as
canon is the right answer, and the include is proven at the same time.**
**Classified as MEASURABLE-BUT-UNMEASURED, not unmeasurable.**

**Against canon the calculus is different, and the distinction matters.** The
failure mode is loud — psql reports on the `\ir` line and nothing downstream
executes — but it is **not a no-op:** `SET statement_timeout` and `QUERY
0a-prime` execute before the `\ir` is reached, so a failed include is a partial
read, read-only and identity-only, requiring a re-run. **Running Addendum B
against canon to test `\ir` IS the read, and the read is unruled.** The local
route avoids that entirely and is the one this amendment records as available.

---

*Type: chain amendment. Three findings, NOT sharing a standing — §AC2 splits into
a measured half and a half attested by the drafting session with a named
corroborator, per §AC1; §AC3 and §AC4 are measured and reader-checkable. All
concerning the filing apparatus rather than the subject matter. One expectation
named as unmeasured at §AC6. Records no closure and no mint. Edits no file
outside its own path. No host, AWS, database, or Cognito contact by any agent
session. Prod FROZEN.*
