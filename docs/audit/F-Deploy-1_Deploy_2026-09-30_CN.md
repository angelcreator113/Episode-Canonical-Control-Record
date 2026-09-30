| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CN, 2026-09-30, backend and frontend, one migration, no dependency change, one plain restart. Evoni ran it herself, outside any agent session, as a manual deploy under `DEVELOPMENT_WORKFLOW.md` §7.1, because the range carried a migration. Deal build PR 3 (#2350, pricing from the rate anchors) goes live, with its migration run before the restart. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CM.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `c043eb0b16adefad07ca6c18d074a202aa999cf2` (#2355),
read 2026-09-30. This is the tree Deploy CN moved production to (§8).

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
path, account number, database user or ARN.

**The letter.** This deploy is lettered **CN**. It follows CM
(`F-Deploy-1_Deploy_2026-09-30_CM.md`, #2355), the register's last deploy
record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-30, about
12:43–12:46 UTC, in her order:

1. **Fetch and fast-forward.**
   - `git fetch` found the range `f32fb543..c043eb0b`: 4 commits (#2350,
     #2353, #2354, #2355). The package diff was empty.
   - `frontend/dist` was backed up (sortable name).
   - `git merge --ff-only` moved the tree to `c043eb0b` (30 files).
2. **Pending migrations, before.** `check-pending-migrations` against the
   canon instance's `episode_metadata` database (the app's user; the name
   is left out): **1 pending of 227**
   (`20260930120000-add-world-events-deal-components`), exit 1.
3. **The migration.**
   - `npx sequelize-cli db:migrate` with `NODE_ENV=production`, run as a
     privileged database user (the name is left out), its password entered
     at a hidden prompt and unset afterwards.
   - "migrated in 0.055s", exit 0.
   - Re-check: **0 pending of 227**, exit 0.
4. **Build and restart.**
   - `vite build` ✓ 33.53 s.
   - `.env` unchanged.
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 43,
     online.
   - `/health` at 2026-09-30T12:46:22Z: healthy, database connected, uptime
     20.1 s. Ready at 12:46:09.
   - CFO 12:46:17–12:46:21: **89/100**, 0 critical, 4 warnings.

**App check: not checked yet** (Evoni). This record claims none.

**The order was right.** The migration ran, and the re-check read 0
pending, before the restart, as §7.1 and #2350's PR text require.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor f32fb543ee5b363b4a68c3b28f160fe9575da4fc c043eb0b && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CM ends at `f32fb543` (CM record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CM left it at 42 (CM
record §6), and CN's single restart brings it to 43.

## §2. The range — MEASURED

```
$ git rev-list --count f32fb543..c043eb0b
4
$ git log --oneline f32fb543..c043eb0b
c043eb0b1 docs(audit): deploy record CM; the app email credential parked as owed [skip-automerge] (#2355)
54e25f103 docs(audit): deploy record CL [skip-automerge] (#2354)
863a69f9f docs(audit): deploy record CK [skip-automerge] (#2353)
570d078a4 feat(deals): deal build PR 3, pricing from the rate anchors [skip-automerge] (#2350)
$ git diff --shortstat f32fb543 c043eb0b
 30 files changed, 2775 insertions(+), 45 deletions(-)
$ git diff --name-only f32fb543 c043eb0b -- src/migrations/
src/migrations/20260930120000-add-world-events-deal-components.js
$ git diff --name-only f32fb543 c043eb0b -- package.json package-lock.json; echo "EXIT: $?"
EXIT: 0
$ git diff --name-only f32fb543 c043eb0b -- frontend/ | wc -l
7
```

This agrees with Evoni's account:
- 4 commits, the four PRs named;
- 30 files;
- one migration, the one her pending check named;
- an empty package diff.

The frontend changed (7 files), so the build used new sources.

## §3. The time

**ATTESTED.** The deploy ran about 12:43–12:46 UTC: ready at 12:46:09,
`/health` at 12:46:22Z with an uptime of 20.1 s, CFO done 12:46:21.

**MEASURED.** The range's last commit, #2355, is at 12:42:37 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" f32fb543..c043eb0b
c043eb0b1 2026-09-30T08:42:37-04:00 docs(audit): deploy record CM; the app email credential parked as owed [skip-automerge] (#2355)
54e25f103 2026-09-30T08:37:16-04:00 docs(audit): deploy record CL [skip-automerge] (#2354)
863a69f9f 2026-09-30T08:30:20-04:00 docs(audit): deploy record CK [skip-automerge] (#2353)
570d078a4 2026-09-30T08:23:03-04:00 feat(deals): deal build PR 3, pricing from the rate anchors [skip-automerge] (#2350)
```

## §4. The migration

**MEASURED.** The tree holds 227 migration files, one more than CM's 226:

```
$ git ls-tree -r --name-only c043eb0b src/migrations | grep -c '\.js$'
227
```

`20260930120000-add-world-events-deal-components.js` adds three columns to
`world_events`:
- `partnership_base_fee` INTEGER, null;
- `performance_fee` INTEGER, null;
- `appearance_required` BOOLEAN NOT NULL DEFAULT false.

It adds each only if `describeTable` lacks it, and its `down` removes only
these three. Existing rows keep their meaning: the two fees are null and
`appearance_required` is false.

**ATTESTED (§0):** 1 pending of 227 before, the migration ran in 0.055 s,
and 0 pending of 227 after. The before and after counts agree with the
tree.

**INFERRED:** the columns now exist in production. The migration's success
and the 0-pending re-check point to it, but this session did not read the
production schema.

## §5. What went live — MEASURED

- **#2350 (`570d078a`), Task #2341: deal build PR 3, pricing from the rate
  anchors.**
  - It builds Evoni's Deal PR 3 ruling (`docs/EVENT_EPISODE_FLOW.md` §8(cc),
    `docs/DEAL_DESIGN.md` §10.2 and §12).
  - Propose terms drafts each deal component from the rate card; the
    deliverable types are a fixed list; premiums add on one component.
  - Start Episode refuses (409 `DEAL_PRICE_REQUIRED`) while a priced
    component or paid deliverable has no number.
  - The Event Package Terms area gains the "Deal price" block and the "No
    fee (0)" button.
  - Legacy events (no `deal_type`) are unchanged.
- **#2353, #2354 and #2355:** the CK, CL and CM deploy records, including
  the `PROJECT_CONTEXT.md` §6.5 row for the parked email credential.
  Documents with no runtime effect.

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 43,
  online.
- `.env` unchanged.
- The account does not mention `ANTHROPIC_API_KEY` or `episode-worker`.

## §7. Schema changes

**ATTESTED and MEASURED (§4).** One: the three `world_events` columns, by
migration `20260930120000`, run before the restart.

## §8. Basis statement

**MEASURED.** After Deploy CN, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
c043eb0b16adefad07ca6c18d074a202aa999cf2 2026-09-30 docs(audit): deploy record CM; the app email credential parked as owed [skip-automerge] (#2355)
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential, database user or host.
- It edits no filed document.
- It reads no production schema and queries nothing in production.
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

## §10. Tails — re-derived, not carried

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

- **Continuity:** the tree agrees with Evoni's account (4 commits, 30 files,
  one migration, no package change), with no gap after CM. Production is at
  `origin/main`, `c043eb0b`.
- **Deploy:** manual under §7.1: backup, fast-forward, 1 pending, the
  migration, 0 pending, build, one restart (count 43). `/health` healthy
  and connected.
- **CFO:** 89/100, 0 critical, 4 warnings.
- **App check:** not checked yet.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
