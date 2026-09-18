# Canon capture evidence note — 2026-09-17

**Basis:** `origin/main` at `5e9411cf538e544bffc626a5677d0afa2c8534aa`, recorded before this filing.

## Provenance and standing

The capture was produced by Evoni from her own workstation, using `psql`
read-only against canon, outside any agent session. **ATTESTED.** This filing
does not repeat that database access and makes no database connection of its
own.

The capture session confirmed `current_database()` as `episode_metadata` and
the public table count as `143`.

The three queries were run as follows:

```sql
SELECT current_database();
SELECT count(*) FROM information_schema.tables WHERE table_schema='public';
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public'
ORDER BY table_name, column_name;
SELECT * FROM pgmigrations ORDER BY id;
SELECT * FROM "SequelizeMeta" ORDER BY name;
```

## Capture measurements

The three source files were copied into `docs/audit/` unchanged. Source and
destination measurements match exactly. **MEASURED.**

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `EvidenceNote_Canon_Schema_Capture_2026-09-17.txt` | 294831 | `1A1111551858D1F9F21FEB4907ADA3CCB503DCD752FF74DD4E1D0716BDB57CC3` |
| `EvidenceNote_Canon_pgmigrations_2026-09-17.txt` | 1311 | `26C890F4C684E2127AC623EE9CCB3AE00D217E0B3CDBD03528F0847A74EC410E` |
| `EvidenceNote_Canon_SequelizeMeta_2026-09-17.txt` | 10512 | `4884E0FB46AC5A0140E006491C7CC9292425D8F25F5CD214CDEA7F42011C2E89` |

The schema capture ends with `(2760 rows)`. The `pgmigrations` capture contains
`14` rows. The `SequelizeMeta` capture contains `219` rows and is new; it has
no 2026-08-29 counterpart.

## Comparison with 2026-08-29

The exact schema comparison command was:

```text
git diff --no-index -- docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
```

Its output was non-empty (`EXIT: 1`), consisting of row-order hunks. Both
captures contain `(2760 rows)`, and sorting the four schema fields
`table_name|column_name|data_type|is_nullable` produced `2760` records in each
with equal normalized record sets. The required table and column comparison
outputs were:

```text
TABLE_ADDED=none
TABLE_REMOVED=none
COLUMN_ADDED=none
COLUMN_REMOVED=none
COLUMN_DEFINITION_CHANGED=none
```

Therefore, the schema has not changed logically since 2026-08-29. **MEASURED.**
The files
are not byte-identical because the textual row order differs.

The pgmigrations comparison command was:

```text
git diff --no-index -- docs/audit/EvidenceNote_Canon_pgmigrations_2026-08-29.txt docs/audit/EvidenceNote_Canon_pgmigrations_2026-09-17.txt
```

Its output was empty (`EXIT: 0`).

## What this note does not do

This note rules nothing, chooses no schema, mints nothing, and makes no claim
about canon after the capture timestamp. The tails remain unminted. File with
`/audit-file`.