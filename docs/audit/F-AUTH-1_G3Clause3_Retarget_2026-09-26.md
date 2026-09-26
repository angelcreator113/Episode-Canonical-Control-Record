| **PRIME STUDIOS** **F-AUTH-1 — GATE G3 CLAUSE 3 — EVIDENCE RETARGETED; WRITE-ATTRIBUTION FINDING** *Clause 3 was not discharged on weak evidence; it was discharged on a write-attribution path that does not exist anywhere. Mints nothing. Does not re-make or unwind the v2.55 §3 discharge ruling.* |
| --- |

**Document version**

v1.0: records Evoni's rulings on issue #1942, clause 3. A new document,
because every document it corrects is merged and immutable. It edits
none of them. It cites them and records what has changed underneath
them.

**Basis:** `origin/main` at `2b2584fbd61b9214fd9c32918724933096c9b2e6`,
2026-09-26 (`git rev-parse origin/main`; `git log -1 --format='%ad'
--date=iso-strict origin/main` → `2026-09-25T20:52:17-04:00`). All
`file:line` citations below are at this SHA unless marked otherwise.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.
**Rulings by Evoni** (issue #1942 and the coordinating session, 2026-09-26),
quoted verbatim at §2. Standing: RULED as quoted; how they reached this
session is ATTESTED (relayed verbatim by the coordinating session; the
first is also posted on issue #1942 as comment 5841887622).

**Status**

**Amendment. Records one substitution and one finding, on Evoni's word.**
The substitution is that F-AUTH-1 Gate G3 clause 3's evidence moves from
the retired plural `decision_logs` write to the browse-pool `decision_log`
write. The finding is stated in §1 and given first because Evoni ruled
that it matters more than the substitution. **Mints nothing. Rules nothing
of its own.** Does not re-make, unwind or re-open v2.55 §3's discharge
ruling or v2.57 §2's disposition of it. Whether either still stands on
the new evidence is Evoni's decision and is not taken here.

---

# §1. The finding — no write-attribution path existed

> *"Clause 3 wasn't discharged on weak evidence, it was discharged on a
> write-attribution path that doesn't exist anywhere."* (Evoni, 2026-09-26)

v1.5 §6.1's G3 row (`F-AUTH-1_Fix_Plan_v1.5.md:408`) requires *"F-Auth-5
has its specific test (decisionLogs write persists matching `user_id`)"*.
v2.55 §3 recorded the clause MET on `956697c0` + `16c47a5f`, and v2.57 §2.1
carried it MET.

**The clause asks that a write in production attribute the signed-in user.
At this basis no code path does that.** Every candidate path was traced
from route to service to INSERT. Each one discards the id, substitutes a
fallback, writes nothing, or writes to a table production does not have.

| # | Candidate path | What happens to `req.user.id` (MEASURED at basis) | Table in production? (09-17 canon capture) |
|---|---|---|---|
| 1 | F-Auth-5 site — `src/routes/decisionLogs.js:21` (`user_id: req.user?.id`; v1.5 cites `:22`, pre-fix) → `DecisionLog.create` | Passed through. | **`decision_logs`: no** (0 rows in the capture; `docs/MIGRATION_DRIFT_READ.md` §2: *"never created"*). The route returned 500 in production (`PROJECT_CONTEXT.md`, FD-66). |
| 2 | F-Auth-5 site — `src/controllers/cursorPathController.js:22` → `cursorPathGeneratorService.savePaths(…, _userId)` (`src/services/cursorPathGeneratorService.js:204`) | **Discarded.** The parameter is unused and the INSERT has no user column. | `cursor_actions`: no |
| 3 | F-Auth-5 site — `src/controllers/iconCueController.js:22` → `iconCueGeneratorService.saveCues(…, _userId)` (`src/services/iconCueGeneratorService.js:459`) | **Discarded.** | `icon_cues`: no |
| 4 | F-Auth-5 site — `src/controllers/musicCueController.js:20` → `musicCueGeneratorService.saveCues(…, _userId)` (`src/services/musicCueGeneratorService.js:371`) | **Discarded.** The INSERT has no user column. | `music_cues`: no |
| 5 | F-Auth-5 site — `src/controllers/productionPackageController.js:22` → `productionPackageService.savePackageRecord` | Written to `generated_by` as **`userId \|\| 'system'`** (`src/services/productionPackageService.js:563`), a masking fallback. | **`production_packages`: no.** No live migration in `src/migrations/` creates it either. |
| 6 | F-Auth-5 site — `src/routes/thumbnails.js:81` (`POST /:id/publish`) → `ThumbnailService.publishThumbnail(id, userId)` | **Nothing written.** A stub that returns a mock (`src/services/ThumbnailService.js:18`: *"Return mock response for now"*). | `thumbnails`: yes, but it has no user column. |
| 7 | `decision_log` (singular) — `POST /api/v1/world/:showId/browse-pool` (`src/routes/world.js:162`, requireAuth) → `logBrowsePoolGenerated` (`src/utils/decisionLogger.js:233`) → `INSERT INTO decision_log` (`:148`) | **Never passed.** `logBrowsePoolGenerated` takes no `user_id`, and `log()` defaults it to `null` (`:89`). Every row stores NULL. The only caller is `world.js:253`. | **`decision_log`: yes** (`user_id` uuid, capture line 486) |
| 8 | `user_decisions` — `POST /api/v1/decisions` (`src/routes/decisions.js:13`) → `UserDecision.create` | Written as **`created_by: req.user?.id \|\| 'system'`** (`:49`), a masking fallback. | `user_decisions`: no |
| 9 | `activity_logs`, via `logger.logAction` (`src/middleware/auditLog.js:167`), the `auditLog` middleware (`:143–144`, `\|\| 'anonymous'`, not mounted: `src/app.js` imports only `captureResponseData`), `AuditLogger.log` (`src/services/AuditLogger.js:33`, `\|\| 'unknown'`) and `ActivityService.logActivity` (`src/services/ActivityService.js:29`, in-memory only) | **Never persisted.** `logAction` and the middleware pass one object to the positional `ActivityLog.logActivity(userId, actionType, …)` (`src/models/ActivityLog.js:130`), which fails validation on every call. The error is caught and logged. `AuditLogger` masks. The model's underscored columns (`action_type`, `old_values`, `ip_address`, `timestamp`, …) are not production's columns. **Filed separately as #1948; not fixed here.** | `activity_logs`: yes (`user_id` varchar, capture line 10), but it does not have the model's shape |

Evoni's ruling (§2.3) calls this *"all seven candidate paths"* and lists
*"the six F-Auth-5 sites, decision_log, user_decisions and activity_logs"*.
That list enumerates to nine rows, and the table carries all nine. The
count in the quote is left as she said it.

The instruments (MEASURED, output as run at this basis):

```
$ F=docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
$ for t in decision_logs decision_log user_decisions activity_logs cursor_actions icon_cues music_cues production_packages thumbnails; do printf "%s: " $t; grep -c "^ $t  *|" $F; done
decision_logs: 0
decision_log: 11
user_decisions: 0
activity_logs: 7
cursor_actions: 0
icon_cues: 0
music_cues: 0
production_packages: 0
thumbnails: 19

$ grep -rln -E "cursor_actions|icon_cues|music_cues|production_packages" src/migrations migrations
migrations/20260209060127-icon-cue-timeline-system.js      # a dead tree; nothing under src/migrations/

$ grep -rnE "req\.user\??\.sub" src/
(no output)
```

The row-9 validation failure was reproduced offline against the real
model file, with no database (the model was built on an unconnected
Sequelize and `create` was replaced by `build().validate()`):

```
fields: id,user_id,action_type,resource_type,resource_id,old_values,new_values,ip_address,user_agent,timestamp
VALIDATION: userId: userId cannot be an array or an object; actionType: ActivityLog.actionType cannot be null; resourceType: ActivityLog.resourceType cannot be null; resourceId: ActivityLog.resourceId cannot be null
```

**Why the old test was green.** `tests/integration/f-auth-1-g3-clause3.test.js`
(`16c47a5f`) ran against CI's database, which `npm run migrate:up` builds
from `src/migrations/`. There `20260208110001-create-decision-logs-table.js`
and `20260818000000-add-deleted-at-to-decision-logs.js` both run.
Production never had `decision_logs`: `scripts/bootstrap-sequelize-meta.js`
recorded the create migration in SequelizeMeta without running it
(`docs/MIGRATION_DRIFT_READ.md` §2), and the 09-17 canon capture has no
such table. **The test proved the write in a schema that only CI had. G3
clause 3's evidence was never exercised against production.** The other
eight paths could not have supplied it either, for the reasons in the
table.

**The v1.5 steps that could never have passed in production** (cited, not
edited):

- §4.6 *F-Auth-5 — verification*, step 1 (`v1.5:308`): *"Authenticated
  POST to a `/decision-logs` route succeeds…"*. The route 500'd in
  production, and as of this change it is removed.
- §4.6 step 2 (`v1.5:309`): *"Authenticated POST to `/thumbnails/:id/publish`
  succeeds and persists user_id (not "system")"*. The handler is a stub
  that persists nothing (row 6).
- §6.1 G5 row (`v1.5:410`): *"write to a `/decision-logs` route (F-Auth-5
  path)"*. The route is now removed.
- §7.6 checklist (`v1.5:495`): *"Authenticated POST to `/decision-logs`
  persists `user_id`…"*. Same.

**This note does not rule on G5 or on the §7.6 checklist.** It records
that those steps point at a route that never worked in production and no
longer exists. What replaces them is Evoni's decision.

# §2. Evoni's rulings, verbatim, in order

**§2.1 — 2026-09-26, option (a)** (issue #1942, comment 5841887622):

> Evoni's ruling on #1942: option (a). Move the clause-3 check to one of
> the five other F-Auth-5 sites, asserting a write persists the matching
> user_id. The amendment should record both the substitution and the
> reason: the existing test only ever passed in CI because production
> never had decision_logs, so the clause's evidence was never exercised
> against production. The new site is stronger evidence, not a weaker
> substitute.

Not executable as ruled: none of the five persists a user id to a
production table (§1 rows 2–6). Reported back without implementing.

**§2.2 — 2026-09-26, option (a′):**

> (a′). And your finding is the more important thing here: none of the
> five F-Auth-5 sites writes a user id to a table that exists in
> production. Four ignore it entirely, one writes to a table that isn't
> there, and the thumbnail one is a stub returning a mock. So the gap
> isn't decision-logs — it's the whole clause. Move the evidence to
> decision_log or activity_logs, check which actually persists the mapped
> id rather than falling back to 'system', and say all of this in the
> amendment. A clause discharged on five sites that couldn't have been
> tested is worth recording as found.

Not executable as ruled: neither table had a writer persisting the mapped
id without a fallback (§1 rows 7–9). Reported back without implementing.

**§2.3 — 2026-09-26, option 1:**

> Evoni's rulings: #1942 clause 3, option 1 — pass user_id: req.user.id
> with no fallback from the browse-pool route through
> logBrowsePoolGenerated into decision_log, and test by reading the table,
> since the buffered .catch means a failed write still returns 200. The
> amendment records the full finding: across all seven candidate paths —
> the six F-Auth-5 sites, decision_log, user_decisions and activity_logs —
> no code stores the signed-in user's id in a table that exists in
> production, so clause 3's evidence was never exercised anywhere.

> Clause 3 wasn't discharged on weak evidence, it was discharged on a
> write-attribution path that doesn't exist anywhere.

The earlier ruling on the surface itself, (b) for `decision_logs`, is
quoted on issue #1942's body and is not restated here.

# §3. The substitution

| | Old evidence | New evidence |
|---|---|---|
| Write | `POST /api/v1/decision-logs` → `src/routes/decisionLogs.js:21` `DecisionLog.create({ user_id: req.user?.id })` | `POST /api/v1/world/:showId/browse-pool` (`src/routes/world.js:162`) → `logBrowsePoolGenerated` call (`world.js:253`), which now passes `user_id: req.user.id` with no fallback → `src/utils/decisionLogger.js:233` → `INSERT INTO decision_log` (`:148`) |
| Table | `decision_logs`, absent from production | `decision_log`, present in production (`user_id` uuid, nullable); created by the live migration `src/migrations/20260219000001-decision-log-browse-pool.js` (`user_id: { type: Sequelize.UUID, allowNull: true }`), so CI builds it |
| Test | `tests/integration/f-auth-1-g3-clause3.test.js` at basis | same file, retargeted; **filename kept** because v2.59 §2.1 and five other register documents cite it by name |

The attribution change is the code change Evoni ruled. Before it, the new
path stored NULL (§1 row 7). The retargeted test and a new unit test,
`tests/unit/utils/decisionLogger.userId.test.js`, both fail on the basis
code and pass after the change. The evidence for that, and the test run
itself, are in the PR that carries this note, not here. A register
document records what was ruled and found, and the PR's CI run is the
evidence of record.

**What the retargeted test asserts** (the three assertions of v2.53 §1.1 /
v2.54 §2.1, unchanged in substance):

1. The persisted `decision_log.user_id` is non-null, not `'undefined'`,
   and not empty.
2. It equals `req.user.id` as the middleware maps it, read from
   `GET /api/v1/auth/me`. The v2.54 §2.1 coupling note carries over
   unchanged.
3. An anonymous POST returns 401 `AUTH_REQUIRED` and persists no row for
   its own freshly created show.

It reads the table, not the response. The route awaits the write, but
`DecisionLogger.log` catches a failed write and buffers it on a
per-request instance that is then discarded, so a failed write still
returns 200 (Evoni, §2.3).

**What it still does not prove.** It runs against CI's migrated schema,
like its predecessor. What makes it stronger evidence is that its table
exists in production. **It has not been exercised against production.**
That would be a live write by Evoni, and no agent session performs one.

**Retired alongside it** (ruling (b), issue #1942): the
`/api/v1/decision-logs` mount (`src/app.js:917–918`),
`src/routes/decisionLogs.js`, `src/models/DecisionLog.js` and its
registration in `src/models/index.js`, and the CP12 shape-lock
`tests/unit/routes/cp12-decisionLogs-tier.test.js`, whose subject file no
longer exists. `decision_log`, `20260219000001-decision-log-browse-pool.js`,
`/api/v1/decisions` and `scripts/bootstrap-sequelize-meta.js` are
untouched. The two pending migrations are handled by PR #1945.

# §4. Documents whose clause-3 evidence this supersedes (cited, not edited)

Each of these rests clause 3 on the plural `decisionLogs` / `decision_logs`
write or on the old test. **For evidence only, they are superseded by this
note.** Nothing else in them is touched, and no ruling in them is unwound.

- `F-AUTH-1_Fix_Plan_v2.52.md` §1: withholds the discharge; clause 3
  *"NOT MET, AND PRESENTLY UNMEETABLE"*.
- `F-AUTH-1_Fix_Plan_v2.53.md` §1.1: specifies the clause-3 test against
  `decisionLogs`.
- `F-AUTH-1_Fix_Plan_v2.54.md` §2.1: restates it, and authorizes the
  `decision_logs.deleted_at` migration.
- `F-AUTH-1_Fix_Plan_v2.55.md` §3: *"clause 3 closed, gate DISCHARGED"*,
  on `956697c0` + `16c47a5f`.
- `F-AUTH-1_Fix_Plan_v2.57.md` §2.1: carries *"v1.5 clause 3 — F-Auth-5
  `decision_logs` test — MET"*.
- `F-AUTH-1_Fix_Plan_v2.59.md` §2.1: lists the test as *"for persisted
  `decision_logs.user_id`"*.

**Banner.** `/audit-file` rule 2 allows an additive, dated, newest-first
banner on a corrected file, which *"may point; it may not carry"*. The
natural target is `F-AUTH-1_Fix_Plan_v2.55.md`, the discharge record. This
filing adds none. Whether a pointer banner goes on v2.55, and on which
other files, is left to Evoni so that this change stays one new file.

# §5. Owed, recorded not taken

- **Evoni:** whether v2.55 §3's discharge (as narrowed by v2.57 §2) stands
  on the retargeted evidence; what replaces v1.5 §4.6 verification steps
  1–2, the §6.1 G5 `/decision-logs` step and the §7.6 checklist item; and
  whether to add the v2.55 pointer banner.
- **#1948:** `activity_logs` write path (§1 row 9).
- **Other `DecisionLogger` methods** (`logTierOverride`,
  `logEvaluationAccepted`, and the rest) still take no `user_id`. They
  could carry it later. They are unchanged here, and no route calls them
  at this basis.

---

*Type: amendment and finding note. Records Evoni's rulings (§2) and one
substitution (§3). Rules nothing of its own. Mints nothing: no FD, XK or
PE number, and no Fix Plan version. No host, AWS, database or Cognito
contact by the filing session, other than a throwaway local Postgres
cluster on the session's own container for the test run. Production's
freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still
never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Filing date: 2026-09-26. Basis: `origin/main` at
`2b2584fbd61b9214fd9c32918724933096c9b2e6`. Task: #1942.*
