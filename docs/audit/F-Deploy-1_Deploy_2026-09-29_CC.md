| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CC, 2026-09-29, backend and frontend, one migration, one plain restart. Evoni ran it herself, outside any agent session. It was a manual deploy under `DEVELOPMENT_WORKFLOW.md` §7.1: `scripts/deploy-prod.sh` stopped on the pending migration, and the rest was done by hand. T2 (one task list, `event_deliverables.owed_to`) goes live. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_CB.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `38a85be9c9c7e8dc9735cdf932e4e16e5ebfc0c9` (#2297),
read 2026-09-29. This is the tree Deploy CC moved production to (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, as she gave it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.
- **CANNOT-TELL**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email, password, hostname, IP address, key path,
account number or ARN. The database password was typed at a hidden prompt
and is not in Evoni's account.

**The letter.** This deploy is lettered **CC**. It follows CB
(`F-Deploy-1_Deploy_2026-09-29_CB.md`), the register's last deploy record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-29, in her order:

1. **The script, first.** `scripts/deploy-prod.sh` ran at `7c0b1606` and
   fetched 2 commits (#2296, #2297) to `38a85be9`. It **stopped at step 3**
   on `src/migrations/20260929190000-add-event-deliverables-owed-to.js`.
   Nothing changed. `git status` showed untracked files only, among them a
   stray file named `=` (not investigated).
2. **By hand.**
   - `frontend/dist` was backed up to `~/dist-backup-<timestamp>`.
   - `git merge --ff-only origin/main` moved `7c0b1606` to `38a85be9`
     (26 files).
   - `check-pending-migrations` ran against the canon instance,
     `episode_metadata` as `episode_app_dev`: **1 pending of 221**, the
     `owed_to` migration, exit 1.
3. **The migration.** `npx sequelize-cli db:migrate` ran as
   `DB_USER=postgres` with `NODE_ENV=production`. The password was typed at
   a hidden prompt and unset afterwards. It migrated in 0.038 s, exit 0.
   The re-check found **0 pending of 221**, exit 0.
4. **Build and restart.**
   - `vite build` ✓ in 33.20 s.
   - `ANTHROPIC_API_KEY` count 1 (value not read); `.env` unchanged.
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 31,
     online.
   - `/health` at 2026-09-29T19:27:08Z: healthy, database connected, uptime
     20.1 s.
   - Ready at 19:26:51.
   - CFO 19:27:00–19:27:06: 84/100, 1 critical (`dependency_audit`, 14
     critical/high), 4 warnings.
   - `episode-worker` is stopped (a standing state).

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 7c0b1606 38a85be9 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CB ends at `7c0b1606` (CB record §1 and §8), and that is where
this deploy starts.

**The restart count is continuous (ATTESTED):** CB left it at 30 (CB record
§0), and CC's single restart brings it to 31. The two restarts that §1 of CB
could not account for stay as CB recorded them.

## §2. The range — MEASURED

```
$ git rev-list --count 7c0b1606..38a85be9
2
$ git log --oneline 7c0b1606..38a85be9
38a85be9c feat(tasks): one task list, with a source on every item (T2) [skip-automerge] (#2297)
069083d38 docs(audit): deploy record CB [skip-automerge] (#2296)
$ git diff --shortstat 7c0b1606 38a85be9
 26 files changed, 916 insertions(+), 67 deletions(-)
$ git diff --name-only 7c0b1606 38a85be9
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-09-29_CB.md
frontend/src/components/Episodes/EpisodeTodoList.jsx
frontend/src/components/Episodes/EpisodeTodoList.oneList.test.jsx
frontend/src/components/EventPackage/EventTermsSection.jsx
frontend/src/components/EventPackage/EventTermsSection.test.jsx
frontend/src/components/SocialTaskBadge.css
frontend/src/components/SocialTaskBadge.jsx
frontend/src/pages/EpisodeTodoPage.jsx
frontend/src/pages/WorldAdmin.episodeLedgerTaskSource.test.jsx
frontend/src/utils/eventTerms.js
frontend/src/utils/eventTerms.test.js
frontend/src/utils/socialTaskSource.js
src/migrations/20260929190000-add-event-deliverables-owed-to.js
src/models/EventDeliverable.js
src/routes/eventDeliverables.js
src/services/eventTermsService.js
src/services/socialChecklistService.js
src/services/todoListService.js
src/utils/socialTaskSource.js
tests/integration/oneTaskListOwedTo.integration.test.js
tests/integration/socialTasksRequiredFromDeliverables.integration.test.js
tests/unit/models/eventTerms.models.test.js
tests/unit/services/episodeGeneratorService.termsSnapshot.test.js
tests/unit/services/eventTermsService.test.js
tests/unit/utils/socialTaskSource.test.js
$ git diff --name-only 7c0b1606 38a85be9 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
src/migrations/20260929190000-add-event-deliverables-owed-to.js
EXIT: 0
```

This agrees with Evoni's account: 2 commits, 26 files, #2296 and #2297, one
migration and no package change.

The runtime files are:
- **backend:**
  - the migration;
  - `EventDeliverable.js`, `eventDeliverables.js`;
  - `eventTermsService.js`, `socialChecklistService.js`,
    `todoListService.js`;
  - `src/utils/socialTaskSource.js`;
- **frontend:**
  - `EpisodeTodoList.jsx`, `EventTermsSection.jsx`, `SocialTaskBadge.jsx` and
    its CSS;
  - `EpisodeTodoPage.jsx`;
  - `eventTerms.js`, `frontend/src/utils/socialTaskSource.js`.

The rest are tests, one living doc (`docs/EVENT_EPISODE_FLOW.md`) and one
register document (CB).

## §3. The time

**ATTESTED.** Ready at 19:26:51. `/health` answered at 19:27:08Z with an
uptime of 20.1 s. The backup's timestamp was not given.

**MEASURED.** The newest commit in the range is #2297, at 19:20:27 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 7c0b1606..38a85be9 | head -1
38a85be9c 2026-09-29T15:20:27-04:00 feat(tasks): one task list, with a source on every item (T2) [skip-automerge] (#2297)
```

## §4. The migration, and the §7.1 path

**ATTESTED (§0).**
- The script stopped on the pending migration before changing anything.
- Evoni took the §7.1 manual path: backup, fast-forward, pending check
  (1 of 221), `db:migrate` as `postgres`, re-check (0 of 221), build,
  restart.
- The migration ran **before** the restart. That was required: the new code
  reads `event_deliverables.owed_to` (#2297's deploy note).

**MEASURED.** The tree holds 221 migration files, one more than CB's 220,
and the one added is the range's migration:

```
$ git ls-tree -r --name-only 38a85be9 src/migrations | grep -c '\.js$'
221
```

What the migration does (MEASURED, from the file at this tree):
- It adds `event_deliverables.owed_to`, character varying(10), not null,
  default `'host'`, if the column is absent.
- It sets `'brand'` on each row whose event is a `brand_deal` or has an
  `opportunity_id`.
- Its `down` drops the column.

**CANNOT-TELL:** how many rows the backfill changed in production. Evoni's
account does not give a count, and this record does not query production.

## §5. What went live — MEASURED

- **#2297 (`38a85be9`), Task #2294: T2 (§8(bb)), one task list with a
  source on every item.**
  - A deliverable is a host requirement or a brand deliverable, by the new
    `owed_to`. It is set in the Event Package's deliverable form, and an
    Opportunity's deliverables are carried as brand.
  - Every item on an episode's list (`episode_todo_lists.social_tasks`) is
    labelled host requirement, brand deliverable, goal or optional idea.
  - The Career Checklist saves its goals and ideas into that list and
    reloads it; career items are never required. The Run Sheet and the
    Career Checklist are views of the same list. The phone view is #2295,
    not built.
- **Register only, with no runtime effect:** #2296 (deploy record CB).

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, the same as at CB.

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 31,
  online.
- `ANTHROPIC_API_KEY` count 1 (value not read); `.env` unchanged.
- `episode-worker` is stopped, a standing state that this deploy did not
  change.

## §7. Schema changes

**MEASURED (§2, §4):** one, `event_deliverables.owed_to`.

**ATTESTED (§0):** applied in production before the restart, 0 pending
after.

## §8. Basis statement

**MEASURED.** After Deploy CC, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
38a85be9c9c7e8dc9735cdf932e4e16e5ebfc0c9 2026-09-29 feat(tasks): one task list, with a source on every item (T2) [skip-automerge] (#2297)
$ git rev-parse --is-shallow-repository
false
```

## §9. Noted, not investigated

- **A stray untracked file named `=`** in the production checkout (ATTESTED,
  §0). This record does not say what it is or where it came from. It is not
  tracked by git, so it is not part of the deployed tree.

## §10. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding, the stray file, or the backfill's row
  count.
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

## §11. Tails — re-derived, not carried

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

- **Continuity:** the tree agrees with Evoni's account (2 commits, 26 files,
  one migration, no package change), with no gap after CB. Production is at
  `origin/main`, `38a85be9`.
- **Deploy:** a manual deploy under §7.1. The migration ran before the
  restart, and 0 of 221 are pending after it. `/health` is healthy and
  connected; the restart count is 31.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **Live here:** T2, the one task list with `owed_to`.
- **Noted:** a stray untracked `=` file (not investigated).
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
