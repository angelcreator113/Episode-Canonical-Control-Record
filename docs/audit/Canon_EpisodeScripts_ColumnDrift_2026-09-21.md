# `episode_scripts` Column Drift Against Canon

**Basis:** `origin/main` at `a3ba18cc9a8954628f606b2deb75c2e04e85f8f7` (2026-09-21).

**Type:** Standalone MEASURED evidence note. Issue #1623. Every fact below is re-derived
fresh at this basis, against the register documents as filed — nothing here is carried from
issue #1619's own report of the same drift.

**What this does not do.** It does not rule on cause, on which migration (if either) is
correct, or on a fix. It does not choose a schema. It mints no FD, XK, or PE number. It does
not discharge any finding. It is evidence for a future ruling, not the ruling itself.

---

## §1. Both `createTable('episode_scripts')` migrations

**MEASURED:**

```
$ grep -rl "episode_scripts" src/migrations/ | sort
src/migrations/20240101000007-create-episode-scripts.js
src/migrations/20240101000008-create-script-metadata.js
src/migrations/20260718000000-create-episode-scripts-and-feed-posts.js
```

Three files reference the name; two of them create the table. The third,
`20240101000008-create-script-metadata.js:16`, only references `episode_scripts` as an FK
target (`references: { model: 'episode_scripts', ... }`) for its own `script_metadata` table —
it does not create or alter `episode_scripts` itself, and is not counted further below.

**Migration A — `src/migrations/20240101000007-create-episode-scripts.js`** (`up`, lines
5-63). Columns defined:

```
id (INTEGER, autoIncrement, PK), episode_id (UUID, FK -> episodes.id), version (INTEGER,
default 1), content (TEXT, NOT NULL), status (STRING(50), default 'draft'), is_current
(BOOLEAN, default true), created_by (STRING(255)), notes (TEXT), created_at, updated_at,
deleted_at
```

**11 columns total.** Two indexes: `episode_id`, `is_current`.

**Migration B — `src/migrations/20260718000000-create-episode-scripts-and-feed-posts.js`**
(`up`, lines 12-71, the `episode_scripts` block only — the same file also creates an unrelated
`feed_posts` table, lines 94-148, not part of this note). Columns defined:

```
id (UUID, PK), episode_id (UUID, FK -> episodes.id), show_id (UUID), episode_brief_id (UUID,
FK -> episode_briefs.id), version (INTEGER, default 1), status (STRING(30), default 'draft'),
title (STRING(255)), script_text (TEXT), script_json (JSONB), generation_model (STRING(60)),
generation_tokens (INTEGER), generation_cost (DECIMAL(10,4)), generation_prompt_hash
(STRING(64)), context_snapshot (JSONB), feed_moments_used (JSONB), financial_context (JSONB),
wardrobe_locked (JSONB), scene_angles_used (JSONB), word_count (INTEGER), beat_count (INTEGER,
default 14), voice_score (INTEGER), author_notes (TEXT), edited_by (STRING(100)), edited_at
(DATE), created_at, updated_at, deleted_at
```

**27 columns total.** Includes a self-heal step (lines 73-82: `describeTable` + conditional
`addColumn` for `version` if absent) and two additional indexes beyond the implicit PK: a
unique `(episode_id, version)` index and a `status` index (lines 84-91).

**Migration B's `up` does not guard `createTable` itself against the table already
existing** (`queryInterface.createTable('episode_scripts', {...})`, line 12, no
`IF NOT EXISTS` equivalent, no existence check before it) — only the later `version` column
and the two `sequelize.query` index statements have their own conditional/`IF NOT EXISTS`
guards. Whether Migration B's `createTable` call ever actually succeeded against a database
where Migration A had already run is not something this note determines — that depends on
migration run order and history on the live database, which is out of scope for a
repository-only read.

**7 columns are shared by name between the two migrations:** `id`, `episode_id`, `version`,
`status`, `created_at`, `updated_at`, `deleted_at` (`id`'s type differs: `INTEGER`
autoIncrement in Migration A, `UUID` in Migration B). None of Migration A's other 4 columns
(`content`, `is_current`, `created_by`, `notes`) or Migration B's other 20 appear in the
other migration.

---

## §2. `episode_scripts` columns in the filed 2026-09-17 canon capture

**MEASURED**, against `docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt` as filed
(the specific capture file this issue names):

```
$ grep -n "^ episode_scripts " docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
593: episode_scripts                  | author                            | character varying           | YES
594: episode_scripts                  | content                           | text                        | YES
595: episode_scripts                  | created_at                        | timestamp with time zone    | YES
596: episode_scripts                  | created_by                        | character varying           | YES
597: episode_scripts                  | deleted_at                        | timestamp with time zone    | YES
598: episode_scripts                  | duration                          | integer                     | YES
599: episode_scripts                  | episode_id                        | uuid                        | NO
600: episode_scripts                  | file_format                       | character varying           | YES
601: episode_scripts                  | file_size                         | bigint                      | YES
602: episode_scripts                  | file_url                          | character varying           | YES
603: episode_scripts                  | id                                | uuid                        | NO
604: episode_scripts                  | is_latest                         | boolean                     | YES
605: episode_scripts                  | is_primary                        | boolean                     | YES
606: episode_scripts                  | scene_count                       | integer                     | YES
607: episode_scripts                  | scene_markers                     | jsonb                       | YES
608: episode_scripts                  | script_type                       | character varying           | NO
609: episode_scripts                  | status                            | character varying           | YES
610: episode_scripts                  | updated_at                        | timestamp with time zone    | YES
611: episode_scripts                  | version                           | integer                     | NO
612: episode_scripts                  | version_label                     | character varying           | YES
613: episode_scripts                  | version_number                    | integer                     | NO
```

**21 columns, AS-RECORDED in this capture file** — MEASURED directly:
`grep -c "^ episode_scripts " docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`
returns `21`, matching the 21 lines quoted above. This capture is a raw column enumeration
(`table_name | column_name | data_type | is_nullable`, per its own row shape — no header row
of its own precedes the data in this file); no separate provenance statement is embedded in
the `.txt` file itself. This note takes the file as filed, at the name and date it carries, as
its evidence — it does not independently re-verify how or when it was captured. **The live
database was not re-read for this note.** This capture file is the only evidence of canon's
`episode_scripts` shape used here.

**Column-set comparison against §1:**

- **9 columns** canon shares by name with **Migration A**: `id`, `episode_id`, `version`,
  `content`, `status`, `created_by`, `created_at`, `updated_at`, `deleted_at`.
- **7 columns** canon shares by name with **Migration B**: `id`, `episode_id`, `version`,
  `status`, `created_at`, `updated_at`, `deleted_at` — a subset of the 9 above. (`id` differs
  in type across the two migrations: Migration A's is `INTEGER` autoIncrement, Migration B's
  is `UUID`; canon's is `uuid` — canon's `id` type matches Migration B, not Migration A.)
- **12 of canon's 21 columns match neither migration**: `author`, `duration`, `file_format`,
  `file_size`, `file_url`, `is_latest`, `is_primary`, `scene_count`, `scene_markers`,
  `script_type`, `version_label`, `version_number`.
- **2 of Migration A's 11 columns are absent from canon**: `is_current`, `notes`.
- **20 of Migration B's 27 columns are absent from canon**, including `title`, `show_id`,
  `episode_brief_id`, and — the pair this note's §3 turns on — **`script_text` and
  `script_json`**.

---

## §3. The `EpisodeScript` model and its writer

**MEASURED**, `src/models/EpisodeScript.js` (full file, 68 lines). `sequelize.define`
options: `tableName: 'episode_scripts'`, `timestamps: true`, `paranoid: true`,
`underscored: true`. Fields explicitly defined in the schema object (lines 9-42): `id`,
`episode_id`, `show_id`, `episode_brief_id`, `version`, `status`, `title`, `script_text`,
`script_json`, `generation_model`, `generation_tokens`, `generation_cost`,
`generation_prompt_hash`, `context_snapshot`, `feed_moments_used`, `financial_context`,
`wardrobe_locked`, `scene_angles_used`, `word_count`, `beat_count`, `voice_score`,
`author_notes`, `edited_by`, `edited_at` — **24 fields**, plus `created_at`/`updated_at`/
`deleted_at` managed implicitly via `timestamps`/`paranoid`/`underscored`. 24 explicit fields
plus 3 implicit ones is **27 total, matching Migration B's 27-column set exactly** in name
and count (Migration B is this model's counterpart migration).

**`script_text` and `script_json` are absent from the canon capture (§2).** These are the two
fields carrying the actual generated script content and structure.

**Exactly one call site creates an `EpisodeScript` row:**

```
$ grep -rn "EpisodeScript.create(" src/
src/services/episodeScriptWriterService.js:653:  const script = await EpisodeScript.create({
```

`src/services/episodeScriptWriterService.js:603-694`, function `generateEpisodeScript`. The
`EpisodeScript.create({...})` call (lines 653-687) sends all 24 explicit model-defined fields,
including `script_text` (line 660) and `script_json` (line 661). This call has no try/catch
of its own within `generateEpisodeScript`; a separate `episode.script_content` update (lines
690-694, its own try/catch, comment "Also save to episode.script_content for backwards
compat") sits sequentially after it in the same function.

This note does not run the code, does not query a database, and does not assert what happens
at runtime — that a discrepancy exists between the columns this call sends and the columns
canon's capture shows for this table is the extent of what is stated here.

---

## §4. Does `Canon_TableExpectation_Census_2026-09-17.md` already list `episode_scripts`?

**Yes — for table-name presence only, not column shape.** MEASURED:

```
$ grep -n "episode_scripts" docs/audit/Canon_TableExpectation_Census_2026-09-17.md | cut -c1-4
127:
184:
326:
399:

$ grep -oE ".{25}episode_scripts.{25}" docs/audit/Canon_TableExpectation_Census_2026-09-17.md
efs`, `episode_scenes`, `episode_scripts`, `episode_templates`, `
ses`, `episode_scenes`, `episode_scripts`, `episode_templates`, `
ets`, `episode_briefs`, `episode_scripts`, `episode_todo_lists`,

$ grep -n '^| `episode_scripts` |' docs/audit/Canon_TableExpectation_Census_2026-09-17.md
399:| `episode_scripts` | yes | yes | no | yes | yes |
```

(Lines 127, 184, 326 are three long comma-separated table-name lists — columns (a), (b), (d)
respectively, per that census's own §3 — each confirmed to contain `episode_scripts` above
without reproducing the full list, which is code-derived table-name enumeration, not database
row data. Line 399 is that census's own §4 summary table's row for this table, quoted in
full since it is five words, not row data.)

That census's own §4 table header (line 336): `| table name | a | b | c | d | in canon
capture |`. Its own §3 defines the columns: (a) = `tableName` in a `src/models/*.js` file
registered by `src/models/index.js` (§3(a)); (b) = created by a migration under
`src/migrations/` (§3(b)); (c) = a request-path `Model.sync()` call or inline `CREATE TABLE
IF NOT EXISTS` (§3(c)); (d) = a raw SQL table reference in `src/routes/` or `src/services/`
(§3(d)); "in canon capture" = the table name appears in **the 2026-08-29 capture**
(`docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt`) — that census's own §2
locates its capture source as the 2026-08-29 file, not the 2026-09-17 one this note's §2 uses.

`episode_scripts`'s row: `a=yes, b=yes, c=no, d=yes, in canon capture=yes`. In that census's
own words, this check is **"schema/table name only, per §2 — no row data quoted"** (§4's own
lead sentence). It confirms the table name exists in both the model layer, the migration
tree, raw SQL, and the (2026-08-29) canon capture — it does not compare, and does not claim to
compare, column shape. **This note's finding (§1-§3) is not already recorded by that census
and does not contradict it** — they answer different questions about the same table name.

---

## §5. Relation to PE #42–#47

**By citation only — this note does not re-derive or re-verify any PE's own content.**
MEASURED, against `docs/audit/Session_PE_Roster.md` as filed:

```
$ grep -n "^### PE #4[2-7]" docs/audit/Session_PE_Roster.md
295:### PE #42 — 7 critical/high npm audit vulnerabilities (P1, OPEN, NEW 2026-05-14)
338:### PE #43 — Thumbnail.episodeId vs episode_id JOIN failure (P1, OPEN, NEW 2026-05-15)
362:### PE #44 — shows.distribution_defaults column missing on prod RDS (P1, OPEN, NEW 2026-05-15)
384:### PE #45 — WorldEvent.source_profile_id column missing on prod RDS (P1, OPEN, NEW 2026-05-15)
407:### PE #46 — Wardrobe.s3_key_regenerated column missing on prod RDS (P1, OPEN, NEW 2026-05-15)
425:### PE #47 — ui_overlay_types relation drift (P1, OPEN, NEW 2026-05-15)
```

**Where the issue's "#42–#47" framing itself traces to** — MEASURED:

```
$ grep -n "#42.*#47" PROJECT_CONTEXT.md
358:**Session PE roster (PE #27–#68), carried unchanged — see the roster-hygiene item above for what is stale in it.** Closed: #37, #41, #48, #58, #63, #66. P0 open: #51, #52 (F-AUTH-1 pre-flight inventories). P1 open: #27 (prod smoke test accepts 502/503), #38, #40, #42–#47 (npm audit; prod-RDS column drift), #49 (50% AI error rate), #54, #55, #64. P2 open: #31, #39, #50, #53, #56, #57, #59–#62, #65, #67, #68. PE #1–#26 and #28–#36 live in F-AUTH-1's Track 8 roster, not here.
```

`PROJECT_CONTEXT.md:358` cites `#42–#47 (npm audit; prod-RDS column drift)` as one compound
range spanning both labels in a single parenthetical — a reasonable, real source for the
issue's "#42–#47" shorthand, not an unexplained number. The roster itself (quoted above)
resolves that compound range into individual entries, and only there does it become visible
that #42 carries the npm-audit label and #43–#47 carry the drift label.

**Correction to this issue's own framing:** PE #42 is titled "7 critical/high npm audit
vulnerabilities" — an npm dependency finding, not a schema-drift finding. It is not part of
the production-column-drift pattern. **PE #43–#47, not #42–#47, are the schema-drift family**
this note relates to: PE #43 (a naming-mismatch JOIN failure), PE #44–#46 (each a specific
column missing on prod RDS versus a specific model), and PE #47 (a missing relation/table).
PE #47's own text (line 441, quoted): "**Pattern:** Missing-table variant of F-Ward-1 schema
drift. Worth distinguishing from PE #43-#46 because the fix path is different — column adds
vs. table creation." This note's finding — `episode_scripts`'s canon shape not matching
either of its own migrations, with two specific columns (`script_text`, `script_json`)
missing that its one writer depends on — reads as the same general class PE #44–#46 name (a
model/migration expecting columns canon's live table does not have), within the same
"F-Ward-1 schema drift" family PE #47 names as having more than one shape (missing-column vs.
missing-table). **This note does not add a PE, amend one, or claim `episode_scripts` belongs
on that roster — that is Evoni's call, not this note's.**

---

## §6. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Unchanged from the last register tail check this session found (#1619/#1622 work, same
basis lineage). Nothing minted here.

---

**Type:** Standalone MEASURED evidence note. **Rules:** nothing. **Mints:** nothing (no FD,
XK, or PE number). **Host/AWS/DB contact:** none — repo-only, against the filed
`EvidenceNote_Canon_Schema_Capture_2026-09-17.txt` capture and the filed
`Canon_TableExpectation_Census_2026-09-17.md` census; the live database was not re-read.
**Prod FROZEN.**
