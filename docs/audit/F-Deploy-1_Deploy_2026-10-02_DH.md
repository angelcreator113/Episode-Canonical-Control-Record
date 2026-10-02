| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DH, 2026-10-02, backend and frontend. One commit, 16 files, from `93362409` (where DG left production) to `8ab9f8bd`: L(b), the Event Venue Look (#2475), with one migration; no package change; one plain restart. `scripts/deploy-prod.sh` stopped on the pending migration as designed, and Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. CFO 89/100 with 4 warnings, unchanged from DG. The app check has not been done yet. The restart count is continuous from DG (63 → 64).* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-02_DG.md`, whose deploy this one
follows. It edits no filed document.

Basis: the commit Deploy DH moved production to,
`8ab9f8bd417d968a2fd83d0def4c77bff66c6a1c` (#2475), read 2026-10-02 from
`origin/main` at `41ca135c` (§7).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, as she gave it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email address, password, hostname, IP address, key
path, account number, database user or ARN. The database user the
migration ran as is left out, as in the CW–DG records.

**The letter.** This deploy is lettered **DH**, the letter after DG, as
Evoni named it ("deploy record DH"). It follows DG
(`F-Deploy-1_Deploy_2026-10-02_DG.md`, filed in #2477).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-02, about
06:25–06:31 UTC, per `DEVELOPMENT_WORKFLOW.md` §7.1:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `93362409` (where DG left production), fetched 1 commit to `8ab9f8bd`
   (#2475, L(b)). The script **stopped at step 3** on
   `20261002110000-add-world-events-venue-look`. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The package diff was empty.
   - `git merge --ff-only` to `8ab9f8bd`: 16 files.
   - `check-pending-migrations` against the canon instance: **1 pending
     of 248**, exit 1.
3. **Migrate.** `db:migrate` as a database user (name left out). Its
   password was entered at a hidden prompt and unset afterwards. Exit 0.
   - `20261002110000` migrated, 0.023 s.
   - Re-check: **0 pending of 248**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 38.88 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 64, online.
   - Ready at 06:30:17.
   - `/health` at 2026-10-02T06:30:31Z: healthy, database connected,
     uptime 20.1 s.
5. **CFO.** 06:30:25–06:30:29: **89/100**, 0 critical, **4 warnings**.

**App check: not checked yet** (Evoni). Nothing in this record says the
deployed features work or fail in production.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse 93362409 8ab9f8bd
93362409481b683a376c944deee41337e2bc1111
8ab9f8bd417d968a2fd83d0def4c77bff66c6a1c
$ git merge-base --is-ancestor 93362409 8ab9f8bd && echo "ancestor: yes"
ancestor: yes
```

DG left production at `93362409` with restart count 63 (DG record §0).
DH starts at `93362409`, and its one restart brings the count to 64
(ATTESTED, §0). **No gap:** no deploy ran between DG and DH that this
account does not show.

## §2. The range — MEASURED

```
$ git rev-list --count 93362409..8ab9f8bd
1
$ git log --oneline 93362409..8ab9f8bd
8ab9f8bd4 feat(events): the Event Venue Look and its brief lines, L(b) [skip-automerge] (#2475)
$ git diff --shortstat 93362409 8ab9f8bd
 16 files changed, 1230 insertions(+), 20 deletions(-)
$ git diff --name-only 93362409 8ab9f8bd -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only 93362409 8ab9f8bd -- src/migrations/
src/migrations/20261002110000-add-world-events-venue-look.js
$ git diff --name-only 93362409 8ab9f8bd -- frontend/
frontend/src/components/EpisodeLocationsStep.css
frontend/src/components/EpisodeLocationsStep.jsx
frontend/src/components/EventPackage/EventVenueLook.jsx
frontend/src/components/EventPackage/EventVenueLook.test.jsx
frontend/src/components/SceneBriefConfirm.jsx
frontend/src/pages/EventPackagePage.css
frontend/src/pages/EventPackagePage.jsx
frontend/src/pages/EventPackagePage.startEpisode.test.jsx
$ git diff --name-only 93362409 8ab9f8bd -- src/
src/migrations/20261002110000-add-world-events-venue-look.js
src/models/WorldEvent.js
src/routes/worldEvents.js
src/services/sceneBriefService.js
src/services/venueLookService.js
$ git diff --name-only 93362409 8ab9f8bd -- . ':!frontend' ':!src'
tests/integration/venueLook.integration.test.js
tests/unit/routes/world-cluster-tier-promotion.test.js
tests/unit/services/sceneBriefService.venueLook.test.js
```

This agrees with Evoni's account:
- 1 commit, #2475;
- 16 files (8 frontend, 5 backend including the migration, 3 tests);
- exactly the one migration the script and the check named;
- no package or lock file, so no `npm ci` was needed.

## §3. The time

**ATTESTED.** About 06:25–06:31 UTC; ready at 06:30:17, CFO 06:30:25 to
06:30:29, `/health` at 06:30:31Z.

**MEASURED.** The range's one commit, #2475, is at 06:25:26 UTC:

```
$ git log --first-parent --format="%h %cI" 93362409..8ab9f8bd
8ab9f8bd4 2026-10-02T02:25:26-04:00
```

**INFERRED.** The script's fetch reached `8ab9f8bd`, so it ran at or after
06:25:26. That fits Evoni's window, and her ready line at 06:30:17.

## §4. Migrations

**MEASURED.** The tree holds 248 migration files, one more than at DG:

```
$ git ls-tree -r --name-only 93362409 src/migrations | grep -c '\.js$'
247
$ git ls-tree -r --name-only 8ab9f8bd src/migrations | grep -c '\.js$'
248
```

**ATTESTED (§0):** 1 pending of 248 before the run, 0 pending of 248
after it. This agrees with the tree: DG recorded 0 pending of 247, and
the range adds exactly this file.

**The script behaved as designed.** It stopped on the pending file, and
the migration ran **before** the restart, as §7.1 requires on exit 1.
The new code reads the column: `WorldEvent` now declares `venue_look`, so
an unrestricted model read of `world_events` selects it, and the look's
routes, the Scene Brief and the Episode Locations proposal read it. So it
had to run first.

## §5. What went live — MEASURED

- **#2475 (`8ab9f8bd`). L(b), the Event Venue Look** (L1; Q1–Q10,
  §8(hh)):
  - an event's look: overall look, décor and colours, lighting and time,
    event areas, signage, must include and must avoid, each labelled
    Auto-drafted or Edited;
  - reference images by asset ID, at most 3 ticked "use as reference",
    stored and shown only (Q6, as Evoni ruled 2026-10-02);
  - "Draft from event details" (Haiku, budget-gated);
  - the Scene Brief's event layer reads the look in place of theme, mood
    and colours, and its lighting replaces the time line;
  - shown and edited in the Event Package's Place section, and shown
    read-only in the Episode Locations step; locked once the episode is
    accepted.

Three routes were added; none was removed:

```
$ git diff 93362409 8ab9f8bd -- src/routes | grep -E "^[+-]router\.(get|post|put|patch|delete)\("
+router.get('/world/:showId/events/:eventId/venue-look', requireAuth, async (req, res) => {
+router.put('/world/:showId/events/:eventId/venue-look', requireAuth, async (req, res) => {
+router.post('/world/:showId/events/:eventId/venue-look/draft', requireAuth, aiRateLimiter, async (req, res) => {
```

The draft route is the one new AI call: `requireAuth` and
`aiRateLimiter`, with spend gated by `aiCostTracker`.

## §6. Schema change, restart and the CFO

**Schema.** MEASURED (from the migration file); ATTESTED (that it ran,
§0).

```
$ git show 8ab9f8bd:src/migrations/20261002110000-add-world-events-venue-look.js | grep -n "ALTER TABLE"
31:      await sequelize.query('ALTER TABLE world_events ADD COLUMN IF NOT EXISTS venue_look JSONB', { transaction });
38:    await sequelize.query('ALTER TABLE world_events DROP COLUMN IF EXISTS venue_look');
```

- **`world_events.venue_look`** (new, JSONB, nullable). No backfill: no
  rows written. An event has no look until one is drafted or written.
- Guarded; `down` drops the column.

**Restart and CFO.** ATTESTED.
- One plain `pm2 restart`: restart count 64, online.
- `.env` unchanged, so a plain restart was right.
- CFO: 89/100, 0 critical, 4 warnings, the same as at DG.

## §7. Basis statement

**MEASURED.** Production's tree after Deploy DH was `8ab9f8bd` (#2475).
`origin/main` at filing is four commits beyond it: L(c)–L(e) and the DG
record. Of them, only L(d) carries a migration.

```
$ git log --oneline 8ab9f8bd..origin/main
41ca135cc docs(audit): deploy record DG [skip-automerge] (#2477)
33fb358d4 feat(planner): scene image readiness on the checklist and the planner header, L(e) [skip-automerge] (#2479)
823a0d4da feat(planner): beats mapped to location roles and angle kinds, with missing-angle actions, L(d) [skip-automerge] (#2478)
3263b3e28 feat(events): the Place scene-set picker shows thumbnails, search and each set's angles, L(c) [skip-automerge] (#2476)
$ git diff --name-only 8ab9f8bd origin/main -- src/migrations
src/migrations/20261002120000-add-scene-angle-kind.js
$ git rev-parse --is-shallow-repository
false
```

**ATTESTED.** At filing Evoni said she was deploying L(c)–L(e) ("I'm
deploying L(c)–L(e) now"). That deploy, and its letter, are for its own
record; nothing here says how it went.

## §8. What this document does not do

- It records no credential, database user or host.
- It edits no filed document.
- It reads no production schema, calls no production endpoint (including
  the CFO history), and queries nothing in production.
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

## §9. Tails — re-derived, not carried

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -1
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md | tail -1
410:### XK-4 — tenancy absent from the route contract
$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -1
68
```

The tails are FD-69, XK-4 and PE 68. Nothing is minted here.

## §Standing

- **Continuity:** continuous from DG (`93362409`, restart 63). The tree
  agrees with Evoni's account: 1 commit, 16 files, the one migration, no
  package or lock file.
- **Deploy:** the script stopped on the pending migration as designed.
  By hand, per §7.1:
  - fast-forward; 1 pending, migrated (`venue_look` added, no backfill),
    then 0 pending of 248;
  - build; one restart (count 64); ready; `/health` healthy and
    connected.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from DG.
- **App check:** not done yet (Evoni).
- **Live:** L(b), the Event Venue Look.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
