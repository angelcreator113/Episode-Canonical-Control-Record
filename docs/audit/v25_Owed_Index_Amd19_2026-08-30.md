| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 19** *Three corrections to Amd18. One is a substance error, not bookkeeping. The register had already answered the question, four months early, in the same directory.* |
| --- |

***Provenance:*** *route ruled by Evoni on 2026-08-30 — **chain amendment**, filed now rather than held for the two outstanding reads, because `main` currently carries a **falsified** claim in its chain tail and holding the correction would leave the register asserting what its own `docs/audit/` contradicts. **Push and merge are NOT ruled and are not assumed.*** *Filed to `claude/register-reality-gap-docs-hy8h5r`. Rule 7 gates the push, the PR create and the merge separately, for doc-only changes explicitly (`F-Deploy-1_Fix_Plan_v1.5.md:165`; `Fix_Plan_v1.2.md:106`; `Session_PE_Roster.md:2208-2209, 2309-2310`).*

# v25 Owed Index — Amendment 19

**FILED 2026-08-30 on Evoni's authorization.** **Route ruled: chain amendment.**
**Merge to `main` UNRULED.**

**AMENDMENT 19 to `v25_Owed_Index_2026-08-22.md`.** Adds §U1–§U5.

**Basis:** `origin/main` at `86880c278f899237f967cfdb4e95c988bac8d009`, 2026-08-30.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**This amendment carries, and it corrects its immediate predecessor.** Ships no
code. Prod **FROZEN**.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     37
grep -r  'XK-4'  docs/audit/ | wc -l     15
grep -r  'PE #69' docs/audit/ | wc -l    15
Session_PE_Roster.md highest entry       PE #68
Owed Index chain tail (pre-Amd19)        v25_Owed_Index_Amd18_2026-08-30.md
```

**Movement since Amd18's basis (`7a788f3c`, which read 34 / 12 / 12)
attributed rather than asserted:**

```
+3 / +3 / +3  = Amd18 itself, exactly as Amd18 §T1 predicted
 0 /  0 /  0  = the forward-pointer banners merged at #1153 and #1154
```

**Amd18 §T1's forward prediction held across three merges.** It was written at
basis `7a788f3c` and is exact at `86880c2`. **It held because every edit after it
was written so as not to name an instrument token in prose** — the constraint
Amd18 §T1 states, applied prospectively.

**Note on the two instruments, carried because it is still live.** `FD-70` is
counted with `grep -o` (occurrences); `XK-4` and `PE #69` with
`grep -r | wc -l` (matching lines). **They are not the same unit.**

**This amendment's own contribution, measured after the text was final:
+2 to each of the three instruments** — from the block above and this note,
which are its only mentions. **A successor re-deriving once this lands should
read 39 / 17 / 17** and attribute the movement here.

**Constraint on any future edit to this document.** That figure survives only
while each of the three tokens appears in this file **exactly twice**, in the
two places named. **No further mention may be added anywhere — prose or quoted.**
Refer to them collectively, as this paragraph does, and **re-measure after
writing rather than before.** Amd18 §T1 records what happens otherwise: the
sentence asserting the figure named the tokens, raised each count by one, and
falsified itself at the instant of writing.

---

# §U1. Amd18 §T2.4 — the second disjunct is eliminated

**Amd18 §T2.4 reads:** *"A migration 'add `deleted_at` to `decision_logs`' run
against canon either fails on a missing relation **or creates a second, empty
table beside an existing one**."*

**The migration is not hypothetical. It is written and in the tree**, as
`src/migrations/20260818000000-add-deleted-at-to-decision-logs.js` — the last
migration in the repository. Its body is:

```js
await queryInterface.addColumn('decision_logs', 'deleted_at', {
  type: Sequelize.DATE, allowNull: true,
});
```

**`addColumn`, not `createTable`.** Against a canon instance with no
`decision_logs` relation it can only throw. **The second disjunct is impossible
and is withdrawn.** The outcome is a failed migration, full stop.

**This required no database access.** It was available from the tree at the time
Amd18 was written.

---

# §U2. Amd18 §T2's Path B attribution — **FALSIFIED**, not merely unsupported

**Amd18:230 reads:** *"That shape matches the F-App-1 Path B hardcoded
literal,"* and the surrounding §T2.4 treats all five tables' presence on canon as
a fingerprint of the removed auto-repair path.

## §U2.1 All five have creating migrations in the tree

```
world_events              20260219000003-world-events.js
character_state           20260218100000-evaluation-system.js
character_state_history   20260218100000-evaluation-system.js
career_goals              20260219000005-career-goals.js
decision_log              20260219000001-decision-log-browse-pool.js
```

**Tested for absence, which is what could have falsified it: none is missing.**
Migrations explain all five without invoking a code path that no longer exists.

## §U2.2 The literal itself, recovered — the shapes differ

`6bfd99e257d34e750b4275b7e1142a430ad08aae` (2026-05-14, *"F-App-1: Remove
schema-as-JS auto-repair block from `src/app.js`"*) is an **ancestor of
`origin/main`**. Its deleted lines carry the literal:

```
decision_log: CREATE TABLE IF NOT EXISTS decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL, episode_id UUID,
  type VARCHAR(50), data JSONB, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW())
```

**Seven columns. Canon has eleven**, matching
`20260219000001-decision-log-browse-pool.js` **column for column and in order**:

```
id type episode_id show_id user_id context_json decision_json
alternatives_json confidence source created_at
```

**Canon carries no `data` and no `notes`** — the two columns that would mark the
auto-repair shape — **and six the literal never had.** The two candidate
provenances produce **different tables**, and canon matches the migration.

## §U2.3 `career_goals` discriminates in both directions

The auto-repair literal names `name`, `goal_type`, `stat_key`. The migration
names `title`, `type`, `target_metric`.

```
auto-repair names present on canon:  name        NO   goal_type  NO   stat_key      NO
migration names present on canon:    title      YES   type      YES   target_metric YES
```

**Twenty-two columns, no auto-repair fingerprint.** Two independent tables, same
verdict.

**The attribution is therefore FALSIFIED, not unsupported.** Amd18:230 is wrong
on the facts and not only on its evidence.

## §U2.4 What survives, and what does not

**§T2.4's schema observations stand** — `decision_logs` is absent from canon,
`decision_log` is present, they are two intentional tables created eleven days
apart, and `src/models/DecisionLog.js:63` targets the **February 8th** one.
**A tree-complete migration run cannot produce canon's state.**

**What does not stand is the provenance inference.** The question is not *which
non-migration path built these tables*. It is: **canon applied a migration dated
2026-02-19 and did not apply — or has since lost — one dated 2026-02-08.**

---

# §U3. The method finding — the register had already answered this

**Recorded because it is the correction a successor benefits from most, and
because it is the third instance of a pattern §R3.5 already carries twice.**

**Three independent prior statements existed, all predating Amd18:**

| Source | Statement |
| --- | --- |
| `F-App-1_Fix_Plan_v1.md` §11.2 | Tabulates all five tables against their creating migrations, with **`decision_logs` (plural) on its own row, marked out of scope** |
| `F-App-1_G1_Audit_Report.md:159` | *"Migration-canonical. All 11 migration columns present including `confidence`, `source`… the three separate JSONB columns"* |
| `F-App-1_G1_Audit_Report.md:198` | *"Migration-canonical with `title`/`type`/`target_metric` column names (NOT auto-repair's `name`/`goal_type`/`stat_key`)"* |
| `F-App-1_G1_Audit_Report.md:309` | ***"All 5 F-App-1 tables on prod RDS are migration-canonical. Zero auto-repair fingerprints across any table."*** |

**`:309` answers Amd18 §T2's provenance question, flatly, for all five tables,
four months before §T2 asked it.** It is in `docs/audit/` on `main` and needs no
history to read.

**The Path B list used by the reading that produced §T2 was taken from §147 of
`F-App-1_Fix_Plan_v1.md` and treated as complete without reading down to §11.2
of the same file.** `G1_Audit_Report` — a live, column-level audit of the same
instance, in the same directory — was never opened.

**§R3.5 records this pattern twice, six weeks apart, across separate documents.**
**This is the third instance, and the shortest distance yet:** one file, one
section apart for §11.2; the same directory for `G1_Audit_Report`. **Distance was
never the cause.** The cause is a list taken as complete.

**Two failures, not one, with different remedies.** The claim originated in one
author's reading of the capture and **was not caught by a second reader either**.
*"The author did not check"* is a discipline gap. *"Two readers did not check"*
means the review structure does not cover provenance claims at all — which is
what Amd18 §T6.2 warned would be invisible, and was.

---

# §U4. What held — recorded because the corrections would otherwise mislead

**Stated deliberately.** This session has produced corrections at a rate that,
filed alone, reads as a register in which nothing holds. **That impression would
be false, and the counterweight is specific and checkable.**

**The capture independently corroborates F-App-1's G1 finding.** A fresh read of
canon on 2026-08-29, over a different route, three and a half months after G1,
reproduces:

- `decision_log`'s eleven migration columns — `G1_Audit_Report:159`
- `career_goals`'s `title`/`type`/`target_metric` naming against the auto-repair
  alternative — `G1_Audit_Report:198`

**Column for column, on two independent tables.** This is the first prior
register claim tested against canon in this thread that survived contact.

**It also locates the failure precisely within Amd18 §T6.1's split.** **The parse
was correct** — `decision_log` really does carry those eleven columns, and §T3's
model-side derivation stands unamended. **The judgment was wrong** — the
inference about where those columns came from. **§T6.1 predicted that the
judgment half was the exposed half, and §T6.2 predicted that the instruments
used in this session could not detect an error there. Both are now
demonstrated rather than argued**, by an error found from a fresh look at the
tree rather than by any check this session ran on itself.

---

# §U5. What this amendment does not do

- **Does not close `v25` Sec 6 item 8.** The read is discharged; **the
  disposition remains OPEN and Evoni-gated.**
- **Does not supersede Amd18.** Three sections are corrected; §T1, §T3, §T5,
  §T6 and §T7 stand unamended, and **§T3's model-side reconciliation is
  untouched.**
- **Does not close the ledger question.** `G1_Audit_Report` covered the five
  F-App-1 tables and **explicitly not `decision_logs` (plural)**, unsurveyed at
  §11.2. **Canon having the February 19 table and not the February 8 one is
  untouched by G1** and is what the outstanding read goes after.
- **Does not perform either outstanding read.** Both remain Evoni-gated:
  `SequelizeMeta`'s rows (§T2.2) and the Path B tables' row counts and newest
  rows (§T2.4 severity). **Neither is inferred.**
- **Does not reopen §H4**, which is CLOSED unperformed and, per §T6.3,
  **permanently so for this authorship line.** **This amendment is not the
  missing check** — it corrects three findings and leaves the rest of §T2–§T4
  single-sourced exactly as before.
- **Does not close items 9, 11 or 13**, the 8-A/8-B split, or the
  `100.50.2.212` / `10.0.20.224` identity question.
- **Does not amend `v25` Sec 6's item count.** Fifteen entries stand.
- **Does not mint.** No FD, XK, or PE number.
- **Does not rule its own push or merge.** Route was ruled; neither was.
- **Does not authorize a host session, an AWS call, a VPN, a bastion, an SSH
  tunnel, or SSM port forwarding.**

---

*Type: correcting amendment. Withdraws one disjunct, falsifies one provenance
claim, and records one method failure together with the corroboration that
bounds it. Records no closure. Edits no file outside `docs/audit/`. No host,
AWS, database, or Cognito contact by any agent session. Prod FROZEN.*
