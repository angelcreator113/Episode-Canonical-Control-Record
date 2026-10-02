| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DG, 2026-10-02, backend and frontend. Ten commits, 44 files, from `22824569` (where DF left production) to `93362409`: the A9 draft change (#2465, whose own deploy never ran), the DF and DE records (#2466, #2467), the venue-description fix (#2468), the §8(hh) docs (#2469, #2473), B1–B3 (#2470–#2472) and L(a) Episode Locations (#2474), with one migration; no package change; one plain restart. `scripts/deploy-prod.sh` stopped on the pending migration as designed, and Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. CFO 89/100 with 4 warnings, unchanged from DF. The app check has not been done yet. The restart count is continuous from DF (62 → 63). Production was left at `93362409`; Deploy DH (`F-Deploy-1_Deploy_2026-10-02_DH.md`) followed it.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-02_DF.md`, whose deploy this one
follows. It edits no filed document.

Basis: the commit Deploy DG moved production to,
`93362409481b683a376c944deee41337e2bc1111` (#2474), read 2026-10-02 from
`origin/main` at `8ab9f8bd`. DG is filed after DH, which followed it (§7).

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
migration ran as is left out, as in the CW–DE records.

**The letter.** This deploy is lettered **DG**, the letter after DF, as
Evoni named it ("deploy record DG"). It follows DF
(`F-Deploy-1_Deploy_2026-10-02_DF.md`, filed in #2466).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-02, about
06:05–06:17 UTC, per `DEVELOPMENT_WORKFLOW.md` §7.1:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `22824569` (DF's tree; the separate A9 deploy never ran, so #2465
   ships here), fetched 10 commits to `93362409`: #2465, #2466, #2467,
   #2468, #2469, #2470, #2471, #2472, #2473, #2474. Of L(a)–L(e), only
   L(a) was merged. The script **stopped at step 3** on
   `20261002100000-add-scene-set-episode-roles`. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The package diff was empty.
   - `git merge --ff-only` to `93362409`: 44 files.
   - `check-pending-migrations` against the canon instance: **1 pending
     of 247**, exit 1.
3. **Migrate.** `db:migrate` as a database user (name left out). Its
   password was entered at a hidden prompt and unset afterwards. Exit 0.
   - `20261002100000` migrated, 0.044 s. Roles backfilled: **0 event,
     6 home, 1 closet, 7 extra**.
   - Re-check: **0 pending of 247**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 38.14 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 63 (DF 62 → 63, no deploy
     between), online.
   - Ready at 06:16:30.
   - `/health` at 2026-10-02T06:16:44Z: healthy, database connected,
     uptime 20.1 s.
5. **CFO.** 06:16:38–06:16:41: **89/100**, 0 critical, **4 warnings**.

**App check: not checked yet** (Evoni). Nothing in this record says the
deployed features work or fail in production.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse 22824569 93362409
22824569edd72d1a86a25862589943dc9745462e
93362409481b683a376c944deee41337e2bc1111
$ git merge-base --is-ancestor 22824569 93362409 && echo "ancestor: yes"
ancestor: yes
```

DF left production at `22824569` with restart count 62 (DF record §0).
DG starts at `22824569`, and its one restart brings the count to 63
(ATTESTED, §0). **No gap:** no deploy ran between DF and DG that this
account does not show. The A9 draft change (#2465), merged after DF's
fetch, had no deploy of its own; it ships in DG. DH then started at
`93362409` with one restart to 64 (DH record §0, §1), so the count runs
62 → 63 → 64 with no restart unaccounted for.

## §2. The range — MEASURED

```
$ git rev-list --count 22824569..93362409
10
$ git log --oneline 22824569..93362409
933624094 feat(episodes): episode locations with roles and the Episode Locations step, L(a) [skip-automerge] (#2474)
5008f369d docs(venue): record Evoni's answers to the venue design questions in §8(hh) and the note [skip-automerge] (#2473)
3f02afd8f fix(checklist): "Venue image generated" checks for an actual base image on the event's set (B3) [skip-automerge] (#2472)
df7d85977 fix(planner): a plan rewrite keeps locked beats; the beats' Edit buttons open an editor (B2) [skip-automerge] (#2471)
d3bcae2e5 fix(episodes): Start Episode's home set is this show's, oldest first (B1) [skip-automerge] (#2470)
ca2f16c4f docs(venue): record L1-L6 as §8(hh) and the venue looks and episode locations design note [skip-automerge] (#2469)
4d5c99aec fix(venue): a venue's new scene set is saved with its description again [skip-automerge] (#2468)
804d50dfd docs(audit): deploy record DE [skip-automerge] (#2467)
acfa92300 docs(audit): deploy record DF [skip-automerge] (#2466)
a63eb7b86 feat(season): Draft with AI on a started slot drafts from its episode, never over a purpose Evoni edited (A9 as changed) [skip-automerge] (#2465)
$ git diff --shortstat 22824569 93362409
 44 files changed, 3187 insertions(+), 114 deletions(-)
$ git diff --name-only 22824569 93362409 -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only 22824569 93362409 -- src/migrations/
src/migrations/20261002100000-add-scene-set-episode-roles.js
$ git diff --name-only 22824569 93362409 -- frontend/ | wc -l
18
$ git diff --name-only 22824569 93362409 -- src/
src/migrations/20261002100000-add-scene-set-episode-roles.js
src/models/SceneSetEpisode.js
src/routes/arcRoutes.js
src/routes/episodes.js
src/routes/shows.js
src/routes/worldEvents.js
src/services/episodeGeneratorService.js
src/services/episodeLocationsService.js
src/services/scenePlannerService.js
src/services/seasonIntentionService.js
src/services/seasonSlotService.js
src/services/venueGenerationService.js
$ git diff --name-only 22824569 93362409 -- . ':!frontend' ':!src'
docs/EVENT_EPISODE_FLOW.md
docs/VENUE_LOOKS_EPISODE_LOCATIONS_NOTE.md
docs/audit/F-Deploy-1_Deploy_2026-10-01_DE.md
docs/audit/F-Deploy-1_Deploy_2026-10-02_DF.md
tests/integration/episodeLocations.integration.test.js
tests/integration/scenePlannerLockedRows.integration.test.js
tests/integration/seasonPurposes.integration.test.js
tests/integration/startEpisodeHomeSet.integration.test.js
tests/integration/venueBrief.integration.test.js
tests/unit/routes/episodes-cluster-tier-promotion.test.js
tests/unit/routes/world-cluster-tier-promotion.test.js
tests/unit/services/episodeGeneratorService.startTransaction.test.js
tests/unit/services/episodeLocationsService.normalise.test.js
tests/unit/services/seasonPurposes.test.js
```

This agrees with Evoni's account:
- 10 commits, the ten PRs she named;
- 44 files (18 frontend, 12 backend including the migration, 4 docs,
  10 tests);
- exactly the one migration the script and the check named;
- no package or lock file, so no `npm ci` was needed.

## §3. The time

**ATTESTED.** About 06:05–06:17 UTC; ready at 06:16:30, CFO 06:16:38 to
06:16:41, `/health` at 06:16:44Z.

**MEASURED.** The range's last commit, #2474, is at 06:12:42 UTC:

```
$ git log --first-parent --format="%h %cI" 22824569..93362409
933624094 2026-10-02T02:12:42-04:00
5008f369d 2026-10-02T02:03:42-04:00
3f02afd8f 2026-10-01T22:15:00-04:00
df7d85977 2026-10-01T22:04:25-04:00
d3bcae2e5 2026-10-01T21:51:53-04:00
ca2f16c4f 2026-10-01T21:42:04-04:00
4d5c99aec 2026-10-01T21:23:54-04:00
804d50dfd 2026-10-01T21:10:25-04:00
acfa92300 2026-10-01T20:50:56-04:00
a63eb7b86 2026-10-01T20:30:14-04:00
```

**INFERRED.** The script's fetch reached `93362409`, so it ran at or after
06:12:42. "About 06:05" is therefore the start of Evoni's session, not of
the fetch. The window still fits her ready line at 06:16:30.

## §4. Migrations

**MEASURED.** The tree holds 247 migration files, one more than at DF:

```
$ git ls-tree -r --name-only 22824569 src/migrations | grep -c '\.js$'
246
$ git ls-tree -r --name-only 93362409 src/migrations | grep -c '\.js$'
247
```

**ATTESTED (§0):** 1 pending of 247 before the run, 0 pending of 247
after it. This agrees with the tree: DF recorded 0 pending of 246, and
the range adds exactly this file.

**The script behaved as designed.** It stopped on the pending file, and
the migration ran **before** the restart, as §7.1 requires on exit 1. The
new code reads the columns: the Episode Locations reads and writes, the
Start Episode link, and the plan's beat moves all use
`scene_set_episodes.role`. So it had to run first.

## §5. What went live — MEASURED

- **#2465 (`a63eb7b8`). Season Arc A9 as changed:** Draft with AI on a
  started slot drafts from its episode's event and script, and never
  writes over a purpose Evoni edited.
- **#2466, #2467.** The DF and DE deploy records. No runtime effect.
- **#2468 (`4d5c99ae`).** A venue's new scene set is saved with its
  description again (the location's, else the venue theme, else the
  location hint).
- **#2469, #2473.** §8(hh) "Venue looks and episode locations" (L1–L6)
  and the design note; then Evoni's answers. Docs only.
- **#2470 (`d3bcae2e`). B1:** Start Episode's home set is this show's
  Home Base, oldest first. It took any show's, in no order.
- **#2471 (`df7d8597`). B2:** a plan rewrite keeps locked beats, and the
  planner's Edit buttons open an editor.
- **#2472 (`3f02afd8`). B3:** "Venue image generated" ticks only when the
  event's set has a base image.
- **#2474 (`93362409`). L(a) Episode Locations** (L3, L6; Q12–Q16):
  - each episode set link has a role (home, closet, event, extra);
  - a show's default home and closet, and "Make default" in Scene Sets;
  - the Episode Locations step before Start Episode;
  - Scenes → "Edit locations" while the episode is a draft.

Five routes were added; none was removed:

```
$ git diff 22824569 93362409 -- src/routes | grep -E "^[+-]router\.(get|post|put|patch|delete)\("
+router.get(
+router.put(
+router.get('/:id/scene-defaults', requireAuth, async (req, res) => {
+router.put('/:id/scene-defaults', requireAuth, async (req, res) => {
+router.get('/world/:showId/events/:eventId/episode-locations', requireAuth, async (req, res) => {
```

The first two are `GET` and `PUT /episodes/:episodeId/locations`
(`src/routes/episodes.js`). All five are `requireAuth`.

## §6. Schema change, restart and the CFO

**Schema.** MEASURED (from the migration file); ATTESTED (that it ran,
§0).

```
$ git show 93362409:src/migrations/20261002100000-add-scene-set-episode-roles.js | grep -n "addColumn\|removeColumn\|SET role"
51:        await queryInterface.addColumn(TABLE, 'role', { type: Sequelize.STRING(20), allowNull: true }, { transaction });
54:        await queryInterface.addColumn(TABLE, 'role_name', { type: Sequelize.STRING(80), allowNull: true }, { transaction });
58:        `UPDATE scene_set_episodes l SET role = 'event'
66:          `UPDATE scene_set_episodes l SET role = :role
83:        `UPDATE scene_set_episodes l SET role = 'extra', role_name = LEFT(s.name, 80)
95:    if (await hasColumn(sequelize, 'role_name')) await queryInterface.removeColumn(TABLE, 'role_name');
96:    if (await hasColumn(sequelize, 'role')) await queryInterface.removeColumn(TABLE, 'role');
```

- **`scene_set_episodes.role`** (new, VARCHAR(20), nullable) and
  **`role_name`** (new, VARCHAR(80), nullable).
- The backfill, on live links with no role, in order:
  - the set the episode's event uses becomes event: **0** (ATTESTED);
  - the first Home Base by `sort_order` becomes home: **6**;
  - the first Closet becomes closet: **1**;
  - every other link becomes an extra named after its set: **7**.
- Guarded and re-runnable; `down` drops both columns.

**Two observations on the backfill, INFERRED from the migration's SQL
(not from production data):**

1. **0 event links.** The event step needs a link whose set equals the
   set of an event with `used_in_episode_id` set to that episode. None
   matched. So any older link to a venue's set was backfilled as an extra
   (named after its set), not as the event. The planner's later
   role-based mapping (L(d)) would not place event beats on it.
2. **Home picks are not filtered by show.** The home step takes each
   episode's first linked Home Base set, whatever that set's show. Before
   B1 (#2470), Start Episode could link another show's Home Base. So a
   backfilled home can point to another show's set. B1 prevents that
   going forward; it changes no existing link.

Whether either applies to the 6 home and 7 extra links is a production
read, which the filing session did not make (§8).

**Evoni's read of those links, ATTESTED** (2026-10-02, production,
read-only, run by Evoni herself, not by any agent session). The query
listed the live `home` and `extra` links with each episode's show, the
set's show, and whether the episode is deleted:
- **13 rows** (the 6 home and 7 extra links of §0).
- **The live episode's only home link is Lala's Room**, a set of the same
  show.
- **Both cross-show links** ("lalas bedroom day time" and "The Honey
  Table — Garden Society Brunch") belong to the **deleted** episode
  "Arrival".
- **Every other row** is a set of this show on a deleted episode.

**RULED** (Evoni, 2026-10-02): "No action". The cross-show picks
observation 2 anticipated exist only on a deleted episode; no live
episode is affected.

**Restart and CFO.** ATTESTED.
- One plain `pm2 restart`: restart count 63, online.
- `.env` unchanged, so a plain restart was right.
- CFO: 89/100, 0 critical, 4 warnings, the same as at DF.

## §7. Basis statement

**MEASURED.** Production's tree after Deploy DG was `93362409` (#2474).
DG is filed after the deploy that followed it: Deploy DH moved production
on to `8ab9f8bd` (#2475, L(b)), which is `origin/main` at filing.

```
$ git log --oneline 93362409..origin/main
8ab9f8bd4 feat(events): the Event Venue Look and its brief lines, L(b) [skip-automerge] (#2475)
$ git diff --name-only 93362409 origin/main -- src/migrations
src/migrations/20261002110000-add-world-events-venue-look.js
$ git rev-parse --is-shallow-repository
false
```

L(c)–L(e) are not merged. L(d) carries one more migration,
`20261002120000-add-scene-angle-kind`.

## §8. What this document does not do

- It records no credential, database user or host.
- It edits no filed document.
- It reads no production schema, calls no production endpoint (including
  the CFO history), and queries nothing in production. Evoni's own
  read-only query of the home and extra links (§6) is recorded as she
  gave it.
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

- **Continuity:** continuous from DF (`22824569`, restart 62); DH
  follows (63 → 64). The tree
  agrees with Evoni's account: 10 commits, 44 files, the one migration,
  no package or lock file.
- **Deploy:** the script stopped on the pending migration as designed.
  By hand, per §7.1:
  - fast-forward; 1 pending, migrated (roles added; backfilled 0 event,
    6 home, 1 closet, 7 extra), then 0 pending of 247;
  - build; one restart (count 63); ready; `/health` healthy and
    connected.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from DF.
- **App check:** not done yet (Evoni).
- **Backfilled links:** 13 home and extra links; the live episode's home
  is this show's Lala's Room; the two cross-show links are on the deleted
  episode "Arrival". No action (Evoni).
- **Live:** A9 as changed; the venue-description fix; B1–B3; L(a)
  Episode Locations.
- The record rules on nothing; it quotes Evoni's "No action" on the
  backfilled links (§6). The filing session made no host, AWS, database
  or Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
