# F-Reg-2 Fix Plan v1.2

**Sequencing the owed items — Prime Studios audit canon**

| | |
|---|---|
| **Version** | 1.2. Additive-supersede on `F-Reg-2_Fix_Plan_v1.1.md`. |
| **Date** | 2026-09-28 |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Basis** | `origin/main` at `a0ceb02be05b2d522c3168942c5ceb5fd475180f` (#2173) |
| **Predecessor** | v1.1 (`b00b8fc8`, #2115) |
| **Reads** | `F-Reg-2_OwedScoping_2026-09-28.md` (`a0ceb02b`, #2173), "the scoping read" |
| **Standing** | §1 is **RULED**. Other clauses are **MEASURED** unless marked. |
| **Task** | #2174 |

---

## H1 — Basis

```
$ git fetch origin --prune
$ git log -1 --format='%H %ad %s' --date=short origin/main
a0ceb02be05b2d522c3168942c5ceb5fd475180f 2026-09-28 docs(audit): F-Reg-2 owed scoping [skip-automerge] (#2173)
$ git rev-parse --is-shallow-repository
false
$ ls docs/audit | grep -E '^F-Reg-2'
F-Reg-2_Fix_Plan_v1.0.md
F-Reg-2_Fix_Plan_v1.1.md
F-Reg-2_OwedScoping_2026-09-28.md
F-Reg-2_Scoping_2026-09-27.md
```

MEASURED. v1.1 is the newest F-Reg-2 plan. The scoping read is the newest F-Reg-2 document. GitHub MCP `list_pull_requests` (state open) returned `[]`.

---

## §1 RULINGS — Evoni, 2026-09-28

**RULED**, verbatim, as recorded on Task #2174. R2 is Evoni's corrected wording, given before this revision was pushed and recorded as a comment on #2174; the issue body carries her first wording.

> R1. The four other registry_dossiers_used[0].registry_id sites (v1.1 §5 :174; locations per F-Reg-2_OwedScoping_2026-09-28.md) are fixed next, as fix group 1b, applying the same fix shape as #2113 (O-e), before fix group 2.

> R2. Fix group 2's open sites are fixed one file at a time, in the order of F-Reg-2_Fix_Plan_v1.0.md §4.2's by-file table (:214–227); a file with many open sites may be split across more than one PR. Rows already covered by #2102/#2107 are excluded.

> R3. The scoping read's §2.2 finding (the unrun root migrations/20260316100000-registry-character-world.js) is recorded. Who created registry_characters.world on production stays NOT ESTABLISHED.

> R4. O-a/O-c/O-d, Family and Boundary, the eight story-table columns, and v1.0 §4.5 remain owed, unsequenced by this version.

**Nothing else is ruled.**

---

## §2 The items, by ruling

Each item's standing is the scoping read's; this plan does not restate its tables.

### §2.1 Fix group 1b — R1

- **The four sites:** v1.1 §5 (`F-Reg-2_Fix_Plan_v1.1.md:174`).
- **Standing:** OPEN, at the locations in the scoping read §1.3 (`F-Reg-2_OwedScoping_2026-09-28.md:75–95`). One of the four has moved from v1.1's `:1558`.
- **Shape:** #2113's (`f8c8509a`), O-e's fix. The scoping read §1.2 (`:60–73`) records it DONE and deployed in BH.
- **Order:** fix group 1b comes next, before fix group 2.

### §2.2 Fix group 2 — R2

- **Standing:** in the scoping read §1.4 (`:97–114`).
- **Open sites:** 22.
- **Excluded:** rows 36, 40, 41, 46 and 49, covered by #2102 and #2107.

**The order — RULED (R2).** Files go one at a time, in the order of v1.0 §4.2's by-file table (`F-Reg-2_Fix_Plan_v1.0.md:214–227`), which the scoping read §1.4 also cites (`F-Reg-2_OwedScoping_2026-09-28.md:101`). Read from that table (MEASURED):
1. `characterRegistry.js`
2. `registrySync.js`
3. `characterGenerationRoutes.js`
4. `consciousness.js`
5. `characterGrowthRoute.js`
6. `memories/core.js`
7. `memories/engine.js`
8. `memories/interview.js`
9. `worldStudio.js`
10. `registrySyncService.js`

A file with many open sites may be split across more than one PR (R2). `characterRegistry.js` has 13 table sites, of which rows 36, 40 and 41 are excluded. `memories/core.js` (row 46) and `memories/engine.js` (row 49) have only excluded rows, so no open site remains in either (the scoping read §1.4).

### §2.3 The §2.2 finding — R3

The finding is in the scoping read §2.2 (`:206–296`): `migrations/20260316100000-registry-character-world.js`, added by `3412a235c` and merged by #254, sits in a directory `.sequelizerc` does not configure.

Production's history stays **NOT ESTABLISHED**, as the scoping read §2.3 (`:298–308`) and `F-Deploy-1_Deploy_2026-09-27_BH.md` §7 record it.

Additive banners on BH and v1.1 point to it (§3).

### §2.4 Owed, unsequenced — R4

| Item | Scoping read |
|---|---|
| O-a, O-c, O-d | §1.5 (`:116–132`), OPEN |
| Family and Boundary | §1.6 (`:134–148`), OPEN, no home |
| The eight story-table columns | §1.7 (`:150–174`), OPEN, no home |
| v1.0 §4.5's items | §1.8 (`:176–192`), CANNOT-TELL |

---

## §3 Banners placed with this revision

One additive block each, at the top of the file, below its title. No other line in either file changes.

| File | Section named |
|---|---|
| `F-Deploy-1_Deploy_2026-09-27_BH.md` | §7 |
| `F-Reg-2_Fix_Plan_v1.1.md` | §3 |

Both banners point to `F-Reg-2_OwedScoping_2026-09-28.md` §2.2 (PR #2173).

---

## §4 Tails — re-derived, not carried

The commands are the register's own (`PROJECT_CONTEXT.md` §6.3), with the XK tail read from the register's admitted entries. The scoping read §4 (#2173) settled that.

**FD tail: FD-69.**

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
```

**XK tail: XK-4.** The tail is the newest admitted entry (`Cross_Keystone_Register.md:9`, `:30`). The filename scan finds only standalone notes, such as the XK-2 extent census, so it is not used.

```
$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md
57:### XK-1 — `paranoid` exposure
208:### XK-2 — row-scope not enforced in SQL
289:### XK-3 — no authorization substrate for the tenancy root
410:### XK-4 — tenancy absent from the route contract
```

**PE tail: PE #68.**

```
$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -1
68
```

Nothing minted here.

---

## What this plan does not do

- **Rules nothing beyond §1's quoted words.**
- **Edits no filed text.** Only the two additive banners (§3) are placed.
- **Writes no fix, and changes no code or schema.** Fix group 1b and fix group 2 are their own PRs.
- **Mints no FD, PE or XK number, and discharges nothing.**
- **Makes no host, AWS, database or Cognito contact.**

---

## Register hygiene

- **RULES** (§1, Evoni):
  - Fix group 1b (the four sites, #2113's shape) is next, before fix group 2.
  - Fix group 2 goes one file at a time, in v1.0 §4.2's by-file table order, a file with many open sites splittable across PRs, excluding #2102/#2107's rows.
  - The §2.2 finding is recorded; production's history stays NOT ESTABLISHED.
  - O-a/O-c/O-d, Family and Boundary, the story-table columns and v1.0 §4.5 stay owed, unsequenced.
- **Banners:** BH §7 and v1.1 §3, additive, pointing to the scoping read §2.2 (#2173).
- **Closes:** nothing. **Discharges:** nothing. **Mints:** nothing.
- Additive-supersede on v1.1; no destructive rewrite.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-28. Basis: `origin/main` at `a0ceb02be05b2d522c3168942c5ceb5fd475180f`. Predecessor: v1.1.*
*Ruled (Evoni): R1–R4, §1. Mints nothing. Host/AWS/DB/Cognito contact by the filing session: none. Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`). Task: #2174. [skip-automerge]*
