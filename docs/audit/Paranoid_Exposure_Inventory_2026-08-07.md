# Paranoid Exposure Inventory - 2026-08-07

| | |
|---|---|
| **Class** | Cross-keystone finding. Not a Fix Plan revision. |
| **Origin** | F-Stats-1 open item 40 (minted v1.23), re-homed here. |
| **Basis** | `394ca354`. Probe run `31211484715` (workflow_dispatch, branch `diag/deleted-at-inventory`, since deleted). |
| **Owner** | UNASSIGNED. Spans F-Stats-1, F-Ward-1, F-Ward-3. |

## §1 Mechanism

`src/config/sequelize.js` sets `paranoid: true` in the global `define`
block. Every model inherits it. Sequelize therefore writes `deleted_at` on
every INSERT and appends `deleted_at IS NULL` to every SELECT.

`deleted_at` was never applied schema-wide. Migration
`src/migrations/20260309130000-add-deleted-at-to-all-tables.js` is named
for a sweep but its body is a hardcoded 14-entry `TABLES` array. It is
also written defensively (`describeTable().catch()`, skip-if-present), so
it ran green over an incomplete list and reported nothing.

Any model table with timestamps but no `deleted_at` column therefore
carries a latent failure: `column "deleted_at" does not exist` on the
first INSERT against a migration-built database.

## §2 Numbers

| | |
|---|---|
| Model tables inheriting `paranoid` | 110 |
| Missing `deleted_at` and exposed | **48** |
| Missing `deleted_at` but immune (`timestamps: false`) | 4 |

## §3 Method and its caveat

Measured empirically, not statically. A temporary Jest probe on a throwaway
branch enumerated model `tableName` values, queried
`information_schema.columns` for `deleted_at` in the CI Postgres, and
printed the difference. Dispatched manually via `gh workflow run` - possible
only because F-Stats-1 item 37 had merged hours earlier.

Static cross-reference was rejected: 43 migrations reference `deleted_at`,
and a static read describes the migration chain rather than any real schema.

**Caveat - the probe over-counts by 4.** `m.options.paranoid` reports
`true` for models that also set `timestamps: false`, because the global is
inherited regardless. Sequelize will not write `deleted_at` without
timestamps, so those models are inoperatively paranoid. The four are
`script_edit_history`, `script_learning_profiles`, `script_suggestions`,
`script_templates`. **Anyone re-running this probe must apply the same
correction:** the exposed set is models with timestamps AND no
`deleted_at`, not models reporting `paranoid`.

## §4 Cross-keystone reach

This is why the finding is not F-Stats-1's alone.

| Keystone | Exposed tables |
|---|---|
| **F-Stats-1** | `character_state` |
| **F-Ward-1** | `episode_wardrobe`, `episode_wardrobe_defaults` |
| **F-Ward-3** | `outfit_sets`, `outfit_set_items` |

`episode_wardrobe` is F-Ward-1's Pattern 40b table - it has no migration
anywhere, and it is also on this list. `outfit_sets` and `outfit_set_items`
are the shared table surface behind F-Ward-3's two-controller drift.

F-Stats-1 hit this the moment item 6 gave it integration coverage.
**F-Ward-1 and F-Ward-3 will hit it the same way, for the same reason, as
soon as they get equivalent coverage.** Item 40 is upstream of three
keystones in the locked sequence, not a residue of one.

## §5 Outstanding obligation

Reciprocal references were not filed in the Ward tracks. As of
`394ca354` no `F-Ward-*` artifact exists in `docs/audit/`. **When F-Ward-1
or F-Ward-3 opens a plan artifact, it must reference this document.** That
obligation is recorded here because there is currently nowhere else to
record it.

## §6 What this document does not do

- Does not assign an owner.
- Does not propose a fix. A schema-wide migration, a scoped per-keystone
  migration, and removing the global `paranoid` are all candidates; none is
  evaluated here.
- Does not enumerate prod. The probe measured CI's migration-built schema.
  Prod's schema drifted separately - Edit Stats works there, so prod
  `character_state` almost certainly has the column. **Prod is FROZEN; this
  was not verified and must not be assumed.**
- Does not change any gate, unit disposition, or PR state.

## §7 Appendix - the 48 exposed tables
```

FileStorages                  layer_presets
activity_logs                 layers
ai_edit_plans                 makeup_library
ai_revisions                  markers
ai_usage_logs                 metadata_storage
asset_labels                  outfit_set_items
asset_roles                   outfit_sets
asset_usage_log               processing_queue
character_arcs                scene_layer_configuration
character_profiles            scene_library
character_state               scene_set_episodes
character_therapy_profiles    scene_templates
composition_assets            show_assets
composition_outputs           show_configs
continuity_beat_characters    story_task_arcs
continuity_beats              thumbnails
continuity_characters         timeline_placements
continuity_timelines          universe_characters
decision_logs                 wardrobe_content_assignments
edit_maps                     wardrobe_library
editing_decisions             wardrobe_library_references
episode_scenes                wardrobe_usage_history
episode_wardrobe              hair_library
episode_wardrobe_defaults     layer_assets

```
Excluded as immune (`timestamps: false`): `script_edit_history`,
`script_learning_profiles`, `script_suggestions`, `script_templates`.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-07. Basis `394ca354`. Probe run 31211484715.*