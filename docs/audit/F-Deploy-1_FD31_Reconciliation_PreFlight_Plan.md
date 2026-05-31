# F-Deploy-1 FD-31 — Reconciliation Session Pre-Flight & Plan (DRAFT)

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
| **Fix Plan lineage** | Inherits v1.7 (FD-1–FD-35); feeds a future revision (v1.8+) |
| **Status** | DRAFT v1.2 — prep only, uncommitted, no gate moved. Sec 4 canon RESOLVED; 2.1b verified dump + 2.3 diff DONE 2026-05-31. |
| **Drafted** | 2026-05-30; v1.1 added canon decision; v1.2 adds verified dump + authoritative table diff (2026-05-31) |
| **Freeze state** | Prod box FROZEN + DEGRADED (port 3002, route bug, `.env`→empty `-prod`). Freeze fully in force. |

---

## Sec 1 — What reconciliation actually is (dissolving the false binary)

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

1. **Schema fate** — for the 37 prod-only table *schemas* (no data to move, since
   `-prod` is empty): carry each onto canon, or abandon. Plus the 9 dev-only
   tables (already on canon, mostly bookkeeping) and the
   `decision_log`/`decision_logs` collision. → Sec 4, Sec 5.
2. **Migration-framework history** — `-dev` carries two bookkeeping tables
   (`pgmigrations` AND `SequelizeMeta`); `-prod` carries only `SequelizeMeta`.
   Decide which framework is authoritative going forward and whether the
   `SequelizeMeta` histories agree. → Sec 5.4.
3. **Cutover mechanics** — make the on-disk config and the running process agree,
   on canon, without triggering the silent-empty swap. This is the dangerous,
   irreversible part. → Sec 6.

Only sub-problem 3 touches the box. Sub-problems 1 and 2 are decisions made on
paper plus read-only inspection, and can be fully resolved in the pre-flight.

---

## Sec 2 — Pre-flight gate (ALL must be GREEN before the session touches anything mutable)

The session does not begin cutover (Sec 6) until every item here is GREEN. These
are conditions, not a schedule.

| # | Gate item | State | Source |
|---|---|---|---|
| 2.1a | Durable snapshot of `episode-control-dev` exists | ✅ GREEN — `episode-control-dev-prefreeze-insurance-20260530`, `available`, 100% (2026-05-30) | tonight |
| 2.1b | **Verified** logical dump (table + row counts matched to catalog) | ✅ GREEN — DONE 2026-05-31. `episode-control-dev-verified-20260530.dump` (2.83 MB), 143 tables + all 8 row-count fingerprints matched exactly. Snapshot proven good (test-restore). Stored off-repo at `Documents\PrimeStudios-Backups\`. | Sec 3 |
| 2.2 | Canon decision written and signed off (the prod-only schema-fate call) | ✅ GREEN — RESOLVED 2026-05-30 (Sec 4): canon = live `-dev`; prod-only not ported, definitions preserved | tonight |
| 2.3 | Table-fate matrix populated from live diff and ratified | ✅ GREEN — DONE 2026-05-31. Authoritative 37 prod-only / 9 dev-only confirmed (Sec 5.2/5.3). Fate uniform: not ported, definitions preserved. | Sec 5 |
| 2.4 | Cutover plan + rollback written in full (not outline) | ⬜ PENDING | Sec 6 |
| 2.5 | Durable credential location decided (folds in S4.2-C `-dev` password rotation) | ⬜ PENDING | Sec 6.2 |

Note 2.1a vs 2.1b: the snapshot is **recoverable** insurance (closes single-copy
risk — done). The verified dump is the hazard doc's named reconciliation
prerequisite — it is *verification*, proving the copy's contents match reality
before anyone touches the canon DB. Both are needed; only the first is done.

---

## Sec 3 — Verified-dump procedure (the session's opening step)

**Goal:** a logical copy of the live data whose table count and row counts match
the inspection catalog. Producing it is also the proof the snapshot is good.

### Sec 3.1 — Catalog to match (re-verify at session time)

From the 2026-05-29 read-only inspection. `episodes.updated_at` last = 2026-05-15,
so the data is expected stable, but **re-run the counts live at session start** —
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
| ai_usage_logs | 764 |

### Sec 3.2 — Path B (RECOMMENDED): restore-and-verify the snapshot

Why primary: it produces the dump, **test-restores the snapshot** (proving the
insurance), never touches `episode-backend`, and never handles the deferred `-dev`
credential (S4.2-C stays clean until the cutover establishes a durable home for it).

Cost/time: one temporary RDS instance for the duration; a 20 GB restore is quick
but not instant. The throwaway is deleted at the end.

**Each step below is a Rule 7 boundary at execution — drafted here, confirmed and
run at session time. Nothing here runs tonight.**

```
# 1. Restore snapshot to a throwaway instance.
#    CRITICAL: place it in a LOCKED security group (NOT the open one — AF is live,
#    the prod RDS SG allows 5432 from 0.0.0.0/0; do not inherit that).
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier episode-control-verify-throwaway \
  --db-snapshot-identifier episode-control-dev-prefreeze-insurance-20260530 \
  --db-subnet-group-name <private-subnet-group> \
  --vpc-security-group-ids <locked-sg-no-0.0.0.0/0> \
  --no-publicly-accessible \
  --region us-east-1

# 2. Reset the throwaway's master password via the API (no knowledge of the
#    -dev postgres password required — this is an admin op, not DB auth).
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

### Sec 3.3 — Path A (FALLBACK): dump the live instance directly

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
exposure — hence the recommendation.

---

## Sec 4 — Canon decision (RESOLVED 2026-05-30 — Evoni)

The one genuine judgment call. **Decided: canon = live `-dev` data; the prod-only
schemas are NOT ported in the cutover; their definitions are preserved.**

### Sec 4.1 — What the prod-only tables are

The prod-only set is the schema for the **AI Video Editing System** — an approved
(2026-02-05) 16-week feature for SAL (script enhancement, raw-footage upload,
YouTube style-learning, layer management, AI edit-plan generation, FFmpeg
rendering; target launch 2026-06-02). Confirmed by mapping the
`Implementation_Roadmap_AI_Video_Editing.docx` weekly groupings onto the live
`-prod` table list pulled 2026-05-30.

Status of the feature, from evidence:
- Schema was **built** (tables exist on `-prod`; created via `node-pg-migrate` per
  Week 1 — likely origin of the `pgmigrations` half of the migration-framework fork).
- Feature was **never used** — `-prod` content tables verified empty, zero rows.
- Live system (`-dev`, canon) **never received** these tables.
- The feature's own `Deviations_Log_AI_Video_Editing.docx` is frozen at the
  2026-02-05 baseline ("No deviations yet") — no tracked progress.
- The project pivoted to the Path A audit / keystone fix-cycle.

### Sec 4.2 — The decision and its reasoning

Evoni's intent: AI video editing **is a real near-term plan** for SAL. The decision
is nonetheless **do not port the schemas onto canon during reconciliation**, for
three reasons:

1. **The feature boundary is entangled, not a clean block.** The `-prod` list shows
   tables that straddle the editing feature and existing live systems —
   `timeline_data`, `timeline_placements`, `markers`, `scene_layer_configuration` —
   and `decision_log`/`decision_logs` is messier than the hazard doc framed (see
   Sec 5.4 correction). Porting risks importing schema that collides with / duplicates
   live tables — a fresh instance of the parallel-system drift the audit catalogs —
   during the most fragile operation on the board.
2. **A never-used schema is not a head start.** The feature should be built against
   canon deliberately (tables designed to fit the live systems they touch, entanglement
   resolved on purpose), not resurrected from an empty 4-month-old definition.
3. **Porting buys nothing the preserved definitions don't give.** The reconciliation
   does one job — clean canon, box un-frozen, live data only. The feature's future
   doesn't change what reconciliation does to the database.

This sequencing serves "I want it soon" *better* than porting: reconciliation stays
simple, canon stays clean, and the feature lands clean as its own post-audit build
instead of dragging a fork in behind it.

### Sec 4.3 — Recorded decision

- **Canon = the live `episode-control-dev` data.** Settled by data (only populated copy).
- **Prod-only schemas: NOT ported in the cutover.** Canon stays clean.
- **Definitions PRESERVED** — captured in the verified dump (Sec 3) AND a parked
  migration file as the deliberate "coming back for this" marker. Evoni's near-term
  intent makes preservation a firm requirement, not an optional footnote.
- **AI video editing rebuilds post-audit as its own effort**, designed against canon
  with the timeline/marker/scene entanglement resolved on purpose. *How* it revives
  (fresh build vs. resurrect-and-fix from the preserved definitions) is deferred —
  the definitions sit safely in the dump either way, so this decision does not lock
  the rebuild approach.

This collapses the Sec 5 prod-only matrix: every prod-only table → **not ported,
definition preserved** (Sec 5.2).

---

## Sec 5 — Table-fate matrix (RESOLVED — authoritative diff complete 2026-05-31)

The Sec 4 decision collapses the prod-only side to a single fate. The authoritative
live diff is now complete (both lists pulled, see Sec 5.1), so membership is
confirmed, not estimated. What the diff did NOT resolve and Sec 4 does not touch:
the dev-only / migration-fork questions (Sec 5.3–5.4).

**Diff performed 2026-05-31** off a snapshot-restored throwaway instance (freeze-safe,
box never touched; instance + locked SG torn down after). `-dev` = 143 tables,
`-prod` = 171, gap = 28 net (37 prod-only − 9 dev-only). The verified dump (gate
2.1b) was taken from the same throwaway and matched the catalog exactly.

### Sec 5.1 — Authoritative diff query (read-only, both DBs — freeze-safe)

```
# Table list from -dev (live, read-only). Path-B note: run against the throwaway
# instead, to avoid the box entirely.
\dt    -- or:
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' ORDER BY table_name;   -- on episode_metadata @ -dev

# Table list from -prod (EMPTY — fully safe to read; on-disk .env password works).
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' ORDER BY table_name;   -- on episode_metadata @ -prod

# Diff the two lists:
#   prod-only  = in -prod, not in -dev  → the 37 (schema-fate decisions, Sec 4/5.2)
#   dev-only   = in -dev, not in -prod  → the 9  (mostly already-canon, Sec 5.3)
```

### Sec 5.2 — Prod-only schemas: FATE RESOLVED → NOT PORTED, DEFINITION PRESERVED

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

> **CORRECTION 2026-05-31 — canary set was wrong for the populated-canon gate.**
>
> The five tables `ai_edit_plans`, `raw_footage`, `scene_layer_configuration`,
> `markers`, `lala_cash_grab_quests` were harvested from the `--schema-only` dump
> of the EMPTY `-prod` RDS. They are `-prod`-only schema definitions and do NOT
> exist in `-dev` canon. Querying them against `-dev` returns
> `relation "..." does not exist` — a guaranteed false-abort.
>
> They are useless as a "is `-dev` populated?" probe. The correct Gate 1 canon
> probe is core tables known to hold canon rows in `-dev`:
> `character_state`, `shows`, `episodes` (verified 3 / 10 / 72 on 2026-05-31).
> Use these for any future row-count abort gate, not the five preservation tables.

**Stragglers — prod-only but not obviously editing-feature (flag for rebuild, not
for cutover):**
`character_profiles`, `character_clips`, `decision_logs`, `user_decisions`,
`episode_phases`, `show_configs`, `layout_templates`, `lala_episode_timeline`,
`lala_friend_archetypes`.

**Fate for all 37: NOT PORTED, DEFINITION PRESERVED** (verified dump + parked
migration file). The straggler group does not change this — but flags real
questions for the *post-audit rebuild*, not the cutover:

- `character_profiles` is prod-only while canon carries `character_state` /
  `character_arcs` / other character tables — possible fork of canon's character
  model, or a feature-specific table. Investigate at rebuild.
- `decision_logs` (prod) vs `decision_log` — see Sec 5.4 correction. Both the
  singular and plural live on `-prod`; canon's situation differs.
- `episode_phases`, `show_configs`, `user_decisions` sound like they could overlap
  live systems. Under Sec 4 moot for the cutover (nothing ports); recorded as
  entanglement the rebuild must classify (feature-table vs. canon-fork).

This entanglement is exactly **why** the Sec 4 decision is don't-port: a blind port
would have grafted forks of live tables onto canon during the cutover. The
preservation file must capture all 37 definitions so the rebuild can sort them
deliberately.
decision this is moot for the cutover (nothing ports), but it is exactly **why** the
decision is don't-port: these are the collision risks a blind port would have
introduced. Record them as the entanglement the *post-audit rebuild* must resolve
deliberately.

### Sec 5.3 — Dev-only tables (the authoritative 9, already on canon)

Confirmed by diff 2026-05-31 — exist on canon `-dev`, NOT on `-prod`:

`asset_label_map`, `character_relationships_extended`, `episode_outfits`,
`episode_outfit_items`, `pgmigrations`, `script_edits`, `search_history`,
`template_studio`, `video_compositions`.

These are already on canon by definition (canon = live `-dev`). No action needed to
"keep" them — the work is only to note any that are themselves stale. Two flags:

- **`pgmigrations`** — node-pg-migrate bookkeeping (see Sec 5.4). Its presence on
  canon but not `-prod` is the migration-framework fork.
- **`template_studio`** — relevant to the incident cleanup: the 2026-05-30 reload
  left the prod box with a "Template Studio routes failed to load" bug. The table
  exists on canon, so the routes have a table to load against — the bug is
  code/port-level (Sec 6.3 step 6), not a missing table. Recorded so the cutover
  doesn't chase a schema problem that isn't there.

### Sec 5.4 — Collisions and migration-framework history (DECISION, not mechanical)

- **`decision_log` vs `decision_logs`** — **resolved by the 2026-05-31 diff:**
  `decision_logs` (plural) is **prod-only** (not on canon). `decision_log` (singular)
  is on canon (it appears in neither diff list, meaning it exists on *both* — or the
  earlier `-prod` raw list showed both `decision_log` and `decision_logs` on prod).
  Net for the cutover: the prod-only `decision_logs` is not ported (Sec 4), so no
  collision lands on canon. The earlier hazard-doc framing (dev-singular vs
  prod-plural) was approximate; live state is the authority. Fold the correction into
  the audit's existing "three parallel decision-logging tables" finding rather than
  treating it fresh. Confirm the exact canon-side state during the rebuild, not the
  cutover.
- **Dual migration frameworks** — `-dev` has `pgmigrations` + `SequelizeMeta`;
  `-prod` has only `SequelizeMeta`. Decide: which framework is authoritative going
  forward, and do the two `SequelizeMeta` histories agree (diff them read-only)?
  This is thorny and is **a session decision, not a pre-flight one** — but the
  read-only diff of both `SequelizeMeta` tables can be pulled in pre-flight so the
  decision is informed.

---

## Sec 6 — Cutover mechanics + rollback (the dangerous part — full plan written before session)

This is the only part that touches `episode-backend`. It is irreversible-on-error.
The outline below must be expanded to a full step-by-step with exact commands
*before* gate 2.4 goes GREEN. Every step is a Rule 7 boundary.

### Sec 6.1 — The design, given tonight's non-override finding

All boot-path `dotenv.config()` calls are **non-override** (confirmed:
`app.js:9`, `server.js:7`, `sequelize.js:10`, `start.js:10`, `index.js:15`). On a
clean restart, PM2 launches the process with a fresh environment (no in-memory
`-dev` override), dotenv reads the on-disk `.env`, and that value wins.

Therefore the safe cutover is **fix `.env` first, then restart**:

1. The split-brain is only dangerous because `.env` (→ empty `-prod`) disagrees
   with the running process (→ live `-dev`).
2. If `.env` is corrected to point at **canon** (the live `-dev` instance, with a
   working credential), then a restart reads the corrected `.env` and the process
   comes up on canon — the *same* data it's serving now, but now durably, with
   file and process in agreement.
3. The restart stops being a swap-to-empty and becomes a no-op data-wise.

This is why the grep mattered: it turns the cutover from "must inject env before
restart" into "make the file correct, verify, then restart."

### Sec 6.2 — Durable credential location (folds in S4.2-C)

The corrected `.env` needs the canon instance's working password. Currently the
working `-dev` password exists only in process memory; the on-disk `.env` has the
`-prod` password. So the cutover is the right moment to:

- Rotate the `-dev` instance `postgres` password to a new value (S4.2-C deferred
  this deliberately to exactly this point).
- Write the new password into the corrected `.env` (its durable home).
- This is why rotating earlier was wrong — there was nowhere durable to put it.

### Sec 6.3 — Cutover sequence (outline — expand to full commands before 2.4 GREEN)

> **⚠️ SUPERSEDED 2026-05-31 — DO NOT EXECUTE AS WRITTEN**
>
> Retained for history only. Two steps are now invalid:
> - **Step 4 ("apply ported schemas")** — killed by the Sec 4 don't-port decision. The FD-31 cutover ports nothing.
> - **Step 6 `--env production` restart** — unsafe per the FD-31 Phase 0 findings (4-app inverted-naming ecosystem; `--env production` does not map to the live 3002 profile).
>
> Corrected procedure lives in the FD-31 Phase 0 findings + the pending Phase 3 redesign.

1. Verified dump in hand (Sec 3) + snapshot confirmed (rollback ready).
2. Rotate `-dev` `postgres` password (API).
3. Correct on-disk `.env`: `DB_HOST` → canon, `DB_PASSWORD` → new value. **Do not
   restart yet.** (Edit without restart is safe — it just makes file and process
   agree once restart happens.)
4. Apply any ported schemas (Sec 5.2 "port" set) to canon via the chosen migration
   framework — *additive DDL only, against canon, with the verified dump as
   rollback.*
5. Controlled restart. Immediately verify: `/health` shows `DB_HOST` = canon and
   the row counts match Sec 3.1. If not → ABORT, restore from snapshot.
6. Fix the incident debris: port 3002 → 3000 (F-Deploy-G1-H `--env production`),
   the Template Studio route-loading bug, correct the `pm2 save` / `dump.pm2` so
   resurrect state is right.
7. Re-enable + gate the two disabled workflows (reconciliation-gated decision per
   hazard Sec 3 item 9) and decide `Deploy to Production`'s gating (armed-but-
   manual today — confirmed `workflow_dispatch`-only with a type-to-confirm guard;
   no autonomous trigger).
8. Post-cutover: AF SG sweep (close `0.0.0.0/0` on the RDS SGs), snapshot
   encryption (the insurance snapshot is unencrypted — same exposure class).

### Sec 6.4 — Rollback

At every mutable step, rollback = restore `episode-control-dev-prefreeze-insurance-20260530`
to a new instance and repoint, OR restore the verified logical dump. The snapshot
and the verified dump are the two-deep safety net; do not begin step 4+ without
both confirmed.

---

## Sec 7 — Abort conditions (hard stops — no judgment call, just stop)

- Live row counts at session start do **not** match the Sec 3.1 catalog → STOP.
  Something changed; understand it before touching anything.
- The verified dump's counts don't match → the backup is not trustworthy → STOP.
- The live diff surfaces tables not accounted for in the matrix → STOP, classify
  before proceeding.
- After the cutover restart, `/health` shows the wrong `DB_HOST` or wrong counts →
  ABORT IMMEDIATELY, restore from snapshot, do not "fix forward."
- No durable credential location is ready when step 3 is reached → STOP (do not
  restart with a `.env` that can't authenticate against canon).
- Any uncertainty about which instance a command targets → STOP. The whole
  incident class is "the reach was implicit."

---

## Sec 8 — What this document does NOT do

- Does **not** authorize, schedule, or begin the reconciliation. That is its own
  gated session.
- Does **not** touch, restart, reboot, deploy to, or edit `.env` on the prod box.
- Does **not** re-enable the disabled workflows.
- Does **not** finalize the rebuild *approach* for AI video editing — the Sec 4
  canon decision is made (don't port, preserve), but how/when the feature revives
  post-audit is deliberately deferred.
- Does **not** claim the Sec 5 prod-only set is complete — fate is resolved for all
  of it, but the exact membership the preservation file must capture still needs the
  `-dev` diff.
- Does **not** move any Fix Plan gate. Sec 4.2 remains BLOCKED on FD-31.

---

*Pre-flight & plan draft for the FD-31 reconciliation. Freeze-safe prep only.
Built on the 2026-05-30 snapshot (insurance) and the non-override dotenv finding
(cutover design). Expand Sec 5 from the live diff and resolve Sec 4 before any
pre-flight gate goes GREEN. The reconciliation remains gated, backup-first, and
its own deliberate session.*
