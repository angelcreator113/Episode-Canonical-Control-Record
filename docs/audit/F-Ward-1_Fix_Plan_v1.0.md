# F-Ward-1 Fix Plan v1.0

**The `episode_wardrobe` migration gap — Prime Studios audit canon**

| | |
|---|---|
| **Version** | 1.0. F-Ward-1's first Fix Plan. It is named by the register's convention for a keystone's first plan, `<keystone>_Fix_Plan_v1.0.md`, as `F-Stats-1_Fix_Plan_v1.0.md` and `F-Deploy-1_Fix_Plan_v1.0.md` are. |
| **Date** | 2026-09-27 |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Basis** | `origin/main` at `3188fe5325dac91dc3cf48a5febaddd068876417` (#2081) |
| **Predecessor keystone** | F-Stats-1. Phase B is complete apart from its owed fixes, and "the locked sequence moves to F-Ward-1" (`F-Stats-1_Fix_Plan_v1.63.md` §66.5, RULED). Both owed fixes have since been deployed. |
| **Scoping** | `F-Ward-1_Scoping_2026-09-27.md` (PR #2081) |
| **Audit canon reference** | Audit Handoff v8, Decision #59 |
| **Standing** | Each clause is **RULED**, **ATTESTED** or **MEASURED**, and says so. |
| **Task** | #2084 |

---

## H1 — Basis

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
3188fe5325dac91dc3cf48a5febaddd068876417 2026-09-27 docs(audit): open F-Ward-1, scoping [skip-automerge] (#2081)
$ ls docs/audit | grep '^F-Ward-1'
F-Ward-1_Scoping_2026-09-27.md
```

MEASURED. This is the second F-Ward-1 document and its first Fix Plan.

---

## §1 RULING — Evoni, 2026-09-27

**RULED**, verbatim, in the review chat:

> I adopt this as my ruling: "F-Ward-1 is the episode_wardrobe migration gap only (Decision #59). outfit_sets, outfit_set_items, episode_outfits and episode_outfit_items, which have no creating migrations, are recorded as owed to F-Ward-3. wardrobe_library, wardrobe_library_references and wardrobe_usage_history, which also have none, are recorded as owed with no home yet. The migration recreates production's current episode_wardrobe schema exactly (16 columns, 5 constraints, 7 indexes, as I read them on 2026-09-27) and changes nothing where the table already exists. The EpisodeWardrobe model gains times_worn to match."

**Nothing else is ruled.** This answers the scoping note's §5 question, and its Q4 (which schema is canonical) and Q5 (scope), in Evoni's words. The scoping note's other readings of F-Ward-1 are left as filed: the paranoid axis, PE #43–#47, and XK-4's reach. This plan does not take them up. PE #43–#47 are not named in the ruling (§6).

---

## §2 Production's `episode_wardrobe`, 2026-09-27 — ATTESTED

Evoni read it in production as `postgres`, read-only, on 2026-09-27. She gave two raw outputs in the review chat: the rows, columns and constraints (§2.1), and the indexes (§2.2).

### §2.1 Rows, columns, constraints — ATTESTED, raw output

Her output, verbatim, as she pasted it:

```
 all_rows | live_rows | episodes 
----------+-----------+----------
        4 |         4 |        1
(1 row)

     column_name     |        data_type         | is_nullable |        column_default        
---------------------+--------------------------+-------------+------------------------------
 id                  | uuid                     | NO          | gen_random_uuid()
 episode_id          | uuid                     | NO          | 
 wardrobe_id         | uuid                     | NO          | 
 scene               | character varying        | YES         | 
 worn_at             | timestamp with time zone | YES         | 
 notes               | text                     | YES         | 
 created_at          | timestamp with time zone | YES         | now()
 updated_at          | timestamp with time zone | YES         | now()
 scene_id            | uuid                     | YES         | 
 is_episode_favorite | boolean                  | NO          | false
 times_worn          | integer                  | NO          | 1
 approval_status     | character varying        | YES         | 'pending'::character varying
 approved_by         | character varying        | YES         | 
 approved_at         | timestamp with time zone | YES         | 
 rejection_reason    | text                     | YES         | 
 deleted_at          | timestamp with time zone | YES         | 
(16 rows)

              conname              |                        pg_get_constraintdef                         
-----------------------------------+---------------------------------------------------------------------
 episode_wardrobe_episode_id_fkey  | FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
 episode_wardrobe_pkey             | PRIMARY KEY (id)
 episode_wardrobe_scene_id_fkey    | FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE SET NULL
 episode_wardrobe_wardrobe_id_fkey | FOREIGN KEY (wardrobe_id) REFERENCES wardrobe(id) ON DELETE CASCADE
 unique_episode_wardrobe           | UNIQUE (episode_id, wardrobe_id)
(5 rows)
```

In the same chat, before the raw output, she wrote: "It answers the open question: **`times_worn` defaults to 1**. That's why inserts worked even though the model doesn't declare it."

**Observed, not ruled:** the output gives `character varying` without a length. `data_type` does not carry one, so this read does not show the lengths of `scene`, `approval_status` or `approved_by`.

### §2.2 Indexes — ATTESTED, raw output

Her command's SQL and its output, verbatim. The shell prompt and the environment lines that name the connection are left out.

```
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='episode_wardrobe' ORDER BY indexname;

           indexname            |                                                                  indexdef
--------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------
 episode_wardrobe_episode_id    | CREATE INDEX episode_wardrobe_episode_id ON public.episode_wardrobe USING btree (episode_id)
 episode_wardrobe_pkey          | CREATE UNIQUE INDEX episode_wardrobe_pkey ON public.episode_wardrobe USING btree (id)
 episode_wardrobe_wardrobe_id   | CREATE INDEX episode_wardrobe_wardrobe_id ON public.episode_wardrobe USING btree (wardrobe_id)
 idx_episode_wardrobe_favorites | CREATE INDEX idx_episode_wardrobe_favorites ON public.episode_wardrobe USING btree (is_episode_favorite) WHERE (is_episode_favorite = true)
 idx_episode_wardrobe_scene_id  | CREATE INDEX idx_episode_wardrobe_scene_id ON public.episode_wardrobe USING btree (scene_id)
 idx_episode_wardrobe_worn_at   | CREATE INDEX idx_episode_wardrobe_worn_at ON public.episode_wardrobe USING btree (worn_at)
 unique_episode_wardrobe        | CREATE UNIQUE INDEX unique_episode_wardrobe ON public.episode_wardrobe USING btree (episode_id, wardrobe_id)
(7 rows)
```

**Beside the register, MEASURED.** Deploy AI records the dedupe from 12 indexes to 7 (`F-Deploy-1_Deploy_2026-09-26_AI.md:42`, ATTESTED). It dropped `episode_wardrobe_episode_id_wardrobe_id_key`, `episode_wardrobe_episode_id_idx`, `idx_episode_wardrobe_episode`, `episode_wardrobe_wardrobe_id_idx` and `idx_episode_wardrobe_wardrobe`. It renamed the two survivors to `episode_wardrobe_episode_id` and `episode_wardrobe_wardrobe_id`. All seven names above agree with that record: none it dropped is present, and both renamed names are.

**Beside the scoping note:**
- 4 rows fits Deploy AI's "three locked episode_wardrobe rows" plus one written since (`F-Ward-1_Scoping_2026-09-27.md` §4, Q1).
- "`times_worn` (default 1)" settles its Q2 for that column. The note INFERRED that production supplies a default.

---

## §3 The model against production — MEASURED (model) beside ATTESTED (production)

```
$ grep -nE "^      [a-zA-Z_]+: \{" src/models/EpisodeWardrobe.js
12:      id: {
18:      episode_id: {
27:      wardrobe_id: {
36:      scene_id: {
46:      scene: {
51:      worn_at: {
57:      notes: {
66:      is_episode_favorite: {
77:      approval_status: {
83:      approved_by: {
88:      approved_at: {
93:      rejection_reason: {
```

`timestamps: true` (`:105`), `createdAt`, `updatedAt` and `deletedAt` mapped to snake_case (`:106–108`), `paranoid: true` (`:109`).

| Column | Model (`src/models/EpisodeWardrobe.js`) | Production (§2.1, ATTESTED: type, nullable, default) | Difference |
|---|---|---|---|
| `id` | UUID, `defaultValue: UUIDV4`, NOT NULL (`:12–16`) | uuid, NO, `gen_random_uuid()` | none in kind: the model defaults in the app, production in the database |
| `episode_id` | UUID, NOT NULL, FK `episodes.id` `ON DELETE CASCADE` (`:18–26`) | uuid, NO; `episode_wardrobe_episode_id_fkey` … `ON DELETE CASCADE` | none |
| `wardrobe_id` | UUID, NOT NULL, FK `wardrobe.id` `ON DELETE CASCADE` (`:27–35`) | uuid, NO; `episode_wardrobe_wardrobe_id_fkey` … `ON DELETE CASCADE` | none |
| `scene_id` | UUID, NULL, FK `scenes.id` `ON DELETE SET NULL` (`:36–45`) | uuid, YES; `episode_wardrobe_scene_id_fkey` … `ON DELETE SET NULL` | none |
| `scene` | STRING(255), NULL (`:46–50`) | character varying, YES | none known (length not in the read) |
| `worn_at` | DATE, **NOT NULL**, `defaultValue: NOW` (`:51–56`) | timestamp with time zone, **YES**, no default | **Observed, not ruled:** production has `worn_at` nullable (YES); the model has it NOT NULL, with an app-side default. The 2026-09-17 canon capture agrees with production (YES). |
| `notes` | TEXT, NULL (`:57–61`) | text, YES | none |
| `is_episode_favorite` | BOOLEAN, NOT NULL, default `false` (`:66–70`) | boolean, NO, `false` | none |
| `approval_status` | STRING(50), NULL, default `'pending'` (`:77–81`) | character varying, YES, `'pending'::character varying` | none known (length not in the read) |
| `approved_by` | STRING(255), NULL (`:83–86`) | character varying, YES | none known (length not in the read) |
| `approved_at` | DATE, NULL (`:88–91`) | timestamp with time zone, YES | none |
| `rejection_reason` | TEXT, NULL (`:93–96`) | text, YES | none |
| `created_at` | timestamps (`:106`) | timestamp with time zone, YES, `now()` | the model sets it in the app; production defaults it in the database and allows NULL |
| `updated_at` | timestamps (`:107`) | timestamp with time zone, YES, `now()` | as above |
| `deleted_at` | paranoid (`:108–109`) | timestamp with time zone, YES | none |
| `times_worn` | **not declared** | integer, **NO, 1** | **missing from the model.** The ruling: "The EpisodeWardrobe model gains times_worn to match." |

**Indexes, model against production.** The model declares three (`:114–128`): `unique_episode_wardrobe (episode_id, wardrobe_id)`, `episode_wardrobe_episode_id`, `episode_wardrobe_wardrobe_id`. All three are among production's seven. The model does not declare the other four:
- `episode_wardrobe_pkey`, which follows from the primary key;
- `idx_episode_wardrobe_favorites`, partial;
- `idx_episode_wardrobe_scene_id`;
- `idx_episode_wardrobe_worn_at`.

Nothing runs `sync()` against this table, so the model's list governs no DDL. The ruling's migration must create all seven.

**Constraints.** Production's five (§2.1): the primary key `episode_wardrobe_pkey`; the unique constraint `unique_episode_wardrobe (episode_id, wardrobe_id)`, which the index of the same name serves (§2.2); and the three foreign keys. Deploy AI dropped the duplicate unique constraint `episode_wardrobe_episode_id_wardrobe_id_key`, which is absent here. The three foreign keys match the model's `references` and `onDelete`.

**The migration tree has no file that creates `episode_wardrobe`.** This is carried from the scoping note §3.1, which measured it at `943b7e65`. Nothing under `src/migrations/` changed between that SHA and this basis:

```
$ git diff --stat 943b7e65 3188fe53 -- src/migrations src/models/EpisodeWardrobe.js
$ echo "exit=$?"
exit=0
```

---

## §4 XK-1 and its inventory — the Register's reference

The Register requires this reference, at `Cross_Keystone_Register.md:190` (XK-1's entry): "**When F-Ward-1 or F-Ward-3 opens a plan artifact, it must reference the inventory and this entry.** The obligation transfers here and is discharged only by that reference." The inventory says the same at `Paranoid_Exposure_Inventory_2026-08-07.md` §5: "When F-Ward-1 or F-Ward-3 opens a plan artifact, it must reference this document."

**This plan references both:**
- **XK-1**, `paranoid` exposure: `Cross_Keystone_Register.md` §4, the XK-1 entry and its dated banner.
- **The inventory**, `Paranoid_Exposure_Inventory_2026-08-07.md`, with its two correction banners.

**Is `episode_wardrobe` on the inventory? — MEASURED, from the filed text: no, it was withdrawn.**
- The inventory's 2026-08-18 banner and XK-1's banner both exclude it, with `episode_wardrobe_defaults`, from the exposed set (48 → 37). At that time no deletion attribute resolved on the model.
- XK-1's banner: "**Reach — the F-Ward-1 row is withdrawn in full.** Both tables cited for F-Ward-1 are among the eleven" (`Cross_Keystone_Register.md:131`).
- The inventory: "**`episode_wardrobe` leaves this list and is not thereby clean.** It is F-Ward-1's Pattern 40b table — **no migration anywhere**" (`:64`).

**Since then — MEASURED and ATTESTED, not re-ruled.**
- `EpisodeWardrobe` is now `paranoid: true` with `deletedAt: 'deleted_at'` (`src/models/EpisodeWardrobe.js:108–109`, Task #1924). A deletion attribute now resolves.
- Production has the `deleted_at` column (ATTESTED: Deploy AG, and §2.1's column list). So in production the model's paranoid filter has its column.
- On a migration-built database the table does not exist at all (§3). There the failure is a missing relation, not a missing `deleted_at`.
- XK-1's banner leaves that case open for `outfit_sets` and `outfit_set_items`: "Whether such tables belong in a `paranoid`-exposure finding is unresolved" (`Cross_Keystone_Register.md:142`).

**Whether `episode_wardrobe` re-enters the inventory is not ruled here.** The migration this plan owes (§6, O1) creates the table with `deleted_at`. Once it runs, a migration-built database has the column as well, and no environment remains in which the exposure could arise.

**Whether this reference discharges the obligation.** XK-1's banner (`:144`) left open whether F-Ward-1's half survives the row's withdrawal: "Not resolved here; queued for the ratifying revision." This plan makes the reference either way and does not rule on discharge. Per `Cross_Keystone_Register.md` §6, a status change is ratified by a Fix Plan revision that cites the entry. This plan cites it and changes no status. **No line is added to `Cross_Keystone_Register.md`:** its §6 admission lines record XK admissions, and this plan admits nothing.

---

## §5 The first step — RULED, and what it must satisfy

**RULED:** the migration "recreates production's current episode_wardrobe schema exactly (16 columns, 5 constraints, 7 indexes, as I read them on 2026-09-27) and changes nothing where the table already exists." The model "gains times_worn to match."

What that sets, read from the ruling's words, not added to it:
- **Target.** Production as Evoni read it on 2026-09-27: §2.1's 16 columns (type, nullability, default) and 5 constraints, and §2.2's 7 indexes, each by name and definition.
- **Idempotent where the table exists.** In production, and any database that already has the table, the migration changes nothing.
- **Model.** `times_worn` declared with production's default, 1.

The existing `episode_wardrobe` migrations already use the "no CREATE TABLE where it exists" guard style: `20260925000001` (§3 of the scoping note) and `20260926000000`. **Not ruled here:** the migration's file name, how it tests existence, or its `down`. Those are the migration PR's to propose.

---

## §6 Owed

| # | Item | Source | Standing |
|---|---|---|---|
| O1 | **The migration**: a live migration that creates `episode_wardrobe` exactly as production has it, and changes nothing where it exists | RULED (§1); Decision #59 (`Prime_Studios_Audit_Handoff_v8.md:2289–2290`) | **Owed now; F-Ward-1's first step.** |
| O2 | `EpisodeWardrobe` gains `times_worn` (production default 1) | RULED (§1); §3 | **Owed now**, with O1 or alongside it. |
| O3 | `outfit_sets`, `outfit_set_items`, `episode_outfits`, `episode_outfit_items`: no creating migrations | RULED (§1): "owed to F-Ward-3"; scoping note §3.3 | **Owed to F-Ward-3.** Recorded here; F-Ward-3 has no document yet. |
| O4 | `wardrobe_library`, `wardrobe_library_references`, `wardrobe_usage_history`: no creating migrations | RULED (§1): "owed with no home yet"; scoping note §3.3 | **Owed, unhomed.** |
| O5 | XK-1's reciprocal reference | `Cross_Keystone_Register.md:190`; inventory §5 | **Made here** (§4). Whether it discharges the obligation is not ruled. |

**Not in this list, left as filed:**
- **PE #43–#47**, deferred as "F-Ward-1 keystone territory" in `Session_PE_Roster.md:356`–`:443`. The ruling scopes F-Ward-1 to `episode_wardrobe` only and does not name them, so they are neither taken in nor re-homed here.
- **XK-4's reach**, which names F-Ward-1 (`Cross_Keystone_Register.md:53`).

---

## What this plan does not do

- **Rules nothing beyond §1's quoted words.**
- **Writes no migration and changes no model.** O1 and O2 are owed.
- **Mints no FD, PE or XK number**, and adds nothing to `Cross_Keystone_Register.md`.
- **Does not re-home PE #43–#47** or XK-4's reach.
- **Does not rule on XK-1's reference obligation**, or on `episode_wardrobe`'s standing on the inventory (§4).
- **Does not edit** the scoping note, v1.63, the Register, the inventory or any other filed document.
- **Makes no host, AWS, database or Cognito contact.** Every ATTESTED clause is Evoni's own read, made outside any agent session. The shell prompt and the environment lines in her paste, which name the connection, are not reproduced.

---

## Register hygiene

- **RULES** (§1, Evoni): F-Ward-1's scope (the `episode_wardrobe` migration gap only); where the seven other tables go; the migration's target (production as read on 2026-09-27) and behaviour; `times_worn` on the model.
- **Opens:** the F-Ward-1 Fix Plan series (v1.0).
- **Owes, new:** O1 (the migration), O2 (`times_worn`), O3 (to F-Ward-3), O4 (unhomed).
- **Records, observed, not ruled:** production's `worn_at` is nullable (YES) while the model has it NOT NULL (§3).
- **Mints:** nothing. FD, XK and PE tails are unchanged.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

F-Ward-1 began as one sentence in the v8 handoff: a table the wardrobe game writes to, with no migration that creates it. The columns have since been fixed in production. What remains is the thing the sentence named: the table itself, written down so that a new database gets it too. Evoni has read production's version of it. The next step is the migration that copies it.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `3188fe5325dac91dc3cf48a5febaddd068876417`. Scoping: `F-Ward-1_Scoping_2026-09-27.md`.*
*Ruled (Evoni): F-Ward-1's scope and first step. Owed: O1, O2, O3 (F-Ward-3), O4 (unhomed). References XK-1 and its inventory. Mints nothing. Task: #2084. [skip-automerge]*
