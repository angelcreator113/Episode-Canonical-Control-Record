# F-Ward-1 Fix Plan v1.1

**F-Ward-1 closed — Prime Studios audit canon**

| | |
|---|---|
| **Version** | 1.1. Additive-supersede on `F-Ward-1_Fix_Plan_v1.0.md`. |
| **Date** | 2026-09-27 |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Basis** | `origin/main` at `7e2ea9ce89e22336a1647d1c951963e810fa9072` (#2089) |
| **Predecessor** | v1.0 (`13ebf99b`, #2085) |
| **Standing** | Each clause is **RULED**, **ATTESTED** or **MEASURED**, and says so. |
| **Task** | #2092 |

---

## H1 — Basis

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
7e2ea9ce89e22336a1647d1c951963e810fa9072 2026-09-27 feat(db): a migration that creates episode_wardrobe as production has it [skip-automerge] (#2089)
$ ls docs/audit | grep '^F-Ward-1'
F-Ward-1_Fix_Plan_v1.0.md
F-Ward-1_Scoping_2026-09-27.md
```

MEASURED. v1.0 is the newest F-Ward-1 plan.

---

## §1 RULING — Evoni, 2026-09-27

**RULED**, verbatim, in the review chat:

> F-Ward-1 closes. O1 (the migration that creates episode_wardrobe) and O2 (times_worn in the model) are done, deployed in Deploy BD. O3 stays owed to F-Ward-3 and O4 stays owed with no home. episode_wardrobe stays off XK-1's paranoid inventory, since it has deleted_at in production and in its creating migration, and its Pattern 40b finding is resolved by migration 20260927000000. The locked sequence moves to F-Reg-2.

**Nothing else is ruled.**

---

## §2 O1 and O2 — done

### §2.1 On main — MEASURED

PR #2089 (`7e2ea9ce`, Task #2087) adds the migration and the model change:

```
$ git show --stat --format='%h %s' 7e2ea9ce -- src/
7e2ea9ce8 feat(db): a migration that creates episode_wardrobe as production has it [skip-automerge] (#2089)

 .../20260927000000-create-episode-wardrobe.js      | 110 +++++++++++++++++++++
 src/models/EpisodeWardrobe.js                      |   8 ++
 2 files changed, 118 insertions(+)
$ git show 7e2ea9ce:src/migrations/20260927000000-create-episode-wardrobe.js | grep -n "tableExists\|async down\|CREATE TABLE IF NOT EXISTS"
36:  CREATE TABLE IF NOT EXISTS public.episode_wardrobe (
79:      if (await queryInterface.tableExists(TABLE, { transaction })) {
104:  async down() {
$ git show 7e2ea9ce:src/models/EpisodeWardrobe.js | grep -n "times_worn"
71:      // F-Ward-1 Fix Plan v1.0 O2 (Task #2087): production has times_worn
74:      times_worn: {
```

- **O1.** The migration checks whether the table exists (`:79`). If it does, it logs and returns before any DDL. Otherwise it creates the table (`:36`) with v1.0 §2's 16 columns, 5 constraints and 7 indexes. Its `down` (`:104`) does nothing.
- **Tested in CI.** On a migration-built database, #2089's integration test compares the table with Evoni's production read, as data, and they are equal. The same test shows a second run changes nothing, and that an existing table of another shape keeps its columns, constraints, indexes and rows.
- **O2.** `EpisodeWardrobe` declares `times_worn` (INTEGER, NOT NULL, default 1) (`:74`).

### §2.2 In production — ATTESTED, Deploy BD

As the BD record states it (`F-Deploy-1_Deploy_2026-09-27_BD.md`, filed under Task #2091 alongside this plan):

- **Pending check before:** production reached `7e2ea9ce` and reported "1 pending of 219 … FAIL: pending migrations. Do not restart."
- **The migration was recorded, not run.** Evoni did the following as `postgres`, in one transaction:
  - confirmed the table present;
  - inserted the migration's `SequelizeMeta` row;
  - confirmed `episode_wardrobe` still held 4 rows;
  - committed.

  So the migration's "already exists" branch never ran in production. The evidence that production is unchanged is that check.
- **Pending check after:** 0 pending of 219.
- **Restart:** a plain restart, 4 → 5. `/health` reported healthy with the database connected.

**Disposition, per the ruling:** O1 and O2 are done and deployed.

---

## §3 `episode_wardrobe` and XK-1 — RULED, with the Register's words

**RULED:**
- "episode_wardrobe stays off XK-1's paranoid inventory, since it has deleted_at in production and in its creating migration."
- "its Pattern 40b finding is resolved by migration 20260927000000."

**The Register's words — MEASURED** (`Cross_Keystone_Register.md`, XK-1's dated banner):

```
$ sed -n 131p docs/audit/Cross_Keystone_Register.md
**Reach — the F-Ward-1 row is withdrawn in full.** Both tables cited for F-Ward-1 are among the eleven.
$ sed -n 138p docs/audit/Cross_Keystone_Register.md
**`episode_wardrobe` is withdrawn from the paranoid axis and is not thereby clean.** It remains F-Ward-1's **Pattern 40b** table — no migration anywhere — an undisturbed finding. Withdrawal means it cannot fail on `deleted_at`; it means nothing about whether its table exists.
```

The XK-1 entry's table (`:176–182`) lists `episode_wardrobe` and `episode_wardrobe_defaults` under F-Ward-1. It adds: "`episode_wardrobe` is F-Ward-1's Pattern 40b table — it has no migration anywhere".

**The ruling's two grounds, beside the tree — MEASURED:**
- **"deleted_at … in its creating migration":** `deleted_at timestamp with time zone` is column 16 of the migration's `CREATE TABLE` (`src/migrations/20260927000000-create-episode-wardrobe.js:52`).
- **"deleted_at in production":** ATTESTED, `F-Ward-1_Fix_Plan_v1.0.md` §2.1, Evoni's raw read.
- **"no migration anywhere", as the banner put it,** no longer holds. `20260927000000` creates the table (§2.1).

**No edit to `Cross_Keystone_Register.md`.**
- Its §6 reads: "Status changes are ratified by a Fix Plan revision that cites the entry, never by editing this file alone."
- The ruling changes no XK status. `episode_wardrobe` *stays* off the inventory, and XK-1's reach and admission are untouched.
- This plan cites the entry. That is the Register's own mechanism for recording what the ruling decides.
- The banner v1.62 added to XK-3 moved an item *into* an entry (the §64.4-R fold). Nothing moves into an entry here.

**The reciprocal-reference obligation** (`Cross_Keystone_Register.md:190`; v1.0 §4) was made by v1.0 and is made again here. The ruling does not say whether that discharges it. This plan leaves it as v1.0 did.

---

## §4 Owed, carried

| # | Item | Standing |
|---|---|---|
| O3 | `outfit_sets`, `outfit_set_items`, `episode_outfits`, `episode_outfit_items`: no creating migrations | **Owed to F-Ward-3** (RULED, v1.0 §1 and v1.1 §1). F-Ward-3 has no document yet. |
| O4 | `wardrobe_library`, `wardrobe_library_references`, `wardrobe_usage_history`: no creating migrations | **Owed, with no home** (RULED, v1.0 §1 and v1.1 §1). |
| — | `worn_at`: production nullable (YES), the model NOT NULL | **Observed, not ruled** (v1.0 §3), unchanged. |
| — | PE #43–#47; XK-4's reach naming F-Ward-1 | Left as filed (v1.0 §6), unchanged. |

---

## §5 The locked sequence moves to F-Reg-2 — RULED

**RULED:** "The locked sequence moves to F-Reg-2."

The sequence, as `PROJECT_CONTEXT.md` §6.1 carries it: F-AUTH-1 → F-Deploy-1 → F-App-1 → F-Stats-1 Phase B → F-Ward-1 → **F-Reg-2** → F-Ward-3 → F-Franchise-1 (= Director Brain) → F-Sec-3.

**F-Reg-2's repository presence — MEASURED: none of its own.**

```
$ ls docs/audit | grep -c '^F-Reg-2'
0
$ grep -rl "F-Reg-2" docs/audit | wc -l
43
```

The 43 files mention it, mostly as a place in the sequence. The audit defined it in `Prime_Studios_Audit_Handoff_v8.md:180`: "**F-Reg-2** (architectural keystone, v6) --- registry_characters …". `PROJECT_CONTEXT.md` §6.1 records it as "Registry write contention | Queued; zero presence."

**Not specified by the ruling:** F-Reg-2's first step. This plan opens no F-Reg-2 document.

---

## What this plan does not do

- **Rules nothing beyond §1's quoted words.**
- **Edits no filed document.** That includes `Cross_Keystone_Register.md` (§3), v1.0, the scoping note and the BD record.
- **Mints no FD, PE or XK number.**
- **Does not open F-Reg-2 or F-Ward-3.**
- **Does not rule on the `worn_at` difference, PE #43–#47, XK-4's reach, or XK-1's reference obligation.**
- **Makes no host, AWS, database or Cognito contact.** Every ATTESTED clause is Evoni's own account, taken outside any agent session.

---

## Register hygiene

- **RULES** (§1, Evoni): F-Ward-1 closed; O1 and O2 done and deployed (Deploy BD); O3 to F-Ward-3 and O4 unhomed, both still owed; `episode_wardrobe` stays off XK-1's paranoid inventory; its Pattern 40b finding resolved by migration `20260927000000`; the locked sequence to F-Reg-2.
- **Closes:** F-Ward-1. **Discharges:** O1, O2.
- **Owes, carried:** O3 (to F-Ward-3), O4 (unhomed).
- **Moves:** the locked sequence, from F-Ward-1 to F-Reg-2.
- **Mints:** nothing. FD, XK and PE tails are unchanged.
- Additive-supersede on v1.0; no destructive rewrite.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

Decision #59 asked for a migration that captures `episode_wardrobe`'s schema. It was written into the v8 handoff months ago and waited behind every keystone ahead of it. Today it was scoped, ruled, written to production's exact shape, tested against that shape, and deployed as a no-op on the one database where the table already lived. F-Ward-1 closes on it. Next is F-Reg-2: the registry's write contention.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `7e2ea9ce89e22336a1647d1c951963e810fa9072`. Predecessor: v1.0.*
*Ruled (Evoni): F-Ward-1 closed; O1/O2 done (Deploy BD); O3 to F-Ward-3, O4 unhomed; episode_wardrobe off XK-1's paranoid inventory; Pattern 40b resolved by 20260927000000; sequence to F-Reg-2. Mints nothing. Task: #2092. [skip-automerge]*
