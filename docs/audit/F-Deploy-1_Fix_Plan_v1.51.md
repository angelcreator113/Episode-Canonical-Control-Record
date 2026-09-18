| **PRIME STUDIOS** **F-DEPLOY-1 FIX-PLANNING DOCUMENT** *Schema-fork ruling.* |
| --- |

**Document version**

v1.51 — successor to v1.50. Basis: `origin/main` at
`2b4207ab8dd6b1774604e877fcc0bac9b94f6636`, recorded 2026-09-17.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RULED. This revision records Evoni's schema-fork ruling for the reconciliation
session. It is policy for that session, not the session itself. It authorizes
nothing to run. It mints nothing.

## §Evidence — cited, not re-derived

The following evidence is carried from the named register documents and is not
restated as this revision's own finding:

- `Canon_TableExpectation_Census_2026-09-17.md` §4.1 states: **193 expected,
  137 present, 56 absent, and 6 canon-only.**
- `Canon_AbsentTable_Classification_2026-09-17.md` §6 states: **REAL-ROUTE
  30, REAL-SERVICE 6, FALSE POSITIVE 4, UNUSED 16; 30 + 6 + 4 + 16 = 56.**
  Its REAL-ROUTE rows, taken from that table, are:

  ```text
  FileStorages
  ai_training_data
  audio_clips
  beats
  brain_documents
  chapter_versions
  character_clips
  character_profiles
  cursor_actions
  decision_logs
  decision_patterns
  edit_maps
  game_wardrobe
  icon_cues
  icon_slot_mappings
  jobs
  layer_assets
  layers
  markers
  music_cues
  production_packages
  scene_footage_links
  script_metadata
  script_templates
  show_configs
  timeline_events
  user_decisions
  users
  video_scenes
  world_tensions
  ```

- `EvidenceNote_Canon_Capture_2026-09-17_Note.md` states that canon's schema
  is unchanged since 2026-08-29 because the normalized record set is the same;
  it records `pgmigrations` at 14 rows and `SequelizeMeta` at 219 rows.
- `PROJECT_CONTEXT.md` §4.5 states the asserted canon/prod split: canon is
  143 tables, prod is 171 tables, **37 prod-only and 9 dev-only**, neither a
  superset, with prod-only tables preserved in
  `docs/audit/FD31-prod-only-schema-20260601.sql` (**DO NOT RUN**).
  `v25_Owed_Index_Amd18_2026-08-30.md` §T3 records the related model/canon
  ledger distinction: 154 distinct model-code targets, 124 present on canon,
  30 absent, and 19 canon tables with no model. These are cited authorities,
  not findings re-derived by this revision.

## §Ruling — Evoni, 2026-09-17

The following are Evoni's settled sub-rulings:

### (a) Direction

Canon's current schema, as captured 2026-09-17, is the baseline. The
reconciliation adds only what live routes reach; it does not migrate canon
toward the code wholesale, and it never runs the existing migration tree
against canon.

### (b) Scope of creates

The REAL-ROUTE tables are the 30 names listed in §Evidence above. REAL-SERVICE
tables are decided individually when their service is next worked on. UNUSED
and FALSE POSITIVE tables get no create.

### (c) `decision_logs` and `decision_log`

`decision_logs` and `decision_log` are two different tables, not a rename.
`decision_logs` is created fresh from the model; canon's `decision_log` is left
untouched, with its data preserved.

### (d) Canon-only tables

The four canon-only tables `asset_label_map`, `episode_outfit_items`,
`episode_outfits`, and `search_history` are kept. No drop.

### (e) Prod-only archive

The 37 prod-only tables stay archived in
`docs/audit/FD31-prod-only-schema-20260601.sql`. Nothing is ported now, and the
file stays **DO NOT RUN**.

### (f) Migration history

`pgmigrations` and `SequelizeMeta` are retired as authorities; neither
describes canon. Canon's captured schema is the baseline; future migrations
start from it. How that baseline is expressed in the repository is left to the
reconciliation session.

## §What this revision does not do

This revision starts no reconciliation, writes no migration, creates no table,
touches no host, AWS, RDS, or secret, does not re-enable Deploy to Development
(v1.50 stands), and does not edit `PROJECT_CONTEXT.md`. It does not claim canon
is unchanged after 2026-09-17. It mints nothing. The FD, XK, and PE tails remain
unminted.

## §Standing

This document is policy for a future reconciliation session. It authorizes
nothing to run and chooses no implementation for expressing the captured
baseline in the repository.