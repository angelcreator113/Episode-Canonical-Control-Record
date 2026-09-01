| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 23** *§X7.2's population was derived over 51% of the tree. Re-derived over all of it, one direction is confirmed and the other is unmeasured. The check was unsound and its answer was right.* |
| --- |

> ## ⚠ STATUS UPDATE — §Y3's "no new read required" is UNSUPPORTED. Read this first.
>
> **§Y3 below states that filing the `SequelizeMeta` listing requires no new
> database read, because the listing was already produced at Amd22 §X2. Nothing
> establishes that any party still HOLDS it.** §Y3 itself records, thirteen lines
> earlier, that the listing *"was never filed as an evidence note"* and that this
> amendment's author holds the nine reported entries, **not the listing**.
> **Produced is not held.** See `v25_Owed_Index_Amd26_2026-08-31.md` §AB2.
>
> **Measured:** no file on `origin/main` holds the 219-entry listing. The densest
> holder of migration-timestamp tokens carries 49. A filename search returns
> nothing. §AB2.2 states the instrument and threshold.
>
> **What is NOT superseded.** **Availability of the listing is UNMEASURED, not
> disproved** — a terminal scrollback or an untracked local file could hold it,
> and neither was measured. **Discharging §Y3 may therefore require a fresh read
> under Addendum A's gate**, which §Y3 says it does not. **Everything else in
> this amendment stands**, including §X7.2's population correction and the
> remainder of §Y3's closure conditions.
>
> **§Y3's text is retained unaltered.**
>
> *Banner added 2026-09-01 on Evoni's ruling. Not a supersede.*

***Provenance:*** *route ruled by Evoni on 2026-08-30 — **chain amendment, additive-supersede against merged §X7.2**. **Push and merge are NOT ruled and are not assumed.** Rule 7 gates the push, the PR create and the merge separately, for doc-only changes explicitly (`F-Deploy-1_Fix_Plan_v1.5.md:165`; `Fix_Plan_v1.2.md:106`; `Session_PE_Roster.md:2208-2209, 2309-2310`).*

# v25 Owed Index — Amendment 23

**FILED 2026-08-30 on Evoni's authorization.** **Merge to `main` UNRULED.**

**AMENDMENT 23 to `v25_Owed_Index_2026-08-22.md`.** Adds §Y1–§Y5.
**Additively supersedes Amd22 §X7.2. Amd22 is not edited.**

**Basis:** `origin/main` at `3cef134d9d2ccfcde97ee0e9c102170cc16b77d8`, 2026-08-30.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Corrects one section of its immediate predecessor and measures the scope of
what remains unmeasured.** Ships no code. Prod **FROZEN**.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     45
grep -r  'XK-4'  docs/audit/ | wc -l     23
grep -r  'PE #69' docs/audit/ | wc -l    23
Session_PE_Roster.md highest entry       PE #68
Owed Index chain tail (pre-Amd23)        v25_Owed_Index_Amd22_2026-08-30.md
```

**Movement since Amd22's basis (`169e4192`, which read 43 / 21 / 21) attributed
rather than asserted: `+2 / +2 / +2` = Amd22 itself, as Amd22 predicted.
Addendum A contributed 0.**

**Note on the two instruments, carried because it is still live.** `FD-70` is
counted with `grep -o` (occurrences); `XK-4` and `PE #69` with
`grep -r | wc -l` (matching lines). **They are not the same unit.**

**This amendment's own contribution, measured after the text was final: +2 to
each of the three instruments** — from the block above and this note, its only
mentions. **A successor re-deriving once this lands should read 47 / 25 / 25.**
**The three tokens must appear in this file exactly twice each, in those two
places and nowhere else, prose or quoted;** refer to them collectively and
**re-measure after writing rather than before.**

---

# §Y1. The defect: §X7.2's population was derived over 51% of the tree

**The repository holds four migration roots.** Measured at this basis, counting
`.js` — the only extension a Sequelize ledger entry can name:

| Root | `.js` | Read by Sequelize? |
| --- | --- | --- |
| `src/migrations` | **211** | **YES — the only one** |
| `scripts/migrations` | 169 | no |
| `migrations` | 19 | no |
| `migrations/sequelize-migrations` | 16 | no |
| **TOTAL** | **415** | |

`.sequelizerc` sets `migrations-path` to `./src/migrations` and nothing else.

**§X7.2's sweep covered `src/migrations` alone — 211 of 415, 51%.** Its
population — *"nine ledger entries with no same-named file in the tree"* — is a
**correct check run over an incomplete population**, which is Amd20 §V2's shape
applied to a file set rather than a boundary.

**Two corrections to figures raised while diagnosing this, recorded because both
are the same error twice.** A count of **473** files and a **45%** share were
put forward: both take `scripts/migrations` at **all file types (226 = 169 `.js`
+ 57 `.sql`)** while taking `src/migrations` at `.js` (211). **`.sql` files
cannot be Sequelize ledger entries**, so the denominator is `.js`: **415, and
51%.** A related claim that `scripts/migrations` is **larger than the configured
directory is FALSE** — 169 against 211.

---

# §Y2. Re-derived over all four roots — the ledger→tree direction

**Every one of §X7.2's nine entries, resolved against all 415 files:**

| Ledger entry | Resolution |
| --- | --- |
| `20260208000000-create-lala-formula` | RE-DATED → `src/migrations/20260208000002-…` |
| `20260306100000-create-episode-orchestration-tables` | **SOURCELESS** |
| `20260307140000-create-franchise-knowledge` | RE-DATED → `src/migrations/20260307210000-…` |
| `20260311200000-create-story-calendar-system` | **SOURCELESS** |
| `20260315000000-add-relationship-engine-columns` | RE-DATED → `src/migrations/20260615000000-…` |
| `20260315100000-add-expanded-world-character-columns` | RE-DATED → `src/migrations/20260615120000-…` |
| `20260320000000-create-scene-sets-and-angles` | RE-DATED → `src/migrations/20260625000000-…` |
| `20260627000000-add-base-still-url` | **EXACT MATCH, OUTSIDE THE CONFIGURED PATH** → `migrations/20260627000000-…` |
| `20260710000000-create-generation-jobs` | RE-DATED → `src/migrations/20260323000000-…` |

**Corrected population: 6 re-dated, 1 outside the configured path, 2
sourceless.**

**§X7.2 said three are "genuinely absent under any name." It is two** —
`create-episode-orchestration-tables` and `create-story-calendar-system`.

**`add-base-still-url` is NOT re-dated — with the two halves at different
standing, stated because they are not equally established.**

| Half | Standing |
| --- | --- |
| The file `migrations/20260627000000-add-base-still-url.js` exists outside the configured path | **MEASURED** from `origin/main`'s tree |
| The ledger entry is named `20260627000000-add-base-still-url` | **REPORTED**, not filed — §Y3 records that the listing was never entered as an evidence note |

**The mechanism claim rests only on the measured half and holds without the
other:** `.sequelizerc` configures one root, that file is outside it, so
`sequelize db:migrate` never runs it and cannot detect the omission. **The
"identical timestamp" observation rests on the reported half and is NOT adopted
as checked.** It becomes checkable when §Y3's listing is filed, and not before. **The distinction is operative, not pedantic:
re-dating means a fresh database re-runs the migration under a new name;
this means a fresh `sequelize db:migrate` NEVER RUNS IT AND CANNOT DETECT THE
OMISSION.** Filing it as re-dated would put it under the wrong mechanism.

**The result the re-derivation actually returned.** Widening the sweep from 51%
to 100% **changed the classification of exactly one entry, and that one was
already known before the re-derivation began.** All six re-dated entries resolve
inside `src/migrations`; both sourceless entries are sourceless in all four
roots. **The check was unsound and its answer was, in this direction, right.**
**That is recorded because it is the outcome least likely to be reported** — an
unsound method vindicated by measurement is easy to quietly upgrade to a sound
one, and it was not sound.

---

# §Y3. The tree→ledger direction is UNMEASURED, and its scope is 204 files

**§X7.2's other half — one file in the tree with no ledger entry
(`20260818000000-add-deleted-at-to-decision-logs`) — was derived the same way,
from `src/migrations` alone.**

**It is not re-derived here, and the reason is a limit rather than a choice.**
That direction requires the **full 219-entry `SequelizeMeta` listing**. This
amendment's author holds the nine reported entries, **not the listing**. **The
listing was read by the operator and reported in summary; it was never filed as
an evidence note.**

**The unexamined scope is measurable and is 204 files** — every `.js` outside
`src/migrations`. **Any of them could be a tree file with no ledger entry, and
none has been checked.**

**So §X7.2's tree→ledger claim of "one" stands unverified over 49% of the
tree**, and **this amendment does not correct it, assert a replacement, or imply
the figure is wrong.** **It is unmeasured, which is a different state from
either confirmed or refuted.**

**What would close it:** the `SequelizeMeta` listing filed as an evidence note,
then one sweep across all four roots. **No new database read is required — the
listing was already produced by the admissible run at Amd22 §X2.** **Filing that
output is a durability act, not a new read.**

---

# §Y4. Two structural findings the re-derivation surfaced

**§Y4.1 — a fourth divergence kind.** Amd22 §X4 records three kinds; this adds a
fourth, and it is the one visible from nowhere inside the configured path:

| Kind | Count |
| --- | --- |
| Ledger records applied, effect absent or differently named | 3 (§X4) |
| Ledger records applied, file re-dated | 6 |
| Ledger records applied, **no file in any root** | 2 |
| Ledger records applied, **file present but OUTSIDE the configured path** | 1 |

**§Y4.2 — nine basenames span roots, and both copies look authoritative.**
Measured: nine filenames appear in more than one root. Sampled resolutions put
the pair in **`src/migrations/` and `migrations/sequelize-migrations/`** —
**both Sequelize-shaped directories.**

**A ledger entry records a filename, not a path.** So for those nine, **the
ledger names two candidate files and nothing records which one ran, or which
directory is authoritative.**

**This is a different kind of gap from the two sourceless entries.** **Two
sourceless migrations is an INCOMPLETE record** — bounded, enumerable, closable
by reconstruction. **Nine entries with two plausible sources each is an UNDECIDED
one** — no amount of reading resolves it, because the missing thing is a decision
about which root is canon that appears never to have been made.

**It bears directly on the live question.** **Item 8's disposition is a
remediation decision, and any remediation reads migrations. From which of four
roots is not currently answerable.**

---

# §Y5. What this amendment does not do

- **Does not close `v25` Sec 6 item 8.** The reads are discharged per Amd22 §X9;
  **the disposition remains OPEN and Evoni-gated.** **§Y4.2 identifies a
  precondition on that decision; it does not make it.**
- **Does not re-derive the tree→ledger direction**, and **does not assert that
  §X7.2's "one" is wrong.** See §Y3. **Unmeasured is recorded as unmeasured.**
- **Does not edit Amd22.** §X7.2 stands as filed and is superseded additively;
  a reader arriving at §X7.2 is not redirected by this amendment, which is a
  known cost of additive supersede and is not remedied here.
- **Does not decide which migration root is canon.** §Y4.2 records that the
  decision is absent, not what it should be.
- **Does not perform any database read.** No agent session contacted the
  database at any point. **§Y2 and §Y4 are derived from the tree alone.**
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

*Type: correcting amendment. Re-derives one population over the full tree,
measures the scope of the other, and records a fourth divergence kind and an
undecided-canon finding. Records no closure. Edits no file outside `docs/audit/`.
No host, AWS, database, or Cognito contact by any agent session. Prod FROZEN.*
