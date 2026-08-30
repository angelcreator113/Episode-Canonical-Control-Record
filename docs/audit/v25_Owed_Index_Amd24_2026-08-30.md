| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 24** *Amd23 §Y4.2's sample is completed. Two of the nine duplicates are not byte-identical, and both divergences change schema. The undecided-canon question is a schema question for those two, not a records question.* |
| --- |

***Provenance:*** *route ruled by Evoni on 2026-08-30 — **evidence note first, then a chain amendment citing it**, per the `#1151`/`#1152` order. **Push and merge are NOT ruled and are not assumed.** Rule 7 gates the push, the PR create and the merge separately, for doc-only changes explicitly (`F-Deploy-1_Fix_Plan_v1.5.md:165`; `Fix_Plan_v1.2.md:106`; `Session_PE_Roster.md:2208-2209, 2309-2310`).*

***Citation and basis note.*** *Basis is `origin/main`. **Amd23 and the cited evidence note are NOT on `main` at that basis** — both sit ahead of this file on the same branch and **arrive in the same merge**, so the citations resolve when this amendment does. This is stated rather than left to be noticed, per the defect Amd21 §W3 recorded.*

# v25 Owed Index — Amendment 24

**FILED 2026-08-30 on Evoni's authorization.** **Merge to `main` UNRULED.**

**AMENDMENT 24 to `v25_Owed_Index_2026-08-22.md`.** Adds §Z1–§Z4.
**Completes Amd23 §Y4.2's sample. Amd23 is not edited.**

**Basis:** `origin/main` at `3cef134d9d2ccfcde97ee0e9c102170cc16b77d8`, 2026-08-30.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Completes a sample and reclassifies what it found.** Ships no code.
Prod **FROZEN**.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     45
grep -r  'XK-4'  docs/audit/ | wc -l     23
grep -r  'PE #69' docs/audit/ | wc -l    23
Session_PE_Roster.md highest entry       PE #68
Owed Index chain tail on main            v25_Owed_Index_Amd22_2026-08-30.md
Owed Index chain tail on this branch     v25_Owed_Index_Amd23_2026-08-30.md
```

**The two tails differ because Amd23 is pushed and unmerged. Both are stated;
neither is carried.**

**Note on the two instruments, carried because it is still live.** `FD-70` is
counted with `grep -o` (occurrences); `XK-4` and `PE #69` with
`grep -r | wc -l` (matching lines). **They are not the same unit.**

**Contributions on this branch, measured after the text was final: Amd23 +2 each;
the cited evidence note +0 each; this amendment +2 each.** **A successor
re-deriving once all three land should read 49 / 27 / 27.** **The three tokens
must appear in this file exactly twice each, in the block above and this note,
and nowhere else;** refer to them collectively and **re-measure after writing.**

---

# §Z1. What Amd23 §Y4.2 said, and what completing it changed

**§Y4.2 labelled itself a sample and did so honestly** — *"sampled resolutions"*
— so this is a **completion, not a correction of a defect.** But the completion
changes the finding's weight, not merely its coverage.

**Evidence:** `EvidenceNote_CrossRoot_Duplicate_Migrations_2026-08-30.txt`,
`sha256 2dbf5047704edfd25e9deac393b55efc0f6c439af0f4ba61769b93cb0fa7f60f`,
58 lines. **Tree-only. No database read.**

**The pairing splits, where §Y4.2 stated one pattern from a sample of two:**

```
migrations/sequelize-migrations  <->  src/migrations    6
migrations/                      <->  src/migrations    3
```

**`migrations/` is now implicated by two independent findings** — it holds three
of the nine duplicates, and it holds `add-base-still-url`, the entry Amd23 §Y2
records as present-but-outside-the-configured-path.

---

# §Z2. **Seven pairs are byte-identical. Two are not, and both change schema.**

## §Z2.1 `20260127000001-add-thumbnail-compositions-deleted-at.js` — two frameworks, one basename

```
migrations/sequelize-migrations/…   30 lines   pgm.* ×4   queryInterface.* ×0
src/migrations/…                    33 lines   pgm.* ×0   queryInterface.* ×4
```

**The copy under `migrations/sequelize-migrations` is node-pg-migrate. The copy
under `src/migrations` is Sequelize.** **The directory NAMED
`sequelize-migrations` holds the NON-Sequelize copy.** A successor navigating by
directory name lands on the wrong engine.

## §Z2.2 `20260216000001-asset-wardrobe-system.js` — constraints in one copy only

```
                          sequelize-migrations    src/migrations
lines                              371                  385
ENUM                                 4                    6
VARCHAR(50)                          1                    3
REFERENCES episodes(id)              2                    0
idx_assets_category                  2                    0
```

**Foreign keys to `episodes(id)` and `idx_assets_category` exist ONLY in the copy
`.sequelizerc` does not read.** **If the `src/migrations` copy ran, `assets`
carries neither.**

---

# §Z3. The consequence — for these two, canon is a schema question

**One ledger entry names both files. Nothing in `SequelizeMeta` records which
ran. Their effects differ in constraints.** That is **precisely the class Amd22
§X4 established the ledger cannot adjudicate**, now reaching foreign keys and
indexes rather than column names.

**So Amd23 §Y4.2's precondition on item 8 is stronger than Amd23 states it.**
Not merely *"which root is canon must be decided before remediation reads
migrations."* **For these two members the candidates disagree about whether
foreign keys exist on the database**, and **no reading of the ledger
distinguishes them.**

**For the other seven the question remains bookkeeping** — the copies are
byte-identical, so which one ran does not change the schema. **The distinction
matters: two of nine are material, seven are not, and treating all nine as
equally severe would misdirect the remediation.**

---

# §Z4. What this amendment does not do

- **Does not decide which root is canon**, and **does not assert which copy
  ran.** §Z3 records that the question is now schema-bearing for two members;
  it does not answer it.
- **Does not close `v25` Sec 6 item 8.** The reads are discharged per Amd22 §X9;
  **the disposition remains OPEN and Evoni-gated.** **§Z3 sharpens a
  precondition on that decision; it does not make it.**
- **Does not edit Amd23.** §Y4.2 stands as filed and is completed additively.
  **A reader arriving at §Y4.2 is not redirected here** — a known cost of
  additive completion, not remedied.
- **Does not infer anything about Amd22 §X3's two-ledger-era finding.** The
  framework split is suggestive given the dates' proximity to the `pgmigrations`
  stop. **It is suggestive and NOT shown, and is left alone.**
- **Does not re-derive Amd23 §Y3's unmeasured tree→ledger direction**, which
  still needs the `SequelizeMeta` listing filed as an evidence note — **an act
  requiring no database read, since that output already exists from the
  admissible run at Amd22 §X2.**
- **Does not perform any database read.** No agent session contacted the
  database at any point.
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

*Type: completing amendment. Finishes one sample, reclassifies two of its nine
members as schema-bearing, and records that seven are not. Records no closure.
Edits no file outside `docs/audit/`. No host, AWS, database, or Cognito contact
by any agent session. Prod FROZEN.*
