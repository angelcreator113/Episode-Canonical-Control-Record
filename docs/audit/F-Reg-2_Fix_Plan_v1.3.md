# F-Reg-2 Fix Plan v1.3

**Closing fix group 2, sequencing what's next — Prime Studios audit canon**

| | |
|---|---|
| **Version** | 1.3. Additive-supersede on `F-Reg-2_Fix_Plan_v1.2.md`. |
| **Date** | 2026-09-29 |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Basis** | `origin/main` at `656252dcf7661a3f5e46b4e1a18a806562c920c0` (#2239) |
| **Predecessor** | v1.2 (`3a17e023`, #2175) |
| **Standing** | §1 is **RULED**. Other clauses are **MEASURED** unless marked. |
| **Task** | #2240 |

---

## H1 — Basis

```
$ git fetch origin --prune
$ git log -1 --format='%H %ad %s' --date=short origin/main
656252dcf7661a3f5e46b4e1a18a806562c920c0 2026-09-29 docs(audit): register note on money-path rulings D1–D3 [skip-automerge] (#2239)
$ git rev-parse --is-shallow-repository
false
$ ls docs/audit | grep -E '^F-Reg-2'
F-Reg-2_Fix_Plan_v1.0.md
F-Reg-2_Fix_Plan_v1.1.md
F-Reg-2_Fix_Plan_v1.2.md
F-Reg-2_OwedScoping_2026-09-28.md
F-Reg-2_Scoping_2026-09-27.md
```

MEASURED. v1.2 is the newest F-Reg-2 plan.

---

## §1 RULINGS — Evoni, 2026-09-29

**RULED**, verbatim, as recorded on Task #2240.

> R1. Fix group 2 is closed, with row 12 recorded as moot and row 74 as blocked on the registry build.

> R2. O-a, O-c and O-d are the next F-Reg-2 work, in that order, each scoped by a read before any fix.

> R3. Family and Boundary, the eight story-table columns, and v1.0 §4.5's unverified items remain owed, unsequenced.

**Nothing else is ruled.**

---

## §2 Fix group 2's outcome — R1

v1.2 R2 (`F-Reg-2_Fix_Plan_v1.2.md:43`) ruled one file at a time, in the order of v1.0 §4.2's by-file table (`F-Reg-2_Fix_Plan_v1.0.md:214–227`). Each file is listed below in that order.

### §2.1 File by file

| # | File | v1.0 §4.2 rows | PR(s) | Merge SHA | Deployed in |
|---|---|---|---|---|---|
| 1 | `src/routes/characterRegistry.js` | 18, 19, 20, 30, 33, 34, 35, 37, 38, 39 (36, 40, 41 excluded, v1.2 R2) | #2179 (part 1), #2181 (part 2) | `4f2a4baa1`, `272a96811` | BO |
| 2 | `src/services/registrySync.js` | 70, 71, 72, 73 | #2183 | `9e4a57aa3` | BP |
| 3 | `src/routes/characterGenerationRoutes.js` | 4 (#2186); 8 (#2192, after #2188's enum fix) | #2186, #2188, #2192 | `9e36febe5`, `11ebb5d41`, `fcad7f772` | BQ |
| 4 | `src/routes/consciousness.js` | 42, 43 | #2198 | `3c41e368d` | BR |
| 5 | `src/routes/characterGrowthRoute.js` | 12 | none | none | **MOOT** (§2.2) |
| 6 | `src/routes/memories/core.js` | 46 (excluded) | none | none | no open site |
| 7 | `src/routes/memories/engine.js` | 49 (excluded) | none | none | no open site |
| 8 | `src/routes/memories/interview.js` | 50 | #2203 | `5b3ffd500` | BS |
| 9 | `src/routes/worldStudio.js` | 60 | #2206 | `12e0352b7` | BS |
| 10 | `src/services/registrySyncService.js` | 74 | none | none | **BLOCKED** (§2.2) |

**The merge SHAs.** MEASURED:

```
$ for s in 4f2a4baa1 272a96811 9e4a57aa3 9e36febe5 11ebb5d41 fcad7f772 3c41e368d 5b3ffd500 12e0352b7; do git log -1 --format='%h %ad %s' --date=short $s; done
4f2a4baa1 2026-09-28 fix(registry): serialize characterRegistry.js RMW sites, part 1 (F-Reg-2 v1.2 R2) [skip-automerge] (#2179)
272a96811 2026-09-28 fix(registry): serialize characterRegistry.js RMW sites, part 2 (F-Reg-2 v1.2 R2) [skip-automerge] (#2181)
9e4a57aa3 2026-09-28 fix(registry): serialize registrySync.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2183)
9e36febe5 2026-09-28 fix(registry): serialize characterGenerationRoutes.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2186)
11ebb5d41 2026-09-28 fix(registry): promote-ghost uses role_type 'support' [skip-automerge] (#2188)
fcad7f772 2026-09-28 fix(registry): serialize promote-ghost ghost_characters RMW (F-Reg-2 v1.2 R2) [skip-automerge] (#2192)
3c41e368d 2026-09-28 fix(registry): serialize consciousness.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2198)
5b3ffd500 2026-09-28 fix(registry): serialize memories/interview.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2203)
12e0352b7 2026-09-28 fix(registry): serialize worldStudio.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2206)
```

**The deploys.** ATTESTED, from each deploy record's range line and PR list:
- `F-Deploy-1_Deploy_2026-09-28_BO.md`: tree `ff2ed851` → `272a9681` (#2179, #2181).
- `F-Deploy-1_Deploy_2026-09-28_BP.md:35`: `Range: 1 commit(s), 2 file(s); PRs: #2183`.
- `F-Deploy-1_Deploy_2026-09-28_BQ.md`: tree `9e4a57aa` → `e5c3fc82`, which includes #2186, #2188 and #2192.
- `F-Deploy-1_Deploy_2026-09-28_BR.md:39`: `Range: 2 commit(s), 4 file(s); PRs: #2197 #2198`.
- `F-Deploy-1_Deploy_2026-09-28_BS.md`: tree `3c41e368` → `80fc3ad9`, which includes #2203 and #2206.

**`memories/core.js` and `memories/engine.js`.** Their only rows (46 and 49) are excluded, so no open site remained in either (v1.2 §2.2, `F-Reg-2_Fix_Plan_v1.2.md:82`). No PR was owed.

### §2.2 The two rows not fixed

- **Row 12, `characterGrowthRoute.js` — MOOT (R1).** The route makes no effective write. Its silent writes wait for a product decision, Task #2200, which carries the `blocked` label (MEASURED, GitHub MCP `issue_read` get_labels: `claude-task`, `blocked`).
- **Row 74, `registrySyncService.js` — BLOCKED on the registry build (R1).** It waits for the registry build's Feed link, Task #2208 (C3's `feed_profile_id`), which carries the `blocked` label (MEASURED, same instrument: `claude-task`, `blocked`).

Neither row is fixed, and neither is discharged. R1 closes the group around them.

### §2.3 Fix group 1b, for the record

v1.2 R1 named fix group 1b. It shipped as #2177 (`ff2ed851f`, Task #2176) in Deploy BN (`F-Deploy-1_Deploy_2026-09-28_BN.md:38`, tree `1039859f` → `ff2ed851`). MEASURED:

```
$ git log -1 --format='%h %ad %s' --date=short ff2ed851f
ff2ed851f 2026-09-28 fix(registry): scope the four remaining registry_dossiers_used sites per F-Reg-2 v1.2 R1 [skip-automerge] (#2177)
```

---

## §3 Next: O-a, O-c, O-d — R2

In this order, each scoped by a read before any fix (R2). The sites are v1.0 §4.3's (`F-Reg-2_Fix_Plan_v1.0.md:233–237`). The scoping read (`F-Reg-2_OwedScoping_2026-09-28.md:116–132`) records all three OPEN.

| Order | Item | Site (v1.0 §4.3) |
|---|---|---|
| 1 | O-a | The assistant's delete guard selects `status` and tests `depth_level`: `src/routes/memories/assistant.js:657`, `:660` |
| 2 | O-c | The onboarding creates pass no `character_key` and an invalid `appearance_mode`: `src/routes/onboarding.js:284`, `:332` (`:290`, `:338`) |
| 3 | O-d | `therapy.js`'s registry write reads an unset `req.app.get('models')` with no fallback: `src/routes/therapy.js:800` |

### §3.1 For O-a's read: a fix already on main

**MEASURED.** Since the scoping read's basis, one of the three files has changed. #2197 (Task #2195) changed O-a's site:

```
$ git log --format='%h %ad %s' --date=short 2c3e4f02..origin/main -- src/routes/memories/assistant.js src/routes/onboarding.js src/routes/therapy.js
660eb7752 2026-09-28 fix(registry): Amber delete guard loads the field it checks [skip-automerge] (#2197)
$ git show 660eb7752 -- src/routes/memories/assistant.js
-          `SELECT status FROM registry_characters WHERE id = :charId AND deleted_at IS NULL`,
+          `SELECT depth_level FROM registry_characters WHERE id = :charId AND deleted_at IS NULL`,
$ grep -n "depth_level" src/routes/memories/assistant.js | head -2
657:          `SELECT depth_level FROM registry_characters WHERE id = :charId AND deleted_at IS NULL`,
660:        if (char?.depth_level === 'alive') {
```

ATTESTED: `F-Deploy-1_Deploy_2026-09-28_BR.md:115` records #2197 (`660eb775`) as deployed in BR.

This plan does not discharge O-a. INFERRED: O-a's read (R2) may find nothing left to fix. That finding, and whether O-a closes, is for that read and for Evoni.

`onboarding.js` and `therapy.js` are unchanged since the scoping read's basis.

---

## §4 Owed, unsequenced — R3

| Item | Scoping read (`F-Reg-2_OwedScoping_2026-09-28.md`) |
|---|---|
| Family and Boundary | §1.6 (`:134–148`), OPEN, no home |
| The eight story-table columns | §1.7 (`:150–174`), OPEN, no home |
| v1.0 §4.5's unverified items | §1.8 (`:176–192`), CANNOT-TELL |

---

## §5 Noted, not ruled: `storyteller_memories.line_id`

Found during fix group 1b (#2177). This is recorded here as owed. No ruling is made, and it is not sequenced.

**MEASURED.** The migration tree, the model and the canon schema capture disagree on nullability:

```
$ sed -n 15,17p src/migrations/20260221120000-create-storyteller-memories.js
      line_id: {
        type: Sequelize.UUID,
        allowNull: false,
$ sed -n 16,18p src/models/StorytellerMemory.js
      line_id: {
        type: DataTypes.UUID,
        allowNull: true,
$ sed -n 2146p docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
 storyteller_memories             | line_id                           | uuid                        | YES
```

- The migration declares `NOT NULL`.
- The model allows null.
- The canon capture (2026-09-17) records the column as nullable.

**MEASURED.** #2177's integration test drops `NOT NULL` for its run and restores it afterwards:

```
$ grep -n 'line_id\|NOT NULL' tests/integration/storyRegistryScopeGroup1b.integration.test.js
82:    // line_id, which the migration tree declares NOT NULL while the model and
93:                              WHERE table_schema = 'public' AND table_name = 'storyteller_memories' AND column_name = 'line_id'`);
95:      await run(`ALTER TABLE storyteller_memories ALTER COLUMN line_id DROP NOT NULL`);
115:    if (relaxedLineId) await run(`ALTER TABLE storyteller_memories ALTER COLUMN line_id SET NOT NULL`);
```

**Earlier register mentions.** `F-Stats-1_Fix_Plan_v1.60.md:39` records the model's `line_id` as nullable, without the migration. No register document records the disagreement between the migration and the model (MEASURED: `grep -rn 'line_id' docs/audit`).

**Not established:**
- how production's column became nullable;
- which of the three is meant to be right.

---

## §6 Tails — re-derived, not carried

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -1
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md | tail -1
410:### XK-4 — tenancy absent from the route contract
$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -1
68
```

The tails are FD-69, XK-4 and PE #68. Nothing is minted here.

---

## What this plan does not do

- **Rules nothing beyond §1's quoted words.** §5 is a note, not a ruling.
- **Edits no filed document, and places no banner.**
- **Writes no fix, and changes no code or schema.**
- **Discharges nothing.** Rows 12 and 74 are recorded as moot and blocked, not fixed. O-a is not discharged (§3.1).
- **Mints no FD, PE or XK number.**
- **Makes no host, AWS, database or Cognito contact.**

---

## Register hygiene

- **RULES** (§1, Evoni):
  - Fix group 2 is closed: row 12 moot, row 74 blocked on the registry build.
  - O-a, O-c, O-d are next, in that order, each scoped by a read before any fix.
  - Family and Boundary, the story-table columns and v1.0 §4.5 stay owed, unsequenced.
- **Notes, unruled:** `storyteller_memories.line_id` drift (§5). O-a's site was changed by #2197 (§3.1).
- **Banners:** none. **Closes:** fix group 2, by R1. **Discharges:** nothing. **Mints:** nothing.
- Additive-supersede on v1.2; no destructive rewrite.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-29. Basis: `origin/main` at `656252dcf7661a3f5e46b4e1a18a806562c920c0`. Predecessor: v1.2.*
*Ruled (Evoni): R1–R3, §1. Mints nothing. Host/AWS/DB/Cognito contact by the filing session: none. Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`). Task: #2240. [skip-automerge]*
