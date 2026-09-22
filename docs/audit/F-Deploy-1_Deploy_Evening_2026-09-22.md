| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Three further production deploys on the evening of 2026-09-22, and the production `world_events` status/link reset between the first and second of them — all performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-22.md` — this document follows that one, filed
earlier the same day, rather than editing it. Basis: `origin/main` at
`1ea3cbebc9153c1277106aaff6f0bddc5facd8ab`, measured 2026-09-22.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Two standings appear below, each marked on its own claim, never
upgraded: **ATTESTED** for what only Evoni's own account of the
production host or database session states, not reproducible from a
clone, and **MEASURED** for what this repository itself shows — a `git
log`/`diff` any clone can reproduce. This document closes no keystone,
discharges no owed item, mints no FD, XK, or PE number, and rules on
nothing.

## §1. Identity — all three deploys

**ATTESTED.** Instance `i-02ae7608c531db485`; tree `~/episode-metadata`.
`git status` showed only the four known untracked `.bak` files, unchanged
from the standing observation in `F-Deploy-1_Deploy_2026-09-22.md` §1 and
`F-Deploy-1_Deploy_2026-09-20_2026-09-21.md` §1. `episode-worker` was
stopped throughout all three deploys. No package, migration, or model
change appeared in any of the three.

## §2. Deploy A — 2026-09-22 ~17:25–17:28 UTC, frontend and backend

**ATTESTED.** Evoni moved the tree from
`7c200d159b29254a4921cdbfa1686e71668bd24d` to
`8bb30b4843ab487204b25f9c7d879bcd8aa3dc31`, seven commits. Backend files:
`src/controllers/sceneLibraryController.js`, `src/models/SceneLibrary.js`;
`node -c` passed on both, and requiring `SceneLibrary` succeeded.

Backup `/var/www/html.bak-20260922-pre1659` (5.8M); served entry
`index-DptWIZp2.js` → `index-DNo1UBvf.js`; a request with
`Host: primepisodes.com` returned HTTP 200.

`pm2 restart`: restart count 12 → 13, online; `/health` returned 200; the
startup log showed only the OpenSearch fallback and the Node 22 and AWS
SDK v2 notices — the same three familiar notices `F-Deploy-1_Deploy_
2026-09-22.md` §2/§4 already record for the deploys before this one.

Afterward, Evoni created an event from a host in the application; the
invitation generated and uploaded with no error in the log — the first
S3 write since the credential replacement recorded in
`F-Deploy-1_Deploy_2026-09-22.md` §6 (cited there only, not re-verified
here — see §6 below).

**MEASURED**, `git log --oneline
7c200d159b29254a4921cdbfa1686e71668bd24d..8bb30b4843ab487204b25f9c7d879bcd8aa3dc31`:

```
8bb30b484 docs(audit): F-Franchise-1 read — Social Systems canon and its readers [skip-automerge] (#1663)
1d3dd37e9 docs(flow): record the scene-set flow decisions [skip-automerge] (#1661)
8e078addf fix(models): stop Scene Library reads overwriting stored S3 keys [skip-automerge] (#1659)
e54d313a2 fix(frontend): show older events' venue and date from their saved copy [skip-automerge] (#1658)
105cae2fa feat(frontend): Event Package invitations, auto-generated and editable [skip-automerge] (#1655)
fcedef740 docs: refresh PROJECT_CONTEXT.md — basis, §4.6, §6.5, §7, §10 [skip-automerge] (#1653)
13570da53 docs(audit): file the 2026-09-22 deploy record [skip-automerge] (#1651)
```

Seven commits, matching Evoni's own count. PRs #1651, #1653, #1655,
#1658, #1659, #1661, #1663. `git diff --stat` over the same range,
scoped to `src/`, confirms exactly the two files named above changed,
and none under `src/migrations/` or `package.json`:

```
 src/controllers/sceneLibraryController.js |  6 +++++-
 src/models/SceneLibrary.js                | 25 +++++++++++++++++++++++--
 2 files changed, 28 insertions(+), 3 deletions(-)
```

## §3. Data change — 2026-09-22 ~18:00 UTC, `world_events` status/link reset

**ATTESTED.** Via `psql`, as the application user `episode_app_dev` on
database `episode_metadata`, over SSL.

**Before.** 54 events not soft-deleted; 14 with `used_in_episode_id`
set; 16 with `status` `used` or `filmed`; 13 of the 14 pointed at an
episode that no longer exists or is itself soft-deleted.

**Venue read, same session.** Of the 54 events: 1 has `venue_location_id`
set, 1 has a non-empty `venue_name`, 1 has an automation `venue_name`
copy, and 1 has `scene_set_id` set. See §7 for this read as an
observation.

**Transaction 1.** The 13 events whose `used_in_episode_id` pointed at a
missing or soft-deleted episode had `used_in_episode_id` set to `NULL`
and `status` set to `'draft'` (`UPDATE 13`). Verified before commit: 1
event still linked (the 14th, whose episode was live), total still 54.
Committed.

**Transaction 2.** Two events with `status` `'used'` and no episode
link — `f0bc7d84-50dc-47d0-bf6c-43c94bd20067` and
`2003ee93-525e-4a06-81cb-d1c31528e734` — had `status` set to `'draft'`
(`UPDATE 2`). Committed.

**After.** 36 `ready`, 17 `draft`, 1 `used`. No row was deleted; no
column other than `used_in_episode_id` and `status` was changed, on
either transaction.

**The 13 event-to-episode pairings this reset undid exist only in
Evoni's own session transcript of the two transactions above — they are
not recoverable from the database.** `used_in_episode_id` was
overwritten to `NULL` on all 13 rows; nothing in `world_events` or
elsewhere in the schema retains the prior value. Stated plainly, not as
a finding: any future question of "which episode did event X point at
before this reset" has exactly one source, Evoni's own record of this
session, and no database read from any later point can answer it.

## §4. Deploy B — 2026-09-22 ~18:36–18:38 UTC, frontend and backend

**ATTESTED.** Evoni moved the tree from
`8bb30b4843ab487204b25f9c7d879bcd8aa3dc31` to
`82ea69415e6829d67922b6a1c8c9483fac42c995`, three commits. Backend file:
`src/services/timelinePlacementService.js`; `node -c` passed.

Backup `/var/www/html.bak-20260922-pre1669`; served entry
`index-DNo1UBvf.js` → `index-BSRXK5fG.js`; HTTP 200.

`pm2 restart`: restart count 13 → 14, online; `/health` returned 200.

The frontend build took 1m13s, against roughly 32s on the other builds
this same day (§2 above; `F-Deploy-1_Deploy_2026-09-22.md` §2/§4). Recorded
as an observation, not a finding — no cause was established, and this
document does not speculate on one.

**MEASURED**, `git log --oneline
8bb30b4843ab487204b25f9c7d879bcd8aa3dc31..82ea69415e6829d67922b6a1c8c9483fac42c995`:

```
82ea69415 fix(frontend): view invitations full size; fix mail panel name match [skip-automerge] (#1669)
7e57e061d docs: capture Director Brain design input [skip-automerge] (#1667)
755c40718 docs(flow): SAL is composited; coverage has four layers [skip-automerge] (#1666)
```

Three commits, matching Evoni's own count. PRs #1666, #1667, #1669.
`git diff --stat` over the same range, scoped to `src/`, confirms exactly
one backend file changed, none under `src/migrations/` or `package.json`:

```
 src/services/timelinePlacementService.js | 35 ++++++++++++++++++++++++++------
 1 file changed, 29 insertions(+), 6 deletions(-)
```

## §5. Deploy C — 2026-09-22 ~18:47–18:50 UTC, frontend and backend

**ATTESTED.** Evoni moved the tree from
`82ea69415e6829d67922b6a1c8c9483fac42c995` to
`1ea3cbebc9153c1277106aaff6f0bddc5facd8ab`, one commit. Backend file:
`src/routes/worldEvents.js`; `node -c` passed.

Backup `/var/www/html.bak-20260922-pre1671`; served entry
`index-BSRXK5fG.js` → `index-CMShKqCA.js`; HTTP 200.

`pm2 restart`: restart count 14 → 15, online; `/health` returned 200.

**MEASURED**, `git log --oneline
82ea69415e6829d67922b6a1c8c9483fac42c995..1ea3cbebc9153c1277106aaff6f0bddc5facd8ab`:

```
1ea3cbebc feat(routes): suggest creative event names [skip-automerge] (#1671)
```

One commit, matching Evoni's own count. PR #1671. `git diff --stat` over
the same range, scoped to `src/`, confirms exactly one backend file
changed, none under `src/migrations/` or `package.json`:

```
 src/routes/worldEvents.js | 158 ++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 158 insertions(+)
```

The full (unscoped) diffstat for this range also shows a fourth file:
`tests/unit/routes/world-cluster-tier-promotion.test.js` (18 insertions,
8 deletions) — see §6 below.

## §6. Related, by citation only — not re-derived, not ruled on

**The invitation upload (§2) and the credential replacement.**
`F-Deploy-1_Deploy_2026-09-22.md` §6 records the same-day S3 access-key
replacement for `episode-metadata-ci-cd`. §2 above cites that record only
for context on why a successful S3 write was worth noting; this document
does not re-verify the credential itself.

**The 09-22 direct-SQL schema change and §3's own data change.**
`F-Deploy-1_Deploy_2026-09-22.md` §3 records an earlier same-day direct
`ALTER TABLE` adding `category`/`format` to `world_events`, run outside
the migration tool. §3 above is a separate action — a data reset via
`UPDATE`, not a schema change — on the same table, later the same day.
This document does not re-verify §3's schema state and takes no position
on whether the two are related beyond both touching `world_events`.

**The CP3 lock-count drift.** PR #1671, merged in Deploy C (§5), changed
`tests/unit/routes/world-cluster-tier-promotion.test.js` — the four
`REQUIRE_AUTH_COUNTS['worldEvents.js']`/"AI handlers"/CP3-zone-aggregate
figures it hardcodes moved from 63 to 64 requireAuth references, from 4
to 5 AI handlers matching the `requireAuth, aiRateLimiter,` (D4) pattern,
and the CP3 zone aggregate from 106 to 107, to account for one new AI
POST route (`suggest-names`) built to that same D4 pattern. That test
file traces to F-AUTH-1's Limb 1 CP3 confirmation sweep —
`F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md` and
`F-AUTH-1_Limb1_CP3_Itemization_2026-09-04.md`, the latter itemizing
`worldEvents.js`'s AI POST handlers by name and line (its rows 5–6, citing
`src/routes/worldEvents.js:748,1779` and `:1687,1889` at that filing's own
basis) as part of CP3's own confirmed count. Both of those documents are
filed and were not edited by PR #1671 or by this record. **The test file
that operationalizes CP3's confirmed counts and the filed CP3 documents
themselves now state different numbers for `worldEvents.js`'s
`requireAuth`/AI-handler counts** — the test reflects current `main`
(64 / 5 / 107), while the filed CP3 record reflects its own basis. This
document records that the two no longer agree; it does not rule on
whether that gap requires a CP3 amendment, does not amend either filed
CP3 document, and does not itself constitute one.

## §7. Observations — not findings, not ruled on

- Of 54 non-deleted events read in §3, exactly 1 carries any venue data
  at all — the same 1 event across all four fields checked
  (`venue_location_id`, `venue_name`, the automation `venue_name` copy,
  `scene_set_id`). Not established here whether it is the same event
  across all four, only that each field's own count is 1.
- The production box now carries several `/var/www/html.bak-*` bundle
  backups from this day's deploys alone (§2, §4, §5 above, plus
  `F-Deploy-1_Deploy_2026-09-22.md` §2/§4), each approximately 6M. Their
  total count and disk footprint were not measured here.

Neither observation above is characterized as a defect, ruled on, or
assigned an owner in this document.

## §8. What this document does not do

This document:

- does not rule on whether §6's CP3 count drift requires a CP3
  amendment, or take any position on F-AUTH-1's own standing;
- does not re-verify the credential replacement or the schema change
  `F-Deploy-1_Deploy_2026-09-22.md` §3/§6 record — both are cited, not
  re-derived;
- does not recover, or claim any path to recovering, the 13
  event-to-episode pairings §3 overwrote — they are stated as existing
  only in Evoni's own record, nowhere in this repository or database;
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision;
- mints no FD, XK, or PE number;
- amends no filed document — `F-Deploy-1_Deploy_2026-09-22.md`,
  `F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md`, and
  `F-AUTH-1_Limb1_CP3_Itemization_2026-09-04.md` are cited above, not
  edited;
- performs no deploy, database change, or credential change of its own,
  and makes no host, AWS, database, or Cognito contact — every ATTESTED
  claim above is Evoni's own account, taken outside any agent session;
  every MEASURED claim is a repository read this filing session
  performed itself, against `origin/main`, not against any host;
- records no secret anywhere above.

## §9. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Unchanged from the last register tail check this session found
(`F-Deploy-1_Deploy_2026-09-22.md` §10). Nothing minted here.

## §Standing

§1–§5 each carry an ATTESTED clause (Evoni's own account of actions and
reads made personally, on the production host or in the production
database session — not reproducible from a clone) and, where a commit
range is involved, a MEASURED clause (a `git log`/`diff` read against
this repository, reproducible by anyone with a clone), marked
separately, never merged into one standing. §6 and §7 carry no
independent standing beyond the citations and reads they name. Nothing
in this document is labelled RULED. No host, AWS, database, or Cognito
contact was made by the agent session that filed it — every MEASURED
claim above reads this repository only. Production's freeze is lifted
(`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch
hosts, AWS, RDS, or Cognito (`CLAUDE.md`), unchanged by that lift or by
this record.
