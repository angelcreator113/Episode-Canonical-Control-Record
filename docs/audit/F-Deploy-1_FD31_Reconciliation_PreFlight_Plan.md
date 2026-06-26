# F-Deploy-1 FD-31 -- Reconciliation Session Pre-Flight & Plan (DRAFT)

> **THIS IS A PREP DOCUMENT. IT AUTHORIZES NO PROD-BOX ACTION.**
> Drafting and reading this changes nothing on `episode-backend` (`54.163.229.144`).
> The reconciliation session itself remains **gated** and is its own deliberate
> sitting per `F-Deploy-1_PROD_SplitBrain_HAZARD.md` Sec 6 and Audit v11 Sec 5
> (discovery and remediation are separate sessions when the failure mode is
> catastrophic and irreversible). This document exists so that when the session
> happens, it is *ratification of a written plan against a verified backup*, not
> discovery against a snapshot trusted on faith.

| | |
|---|---|
| **Parent finding** | FD-31 / F-Deploy-G1-AG (prod three-axis split-brain + schema fork) |
| **Hazard authority** | `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root) |
| **Incident context** | `F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md` (repo root) |
| **Fix Plan lineage** | Inherits v1.7 (FD-1--FD-35); feeds a future revision (v1.8+) |
| **Status** | DRAFT v1.4 -- on main. ALL SIX pre-flight gates GREEN; pre-flight COMPLETE. Preservation artifact committed (#737). v1.4: Sec 6.3 steps 5-6 (prod restart, port flip, pm2 save) HANDED TO TRACK B per the 2026-06-01 incident -- FD-31 cutover reduced to credential rotation + non-topology cleanup; the restart happens in a combined window with Track B (see Track_B_PM2_Topology_Formalization_Plan.md). Cutover execution is its own gated session. |
| **Drafted** | 2026-05-30; v1.1 canon decision; v1.2 verified dump + diff; v1.3 preservation artifact + full cutover commands + .env correction (2026-06-01); v1.4 steps 5-6 handed to Track B after the 2026-06-01 prod-502 incident (2026-06-01) |
| **Freeze state** | Prod RESTORED 2026-06-01 (hotfix on 3000, dev on 3002, reboot-durable -- see incident doc). On-disk .env CANON-ONLY (DB_HOST -> episode-control-dev; no -prod creds) -- verified 2026-06-01; data-swap landmine defused (v1.8 FD-36). Remaining: topology formalization (Track B) + credential rotation (this doc) in a combined restart window. Freeze on canon DATA fully in force. |

---

## Sec 1 -- What reconciliation actually is (dissolving the false binary)

Reconciliation is **not** "pick which database is canon." That framing produces a
wrong instinct (pick `-prod`, it has more tables) that lands on the empty DB. The
accurate framing:

- **The live data on `episode-control-dev` is canonical *by data*.** 143 tables,
  populated (episodes 72, shows 10, franchise_knowledge 605, etc.). This is the
  thing the entire freeze exists to protect. It is canon. That is settled.
- **`episode-control-prod` is empty schema.** 171 tables, `count(*)` zero on
  content tables. It contributes no data and never will. Its only relevance is
  that it holds **37 table *definitions*** the live DB lacks.

So reconciliation is three separable sub-problems, not one choice:

1. **Schema fate** -- for the 37 prod-only table *schemas* (no data to move, since
   `-prod` is empty): carry each onto canon, or abandon. Plus the 9 dev-only
   tables (already on canon, mostly bookkeeping) and the
   `decision_log`/`decision_logs` collision. -> Sec 4, Sec 5.
2. **Migration-framework history** -- `-dev` carries two bookkeeping tables
   (`pgmigrations` AND `SequelizeMeta`); `-prod` carries only `SequelizeMeta`.
   Decide which framework is authoritative going forward and whether the
   `SequelizeMeta` histories agree. -> Sec 5.4.
3. **Cutover mechanics** -- make the on-disk config and the running process agree,
   on canon, without triggering the silent-empty swap. This is the dangerous,
   irreversible part. -> Sec 6.

Only sub-problem 3 touches the box. Sub-problems 1 and 2 are decisions made on
paper plus read-only inspection, and can be fully resolved in the pre-flight.

---

## Sec 2 -- Pre-flight gate (ALL must be GREEN before the session touches anything mutable)

The session does not begin cutover (Sec 6) until every item here is GREEN. These
are conditions, not a schedule.

| # | Gate item | State | Source |
|---|---|---|---|
| 2.1a | Durable snapshot of `episode-control-dev` exists | ✅ GREEN -- `episode-control-dev-prefreeze-insurance-20260530`, `available`, 100% (2026-05-30) | tonight |
| 2.1b | **Verified** logical dump (table + row counts matched to catalog) | ✅ GREEN -- DONE 2026-05-31. `episode-control-dev-verified-20260530.dump` (2.83 MB), 143 tables + all 8 row-count fingerprints matched exactly. Snapshot proven good (test-restore). Stored off-repo at `Documents\PrimeStudios-Backups\`. | Sec 3 |
| 2.2 | Canon decision written and signed off (the prod-only schema-fate call) | ✅ GREEN -- RESOLVED 2026-05-30 (Sec 4): canon = live `-dev`; prod-only not ported, definitions preserved | tonight |
| 2.3 | Table-fate matrix populated from live diff and ratified | ✅ GREEN -- DONE 2026-05-31. Authoritative 37 prod-only / 9 dev-only confirmed (Sec 5.2/5.3). Fate uniform: not ported, definitions preserved. | Sec 5 |
| 2.4 | Cutover plan + rollback written in full (not outline) | ✅ GREEN -- DONE 2026-06-01 (v1.3). Sec 6.3 expanded to full commands; the prod-restart step is documented un-runnable (assemble at session time). Sec 6.4 rollback two-deep (snapshot + verified dump). | Sec 6 |
| 2.5 | Durable credential location decided (folds in S4.2-C `-dev` password rotation) | ✅ GREEN -- DONE 2026-06-01. Durable home = the canon-only on-disk .env (verified present). Rotation executes at cutover (Sec 6.2/6.3); the exposed canon password is on the rotate-at-cutover list (Sec 6.5). | Sec 6.2 |

Note 2.1a vs 2.1b: the snapshot is **recoverable** insurance (closes single-copy
risk -- done). The verified dump is the hazard doc's named reconciliation
prerequisite -- it is *verification*, proving the copy's contents match reality
before anyone touches the canon DB. Both are done.

**All six pre-flight gates GREEN as of 2026-06-01 -- the pre-flight phase is COMPLETE.**
What remains is the cutover *execution*, which is its own gated, backup-first session
(Sec 6). There is no remaining planning gate; the next action against the box is the
cutover itself, run under Rule 7 with the Sec 7 abort checks re-verified live at
session start.

---

## Sec 3 -- Verified-dump procedure (the session's opening step)

**Goal:** a logical copy of the live data whose table count and row counts match
the inspection catalog. Producing it is also the proof the snapshot is good.

### Sec 3.1 -- Catalog to match (re-verify at session time)

From the 2026-05-29 read-only inspection. `episodes.updated_at` last = 2026-05-15,
so the data is expected stable, but **re-run the counts live at session start** --
if they don't match this catalog, that is itself an abort condition (Sec 7).

| Table | Expected count |
|---|---|
| (table total) | 143 |
| episodes | 72 |
| shows | 10 |
| assets | 64 |
| world_events | 53 |
| wardrobe | 40 |
| social_profiles | 444 |
| franchise_knowledge | 605 |
| ai_usage_logs | 765 |

Note: `ai_usage_logs` is volatile append-only telemetry, tracked for situational
awareness but excluded from the hard abort fingerprint gate (per FD-38(e)).

### Sec 3.2 -- Path B (RECOMMENDED): restore-and-verify the snapshot

Why primary: it produces the dump, **test-restores the snapshot** (proving the
insurance), never touches `episode-backend`, and never handles the deferred `-dev`
credential (S4.2-C stays clean until the cutover establishes a durable home for it).

Cost/time: one temporary RDS instance for the duration; a 20 GB restore is quick
but not instant. The throwaway is deleted at the end.

**Each step below is a Rule 7 boundary at execution -- drafted here, confirmed and
run at session time. Nothing here runs tonight.**

```
# 1. Restore snapshot to a throwaway instance.
#    CRITICAL: place it in a LOCKED security group (NOT the open one -- AF is live,
#    the prod RDS SG allows 5432 from 0.0.0.0/0; do not inherit that).
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier episode-control-verify-throwaway \
  --db-snapshot-identifier episode-control-dev-prefreeze-insurance-20260530 \
  --db-subnet-group-name <private-subnet-group> \
  --vpc-security-group-ids <locked-sg-no-0.0.0.0/0> \
  --no-publicly-accessible \
  --region us-east-1

# 2. Reset the throwaway's master password via the API (no knowledge of the
#    -dev postgres password required -- this is an admin op, not DB auth).
aws rds modify-db-instance \
  --db-instance-identifier episode-control-verify-throwaway \
  --master-user-password <new-throwaway-password> \
  --apply-immediately --region us-east-1

# 3. Once available, dump from the throwaway (connect with the new password).
pg_dump -h <throwaway-endpoint> -U postgres -d episode_metadata \
  -Fc -f episode-control-dev-verified-20260530.dump

# 4. Verify: table count + row-count fingerprint must match Sec 3.1.
#    (run against the throwaway, read-only)
psql -h <throwaway-endpoint> -U postgres -d episode_metadata -c \
  "SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema='public';"
psql -h <throwaway-endpoint> -U postgres -d episode_metadata -c \
  "SELECT 'episodes' t, count(*) c FROM episodes
   UNION ALL SELECT 'shows', count(*) FROM shows
   UNION ALL SELECT 'assets', count(*) FROM assets
   UNION ALL SELECT 'world_events', count(*) FROM world_events
   UNION ALL SELECT 'wardrobe', count(*) FROM wardrobe
   UNION ALL SELECT 'social_profiles', count(*) FROM social_profiles
   UNION ALL SELECT 'franchise_knowledge', count(*) FROM franchise_knowledge
   UNION ALL SELECT 'ai_usage_logs', count(*) FROM ai_usage_logs;"

# 5. If counts match: the dump is VERIFIED. Store it off-box (S3 with SSE, or
#    encrypted local). THEN delete the throwaway.
aws rds delete-db-instance \
  --db-instance-identifier episode-control-verify-throwaway \
  --skip-final-snapshot --region us-east-1
```

**Status note (2026-06-01):** Path B was executed 2026-05-31. The verified dump
(gate 2.1b) and the authoritative table diff (gate 2.3) were both produced from a
snapshot-restored throwaway in a locked SG, which was torn down after. The 37
prod-only schema definitions were subsequently captured directly from the empty
`-prod` instance (read-only `pg_dump --schema-only`, 2026-06-01) and committed as
the preservation artifact (Sec 4.3, Sec 5.2, PR #737).

### Sec 3.3 -- Path A (FALLBACK): dump the live instance directly

Use only if Path B is impractical. Touches the box read-only (to read the working
credential) and handles the deferred `-dev` credential earlier than ideal.

```
# On the prod box, READ-ONLY (do NOT run any pm2 mutation while connected):
pm2 env 0    # read DB_PASSWORD (working -dev cred) + DB_HOST from launched env

# From workstation, dump -dev directly (read-only against live DB):
pg_dump -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres -d episode_metadata -Fc -f episode-control-dev-verified-20260530.dump
# then the same Sec 3.2 step-4 verification against -dev (read-only).
```

Risk note for Path A: requires SSH to the frozen box. SSH and `pm2 env` are
read-only and established-safe (the inspection used them), but the operator must
not issue any `pm2 restart/reload/delete/save` while in that session. The single
most dangerous action is one keystroke away the whole time. Path B has no such
exposure -- hence the recommendation.

---

## Sec 4 -- Canon decision (RESOLVED 2026-05-30 -- Evoni)

The one genuine judgment call. **Decided: canon = live `-dev` data; the prod-only
schemas are NOT ported in the cutover; their definitions are preserved.**

### Sec 4.1 -- What the prod-only tables are

The prod-only set is the schema for the **AI Video Editing System** -- an approved
(2026-02-05) 16-week feature for SAL (script enhancement, raw-footage upload,
YouTube style-learning, layer management, AI edit-plan generation, FFmpeg
rendering; target launch 2026-06-02). Confirmed by mapping the
`Implementation_Roadmap_AI_Video_Editing.docx` weekly groupings onto the live
`-prod` table list pulled 2026-05-30.

Status of the feature, from evidence:
- Schema was **built** (tables exist on `-prod`; created via `node-pg-migrate` per
  Week 1 -- likely origin of the `pgmigrations` half of the migration-framework fork).
- Feature was **never used** -- `-prod` content tables verified empty, zero rows.
- Live system (`-dev`, canon) **never received** these tables.
- The feature's own `Deviations_Log_AI_Video_Editing.docx` is frozen at the
  2026-02-05 baseline ("No deviations yet") -- no tracked progress.
- The project pivoted to the Path A audit / keystone fix-cycle.

### Sec 4.2 -- The decision and its reasoning

Evoni's intent: AI video editing **is a real near-term plan** for SAL. The decision
is nonetheless **do not port the schemas onto canon during reconciliation**, for
three reasons:

1. **The feature boundary is entangled, not a clean block.** The `-prod` list shows
   tables that straddle the editing feature and existing live systems --
   `timeline_data`, `timeline_placements`, `markers`, `scene_layer_configuration` --
   and `decision_log`/`decision_logs` is messier than the hazard doc framed (see
   Sec 5.4 correction). Porting risks importing schema that collides with / duplicates
   live tables -- a fresh instance of the parallel-system drift the audit catalogs --
   during the most fragile operation on the board.
2. **A never-used schema is not a head start.** The feature should be built against
   canon deliberately (tables designed to fit the live systems they touch, entanglement
   resolved on purpose), not resurrected from an empty 4-month-old definition.
3. **Porting buys nothing the preserved definitions don't give.** The reconciliation
   does one job -- clean canon, box un-frozen, live data only. The feature's future
   doesn't change what reconciliation does to the database.

This sequencing serves "I want it soon" *better* than porting: reconciliation stays
simple, canon stays clean, and the feature lands clean as its own post-audit build
instead of dragging a fork in behind it.

### Sec 4.3 -- Recorded decision

- **Canon = the live `episode-control-dev` data.** Settled by data (only populated copy).
- **Prod-only schemas: NOT ported in the cutover.** Canon stays clean.
- **Definitions PRESERVED** -- captured in the verified dump (Sec 3) AND a parked
  preservation file as the deliberate "coming back for this" marker. Evoni's near-term
  intent makes preservation a firm requirement, not an optional footnote.
  - **Preservation artifact COMMITTED 2026-06-01** (PR #737): `docs/audit/FD31-prod-only-schema-20260601.sql` -- a schema-only `pg_dump` of `episode-control-prod` (171 tables, zero rows), header-marked DO-NOT-RUN. Captures all 37 prod-only definitions incl. the 5 entangled stragglers, with column comments (design-intent context for the rebuild). Note: the committed `migrations-node-pg-migrate/20260205000001-add-ai-editing-tables.js` covers only 8 of the 37 -- which is why the full `-prod` schema dump was needed to satisfy the preservation requirement completely.
- **AI video editing rebuilds post-audit as its own effort**, designed against canon
  with the timeline/marker/scene entanglement resolved on purpose. *How* it revives
  (fresh build vs. resurrect-and-fix from the preserved definitions) is deferred --
  the definitions sit safely in the dump and the preservation file either way, so this
  decision does not lock the rebuild approach.

This collapses the Sec 5 prod-only matrix: every prod-only table -> **not ported,
definition preserved** (Sec 5.2).

---

## Sec 5 -- Table-fate matrix (RESOLVED -- authoritative diff complete 2026-05-31)

The Sec 4 decision collapses the prod-only side to a single fate. The authoritative
live diff is now complete (both lists pulled, see Sec 5.1), so membership is
confirmed, not estimated. What the diff did NOT resolve and Sec 4 does not touch:
the dev-only / migration-fork questions (Sec 5.3--5.4).

**Diff performed 2026-05-31** off a snapshot-restored throwaway instance (freeze-safe,
box never touched; instance + locked SG torn down after). `-dev` = 143 tables,
`-prod` = 171, gap = 28 net (37 prod-only - 9 dev-only). The verified dump (gate
2.1b) was taken from the same throwaway and matched the catalog exactly.

### Sec 5.1 -- Authoritative diff query (read-only, both DBs -- freeze-safe)

```
# Table list from -dev (live, read-only). Path-B note: run against the throwaway
# instead, to avoid the box entirely.
\dt    -- or:
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' ORDER BY table_name;   -- on episode_metadata @ -dev

# Table list from -prod (EMPTY -- fully safe to read; on-disk .env password works).
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' ORDER BY table_name;   -- on episode_metadata @ -prod

# Diff the two lists:
#   prod-only  = in -prod, not in -dev  -> the 37 (schema-fate decisions, Sec 4/5.2)
#   dev-only   = in -dev, not in -prod  -> the 9  (mostly already-canon, Sec 5.3)
```

### Sec 5.2 -- Prod-only schemas: FATE RESOLVED -> NOT PORTED, DEFINITION PRESERVED

Per Sec 4, **every** prod-only table takes the same fate. The authoritative set of
**37 prod-only tables** (confirmed by diff 2026-05-31; these exist on `-prod` and
NOT on canon `-dev`):

**Clear AI-video-editing feature schema (~28):**
`ai_edit_plans`, `ai_interactions`, `ai_revisions`, `ai_training_data`,
`audio_clips`, `beats`, `decision_patterns`, `edit_maps`, `editing_decisions`,
`interactive_elements`, `layers`, `layer_assets`, `layer_presets`,
`scene_layer_configuration`, `markers`, `processing_queues`, `raw_footage`,
`scene_footage_links`, `script_edit_history`, `script_learning_profiles`,
`script_metadata`, `script_suggestions`, `script_templates`, `upload_logs`,
`video_processing_jobs`, `lala_cash_grab_quests`, `lala_episode_formulas`,
`lala_micro_goals`.

**Stragglers -- prod-only but not obviously editing-feature (flag for rebuild, not
for cutover):**
`character_profiles`, `character_clips`, `decision_logs`, `user_decisions`,
`episode_phases`, `show_configs`, `layout_templates`, `lala_episode_timeline`,
`lala_friend_archetypes`.

**Fate for all 37: NOT PORTED, DEFINITION PRESERVED** (verified dump + committed
preservation file, PR #737). The straggler group does not change this -- but flags real
questions for the *post-audit rebuild*, not the cutover:

- `character_profiles` is prod-only while canon carries `character_state` /
  `character_arcs` / other character tables -- possible fork of canon's character
  model, or a feature-specific table. Investigate at rebuild.
- `decision_logs` (prod) vs `decision_log` -- see Sec 5.4 correction. Both the
  singular and plural live on `-prod`; canon's situation differs.
- `episode_phases`, `show_configs`, `user_decisions` sound like they could overlap
  live systems. Under Sec 4 moot for the cutover (nothing ports); recorded as
  entanglement the rebuild must classify (feature-table vs. canon-fork).

This entanglement is exactly **why** the Sec 4 decision is don't-port: a blind port
would have grafted forks of live tables onto canon during the cutover. The
preservation file captures all 37 definitions (committed 2026-06-01, PR #737 --
`docs/audit/FD31-prod-only-schema-20260601.sql`, with column comments) so the
post-audit rebuild can sort them deliberately (feature-table vs. canon-fork).

### Sec 5.3 -- Dev-only tables (the authoritative 9, already on canon)

Confirmed by diff 2026-05-31 -- exist on canon `-dev`, NOT on `-prod`:

`asset_label_map`, `character_relationships_extended`, `episode_outfits`,
`episode_outfit_items`, `pgmigrations`, `script_edits`, `search_history`,
`template_studio`, `video_compositions`.

These are already on canon by definition (canon = live `-dev`). No action needed to
"keep" them -- the work is only to note any that are themselves stale. Two flags:

- **`pgmigrations`** -- node-pg-migrate bookkeeping (see Sec 5.4). Its presence on
  canon but not `-prod` is the migration-framework fork.
- **`template_studio`** -- relevant to the incident cleanup: the 2026-05-30 reload
  left the prod box with a "Template Studio routes failed to load" bug. The table
  exists on canon, so the routes have a table to load against -- the bug is
  code/port-level (Sec 6.3 step 6), not a missing table. Recorded so the cutover
  doesn't chase a schema problem that isn't there.

### Sec 5.4 -- Collisions and migration-framework history (DECISION, not mechanical)

- **`decision_log` vs `decision_logs`** -- **resolved by the 2026-05-31 diff:**
  `decision_logs` (plural) is **prod-only** (not on canon). `decision_log` (singular)
  is on canon (it appears in neither diff list, meaning it exists on *both* -- or the
  earlier `-prod` raw list showed both `decision_log` and `decision_logs` on prod).
  Net for the cutover: the prod-only `decision_logs` is not ported (Sec 4), so no
  collision lands on canon. The earlier hazard-doc framing (dev-singular vs
  prod-plural) was approximate; live state is the authority. Fold the correction into
  the audit's existing "three parallel decision-logging tables" finding rather than
  treating it fresh. Confirm the exact canon-side state during the rebuild, not the
  cutover.
- **Dual migration frameworks** -- `-dev` has `pgmigrations` + `SequelizeMeta`;
  `-prod` has only `SequelizeMeta`. Decide: which framework is authoritative going
  forward, and do the two `SequelizeMeta` histories agree (diff them read-only)?
  This is thorny and is **a session decision, not a pre-flight one** -- but with the
  Sec 4 no-port decision it is also NOT cutover-blocking (nothing ports through a
  framework). It is deferred to the post-audit rebuild. The read-only diff of both
  `SequelizeMeta` tables can be pulled whenever the rebuild starts so the decision is
  informed. (NOTE: the Sequelize runtime path is `src/migrations` per `.sequelizerc`;
  see Sec 6.6 for the three migration locations in play.)

---

## Sec 6 -- Cutover mechanics + rollback (the dangerous part -- full plan)

This is the only part that touches `episode-backend`. It is irreversible-on-error.
The sequence below is the full step-by-step (gate 2.4 GREEN as of v1.3). Every step
is a Rule 7 boundary.

### Sec 6.1 -- The design, given the non-override finding AND the current canon-only .env

All boot-path `dotenv.config()` calls are **non-override** (confirmed: `app.js:9`,
`server.js:7`, `sequelize.js:10`, `start.js:10`, `index.js:15`). On a clean restart,
PM2 launches with a fresh environment, dotenv reads the on-disk `.env`, and that
value wins.

**Update 2026-06-01 -- the .env is already canon-only.** Verified live: the on-disk
`.env` has `DB_HOST=episode-control-dev` and a working `DB_PASSWORD`; there are NO
`-prod` credentials on the box. So the original cutover premise ("`.env` points at
empty `-prod`; correct it") is already satisfied for the host pointer (FD-31 Track A,
Fix Plan v1.8 FD-36). The data-swap landmine is defused on disk: a plain restart now
reads canon and comes up on canon. What remains of the "cutover" is therefore NOT a
DB_HOST correction -- it is: (a) optionally rotate the canon password (it was exposed
in a working session; rotate-at-cutover, Sec 6.5), and (b) the degraded-state cleanup
(port, route bug, pm2 save). The restart is data-wise a no-op by construction.

### Sec 6.2 -- Durable credential location (folds in S4.2-C)

The on-disk `.env` is the durable credential home, and as of 2026-06-01 it already
holds a working canon `DB_PASSWORD` (verified). So the original problem this section
described -- "the working password exists only in process memory; `.env` has the
`-prod` password" -- is already resolved. Gate 2.5 is GREEN on that basis.

The remaining credential work at cutover is rotation-for-hygiene, not
rotation-for-correctness:
- The current canon `DB_PASSWORD` was exposed in a working session (Sec 6.5). Rotate
  the `-dev` `postgres` password and write the new value into `.env` at cutover.
- Because `.env` already holds a working password, this rotation can be done
  carefully with the box up (edit `.env`, then the single controlled restart picks
  it up) -- there is no "nowhere durable to put it" problem anymore.

### Sec 6.3 -- Cutover sequence (FULL -- gate 2.4)

> **WARNING -- SUPERSEDE BANNER (Sec 6.3), added 2026-06-25. Authority: FD-42 (Fix Plan v1.15). Original 6.3 below is preserved verbatim; this banner corrects credential-state assumptions 6.3 was written under (pre-06-15 world, off-box credential working). Read before executing 6.3.**
>
> **Per FD-42, the off-box canon credential (`.env` == SSM v2) is STALE by >=2 rotations (06-20, 06-23). The only credential that currently authenticates canon exists in pm2 id-3 in-memory pool. This changes three things in 6.3:**
>
> 1. **Step 2 rotation is MANDATORY, not "optional hygiene."** It is the sole means of establishing a known off-box canon credential -- there is no working off-box value to fall back on. "Skip step 2" is NOT a valid branch.
> 2. **Step 3 "if step 2 skipped, .env needs no change" no longer applies** -- step 2 is not skipped. The rotated <NEW> value MUST be written to .env AND to SSM (new version, closing the FD-42 off-box gap) within this window.
> 3. **The restart (Track B step 5) is credential-destructive, not only data/topology-irreversible.** When the process cycles, the in-memory working credential is GONE. If .env does not already hold the rotated <NEW> value at cycle time, canon access is lost with NO off-box recovery. The 6.3 coupling ("rotate + restart-to-align in one combined window") is therefore REQUIRED for credential survival, not merely efficient. Order within the window: rotate canon -> confirm PendingModifiedValues empty -> write <NEW> to .env + SSM -> THEN restart.
>
> **The <NEW> value never appears in any document, chat, or commit. Rule 7 gate on the canon modify-db-instance stands; confirm episode-control-dev, NOT -prod, twice.**


Run under Rule 7, each step a boundary. Re-verify the Sec 7 abort checks live at
session start BEFORE step 1.

1. **Confirm rollback in hand.** Verified dump (`episode-control-dev-verified-20260530.dump`,
   Sec 3) present + snapshot `episode-control-dev-prefreeze-insurance-20260530` `available`.
   Re-verify live canon row counts match the Sec 3.1 catalog (gate fingerprint: episodes 72, shows 10, assets 64, world_events 53, wardrobe 40, social_profiles 444, franchise_knowledge 605 -- `ai_usage_logs` is informational, excluded from the hard gate per FD-38(e)). Mismatch -> ABORT (Sec 7).

2. **(Optional, hygiene) Rotate canon `-dev` password.** Generate locally; set via
   `aws rds modify-db-instance --region us-east-1 --db-instance-identifier episode-control-dev --master-user-password <NEW> --apply-immediately`; poll `PendingModifiedValues` empty.
   *** This is a write to the LIVE CANON instance -- Rule 7 gate, draft un-runnable, confirm target identifier twice (episode-control-dev, NOT -prod). ***

3. **Correct `.env` -- DB_HOST already canon; only password if rotated.** If step 2 ran,
   write the new `DB_PASSWORD` into `/home/ubuntu/episode-metadata/.env`. DB_HOST is
   already canon (no change). Edit-without-restart is safe. If step 2 skipped, `.env` needs no change.

4. **(NO-OP) Schema port.** Nothing ports (Sec 4/5.2: all 37 prod-only NOT ported).
   This step is intentionally empty -- the migration-framework decision (Sec 5.4) is
   deferred to the post-audit rebuild and does NOT gate the cutover.

> **STEPS 5-6 HANDED TO TRACK B (2026-06-01).** The 2026-06-01 prod-502 incident
> established that the prod restart, port flip (3002->3000), and pm2-save/topology
> fix are Track B work, not FD-31 cutover work (see
> `Track_B_PM2_Topology_Formalization_Plan.md` and
> `F-Deploy-1_INCIDENT_2026-06-01_prod-502-restore.md`). FD-31 owns the credential
> rotation (steps 2-3); Track B owns the restart (steps 5-6). They execute TOGETHER
> in a single combined restart window -- FD-31 rotates the credential, Track B's
> restart-to-align applies it, in one prod restart, not several. Steps 5-6 below are
> retained for context but are TRACK B's to run; FD-31 does not perform the restart.
> NOTE: prod is currently RESTORED (hotfix on 3000, 2026-06-01) -- so the "port 3002
> with nothing on 3000" framing in step 5/6 is historical; the live state is prod-up
> via the additive hotfix, and Track B formalizes that.

5. **[TRACK B] Controlled restart of the prod box.** *** GATED -- DO NOT PASTE-RUN. Owned by Track B; runs in the combined window. Assemble and
   execute deliberately at session time, with rollback confirmed. *** This is the one
   irreversible action. Restart must use the production env so PM2 reads the right
   ecosystem block (port 3000, not 3002 -- F-Deploy-G1-H). Per the standing rule, ANY
   prod-box restart is a hard Rule 7 stop even when developer-initiated. Immediately after: post-restart integrity follows the runbook's "Integrity gate — counting method (per FD-38)" block (unfiltered `count(*)` + `db`/`server` identity asserts via read-only psql); `/health` is liveness-only and its soft-delete-filtered counts are NOT the integrity comparator (FD-38). Any identity or fingerprint deviation -> ABORT, restore from snapshot (Sec 6.4). [Exact restart command
   left un-templated here by design; build it at the session from the live ecosystem
   config, do not copy a restart line out of this document.]

6. **[TRACK B] Degraded-state cleanup / topology** (Track B's Minimal-B / combined-restart window): port 3002 ->
   3000 (F-Deploy-G1-H, `--env production`), the Template Studio route-loading bug
   (code/port-level -- the `template_studio` table exists on canon, Sec 5.3, so not a
   missing-table problem), and correct `pm2 save` / `dump.pm2` so resurrect state is right.

7. **Re-enable + gate the disabled workflows** (Deploy to Development, Auto-merge to Dev
   -- FD-35; reconciliation-gated per hazard Sec 3 item 9). Decide `Deploy to Production`
   gating (confirmed `workflow_dispatch`-only, type-to-confirm; no autonomous trigger).

8. **Post-cutover security sweep:** close `0.0.0.0/0` on the RDS SGs (F-Deploy-G1-AF);
   encrypt the insurance snapshot (currently unencrypted); migrate the box off static
   `AWS_ACCESS_KEY_ID`/`SECRET` in `.env` to an instance profile (F-Deploy-G1-AD).

### Sec 6.4 -- Rollback

At every mutable step, rollback = restore `episode-control-dev-prefreeze-insurance-20260530`
to a new instance and repoint, OR restore the verified logical dump. The snapshot
and the verified dump are the two-deep safety net; do not begin step 5+ without
both confirmed.

### Sec 6.5 -- Credential-rotation list (NEW, from the 2026-06-01 session)

Credentials exposed or created during pre-flight work, with disposition:
- **Canon `-dev` `DB_PASSWORD`** -- exposed in a working session. Rotate at cutover (step 2/3).
- **`-prod` master password** -- reset twice during preservation capture (2026-06-01), value exposed. `-prod` is the empty, retire-bound instance; retire the password at `-prod` teardown (no live data at risk meanwhile).
- **AWS static keys in `.env`** (`AWS_ACCESS_KEY_ID`/`SECRET`) -- F-Deploy-G1-AD; replace with an instance profile at the security sweep (step 8).

### Sec 6.6 -- Migration-location note (NEW)

Three migration locations are in play and the cutover/rebuild must not conflate them:
- `src/migrations` -- Sequelize runtime path (`.sequelizerc`); the ONLY dir the runner scans.
- `migrations/` -- top-level; holds parked items (e.g. the reconciliation-gated `world_events` backfill). NOT scanned by the runner.
- `migrations-node-pg-migrate/` -- the AI-video-editing feature DDL (8 of 37 tables). NOT scanned by the Sequelize runner.

---

## Sec 7 -- Abort conditions (hard stops -- no judgment call, just stop)

- Live row counts at session start do **not** match the Sec 3.1 catalog -> STOP.
  Something changed; understand it before touching anything.
- The verified dump's counts don't match -> the backup is not trustworthy -> STOP.
- The live diff surfaces tables not accounted for in the matrix -> STOP, classify
  before proceeding.
- Phase 2 post-restart: integrity gate mismatch (`db`/`server` identity or any unfiltered fingerprint count, per the runbook's FD-38 integrity gate) -> ABORT IMMEDIATELY, restore from snapshot, do not "fix forward."
- Phase 2 post-restart: `/health` non-200 or `database != connected` (LIVENESS only) -> ABORT.
- No durable credential location is ready when step 3 is reached -> STOP (do not
  restart with a `.env` that can't authenticate against canon). (As of 2026-06-01
  this is satisfied -- `.env` holds a working canon credential -- but re-confirm live
  at session start.)
- Any uncertainty about which instance a command targets -> STOP. The whole
  incident class is "the reach was implicit."

---

## Sec 8 -- What this document does NOT do

- Does **not** authorize, schedule, or begin the reconciliation. That is its own
  gated session.
- Does **not** touch, restart, reboot, deploy to, or edit `.env` on the prod box.
- Does **not** re-enable the disabled workflows.
- Does **not** finalize the rebuild *approach* for AI video editing -- the Sec 4
  canon decision is made (don't port, preserve), but how/when the feature revives
  post-audit is deliberately deferred.
- Does **not** move any Fix Plan gate. Sec 4.2 (Fix Plan) remains BLOCKED on FD-31;
  the pre-flight gates (Sec 2 of THIS doc) are all GREEN, which is a different thing
  -- it means the cutover is ready to be executed in its own gated session, not that
  any Fix Plan gate has closed.

---

*Pre-flight & plan for the FD-31 reconciliation. Freeze-safe prep only. Built on the
2026-05-30 snapshot (insurance), the verified 2026-05-31 dump + diff, the non-override
dotenv finding, and the 2026-06-01 findings (preservation artifact committed #737;
on-disk .env confirmed canon-only; cutover scope reduced). All six pre-flight gates
are GREEN; the reconciliation cutover remains gated, backup-first, and its own
deliberate session.*
