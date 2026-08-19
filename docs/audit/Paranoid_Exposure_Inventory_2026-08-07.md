# Paranoid Exposure Inventory - 2026-08-07

| | |
|---|---|
| **Class** | Cross-keystone finding. Not a Fix Plan revision. |
| **Origin** | F-Stats-1 open item 40 (minted v1.23), re-homed here. |
| **Basis** | `394ca354`. Probe run `31211484715` (workflow_dispatch, branch `diag/deleted-at-inventory`, since deleted). |
| **Owner** | UNASSIGNED. Spans F-Stats-1, F-Ward-1, F-Ward-3. |

## CORRECTION BANNER 2 — added 2026-08-19

**Banners are read newest-first. Where two disagree the later governs; where a banner and the body disagree the banner governs. The 2026-08-18 banner below is preserved exactly as merged at `76a7f1ac` and is not edited.**

**Dates.** Added **2026-08-19**; measurements run **2026-08-18**. The session spanned midnight. Both correct.

**§7's appendix contains 24 tables that cannot exhibit this document's own mechanism.** §1 states the failure as `column "deleted_at" does not exist` on the first INSERT against a migration-built database. **24 of the 48 have no table at all in such a database.** Three branches, measured 2026-08-18, none reaching a missing-column failure:

| Model | before `sync()` | `sync()` | `deleted_at` after |
|---|---|---|---|
| `Marker` → `markers` | `relation "markers" does not exist` | succeeded | **present** |
| `ContinuityBeat` → `continuity_beats` | `relation … does not exist` | **failed** — `relation "continuity_timelines" does not exist` | n/a |
| `FileStorage` → `FileStorages` | `relation … does not exist` | **failed** — `relation "Episodes" does not exist` | n/a |

Table absent → missing relation, a different defect. `sync()` succeeds → it creates `deleted_at` too, since the model declares `paranoid`. `sync()` fails → table stays absent, failure remains a missing relation; this arises when a model's FK targets are themselves in the 24.

**All 24 were checked systematically, not inferred from the probes: every one resolves `deleted_at` exactly** — no custom `deletedAt` field name, no missing deletion attribute.

| | as published | 2026-08-18 banner | this banner |
|---|---:|---:|---:|
| exposed | 48 | 37 | **13** |

**13 at the basis preceding `956697c0`; 12 as of `main` at `803b0265`. This is the remainder of the partition in the banner below, not an independent second measurement.**

**Basis and limits.** Scratch database built from `src/migrations` only — the sole tree `db:migrate` reads; four others hold migration-shaped files and none run. **Not asserted for any deployed schema:** §4's prod carve-out stands. **A table created by `model.sync` before `paranoid` was added would exist, lack `deleted_at`, and be genuinely exposed** — excluded here by the basis, not by measurement. That path is **current, not historical**: §12.11's Variant A sites are intact, exactly 11 live `Model.sync()` calls in `src/routes/` and `src/workers/`, verified 2026-08-19. Its five Variant B inline-`CREATE TABLE` sites in request-path code — `videoCompositionController.js:35`, `admin.js:53`, `storyHealth.js:244`/`:276`, `worldStudio.js:319` — are **also still present**, verified 2026-08-19. F-App-1 removed a different five, the `app.js` auto-repair literals. **Neither variant has been retired; an earlier draft of this banner said Variant B had been, corrected before filing.**

**§4's cross-keystone reach is affected.** Both F-Ward-3 tables are among the 24; with F-Ward-1 already withdrawn, reach reduces to F-Stats-1 alone. **This document does not evaluate the consequence** — admission is the register's question, referred to a ratifying revision.

**Prior art checked:** F-Stats-1 v1.57 §60 contains no characterisation of absent-table exposure. Recorded so the check is known to have been run.

**Cross-reference.** `Cross_Keystone_Register.md` XK-1 carries a matching second banner; neither cites the other as authority.

---

## CORRECTION BANNER — added 2026-08-18

**Body below preserved verbatim. Where they disagree, this banner governs. §2's exposed count and §7's appendix are corrected; §1's mechanism and §6's declinations are unchanged.**

**Authority — a reading.** This document is the measurement of record, amended by additive-supersede, and corrected here on the reading that correcting a measurement needs no ratification — the same reading applied to XK-1's entry. **If a ratifying revision disagrees, this is an unratified correction that announced itself as one.**

**The correction, derived here and not inherited.** §3 states the mechanism and excludes four models. **The same criterion across all 48 in §7 excludes eleven more.** Measured 2026-08-18: every model loaded via `src/models/index.js`, tested for whether a deletion attribute resolves — `Model.options.deletedAt` or `deletedAt`, checked against `rawAttributes` — with column presence from `information_schema` on a scratch database built by all 210 migrations. Models resolving **no deletion attribute** cannot name `deleted_at` and cannot fail:

`activity_logs`, `ai_usage_logs`, `metadata_storage`, `asset_labels`, `asset_roles`, `asset_usage_log`, `processing_queue`, `show_configs`, `thumbnails`, `episode_wardrobe`, `episode_wardrobe_defaults`

| | as published | corrected |
|---|---:|---:|
| Model tables inheriting `paranoid` | 110 | **110 — unchanged** |
| Missing `deleted_at` and exposed | 48 | **37** |
| Missing `deleted_at` but inoperatively paranoid | 4 | **15** |

**The denominator is confirmed, not corrected.** An independent probe on 2026-08-18 also found 110. Two instruments, eleven days apart, same figure. **That confirms the population and nothing about the exposure count**, since both applied the same flawed test to it.

**Criterion, precisely.** `timestamps: false` is *sufficient*; **the property that matters is that no deletion attribute resolves.** Both tests were run over the eleven and agree on all eleven. A re-run should use the attribute test. No custom `deletedAt` mappings exist in the set — verified, not assumed.

**`episode_wardrobe` leaves this list and is not thereby clean.** It is F-Ward-1's Pattern 40b table — **no migration anywhere** — and that finding is untouched. Leaving a `deleted_at` exposure list is not a statement that the table is sound.

**§5's reciprocal-reference obligation — now open, not unaffected.** With `episode_wardrobe` and `episode_wardrobe_defaults` both withdrawn, no exposed table remains cited for F-Ward-1. Whether F-Ward-1's half of the obligation survives depends on whether it tracks reach or names keystones. **Not resolved here; queued for the ratifying revision.** F-Ward-3's half is unaffected.

**Cross-reference.** `Cross_Keystone_Register.md` XK-1 cites this document and carries its own banner, including the F-Ward-1 reach withdrawal. Per that register's §5 it cannot amend this artifact; **the two are independent derivations of the same measurement, not one citing the other.** Raised also at `FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md` §B4.

---

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