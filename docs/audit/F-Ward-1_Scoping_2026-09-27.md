# F-Ward-1 — Scoping: the `episode_wardrobe` migration gap

*Standalone note. Measurement only. Opens F-Ward-1. Mints nothing, rules nothing, closes nothing, fixes nothing.*

| | |
|---|---|
| **Basis** | `origin/main` at `943b7e657227b31964901fa5903ce413814e2bf7` (#2079), 2026-09-27, the /wake-up SHA of the session that filed this. |
| **Standing** | **MEASURED**: a command and its raw output, reproducible from a clone. **ATTESTED**: Evoni's own account of production, as a filed record carries it; cited, never upgraded. **INFERRED**, marked where used. |
| **Why now** | `F-Stats-1_Fix_Plan_v1.63.md` §66.5 (RULED, 2026-09-27): "the locked sequence moves to F-Ward-1." F-Ward-1's first step is not ruled. |
| **Task** | #2080 |

## Purpose

F-Ward-1 has had no document of its own. This note sets out three things, each with its source, so Evoni can rule F-Ward-1's first step:
- what the register has said F-Ward-1 covers;
- what has already been done toward it;
- what remains.

It does not reconcile differing definitions. It lists them side by side.

**Cross-Keystone Register §4's reciprocal-reference obligation.** `Cross_Keystone_Register.md:190` reads: "When F-Ward-1 or F-Ward-3 opens a plan artifact, it must reference the inventory and this entry." This note references both:
- the XK-1 entry (`Cross_Keystone_Register.md` §4, XK-1);
- the inventory (`Paranoid_Exposure_Inventory_2026-08-07.md`).

Whether a scoping note discharges the obligation is not ruled here (§4, Q6).

## H1 — Basis

```
$ git fetch origin --prune
$ git log -1 --format='%H %ad %s' --date=short origin/main
943b7e657227b31964901fa5903ce413814e2bf7 2026-09-27 fix(world): affordability and financial-pressure read the ledger balance [skip-automerge] (#2079)
$ git rev-parse --is-shallow-repository
false
$ ls docs/audit | grep -c '^F-Ward-1'
0
```

MEASURED. Date: 2026-09-27. There was no open PR at wake-up. No `F-Ward-1*` file existed before this one.

---

## §1. What the register says F-Ward-1 covers — MEASURED (quoted)

```
$ grep -rl "F-Ward-1" docs/audit | wc -l
96
```

Most of the 96 files name F-Ward-1 only as a position in the locked sequence (for example "F-Stats-1 Phase B → F-Ward-1 → F-Reg-2"). The passages below are the ones that say what F-Ward-1 *covers*.

**D1 — the keystone, as the audit defined it.** `Prime_Studios_Audit_Handoff_v8.md:186–190`:

> **F-Ward-1** (v7 KEYSTONE --- wardrobe side) --- `episode_wardrobe` has no migration in the codebase. The table the entire wardrobe-gameplay loop writes to exists only via Sequelize sync from the EpisodeWardrobe model. Pattern 40b canonical instance, schema-source drift Tier 4 (most severe of four).

The same handoff, at `:418–424`:

> **F-Ward-1 (v7 KEYSTONE) --- episode_wardrobe table has no migration.** Table exists only via Sequelize sync from EpisodeWardrobe model. The wardrobe.js:1291 defensive comment ("RDS table may have been created from a simpler migration that lacks approval_status, worn_at") is the codebase acknowledging this in writing. Schema-source drift Tier 4. Decision #59: write a migration.

**D2 — the resolution, Decision #59.** `Prime_Studios_Audit_Handoff_v8.md:2289–2290`:

> **Decision #59:** Write a migration to capture the canonical episode_wardrobe schema. F-Ward-1 keystone resolution.

The F-AUTH-1 family carries it as a tier-1 row. At `F-AUTH-1_Fix_Plan_v1.5.md:617`:

> | 1 | **F-Ward-1** | Write the migration that captures `episode_wardrobe` canonical schema. Decision #59. |

```
$ grep -lF "Write the migration that captures" docs/audit/*.md | wc -l
8
```

**D3 — at the model file, and the drift class.** `Prime_Studios_Audit_Handoff_v8.md:1215–1222` (F-Closet-2, P0):

> F-Ward-1 keystone confirmed at the model file. EpisodeWardrobe declares full schema (id UUID, episode_id, wardrobe_id, scene_id, scene STRING legacy, worn_at, notes, approval_status, approved_by, approved_at, rejection_reason). No migration in the codebase creates …

At `:1695–1698`:

> **Decision #88:** Pattern 40b gains a second axis: data-source drift. F-Ward-1 (no migration for episode_wardrobe) is **schema** drift Tier 4.

**D4 — the silent-failure consequence.** `Prime_Studios_Audit_Handoff_v8.md:1845–1849` (F-EpComp-2, P0):

> Outfit-piece source falls back from episode_wardrobe → event.outfit_pieces JSONB. F-Ward-1 keystone makes this critical: in environments where episode_wardrobe schema drift means writes silently fail, this fallback hides the failure mode entirely. CZ-32.

**D5 — the paranoid-exposure inventory, then withdrawn.**

`Cross_Keystone_Register.md:176–192`, the XK-1 entry's table:

> | F-Ward-1 | `episode_wardrobe`, `episode_wardrobe_defaults` |
>
> `episode_wardrobe` is F-Ward-1's Pattern 40b table — it has no migration anywhere, and it is also on this list. … **When F-Ward-1 or F-Ward-3 opens a plan artifact, it must reference the inventory and this entry.**

The dated banner on the same entry, `:131` and `:138`:

> **Reach — the F-Ward-1 row is withdrawn in full.** Both tables cited for F-Ward-1 are among the eleven.
>
> **`episode_wardrobe` is withdrawn from the paranoid axis and is not thereby clean.** It remains F-Ward-1's **Pattern 40b** table — no migration anywhere — an undisturbed finding.

**D6 — the wider wardrobe and outfit divergence.** `F-Stats-1_Fix_Plan_v1.28.md:139`:

> F-Ward-1 is next in the locked register order after F-Stats-1 closes. Eight of the thirty canon-only tables are wardrobe and outfit tables. **F-Ward-1 inherits this divergence directly**, and any F-Ward-1 work that assumes a migration-built environment reproduces production will be working against a schema that does not exist there.

The eight, as v1.28 names them (`:129`, in its "Bearing on open item 6"): `wardrobe_library`, `wardrobe_library_references`, `wardrobe_usage_history`, `episode_wardrobe`, `outfit_sets`, `outfit_set_items`, `episode_outfits`, `episode_outfit_items`.

**D7 — pre-existing errors filed to it.** `Session_PE_Roster.md` defers five open P1 entries, PE #43 to #47, as "F-Ward-1 keystone territory":

| PE | Title as filed | Deferral |
|---|---|---|
| #43 | Thumbnail.episodeId vs episode_id JOIN failure | `:356`, "Covered by F-Ward-1 keystone scope (schema-source drift, Pattern 40b)" |
| #44 | shows.distribution_defaults column missing on prod RDS | `:380` |
| #45 | WorldEvent.source_profile_id column missing on prod RDS | `:403` |
| #46 | Wardrobe.s3_key_regenerated column missing on prod RDS | `:421` |
| #47 | ui_overlay_types relation drift | `:443`, "missing-table variant" |

The same roster, later, at `:1360`:

> No queued keystone absorbs them: F-Ward-1 owns only `episode_wardrobe`; …

**D8 — the living summary.** `PROJECT_CONTEXT.md` §6.1 (line 317), the F-Ward-1 row's Finding column: "`episode_wardrobe` migration gap".

**D9 — named in XK-4's reach.** `Cross_Keystone_Register.md:53`:

> | XK-4 | Tenancy absent from the route contract … | F-Stats-1, F-Ward-1, F-AUTH-1 | …

### §1.1 The definitions side by side (not reconciled)

| | Tables | What F-Ward-1 is to do | Source |
|---|---|---|---|
| **Narrow** | `episode_wardrobe` only | Write a migration that captures its canonical schema | D1, D2, D3, D8; the roster's "F-Ward-1 owns only `episode_wardrobe`" (`:1360`) |
| **Paranoid axis** | `episode_wardrobe`, `episode_wardrobe_defaults` | Reference the XK-1 entry and inventory; the row itself is withdrawn | D5 |
| **Wide** | the eight canon-only wardrobe and outfit tables | Inherit the canon-versus-migration divergence | D6 |
| **Wider** | columns and relations on `thumbnails`, `shows`, `world_events`, `wardrobe`, `ui_overlay_types` | The PE #43–#47 deferrals | D7 (`:356`–`:443`), against the same roster's `:1360` |
| **Tenancy** | routes reaching child records | A keystone in XK-4's reach | D9 |

The narrow reading is the one every definitional source states. The wide and wider readings come from later documents that forward-pointed to F-Ward-1 without the audit having scoped it that way. The roster says both "F-Ward-1 keystone territory" (`:356`–`:443`) and "F-Ward-1 owns only `episode_wardrobe`" (`:1360`).

---

## §2. What has been done toward it — MEASURED, with ATTESTED production accounts

**PR #1929 (Task #1924, `5a60f3278`): the approval columns.** It adds `src/migrations/20260925000001-add-approval-columns-to-episode-wardrobe.js`. That migration adds five columns and **does not create the table**, by design:

```
$ sed -n 40,45p src/migrations/20260925000001-add-approval-columns-to-episode-wardrobe.js
 * No CREATE TABLE: the table exists in canon, but no live migration creates
 * it, so a fresh database (CI, a new dev box) has no episode_wardrobe. There
 * the migration logs and does nothing — it adds columns to the table where the
 * table exists and never invents the table. Additive and idempotent: each
 * column is added only when describeTable does not already show it; down
 * removes those that are there.
```

**Deploy AG ran it, ATTESTED** (`F-Deploy-1_Deploy_2026-09-25_AG.md` §0 and §7). Evoni ran it by hand as `postgres`, before the code, in one transaction:
- five columns added: `approval_status`, `approved_by`, `approved_at`, `rejection_reason`, `deleted_at`;
- "table verified at 16 columns before COMMIT";
- "No backfill ran because the table holds 0 rows."

**PR #1938 (Task #1933): the duplicate indexes.** It adds `20260926000000-dedupe-episode-wardrobe-indexes.js`, which also creates no table. **Deploy AI ran it, ATTESTED** (`F-Deploy-1_Deploy_2026-09-26_AI.md:42`): "episode_wardrobe went from 12 indexes to 7 … The three locked episode_wardrobe rows were untouched."

**The defensive comment D1 cites is gone.** PR #1929 removed it:

```
$ grep -n "simpler migration" src/routes/wardrobe.js; echo "exit=$?"
exit=1
$ git log --oneline -S "simpler migration" -- src/routes/wardrobe.js
5a60f3278 fix(wardrobe): episode_wardrobe gets its approval columns, so an episode can have a look of its own [skip-automerge] (#1929)
823629b5a fix: select route  use only guaranteed columns (id, episode_id, wardrobe_id, created_at, updated_at)
```

**The living record.** `PROJECT_CONTEXT.md` §6.5 (line 456) marks "`episode_wardrobe` columns missing in production" as **DONE — migration merged and run in production**. It sources that to `docs/WARDROBE_OWNERSHIP_READ.md` §4.6 (PR #1742), which read from the 2026-09-17 capture that canon's table lacked `approval_status` and `deleted_at`.

### §2.1 Against each definition

| Definition | Covered by the work above? |
|---|---|
| Narrow (D1, D2): "no migration in the codebase" / "write a migration to capture the canonical schema" | **No.** The table's columns now match the model *in production* (ATTESTED, AG). But no live migration creates `episode_wardrobe` (§3.1). A fresh database still has no table, which is Decision #59's gap exactly. |
| D3: the model declares columns the table lacks | **Yes, for production** (ATTESTED, AG). |
| D4: writes fail silently and completion falls back to `outfit_pieces` | **The column cause is removed in production** (ATTESTED, AG). Whether a write now succeeds end to end is partly attested: AI's "three locked episode_wardrobe rows" (§4, Q1). |
| Paranoid axis (D5) | **Moot for the row, which was withdrawn.** `episode_wardrobe` is now `paranoid: true` with `deleted_at` in production (model; ATTESTED, AG). The CKR §4 reference obligation is addressed in §4, Q6. |
| Wide (D6): the other seven tables | **No.** Untouched (§3.3). |
| Wider (D7): PE #43–#47 | **No.** Not touched by this work; not re-derived here. |

---

## §3. The model, the migration tree and canon — MEASURED

### §3.1 No live migration creates `episode_wardrobe`

```
$ grep -Pzl "(?s)createTable\(\s*['\"]episode_wardrobe['\"]|CREATE TABLE(\s+IF NOT EXISTS)?\s+\"?episode_wardrobe\"?\s*\(" src/migrations/*.js; echo "exit=$?"
exit=1
$ grep -rln "episode_wardrobe" src/migrations | sort
src/migrations/20260216000001-asset-wardrobe-system.js
src/migrations/20260218000002-fix-wardrobe-defaults-table.js
src/migrations/20260925000001-add-approval-columns-to-episode-wardrobe.js
src/migrations/20260926000000-dedupe-episode-wardrobe-indexes.js
```

The first two name only `episode_wardrobe_defaults`, which they create. The last two alter `episode_wardrobe` where it exists.

The repo's schema-agreement checker classifies it the same way:

```
$ node scripts/check-schema-agreement.js --step2-baseline scripts/schema-agreement-step2.baseline 2>&1 | grep -E "ALTERONLY EpisodeWardrobe"
  ALTERONLY EpisodeWardrobe (episode_wardrobe) 5 column(s) added by live migrations
$ grep -c "EpisodeWardrobe" scripts/schema-agreement-step2.baseline
0
```

- `ALTERONLY` means the live tree alters the table but never creates it.
- Step 2 compares an `ALTERONLY` model with the canon capture plus every live `addColumn` (`scripts/check-schema-agreement.js:81–97`).
- Zero baseline entries means no model column is missing from canon-plus-migrations.

On a migration-built database, the migration logs the gap. This was run by this session on a throwaway local Postgres, not production, at `368781a6`. Neither the migration tree nor the model changed between that SHA and the basis (`git diff --stat 368781a6 943b7e65 -- src/migrations src/models/EpisodeWardrobe.js` prints nothing):

```
[migration 20260926000000] episode_wardrobe does not exist here; no live migration creates it, so there is nothing to dedupe (fresh database).
```

### §3.2 Column by column

Sources for the table below:
- **Model:** `src/models/EpisodeWardrobe.js`, attributes at the lines shown. `timestamps: true`, `paranoid: true` and `underscored: true` at `:105–110` add `created_at`, `updated_at` and `deleted_at`.
- **Canon capture:** ATTESTED, from the filed capture, dated **2026-09-17, which predates Deploy AG (2026-09-25)**.
- **Production after AG:** ATTESTED, "16 columns".

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
$ grep -E "^ episode_wardrobe +\|" docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
 episode_wardrobe                 | created_at                        | timestamp with time zone    | YES
 episode_wardrobe                 | episode_id                        | uuid                        | NO
 episode_wardrobe                 | id                                | uuid                        | NO
 episode_wardrobe                 | is_episode_favorite               | boolean                     | NO
 episode_wardrobe                 | notes                             | text                        | YES
 episode_wardrobe                 | scene                             | character varying           | YES
 episode_wardrobe                 | scene_id                          | uuid                        | YES
 episode_wardrobe                 | times_worn                        | integer                     | NO
 episode_wardrobe                 | updated_at                        | timestamp with time zone    | YES
 episode_wardrobe                 | wardrobe_id                       | uuid                        | NO
 episode_wardrobe                 | worn_at                           | timestamp with time zone    | YES
```

| Column | Model | Live migration tree | Canon capture 2026-09-17 | Production after AG (ATTESTED) |
|---|---|---|---|---|
| `id` | `:12` | not created | uuid, NOT NULL | present |
| `episode_id` | `:18` | not created | uuid, NOT NULL | present |
| `wardrobe_id` | `:27` | not created | uuid, NOT NULL | present |
| `scene_id` | `:36` | not created | uuid | present |
| `scene` | `:46` | not created | varchar | present |
| `worn_at` | `:51` | not created | timestamptz | present |
| `notes` | `:57` | not created | text | present |
| `is_episode_favorite` | `:66` (`allowNull: false`, default `false`) | not created | boolean, NOT NULL | present |
| `approval_status` | `:77` | added (`20260925000001`) | **absent** | added at AG |
| `approved_by` | `:83` | added | **absent** | added at AG |
| `approved_at` | `:88` | added | **absent** | added at AG |
| `rejection_reason` | `:93` | added | **absent** | added at AG |
| `created_at` | timestamps (`:106`) | not created | timestamptz | present |
| `updated_at` | timestamps (`:107`) | not created | timestamptz | present |
| `deleted_at` | paranoid (`:108–109`) | added | **absent** | added at AG |
| `times_worn` | **not declared** | not created | integer, **NOT NULL** | present |

**The remaining mismatch, model against canon: `times_worn`.**
- Canon has it NOT NULL, and the model does not declare it.
- The capture lists no column defaults.
- Both raw `INSERT INTO episode_wardrobe` statements in `src/routes/wardrobe.js` (lines 1475 and 1631) omit it, as model creates would.
- **INFERRED:** production supplies a default. Deploy AI's "three locked episode_wardrobe rows" (ATTESTED) were written without it.
- A live read settles it (§4, Q2).

**The mismatch, migration tree against both: the whole table.** 16 of 16 columns are absent from a migration-built database. Five of them would be added if the table existed.

### §3.3 The other definitions' tables, at this basis

**`episode_wardrobe_defaults` (D5): model, migration and canon agree.** Six columns: `id`, `episode_id`, `character_name`, `default_outfit_asset_id`, `created_at`, `updated_at`.
- The model is `src/models/EpisodeWardrobeDefault.js:12–47`, with `timestamps: false` at `:55` and not paranoid.
- The migration is `createTable('episode_wardrobe_defaults', …)` at `src/migrations/20260216000001-asset-wardrobe-system.js:228`, guarded, and repeated in `20260218000002-fix-wardrobe-defaults-table.js`.
- The canon capture lists the same six columns.

It carries no F-Ward-1 gap on any axis measured here.

**The eight canon-only tables (D6): still canon-only.** No live migration creates any of them:

```
$ for t in wardrobe_library wardrobe_library_references wardrobe_usage_history episode_wardrobe outfit_sets outfit_set_items episode_outfits episode_outfit_items; do c=$(grep -Pzl "(?s)createTable\(\s*['\"]$t['\"]|CREATE TABLE(\s+IF NOT EXISTS)?\s+\"?$t\"?\s*\(" src/migrations/*.js | tr '\n' ' '); echo "$t: ${c:-none}"; done
wardrobe_library: none
wardrobe_library_references: none
wardrobe_usage_history: none
episode_wardrobe: none
outfit_sets: none
outfit_set_items: none
episode_outfits: none
episode_outfit_items: none
```

The checker's step-2 report classifies the four that have models:
- `wardrobe_library`: ALTERONLY, 12 columns added by live migrations;
- `wardrobe_usage_history`, `wardrobe_library_references`, `outfit_sets`, `outfit_set_items`: NOTABLE, meaning no live migration touches them.

`episode_outfits` and `episode_outfit_items` have no model in the report. **Not re-derived here:** whether all eight are still in canon today. The capture lists all eight; it predates this basis.

---

## §4. Open questions — recorded, not answered

**Q1. The row count: 21, then 0, then 3.**

The register explains the drop:

| Date | Count | Source |
|---|---|---|
| 2026-09-23 | 21 rows (lacking `approval_status` and `deleted_at`) | ATTESTED, as `PROJECT_CONTEXT.md` §6.5 (line 456) records it. That row calls the difference from AG's 0 "not reconciled here". |
| 2026-09-24, ~11:00 UTC | 21 before, then `DELETE 21` in one transaction, count verified 0 before commit | ATTESTED, `F-Deploy-1_Deploy_2026-09-24.md` §9. "All 21 pointed at episodes that no longer existed or were soft-deleted"; "No rollback record was kept." |
| 2026-09-25 | 0 rows | ATTESTED, the AG record: "episode_wardrobe holds 0 rows across 0 episodes" and "No backfill ran because the table holds 0 rows". |
| 2026-09-26 | "three locked episode_wardrobe rows" | ATTESTED, the AI record (`:42`). |

**MEASURED, from the register only:** the 09-24 record's deliberate cleanup accounts for 21 → 0. The §6.5 row predates it being cross-referenced.

What a repository read cannot settle is the table's contents now. **Read-only query:**

```sql
SELECT count(*) AS all_rows,
       count(*) FILTER (WHERE deleted_at IS NULL) AS live_rows,
       count(DISTINCT episode_id) AS episodes
FROM episode_wardrobe;
```

**Q2. Production's column list now, with defaults.** AG attests 16 columns. The capture has no defaults, and D2's "canonical schema" would need them. This matters most for `times_worn` NOT NULL (§3.2) and for `worn_at`. **Read-only query:**

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'episode_wardrobe'
ORDER BY ordinal_position;
```

**Q3. Indexes and constraints now.** AI attests 12 → 7 indexes, and names the ones it dropped and renamed. A migration that creates the table would need to reproduce what remains. **Read-only query:**

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'episode_wardrobe' ORDER BY indexname;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.episode_wardrobe'::regclass ORDER BY conname;
```

**Q4. Which schema is "canonical" for Decision #59.** The repository holds three differing descriptions of the table:
- **The model:** 15 columns, no `times_worn` (§3.2).
- **The canon capture plus the AG columns:** 16 columns, ATTESTED.
- **`docs/audit/FD31-prod-only-schema-20260601.sql:5175`:** the schema-only dump of the *empty* `episode-control-prod` instance, captured 2026-06-01. It has 13 columns, with `worn_at` NOT NULL and no `times_worn` or `is_episode_favorite`.

D2 says "the canonical episode_wardrobe schema" and does not say which. Not answered here.

**Q5. Scope.** Do the seven other canon-only wardrobe and outfit tables (D6) belong to F-Ward-1? Do PE #43–#47 (D7)? The register says both yes (`:356`–`:443`, v1.28:139) and no (`Session_PE_Roster.md:1360`). Not answered here.

**Q6. CKR §4's reference obligation.**
- `Cross_Keystone_Register.md:190` binds F-Ward-1's first plan artifact to reference XK-1 and the inventory.
- `:144` records that, with F-Ward-1's row withdrawn, "whether F-Ward-1's half of the obligation survives … [is] Not resolved here; queued for the ratifying revision."

This note makes the reference (Purpose). Whether that discharges the obligation, or whether it survives at all, is not ruled here.

---

## §5. What remains owed

| # | Item | Source | Standing at this basis |
|---|---|---|---|
| O1 | A live migration that creates `episode_wardrobe`, so a fresh database has the table: Decision #59 | D1, D2 (`Handoff_v8:2289–2290`; `F-AUTH-1_Fix_Plan_v1.5.md:617`) | **Open.** MEASURED: no creator (§3.1). Its target shape waits on Q2–Q4. |
| O2 | The model's undeclared `times_worn` (canon NOT NULL) | §3.2 | **Open; recorded, not ruled a defect.** Whether it is F-Ward-1's depends on Q4. |
| O3 | CKR §4's reciprocal reference | `Cross_Keystone_Register.md:144`, `:190` | Reference made here; discharge not ruled (Q6). |
| O4 | The seven other canon-only wardrobe and outfit tables | D6 (`F-Stats-1_Fix_Plan_v1.28.md:139`) | **Open, if in scope** (Q5). |
| O5 | PE #43–#47 | D7 (`Session_PE_Roster.md:356`–`:443`) | **Open as filed, if in scope** (Q5). Not re-derived here. |
| — | The approval columns and `deleted_at` in production | D3 | **Done**: PR #1929, Deploy AG (ATTESTED); `PROJECT_CONTEXT.md` §6.5 DONE row. |
| — | The duplicate indexes | the AG record §7.1 (Evoni: "worth a cleanup task eventually") | **Done**: PR #1938, Deploy AI (ATTESTED). |

**The decision the first ruling needs, as questions:**

> **Is F-Ward-1 the one table — `episode_wardrobe`, closed by a migration that creates it (Decision #59) — or the wider wardrobe and outfit schema divergence (the eight tables of v1.28, and PE #43–#47)? And whichever it is: which schema is the migration to capture — canon as it stands in production now (after Q2 and Q3 are read), or the model?**

---

## What this document does not do

- **Rules nothing.** It does not choose a definition, a scope or a target schema.
- **Closes nothing.** No owed item, PE or keystone is closed.
- **Mints nothing.** No FD, PE or XK number.
- **Changes no code.** It does not touch `src/`, `frontend/`, `tests/` or any workflow file.
- **Makes no live database contact.** The three queries in §4 are for Evoni to run, if she chooses. The migration output quoted in §3.1 is from a throwaway local database, not production.
- **Edits no filed document**, and adds no banner to one.
- **Does not re-derive** PE #43–#47, or whether the eight canon-only tables are still in canon today.

## Footer

*Type: standalone scoping note (opens F-Ward-1). Rules: nothing. Mints: nothing. Closes: nothing. Host/AWS/DB/Cognito contact: none. Basis: `943b7e65`. Task: #2080. [skip-automerge]*
