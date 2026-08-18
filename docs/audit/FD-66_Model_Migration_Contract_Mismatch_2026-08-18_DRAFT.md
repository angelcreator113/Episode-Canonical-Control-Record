| **PRIME STUDIOS** **FINDING — FD-66** *Mints FD-66. Ships no code. Changes no gate.* |
| --- |

# Finding — FD-66: The Schema Residue of F-App-1's Incomplete Remediation

**Date:** 2026-08-18
**Status:** **DRAFT.** Mints **FD-66**; FD tail advances **FD-65 → FD-66**. **Priority P0, ruled** — see §0.1. Ships no code. Changes no gate. Authorizes nothing.
**Session:** F-Auth-5 remediation (PR #1049, merged at `77fc5fb0`). This finding was surfaced by that work, not sought by it.
**Derived from:** git against `origin/main` at `77fc5fb0`, plus the CI log for Validate run `32149440997`.
**Environment contact — stated in full:**
- **A local test database was contacted** (`localhost:5434`, the `TEST_DATABASE_URL` target) for the probes at §2.2 and §3.2.
- **A local scratch database was created, migrated, read, and dropped** — `fd66_migrations_only` on the same local instance — for the measurement at §6. 210 migrations were applied to it. Its removal is confirmed.
- **One command connected to a database other than its intended target.** `npx sequelize db:migrate` was first run with `DATABASE_URL` exported but `NODE_ENV` unset; `.env` sets `NODE_ENV=production`, and the production config block **deliberately ignores `DATABASE_URL`** (`src/config/sequelize.js:141-145`), resolving instead to discrete `DB_*` vars. On this machine those resolve to `127.0.0.1` / `episode_metadata_test`, so the connection was local and the command executed no DDL — it reported *"schema already up to date"*. **On a machine where `DB_HOST` pointed at RDS, that command would have reached it.** Recorded because the near-miss is the reportable part, not the outcome.
- **No request was issued to any deployed host.** Prod remains FROZEN and untouched.
**Additive on:** F-AUTH-1 Fix Plan v2.53, and on **F-App-1** — this finding is the schema residue F-App-1's remediation left behind (§1.1). Supersedes nothing. Corrections owed forward are stated at §5.
**Related, not subsumed:** **§12.11 / `PE #62`** — the write paths F-App-1 declared out of scope. Same root cause, different object (§1.2). Paired closure is flagged and not decided (§1.3).

---

## CORRECTION BANNER 2 — added 2026-08-18, after `79f9bab1`

**Banners are read newest-first. Where two banners disagree, the later governs; where a banner and the body disagree, the banner governs. Banner 1 below is preserved exactly as merged at `79f9bab1` and is not edited — a dated layer that changes after merging cannot be relied on for what it said on its date.**

**Scope of this banner: Banner 1's §B5 second question only.** B1, B2, B3, B4 and **B5's first question stand unchanged**.

### B5's second question rested on a premise that is no longer true

**What B5 said.** *"This document is not a Ward artifact but touches `episode_wardrobe`. Whether the obligation attaches is a reading of the register's scope."* The question had force because `episode_wardrobe` was one of two tables XK-1's reach table cited for **F-Ward-1** — so a document touching it plausibly stood in the relation §4's obligation governs.

**What changed.** `76a7f1ac` withdrew XK-1's F-Ward-1 reach row **in full**: both `episode_wardrobe` and `episode_wardrobe_defaults` resolve no deletion attribute and are inoperatively paranoid. **XK-1 now cites no exposed table for F-Ward-1**, so touching `episode_wardrobe` no longer places any document in relation to XK-1's reach. **The question as posed has lost its hook.**

**What replaces it, narrower.** This document still touches `episode_wardrobe` — bucket 3, no table under any spelling — but as **F-Ward-1's Pattern 40b instance**, not as an XK-1 reach table. Whether §4's obligation attaches on *that* basis is a different question with a different answer path: it turns on whether the obligation tracks the tables XK-1 claims or the keystones it names. **That question is recorded at XK-1's own banner and at the inventory's, for F-Ward-1's half of the obligation generally. It is deliberately not re-asked here** — a third copy of an unowned question is how a citation reaches eight carriers.

**B5's first question is untouched. Scope-vs-absorb stands exactly as written.** Axis P is XK-1's territory whether or not the F-Ward-1 row survives, and nothing in `76a7f1ac` bears on it. **This banner corrects one premise, not both questions.**

### Recorded as an instance, not fixed quietly

The claim merged in Banner 1 at `79f9bab1`, was invalidated by `76a7f1ac` roughly an hour later, and was live on `main` in between. **This program invalidated its own citation and did not re-derive it at the point of quoting** — the same failure Banner 1 documents in other artifacts, at the shortest span and with the fullest record.

**It is the only instance in this sequence where the whole chain is documented end to end** — claim, basis, invalidation, and span on `main` — because both ends were authored here rather than reconstructed from evidence. **It demonstrates that the cost of a stale citation is set by whether it is quoted, not by how long it stands:** XK-1's `48` was wrong for eleven days and cost three citations; this claim was wrong for one hour and cost one, and the correction is the same size either way.

**The operative discipline, stated because "read skeptically" has no trigger and this does:** *re-derive a figure at the point of citation, at the current basis, or do not quote it.*

---

## CORRECTION BANNER — added 2026-08-18, after filing

**This banner corrects counts and discloses a duplication. The body below is preserved verbatim per additive-supersede. Where the two disagree, this banner governs.**

### B1. Axis P is over-counted. Every number below carries its basis.

The probe at §6.2 treated `Model.options.paranoid` as the exposure test. **It is not.** A model that also sets `timestamps: false` resolves **no deletion attribute at all** — Sequelize never names `deleted_at`, so nothing fails. Those models are **inoperatively paranoid** and must be excluded.

**The correct test is whether a deletion attribute resolves, not whether `paranoid` reports true.** `timestamps: false` is one sufficient condition for it not to; the attribute test is the property itself and is what a re-run should use.

| Basis | Method | Axis P | Broken total |
|---|---|---:|---:|
| `77fc5fb0` — this document's basis | **as filed, wrong method** | 19 | 28 |
| `77fc5fb0` — this document's basis | corrected | **13** | **25** |
| `main` as of 2026-08-18 | corrected | **12** | **24** |

**The first two rows are the same commit.** They differ by method, not by basis — stated explicitly so no reader takes the change for schema drift.

Six Axis P members are inoperatively paranoid: `metadata_storage`, `thumbnails`, `activity_logs`, `episode_wardrobe_defaults`, `asset_usage_log`, `ai_usage_logs`.

**The broken total is not 28 minus 6.** Three of the six remain broken on other axes — `metadata_storage` and `activity_logs` on naming, `thumbnails` on absent-in-every-spelling. Only `episode_wardrobe_defaults`, `asset_usage_log` and `ai_usage_logs` leave the broken set.

**`decision_logs` moved between the two corrected rows.** The migration at `956697c0`, authorized by v2.54 §1, added its `deleted_at` after this document's basis. **Three different numbers are all correct; they differ only by commit.** Any figure quoted from this document without its basis will become false without anyone stating an untruth — which is the mechanism behind most of what this document records.

**Verified, not assumed:** no model in the set uses a custom `deletedAt` mapping. All resolve to the literal `deleted_at`, so the probe's fallback was correct in every case. Measured against a rebuilt migrations-only schema, 2026-08-18.

### B2. Axis P is XK-1's territory, and this document re-derived it without citation.

**`Cross_Keystone_Register.md` XK-1 — `paranoid` exposure — measured this on 2026-08-07, eleven days before this document, and has been OWNED since F-Stats-1 v1.31.** Its evidence artifact, `Paranoid_Exposure_Inventory_2026-08-07.md`, is *"not superseded and not moved… the measurement of record."*

**This document did not cite either.** Its Axis P is XK-1 re-measured, and its §6.4.1 prod point restates the inventory's own carve-out in weaker terms.

**The over-count was predicted.** The inventory §3 states: *"Anyone re-running this probe must apply the same correction."* This document re-ran a probe of the same shape and did not apply it.

**Independent corroboration, and of which quantity.** The inventory reports **110 models inheriting `paranoid`**; this document's probe found **110**. Two instruments, eleven days apart, same figure. **That corroborates the denominator — the population declaring `paranoid` — and nothing else.** It is **not** confirmation of either document's exposure count, since both applied the same flawed exposure test to that shared denominator.

### B3. The two measure different populations. Reconciled by membership, not by arithmetic.

XK-1 reports **48** exposed; this document's corrected Axis P is **13**. **They do not disagree — they have different denominators.** Every one of the inventory's 48 partitions exactly:

| Partition | Count |
|---|---:|
| Inoperatively paranoid — no deletion attribute resolves | 11 |
| Exposed, table **exists** in a migrations-built schema — this document's Axis P | **13** |
| Exposed, table **absent entirely** — this document's bucket 3 | 24 |
| **Total** | **48** |

**Zero residue.** Axis P is scoped to models whose table exists; XK-1 counts across all models regardless. The 13 matches by membership, not only by count.

### B4. RAISED, NOT RESOLVED — a challenge to XK-1's own count

**Criterion used, stated because B1 makes the distinction load-bearing:** the eleven below were derived with the **`attr=NO` test — no deletion attribute resolves** — not with the weaker `timestamps: false`. Both criteria were run over the eleven and agree on all eleven, so the challenge does not depend on which is used.

**Applying the inventory's own criterion across all 48 excludes eleven models it did not exclude**, beyond the four it names: `activity_logs`, `ai_usage_logs`, `metadata_storage`, `asset_labels`, `asset_roles`, `asset_usage_log`, `processing_queue`, `show_configs`, `thumbnails`, `episode_wardrobe`, `episode_wardrobe_defaults`.

**`episode_wardrobe_defaults`, `activity_logs`, `metadata_storage`, `thumbnails`, `ai_usage_logs` and `asset_usage_log` appear here and also among B1's six** — same criterion, same finding, already excluded from Axis P above. Their appearance here is not a second claim; the eleven is the same test applied to the inventory's wider population.

**On that reading the exposed set is 37, not 48**, and XK-1's cross-keystone citation of `episode_wardrobe` does not hold on the paranoid axis — it is Pattern 40b (no migration anywhere) but has `timestamps: false` and no deletion attribute.

**This is raised here and is not corrected here.** XK-1 is owned by F-Stats-1 and admitted by ratification; per the register's authority note **a self-applied entry carries no register authority**, and this document has none over another entry. **The route for amending an admitted entry is not established. Until it is, treat XK-1 as stating 48 and this banner as raising a challenge to it.**

**XK-1's admission is not threatened by the challenge.** §2.1 requires reach into two or more keystones; `character_state` (F-Stats-1) and `outfit_sets` / `outfit_set_items` (F-Ward-3) remain in the genuine set. Two survive, so admission holds and this is an amendment question, not an unwind.

### B5. Open questions, stated rather than resolved by omission

- **Scope or absorb.** Whether this document should be re-scoped to exclude Axis P as XK-1's territory, or absorb it with attribution. A register decision; XK-1 is owned by F-Stats-1.
- **Reciprocal-reference obligation.** XK-1's §4 requires that *"when F-Ward-1 or F-Ward-3 opens a plan artifact, it must reference the inventory and this entry."* This document is not a Ward artifact but touches `episode_wardrobe`. Whether the obligation attaches is a reading of the register's scope, and self-applied readings carry no authority.

**Neither is answered here. Both go to the ratifying revision.**

---

## §0. One-line

**F-App-1 removed the write paths that bypassed migrations. It did not reconcile the schema those paths had already produced. This finding is that residue, measured.**

**Of 146 Sequelize models checked against a database built by migrations alone, 28 name a column or a table that database does not have, and a further 38 have no table under any spelling.** The 28 split across **four** axes with four different remedies — **19** missing `deleted_at` under `paranoid: true`, **4** column-naming mismatches, **10** naming columns that exist in no spelling, **1** table-naming mismatch, with **6** failing more than one (§6.3.1, §6.3.2). Three are confirmed by probe to make an HTTP route return 500 unconditionally — the route Gate G3 clause 3 depended on, the route v2.49 §2.4 named as the control that would evidence an intrusion, and one of the six sites remediated at `ed3461c5`.

## §0.1 Priority — P0, and why not P1

**Ruled P0.** The grounds are not the count of broken models but the identity of one of them.

**A P0 already stands against the authentication surface.** FD-65 is OPEN: `POST /api/v1/auth/login` issues signed tokens to unauthenticated callers, and v2.53 closed only the privilege half — the issuance half remains open by name.

**`GET /api/v1/audit-logs` is the control v2.49 §2.4 named as the one that would evidence an intrusion.** It returns 500, has never returned anything else (§2.3), and on the deploy path as written it is broken in the deployed environments too (§6.4.1).

**Those two facts are worse together than either is alone.** An open issuance defect means a credential can be obtained; a dead audit route means obtaining one leaves no retrievable trace. **P1 would rank this as schema hygiene affecting several routes. It is not — it is the absence of the control that would show the standing P0 being exploited.**

Secondary, and sufficient on its own for P1 but not the reason for P0: FD-66 gates the schema baseline (§7.1), so it blocks a strategy decision rather than sitting behind one.

## §1. What is minted, and at what scope

**The finding is the class, the class is measured, and the class has a cause.** A model declares attributes or behaviour that determine the columns Sequelize names in SQL; the migrations that build its table do not supply them; nothing reconciles the two; and no test observes the result.

Two instances were investigated in depth before the population was measured — `activity_logs` (§2) and `decision_logs` (§3) — because each was independently observed breaking a route this session needed. They remain written up individually, as the worked examples and as the validation of the measurement method (§6.2). **They are no longer the finding's extent.**

**The remedy is one decision applied per table** — correct the migration to match the model, or correct the model to match the table — which is why this is one FD and not 28. See §7.

## §1.1 Where the 28 came from — the causal account

**An earlier draft of this document presented the mismatches as a standalone discovery and could not explain their origin. It has one, and it is in the register already.**

`docs/audit/F-App-1_Fix_Plan_v1.md:21` describes a schema-as-JS auto-repair block that ran in `src/app.js` on every boot where `ENABLE_DB_SYNC` was **not** set — that is, in the normal production configuration. It had two paths:

- **Path A** iterated every Sequelize model and called `model.sync()` for any table absent from `pg_tables`.
- **Path B** held five hardcoded `CREATE TABLE IF NOT EXISTS` literals for `world_events`, `character_state`, `character_state_history`, `decision_log`, `career_goals`.

**For as long as that block ran, the schema was model-shaped by construction.** A model could declare `underscored: true`, inherit `paranoid: true`, or gain a new attribute, and the boot-time repair would materialise whatever it named. **Migrations were not the source of schema truth; they were one contributor to it, and the model files were the other.**

**F-App-1 removed the block.** `grep -c "CREATE TABLE IF NOT EXISTS" src/app.js` returns **0**, and `src/app.js:95` records the intent: *"F-App-1: schema auto-repair removed. Migrations are now the single source of schema truth."* `docs/PRE_DEPLOYMENT_VERIFICATION.md:238` states the matching deployment posture: *"**ENABLE_DB_SYNC disabled**: Using migrations instead (recommended)."*

**That remediation was correct and it was incomplete.** It closed the write path. **It did not reconcile the schema the path had already produced, and it did not check whether the migrations could reproduce that schema on their own.** They cannot: 28 models name columns migrations do not create, and 38 name tables migrations do not build.

**On that reading the 28 are not 28 independent oversights but one omission with 28 visible consequences.**

**The axis distribution is consistent with that and does not establish it.** The mismatches cluster on `paranoid` (19 of 28) and `underscored` (4 of 28) — the declarations the auto-repair would have satisfied silently. **But those are also the declarations a hand-written migration must translate into DDL by hand**, and they would cluster the same way under any regime where models declare behaviour and humans write the migrations. **The 19 missing `deleted_at` are equally consistent with 19 authors forgetting a column Sequelize adds implicitly.**

**What the clustering does support, and this is all it supports:** these are the declarations most likely to drift, whatever the cause.

**The evidence that would distinguish the two accounts is commit-time ordering, and it was not gathered.** A model that gained `paranoid: true` **after** the auto-repair was removed and still has no migration is an ordinary omission; one that gained it **before** was materialised silently and then stranded when the block went. `git log -S` across the 19 would separate them. **It was not run, no proportion is claimed, and this document asserts nothing about how the 28 divide between the two.**

**None of §1.1's account depends on it.** That the block existed, materialised model declarations, was removed, and left the schema unreconciled is established from F-App-1's own documents and from the measurement — independently of what the axis distribution suggests about individual cases.

## §1.2 Relation to §12.11 / `PE #62` — same cause, different object

**`F-App-1_G1_Audit_Report.md:514` enumerates what F-App-1 declared out of its own scope**, recorded as §12.11 and carried since as the `PE #62` residue item, unowned:

- **6 Variant B sites** — inline `CREATE TABLE` SQL — covering `video_compositions`, `chapter_versions`, `ecosystem_previews`
- **11 Variant A sites** — `model.sync()` inside routes and workers — covering `StoryTaskArc`, `ContinuityTimeline`, `ContinuityCharacter`, `ContinuityBeat`, `ContinuityBeatCharacter`, `FranchiseKnowledge`, `GenerationJob`
- a `sequelize.sync()` in the model loader at `src/models/index.js:1797`, since drifted to `:1800` (§6.4.1)

**§12.11 is unremoved code. FD-66 is unreconciled schema. Same root cause, different objects.**

**The overlap is measured, not inferred, and the distinction matters.** `ContinuityTimeline`, `ContinuityCharacter`, `ContinuityBeat` and `ContinuityBeatCharacter` appear in FD-66's own **bucket 3** — models whose tables migrations never build — and `src/routes/continuityEngine.js:40-43` calls `.sync()` on exactly those four. **Both halves come from this document's own instruments**; the correspondence was not obtained by matching names against §12.11's list. `StoryTaskArc` appears in **bucket 2**, missing `deleted_at`.

**§12.11's counts are quoted, not verified by this document, and one of them disagrees with this document's own instrument.** The 6 Variant B and 11 Variant A figures above are F-App-1's enumeration, reproduced as such. **This document's grep found 6 request-path `.sync()` call sites against §12.11's 11 Variant A.** The difference is **unexplained**: it may be worker files, which this document did not search; drift since the report was written; or an error in either count. **A reader must not treat 11 as measured here — FD-66's own instrument disagrees with it, and neither number has been reconciled.**

**Recorded as owed, not performed.** Re-counting the write paths is bounded work and would firm up §1.3. **It is not load-bearing for anything this document decides**, since §1.3 makes no decision — which is why the discrepancy is recorded rather than resolved.

**Neither finding subsumes the other.** Closing §12.11 removes the paths and leaves the 28 broken. Closing FD-66 fixes the schema and leaves paths that can reproduce the drift.

## §1.3 Paired closure — flagged, not decided

**If the write paths at §12.11 remain while FD-66's schema is reconciled, the paths can recreate the divergence they caused.** A route that calls `model.sync()` at request time will materialise whatever the model then declares, against a schema a baseline has just been built to match.

**That is an argument for closing the two together, or at least for ordering them.** It is **not a decision this document makes** — `PE #62` is unowned, its ownership is a register question, and FD-66 has no authority over another finding's disposition. **Recorded so that whoever sequences the baseline knows the dependency exists.**

---

## §2. Instance A — `activity_logs`

### §2.1 The mismatch

`src/migrations/20240101000005-create-activity-logs.js:5` creates `activity_logs` with **camelCase columns**: `userId`, `actionType`, `resourceType`, `resourceId`, `oldValues`, `newValues`, `ipAddress`, `userAgent`.

`src/models/ActivityLog.js:101` declares **`underscored: true`**, so every query the model issues names `user_id`, `action_type`, `resource_type`, and so on.

**No later migration renames the columns.** `activity_logs` is named in exactly one file under `src/migrations/`.

### §2.2 Evidence — observed, both environments

`GET /api/v1/audit-logs` (`src/routes/auditLogs.js:18`, mounted at `src/app.js:892`) returns **500**:

```
Failed to fetch audit logs: Error:
  parent: error: column "user_id" does not exist
  hint: Perhaps you meant to reference the column "ActivityLog.userId".
  sql: SELECT "id", "user_id" AS "userId", … FROM "activity_logs" AS "ActivityLog" …
```

- **Observed locally**, 2026-08-18, against the local test database.
- **Observed in CI**, Validate run `32149440997`, job `95751314122` — a database built by `npm run migrate:up` alone.

### §2.3 Dating — the route has never worked

- `src/migrations/20240101000005-create-activity-logs.js` added at `ee9d3719`, **2026-01-01**.
- `underscored: true` added to `src/models/ActivityLog.js` at `9329b2b5`, **2026-01-09**.
- `src/routes/auditLogs.js` **added in that same commit `9329b2b5`**, 2026-01-09.

**The route was created in the commit that broke the mapping.** `GET /api/v1/audit-logs` has never returned 200 in its lifetime.

---

## §3. Instance B — `decision_logs`

### §3.1 The mismatch

`src/config/sequelize.js:63` sets **`paranoid: true`** as a global `define` default. `src/models/DecisionLog.js:62–68` sets `tableName`, `timestamps`, `createdAt`, `updatedAt: false`, `underscored` and `indexes` — and **does not opt out**, so the model expects a `deleted_at` column.

`src/migrations/20260208110001-create-decision-logs-table.js` creates **no `deleted_at`**. No later migration adds one; `decision_logs` is named in exactly one file under `src/migrations/`.

### §3.2 Evidence — observed locally; CI derived, not run

Authenticated `POST /api/v1/decision-logs` returns **500**:

```
POST /api/v1/decision-logs -> 500
  {"success":false,"error":"column \"deleted_at\" does not exist"}
  sql: INSERT INTO "decision_logs" (…) VALUES (…)
       RETURNING "id",…,"created_at","deleted_at";
```

- **Observed locally**, 2026-08-18. `GET /api/v1/auth/me` with the same token returned 200, so the failure is at persistence, not authentication.
- **Not observed in CI.** No test exercises this route, so no CI run has produced the result. **Derived, and labelled as derived:** the migration creates no `deleted_at`, no later migration adds one, therefore a migrations-only database lacks the column and the same INSERT fails. This half should be converted to an observation before the finding is closed.

### §3.3 Dating — the route has never worked

- Global `paranoid: true` added at `9329b2b5`, **2026-01-09**.
- `src/migrations/20260208110001-create-decision-logs-table.js` added at `7ae309f2`, **2026-02-08** — one month later.

**The table was created into a codebase where the model already required `deleted_at`.** `POST /api/v1/decision-logs` has never persisted a row.

---

## §4. The common mechanism

Both defects originate in **`9329b2b5` (2026-01-09)**, which added `underscored: true` to `ActivityLog` and `paranoid: true` to the global `define` block in the same commit. Neither change was accompanied by a migration reconciling existing or subsequent tables.

The class is: **a model-level declaration that changes the SQL Sequelize generates, landed without the migration that makes the schema satisfy it.** It is invisible to `node --check`, to `eslint`, to `scripts/validate-routes.js`, and to the test suite, and it surfaces only as a runtime 500 on a route nothing exercises.

---

## §5. What this blocks, and the corrections owed forward

### §5.1 Gate G3 clause 3 was unmeetable, and was unmeetable when specified — cleared before this document landed

> **STATE AT FILING.** **Clause 3 is met on `main` as of `19b31b1d`.** The blocker this section describes was removed by the migration at `956697c0`, authorized at v2.54 §1, and the test at `16c47a5f` passes with the before/after pair v2.54 §2 required. **Everything below is the state this finding found, and is written in the tense of that finding; it is not a present-tense claim about the gate.** Recorded here rather than left to a reader, because a clause-level claim about a gate that reads as current and is not is the exact shape of the fifth instance at v2.52 §4.1 — accurate text, inherited forward, no longer true. **The closure record belongs to v2.55; this line exists only so §5.1 cannot be read as live.**

**F-AUTH-1 Fix Plan v2.53 §4 states:** *"Executing §1 makes Gate G3 clause 3 meetable. The test at §1.1 fails today and passes after."*

**That is false.** v2.53 §1.1's assertions 1 and 2 require a persisted `user_id` on `decision_logs`. No row is ever persisted. The specified test fails **before and after** `ed3461c5`, for a reason unrelated to F-Auth-5. **Assertion 3 is different from 1 and 2 and the difference matters: it is met but unverifiable.** The behaviour it asserts already holds — an anonymous POST returns **401 `AUTH_REQUIRED`** from `requireAuth` before any database contact, so no row is persisted, and that is the right reason rather than a coincidence of the 500. **What cannot be done is verify it**, because the verification query — `DecisionLog.findOne` on the request's `entity_id` — names the same absent column and throws. **The subject holds; the instrument is broken.**

*Corrected in place before filing, 2026-08-18.* An earlier draft of this section said assertion 3 *"passes for the wrong reason: the route persists nothing for anyone."* **The demonstration at v2.54 §2 disproved that** — the pre-migration run shows the anonymous test failing at its `findOne`, after its `401` and `AUTH_REQUIRED` assertions had already passed. The correction is made in place rather than forward because this document had not landed; **additive-supersede binds documents on `main`, and the register never carried the wrong version.**

**Consequence for the migration at `956697c0`:** it made two assertions verifiable, of which only one concerned behaviour that was actually broken.

**v2.53 §1.1 was written on 2026-08-18 against a route that had not functioned since 2026-02-08, and the route was not exercised before the specification was written.** This is a specification wrong about what is practical rather than wrong about the world, and it is the register's first recorded instance of that shape.

### §5.2 v2.53 §2's characterisation of the `decisionLogs.js:22` site

v2.53 §2 corrects v1.5 §4.6 forward, holding that the site had been *"silently writing the wrong value"* since `7ae309f2`. **For this site the stronger and more accurate statement is that it was writing nothing at all** — `req.user?.sub` never reached a successful INSERT. The F-Auth-5 change at `:22`, landed at `ed3461c5`, is correct and is currently unreachable.

**What does not change:** F-Auth-5's direction, and the other five sites. Those persist through routes not known to share this defect, and none was checked for it.

### §5.3 v2.52 §1.2's middleware enumeration

Incidental to this finding and recorded so it is not lost: v2.52 §1.2 refers to *"the three middlewares"*. There are **five** `req.user = {…}` assignment sites — three in `src/middleware/auth.js` (`:235`, `:339`, `:510`) and two in `src/middleware/jwtAuth.js` (`:40`, `:92`). **The substantive claim holds** — `grep -rn "sub:" src/middleware/` returns zero, so no site sets a `sub` key — **but the enumeration is scoped to one file and is a floor.**

---

## §6. Population — measured

**The measurement was run. 146 models were checked against a database built by migrations alone. 27 declare columns that database does not have.**

### §6.1 How the first two were found, and why that mattered

**Neither of the first two instances was found by a search for this defect class.** `activity_logs` surfaced while correcting a false claim in a test comment; `decision_logs` surfaced while attempting to write the Gate G3 clause 3 test. That was a **sample of convenience, not a search** — it found exactly the two models the session happened to touch, and would have found no others no matter how many existed.

**Two was never a floor. It was the count of models examined.** This section exists because reporting it as a population would have been the v2.52 §4.1 error committed inside the document that records the rule. The measurement below replaces it.

### §6.2 Method — ground truth on both sides, not grep on either

| Side | Instrument | What it removes |
|---|---|---|
| Models | Loaded via `src/models/index.js`; read `Model.getTableName()`, `Model.rawAttributes[*].field`, `Model.options.paranoid` | Sequelize resolves the effective options, so declarations inherited from the global `define` block (`src/config/sequelize.js:56-66`), a base class, or a spread are all included. Grepping `underscored: true` would miss every one of those. |
| Schema | A scratch database built by `sequelize db:migrate` alone, read via `information_schema.columns` | No migration-file parsing. Conditional creates, inline DDL inside a migration, and later `ALTER`s are reflected exactly as they land. **210 migrations applied, 0 pending.** |

A model is **mismatched** when it names a column the migrated schema does not contain.

**Method validation.** Both independently-observed instances reproduce exactly: `ActivityLog` → missing `user_id, action_type, …`, matching the CI error at Validate run `32149440997`; `DecisionLog` → missing `deleted_at`, matching the local 500 at §3.2. The measurement was not tuned to produce them.

### §6.3 Result — three buckets

| Bucket | Count | Meaning |
|---|---:|---|
| 1 — matched and consistent | **80** | every column the model names exists |
| 2 — matched and **MISMATCHED** | **27** | model names columns the migrated schema lacks |
| 3 — no table of that name | **39** | no table matching `tableName` after all migrations |
| | **146** | models resolved (of 154 files in `src/models/`) |

**These are the first-pass figures and they sum to 146.** §6.3.2 re-files one model — `ProcessingQueue`, whose table exists under a different spelling — from bucket 3 to broken, giving the **28 / 38** used at §0 and in the closing line. Both sets are recorded rather than one silently replacing the other, so a reader reproducing the run sees 27/39 from the script and knows why the mint says 28/38.

**The core entities are clean.** `Episode` → `episodes` and `Show` → `shows` are both bucket 1 with zero missing columns. **Migrations are authoritative for the system's primary tables**, so the defect is not that `src/migrations/` is bypassed wholesale — it is that specific models drifted from it. Bucket 3's membership is peripheral: `layer_presets`, `markers`, `outfit_sets`, `script_templates`, `wardrobe_usage_history` and similar.

**Bucket 2 in full**, model → table → missing columns:

| Model | Table | Missing |
|---|---|---|
| `ActivityLog` | `activity_logs` | `user_id, action_type, resource_type, resource_id, old_values, new_values, ip_address, user_agent, deleted_at` |
| `EpisodeScript` | `episode_scripts` | 20 columns incl. `show_id, script_text, script_json, word_count, edited_by` |
| `SceneAngle` | `scene_angles` | 15 columns incl. `angle_description, camera_direction, quality_score` |
| `Thumbnail` | `thumbnails` | `publishStatus, isPrimary, publishedAt, publishedBy, unpublishedAt, platformUploadStatus, platformUrls, deletedAt` |
| `MetadataStorage` | `metadata_storage` | `episode_id, extracted_text, scenes_detected, sentiment_analysis, visual_objects, extraction_timestamp, processing_duration_seconds, deleted_at` |
| `StorytellerBook` | `storyteller_books` | `theme, pov, tone, setting, conflict, stakes` |
| `SceneSet` | `scene_sets` | `base_still_url, style_reference_url, negative_prompt, variation_count, cover_angle_id` |
| `Asset` | `assets` | `s3_url_no_bg, s3_url_enhanced, processing_status, processing_metadata` |
| `EpisodeAsset` | `episode_assets` | `usage_type, scene_number, display_order, metadata` |
| `EpisodeScene` | `episode_scenes` | `clip_status, display_title, effective_duration, deleted_at` |
| `HairLibrary` / `MakeupLibrary` | `hair_library` / `makeup_library` | `is_just_a_woman_style, deleted_at` |
| `StorytellerChapter` | `storyteller_chapters` | `sections, chapter_template` |
| `RegistryCharacter` | `registry_characters` | `world` |
| `DecisionLog` | `decision_logs` | `deleted_at` |
| `AIUsageLog`, `AssetUsageLog`, `CharacterArc`, `CharacterProfile`, `CharacterState`, `CharacterTherapyProfile`, `EditMap`, `EpisodeWardrobeDefault`, `SceneLibrary`, `StoryTaskArc`, `UniverseCharacter`, `WardrobeContentAssignment` | — | `deleted_at` only |

### §6.3.1 Three defect axes, counted separately

**A single "mismatched" count blurs three different defects with three different remedies.** Each missing column was classified by comparing against the columns the table actually has, so *"the model asks for `user_id` and the table has `userId`"* is separated from *"the model asks for `script_text` and the table has nothing resembling it"*.

| Axis | Meaning | Models |
|---|---|---:|
| **P** | `deleted_at` absent under `paranoid: true` | **19** |
| **N** | naming mismatch — a case-variant of the column exists | **4** |
| **A** | column absent entirely — no variant of any spelling | **10** |

Sums to 33 against 27 mismatched models because **6 models fail more than one axis**: `metadata_storage`, `activity_logs`, `hair_library`, `makeup_library` (P + N); `thumbnails`, `episode_scenes` (P + A).

**Declaration counts, for scale:** **110 of 146** models declare `paranoid: true`; **145 of 146** declare `underscored: true`. The axes are near-universal declarations; what varies is whether the migration honoured them.

**Axis P (19)** is one mechanical decision — add `deleted_at`, or opt the model out. Includes `decision_logs`, the Gate G3 clause 3 blocker.

**Axis N (4)** is a rename, and one member is not a plain snake/camel split: `hair_library` and `makeup_library` declare `is_just_a_woman_style` against an actual column `is_justAWoman_style`. `activity_logs` and `metadata_storage` are the straightforward cases.

**Axis A (10)** is not a mismatch to reconcile at all — **it is migrations that were never written.** `episode_scripts` (20 columns), `scene_angles` (15), `thumbnails` (8), `storyteller_books` (6), `scene_sets` (5). These models describe schema that has no migration anywhere, which is a different failure from the two worked examples and plausibly a different owner.

### §6.3.2 Bucket 3 re-examined — the table-name false negative

**Bucket 3 membership is decided by whether the table exists after all 210 migrations run, not by migration filenames.** A table created by any means — `createTable`, raw SQL, inside a conditional — exists and removes the model from bucket 3. **The residual false negative is at the other end: a model whose `tableName` does not match what the migrations actually built.** That was checked by comparing each bucket-3 table name against every table in the migrated schema, ignoring case, underscores and trailing `s`.

| Sub-bucket | Count | |
|---|---:|---|
| **3a** — table exists under a different spelling | **1** | a real mismatch, mis-filed by the first pass |
| **3b** — no table under any spelling | **38** | |

**3a, in full:** `ProcessingQueue` declares `tableName: 'processing_queue'`; the migrations build **`processing_queues`**. Every query this model issues names a relation that does not exist. **It is a 28th broken model, not a model without a migration**, and the first pass would have reported it as the latter.

**Within 3b, four tables are named in migration source but never created:** `wardrobe_library`, `layer_assets`, `continuity_beats`, `scene_set_episodes`. Those migrations `ALTER` a table they expect to already exist and skip when it does not — visible in CI as *"layer_assets table does not exist, skipping migration"*. **Something other than a migration is expected to create them.** Six request-path `.sync()` calls exist (§6.5) and `ContinuityBeat` is among the models they sync. **Whether these four are the same tables is not checked here** — see §9 on the `PE #62` overlap, which this finding names and does not resolve.

### §6.3.3 The `underscored` axis has one dissenter, and it is informative

**145 of 146 models declare `underscored: true`. The single exception is `Thumbnail`** — and `thumbnails` is correspondingly built with camelCase columns (`episodeId`, `s3Bucket`, …), so the model and its table agree on naming. Its 8 missing columns are Axis A, not Axis N: attributes with no migration at all.

**36 of 146 do not declare `paranoid: true`.** For those, an absent `deleted_at` is not a defect, which is why Axis P counts 19 and not the whole of bucket 2.

### §6.4 A third confirmed route failure, and it is one of F-Auth-5's own sites

`Thumbnail.findByPk(…)` against the migrated schema fails with **`column "publishStatus" does not exist`** — verified by probe, 2026-08-18.

`src/services/ThumbnailService.js:13` calls `findByPk` before its stubbed publish logic, so **`POST /api/v1/thumbnails/:id/publish` — site 6 of the six remediated at `ed3461c5` — also returns 500 on a migrations-built database.** The F-Auth-5 change at that site is correct and, like `decisionLogs.js:22`, currently unreachable.

**Three route failures are now confirmed by probe: `audit-logs`, `decision-logs`, `thumbnails/:id/publish`. The other 24 bucket-2 models were not probed.**

### §6.4.1 Which path builds a deployed database — narrowed from the repository

**The question that decides this finding's severity is whether a deployed database is built by migrations or by `sequelize.sync()`.** If sync runs, the model's declaration wins and these mismatches are invisible there. If migrations run, a deployed database has the same gaps the measured schema has.

**What the repository establishes:**

- **`sync()` requires `ENABLE_DB_SYNC === 'true'`** (`src/app.js:70`), and `alter` requires a second flag, `DB_SYNC_ALTER === 'true'` (`src/app.js:82`). **There is no `NODE_ENV` gate.**
- **Nothing in the repository sets either flag.** Not `.env`, `.env.production`, `.env.production.template`, `.env.example`, `ecosystem.config.js`, any workflow, or any deploy script. The only occurrences are two diagnostic scripts that print them and one migration comment.
- **Both deploy paths run migrations:** `.github/workflows/deploy-production.yml:70` and `:267`; `.github/workflows/deploy-dev.yml:123` and `:341`.

**Therefore, on the deploy path as written, a deployed database is built by migrations — the same path as the measured schema.** That makes `GET /api/v1/audit-logs` and `POST /api/v1/decision-logs` likely broken in the deployed environments in exactly the way they are broken in CI.

**A third write path, gated by neither flag — correction made in place before filing.** An earlier draft of this section reasoned only about `src/app.js:70`'s boot-time sync and concluded that sync is opt-in via `ENABLE_DB_SYNC` and `DB_SYNC_ALTER`. **That reasoning is incomplete.**

`src/models/index.js:1791-1806` exports a `sync` **method** whose defaults are:

```js
alter: process.env.NODE_ENV === 'development',
force: false,
```

**It is not reached at import and not reached at boot** — verified: it is a method definition, and its only caller in the repository is `scripts/reset-database.js:28`, immediately after `db.drop()`. **But when invoked it consults neither `ENABLE_DB_SYNC` nor `DB_SYNC_ALTER`, and enables `alter` from `NODE_ENV` alone.**

**The consequence for this finding is direct and it is not small.** `reset-database.js` drops every table and recreates the schema **from the models**. A database built that way has, by construction, exactly the columns the models declare — **so none of the 28 mismatches in §6.3 would be present on it.** Whether a given database exhibits this finding therefore depends on which of *three* paths built it, not two: migrations, boot-time sync, or a model-driven rebuild.

**F-App-1's own audit flagged this call site** — `F-App-1_G1_Audit_Report.md:514` lists *"a suspicious `sequelize.sync()` call inside the model loader (`src/models/index.js:1797`)"* among §12.11's findings, declared out of F-App-1 scope. **The line has since drifted to `:1800`; the call is the same one.**

**What the repository also establishes, and it cuts the other way:** **sync has been used historically.** `scripts/fix-missing-tables.js:3` describes itself as fixing *"missing tables after DB_SYNC_FORCE incident"*, and `src/migrations/20260323100000-add-scene-sets-generation-status.js:7` records a column that *"was never added via migration — only present when ENABLE_DB_SYNC + alter"*. **Some database has been shaped by sync at some point.** A deployed schema may therefore carry columns the migrations never created.

**What remains unestablished, and is not repository-answerable:** the actual column state of any deployed database. Prod is FROZEN and no host was contacted. **This section narrows the question from "which provisioning system" to "migrations by the deploy path, with evidenced historical sync of unknown extent" — it does not close it.** Closing it is an infrastructure read and is owed.

### §6.5 What this measurement cannot see

Stated per v2.51 §4.1, because the number above will otherwise become the next "36 gates":

- **It describes a migrations-only database, not any real one.** Deployed databases may carry columns added by `sequelize.sync()` — `src/app.js:87` under `ENABLE_DB_SYNC`, and **six request-path `.sync()` calls** at `src/routes/continuityEngine.js:40-43`, `src/routes/franchiseBrainRoutes.js:66`, and `src/routes/memories/engine.js:2434,3183,3470`. **Whether dev or prod match this schema is unmeasured; no deployed host was contacted.**
- **Bucket 2 counts models, not broken routes.** A missing column breaks any query naming it, and for `paranoid` models that is every query — but only three were confirmed against an actual route. The other 24 are unprobed.
- **Bucket 3 is not classified.** 39 models have no migration-created table. Some are created at runtime by the `.sync()` calls above — a different disposition that overlaps the `PE #62` residue item — and some may be unused. **This finding does not sort them, and does not claim they are defects.**
- **146 of 154 model files resolved.** Models not exported by `src/models/index.js` are invisible to this method. `RawFootage` was stubbed at load time and may be misrepresented.
- **Extra columns are not flagged.** Only columns the model names and the schema lacks. A table with columns no model declares would read as consistent.

---

## §7. Remedy — not authorized, not performed

**The remedy is per-table and the choice is real, not a formality.** For the two worked examples:

| Table | Option A — correct the schema | Option B — correct the model |
|---|---|---|
| `activity_logs` | migration renaming eight columns to snake_case | remove `underscored: true` from `ActivityLog` |
| `decision_logs` | migration adding `deleted_at` | set `paranoid: false` on `DecisionLog` |

**The same choice exists for the other 25**, and the three sub-shapes at §6.3 do not all take the same answer. The 14 `deleted_at`-only models are a single mechanical decision. The camelCase/snake_case case is a rename. The *model-newer-than-migration* group (`EpisodeScript` missing 20 columns, `SceneAngle` 15, `Thumbnail` 8) is not a mismatch to reconcile but **migrations that were never written**, and may indicate features shipped in models without their schema.

**Option A is more consistent with stated project convention** — `CLAUDE.md` records global paranoid mode and requires `deleted_at` in migrations — **and Option A is the more dangerous**, because renames and column adds touch tables that may hold rows on databases this finding has not inspected. **No database beyond the local test instance and the scratch instance was examined; row counts and column contents anywhere else are unmeasured.**

**Sequencing note.** Remediating all 27 is a program, not a change. Gate G3 clause 3 needs only `decision_logs`, and that is the smallest of the three sub-shapes — one added column. **Authorizing that one table's migration would unblock the clause 3 test without waiting on the rest**, and is the narrowest thing that moves the gate.

**Nothing here is authorized and nothing has been changed.** A revision must authorize any migration before it is written.

### §7.1 Direction ruled in session — migrations as the single source of schema truth

**Recorded as a ruling given in the course of this work. It is not an authorization and this document cannot make it one.**

**Correction to an earlier draft of this section, made in place before filing:** it stated the direction had *"no written basis in the register."* **That was wrong, and the basis is stronger than a ruling.**

- **`docs/audit/F-App-1_Fix_Plan_v1.md`** records the schema-as-JS auto-repair block in `src/app.js` — Path A calling `model.sync()` for any absent table, and Path B's **five hardcoded `CREATE TABLE IF NOT EXISTS` literals** for `world_events`, `character_state`, `character_state_history`, `decision_log`, `career_goals`. **F-App-1 removed it.** `grep -c "CREATE TABLE IF NOT EXISTS" src/app.js` returns **0**, and `src/app.js:95` carries the result: *"F-App-1: schema auto-repair removed. Migrations are now the single source of schema truth."*
- **`docs/PRE_DEPLOYMENT_VERIFICATION.md:238`** states the deployment posture directly: *"**ENABLE_DB_SYNC disabled**: Using migrations instead (recommended)."*

**So migrations-only is prior policy, already executed once.** What is new here is not the direction but the discovery that **the schema does not currently satisfy it** — 28 models name columns the migrations do not create. F-App-1 closed the write path that bypassed migrations; **it did not reconcile the schema that path had already produced.** That is FD-66.

**The remaining ruling, and it is narrower than the earlier draft claimed:** that reconciliation proceeds by correcting migrations rather than by re-enabling sync, and that a baseline is required before the sync code path's disposition is decided.

The direction is **migrations only**. The stated grounds: `sync({ alter: true })` ships a schema change as a side effect of editing a model file — no separate artifact, no review gate, no down path, and the ability to drop columns when a model narrows. **In a repository whose premise is that every change is authorized, shipped and closed against a register, a schema that cannot be reconstructed from version control is the one artifact with no provenance.**

**The sequence, and the order matters because the first step gates the rest:**

1. **Establish what a deployed schema actually is.** Prod is FROZEN; this is the infrastructure read already owed at §6.4.1 and is not repository-answerable.
2. **Generate a baseline migration reproducing it exactly.**
3. **Verify equivalence** — dump both schemas and diff.
4. **Decide the disposition of the sync code path.** Note this is not "disable sync": `ENABLE_DB_SYNC` is set nowhere in the repository (§6.4.1), so the path is already unreachable as configured. The open item is whether to delete it, which is a code change requiring authorization.

**Steps 2–3 are where this finding's 28 broken models and 38 no-table models get resolved**, because a baseline has to account for every one of them. **That makes FD-66 a precondition of the baseline, not an independent cleanup.**

### §7.1.1 Sequencing ruled — `decision_logs` first, as the pilot

**Ruled: the `decision_logs` migration goes first, ahead of the baseline and ahead of the infrastructure read.** It is one added column — the smallest item in Axis P — and it unblocks Gate G3 clause 3, which is blocked on nothing else.

**The grounds are not expedience.** It is the **first schema change under the migrations-only ruling**, so it exercises authorize → ship → close on a *migration* rather than a code edit, and produces a worked example of that cycle before the baseline has to produce one accounting for 66 models. **If the discipline is wrong somewhere, one column is a cheaper place to discover it than a baseline.**

**Order relative to the owed infrastructure read (§6.4.1):** the read stays the highest-leverage owed item, and steps 2–4 above wait on it. But it is blocked on a frozen environment and a deliberate window, whereas this is blocked only on an authorization. **They are not competing; one is gated on access and the other is not.**

**Still requires authorizing.** This document does not authorize the migration. It records that the sequencing question has been ruled.

**Caveat on the ruling's basis.** It was given against a report of the sync call site and deploy path rather than a first-hand reading of them, and the reporting party flagged that. The underlying facts have since been verified and are cited at §6.4.1 — the ruling's grounds hold, but **a ratifying revision should restate them from the citations rather than inherit them from here**, which is the v2.47 §4.1 failure this register has already recorded five times.

---

## §8. Provenance

**This finding was produced by the correction of an error, not by a search for defects.**

A comment shipped at `4573d253` claimed no migration creates `activity_logs`. The claim was wrong: the search ran against `migrations/` at the repository root, while `.sequelizerc` points `migrations-path` at `./src/migrations/`. **The repository has two migration directories and only `src/migrations/` is read by Sequelize.** Correcting that at `b321cb74` established the real mechanism for `activity_logs`; applying the corrected search path to `decision_logs`, while attempting to write the Gate G3 clause 3 test, produced Instance B.

**Neither instance was found by a check the system runs.** Both were found by re-reading a claim that had already been made.

### §8.1 Sourcing rule applied to this document

**Every factual claim in this finding is traced to an observation made during the session that produced it** — a file read, a command run, a CI log, or a git query — and claims that could not be so traced were cut rather than softened. Where a claim is reasoned from the repository rather than observed, it is labelled as derived at the point it is made (§3.2 is the only such claim).

**This rule exists because it was needed.** During this session, summaries of the work — including a commit SHA and a test result — were asserted and turned out to have no referent. Structural reasoning survived that; factual assertion did not. **A mint is the wrong place to discover the difference**, so the separation is made explicit here: this document's framing may be argued with, and its facts should be re-derivable from the citations without trusting any summary, including its own §0.

---

## §9. What this finding does not establish

- **It establishes the population against a migrations-only database and against nothing else.** 27 of 146 models mismatch that schema (§6.3). Whether any deployed database matches that schema is **unmeasured** — `sequelize.sync()` at `src/app.js:87` and six request-path `.sync()` calls may have added columns there (§6.5).
- **It does not establish 27 broken routes.** Three were probed (§6.4). The other 24 are models with missing columns and no route observation.
- **It classifies bucket 3 only by name, not by disposition.** Of 39, one (`ProcessingQueue`) is a table-name mismatch and is a defect (§6.3.2); 38 have no table under any spelling, and **this finding does not sort them.** Four are named in migration source but created elsewhere; six request-path `.sync()` calls exist and could account for some. **The rest may be unused, may be dead, or may be broken — not established, and not claimed as defects.**
- **It does not establish which of three paths built any given database.** Migrations, boot-time sync (`src/app.js:70`, double-gated), or a model-driven rebuild (`scripts/reset-database.js` → `src/models/index.js:1791`, gated by neither flag). **A database built by the third would exhibit none of the 28 mismatches**, because sync creates columns from the models. The infrastructure read owed at §6.4.1 must therefore establish provenance, not merely current columns.
- **It names the `PE #62` overlap and does not reconcile it.** `PE #62` is recorded as F-App-1 residue, filed and unowned (v2.43, v2.45). **This finding did not read what `PE #62` documents and makes no claim about its contents** — only that runtime-created tables are territory the two items may share. Reconciling them is separate work against an unowned item.
- **It does not establish CI behaviour for `decision_logs`.** §3.2 is observed locally and derived for CI.
- **It does not establish the state of any deployed database.** No deployed host was contacted; prod is FROZEN. Whether `activity_logs` or `decision_logs` on dev or prod match their migrations is unmeasured.
- **It does not establish that the two instances share a cause beyond `9329b2b5`.** Both trace to that commit; whether any process failure explains it is not investigated here.
- **It mints no XK.** The defect class spans beyond F-AUTH-1's artifact, which may make it cross-keystone-shaped; XK admission requires a ratifying revision and is not claimed here.
- **It changes no gate and discharges nothing.** Gate G3 remains NOT DISCHARGED, clause 3 unmet. FD-65 remains OPEN and P0 and is untouched by this finding.

---

## §10. Vehicle — ruled, with one residual

**Ruled: FD-66 is minted in its own revision and is NOT folded into the F-Auth-5 closure.** The grounds: the closure revision's job is reporting what `ed3461c5` did against v2.53 §1. Bundling a P0 with a different remedy, which additionally gates a strategy decision, into a report about six line edits would make that document the register's largest and bury the P0 inside it.

**This document is that vehicle**, on the `F-Deploy-1_Finding_*_DRAFT` precedent of standalone findings filed in `docs/audit/`.

**Residual, not settled.** FD-65 was minted inside a *versioned* Fix Plan revision (v2.49). Whether a standalone finding document is itself sufficient to mint, or whether a versioned revision must ratify it and this document is the evidence that revision cites, is a register convention this document cannot decide. **It is filed as DRAFT for that reason, and the numeral FD-66 should be treated as claimed-not-confirmed until a ratifying instrument says otherwise.**

---

*Type: Finding. **Mints FD-66, P0 (ruled, §0.1)**. FD tail: **FD-65 → FD-66**. XK tail unchanged at **XK-3**. **Population measured: 28 of 146 models broken against a migrations-only schema — 19 on the `paranoid`/`deleted_at` axis, 4 on column naming, 10 on columns absent in every spelling, 1 on table naming, 6 on more than one axis. 38 further models have no table under any spelling and are not classified. 3 route failures confirmed by probe; 25 broken models unprobed.** Ships no code. Changes no gate. Authorizes nothing. Local test and scratch databases contacted; scratch created and dropped three times, removal confirmed each time; no request issued to any deployed host. Prod FROZEN.*
