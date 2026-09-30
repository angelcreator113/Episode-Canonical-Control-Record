| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CQ, 2026-09-30, backend and frontend, two migrations run before the restart, no dependency change, one plain restart. Evoni ran it by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, because the range carried migrations, outside any agent session. Deal build PR 5 (payouts at Complete and on approval, #2371), the texture-enhance sharpen pass (#2370) and the drifted-columns migration (#2372) go live. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CP.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `3ba0e38ae5dbc88da5a3fa72addc95566719d675` (#2373),
read 2026-09-30. Deploy CQ moved production to that same commit (§8).

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
path, account number, database user or ARN. Two database users named in
Evoni's account are left out: the one the pending-migration check read
as, and the one the migrations ran as.

**The letter.** This deploy is lettered **CQ**. It follows CP
(`F-Deploy-1_Deploy_2026-09-30_CP.md`, #2373), the register's last deploy
record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-30, about
17:15–17:25 UTC. It was a manual deploy per `DEVELOPMENT_WORKFLOW.md` §7.1,
because the range carried migrations:

1. **Fast-forward.**
   - `git fetch`: range `8dd85f76..3ba0e38a`, 5 commits (#2370, #2371,
     #2372, #2374, #2373). The package diff was empty.
   - `frontend/dist` was backed up (sortable name).
   - `git merge --ff-only` to `3ba0e38a`: 28 files.
2. **Pending migrations.** `check-pending-migrations` against the canon
   instance's `episode_metadata` database (the user is left out): **2
   pending of 229**, exit 1:
   - `20260930160000-extend-ledger-deal-payout-unique`
   - `20261001090000-add-drifted-columns-2303`

   Per §7.1, exit 1 means do not restart; the files are dealt with first.
3. **Migrate.** `npx sequelize-cli db:migrate` with `NODE_ENV=production`,
   as a separate database user (name left out). Its password was entered at
   a hidden prompt and unset afterwards.
   - `20260930160000` migrated (0.046 s).
   - `20261001090000` migrated (0.024 s).
   - Exit 0.

   Re-check: **0 pending of 229**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 36.47 s.
   - `.env` unchanged.
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 46,
     online.
   - Ready at 17:24:17.
   - `/health` at 2026-09-30T17:24:31Z: healthy, database connected,
     uptime 20.2 s.
5. **CFO.** 17:24:25–17:24:30: **89/100**, 0 critical, 4 warnings.

**App check (Evoni):** not checked yet.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 8dd85f76eff01d608be60809d2cb92dc115bb68c 3ba0e38ae5dbc88da5a3fa72addc95566719d675 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CP ends at `8dd85f76` (CP record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CP left it at 45 (CP
record §6), and CQ's single restart brings it to 46.

## §2. The range — MEASURED

```
$ git rev-list --count 8dd85f76..3ba0e38a
5
$ git log --oneline 8dd85f76..3ba0e38a
3ba0e38ae docs(audit): deploy record CP [skip-automerge] (#2373)
f72bd5e68 docs(registry): record Character Registry ruling C9 [skip-automerge] (#2374)
37e264f5c fix(schema): one guarded migration for four drifted columns [skip-automerge] (#2372)
b31b0a610 feat(deals): deal build PR 5, payouts at Complete and on approval [skip-automerge] (#2371)
7d98260a9 fix(wardrobe): apply texture-enhance's clarity sharpen pass [skip-automerge] (#2370)
$ git diff --shortstat 8dd85f76 3ba0e38a
 28 files changed, 1499 insertions(+), 233 deletions(-)
$ git diff --name-only 8dd85f76 3ba0e38a -- src/migrations/
src/migrations/20260930160000-extend-ledger-deal-payout-unique.js
src/migrations/20261001090000-add-drifted-columns-2303.js
$ git diff --name-only 8dd85f76 3ba0e38a -- package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
$ git diff --name-only 8dd85f76 3ba0e38a -- frontend/ | wc -l
5
$ git diff --name-only 8dd85f76 3ba0e38a -- src/ | wc -l
10
```

This agrees with Evoni's account:
- 5 commits, the five PRs named;
- 28 files;
- exactly the two migrations the check listed;
- no package or lock file.

5 frontend files changed, so the build used new sources. 10 backend files
changed (two of them the migrations); the restart was needed to load the
others.

## §3. The time

**ATTESTED.** The deploy ran about 17:15–17:25 UTC: ready at 17:24:17,
`/health` at 17:24:31, CFO done 17:24:30.

**MEASURED.** The range's last commit, #2373, is at 17:02:36 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 8dd85f76..3ba0e38a
3ba0e38ae 2026-09-30T13:02:36-04:00 docs(audit): deploy record CP [skip-automerge] (#2373)
f72bd5e68 2026-09-30T12:55:47-04:00 docs(registry): record Character Registry ruling C9 [skip-automerge] (#2374)
37e264f5c 2026-09-30T12:46:57-04:00 fix(schema): one guarded migration for four drifted columns [skip-automerge] (#2372)
b31b0a610 2026-09-30T12:35:44-04:00 feat(deals): deal build PR 5, payouts at Complete and on approval [skip-automerge] (#2371)
7d98260a9 2026-09-30T12:21:52-04:00 fix(wardrobe): apply texture-enhance's clarity sharpen pass [skip-automerge] (#2370)
```

## §4. Migrations

**MEASURED.** The tree holds 229 migration files, two more than at CP:

```
$ git ls-tree -r --name-only 3ba0e38a src/migrations | grep -c '\.js$'
229
```

**ATTESTED (§0):** 2 pending of 229 before the run, and 0 pending of 229
after it. This agrees with the tree: CP recorded 0 pending of 227, and the
range adds exactly these two files.

The migrations ran **before** the restart, as §7.1 requires on exit 1. The
payout code of #2371 therefore started against the extended index.

## §5. What went live — MEASURED

- **#2371 (`b31b0a61`), Task #2368: deal build PR 5, payouts at Complete
  and on approval** (`docs/DEAL_DESIGN.md` §13; Evoni's answer 1 and her
  bonus ruling of 2026-09-30).
  - At Complete, a deal books its `appearance_fee`, `partnership_base_fee`
    and `performance_fee`, each once, and a `deal_bonus` for the tier
    reached (FAIL never pays).
  - A deliverable's `content_fee` is booked when the deliverable is
    approved.
  - The generic tier reward (`tier_reward`), `tier_paid_bonus` and
    `event_reward` are retired (Q12 and the follow-up rulings).
- **#2372 (`37e264f5`), Task #2303:** one guarded migration for the
  drifted columns (§7).
- **#2370 (`7d98260a`):** `wardrobeImageService` applies texture-enhance's
  clarity sharpen pass.
- **#2374 and #2373:** the C9 ruling in `docs/navigation-architecture.md`
  and the CP deploy record. Documents with no runtime effect.

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 46,
  online.
- `.env` unchanged, so a plain restart was right (§7.2 applies only to a
  credential or `.env` change).
- The account does not mention `episode-worker`.

## §7. Schema changes

**MEASURED** (from the migration files), **ATTESTED** (that both ran, §0).

- **`20260930160000-extend-ledger-deal-payout-unique`** rebuilds the
  unique partial index `financial_transactions_deal_payout_once`, so it
  covers five payout categories (`appearance_fee`, `partnership_base_fee`,
  `performance_fee`, `content_fee`, `deal_bonus`) instead of PR 1's three.
  - It is guarded: it reads the index's definition from `pg_indexes` and
    rebuilds only when that definition lacks the new categories, so a
    re-run is a no-op.
  - `down` restores PR 1's three-category definition.
- **`20261001090000-add-drifted-columns-2303`**:
  - `ADD COLUMN IF NOT EXISTS` for `assets.processing_status`,
    `assets.s3_key_processed` and `scene_sets.base_still_url`;
  - `storyteller_memories.line_id` `DROP NOT NULL` (a no-op where the
    column is already nullable);
  - `down` is a no-op.

```
$ grep -n "pg_indexes\|DROP INDEX\|CREATE UNIQUE INDEX" src/migrations/20260930160000-extend-ledger-deal-payout-unique.js
22: * Guarded: it reads the index's definition from pg_indexes and rebuilds only
35:    'SELECT indexdef FROM pg_indexes WHERE indexname = :name',
43:    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${INDEX}`, { transaction });
45:      `CREATE UNIQUE INDEX ${INDEX}
$ grep -n "IF NOT EXISTS\|DROP NOT NULL'" src/migrations/20261001090000-add-drifted-columns-2303.js
9: * 'IF NOT EXISTS' migration later." On line_id: "that entry is ALTER COLUMN
11: * COLUMN IF NOT EXISTS."
40:      await q('ALTER TABLE assets ADD COLUMN IF NOT EXISTS processing_status character varying');
41:      await q('ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_key_processed character varying');
44:      await q('ALTER TABLE scene_sets ADD COLUMN IF NOT EXISTS base_still_url text');
48:      await q('ALTER TABLE storyteller_memories ALTER COLUMN line_id DROP NOT NULL');
```

**INFERRED:** the schema-agreement step-2 baseline dropped these three
column entries in #2372. A later production schema read would confirm the
columns now exist. This record reads no production schema.

## §8. Basis statement

**MEASURED.** Production's tree after Deploy CQ is `3ba0e38a` (#2373),
which is `origin/main` at filing. Production is level with main.

```
$ git log --oneline 3ba0e38a..origin/main | wc -l
0
$ git log -1 --format='%H %ad %s' --date=short origin/main
3ba0e38ae5dbc88da5a3fa72addc95566719d675 2026-09-30 docs(audit): deploy record CP [skip-automerge] (#2373)
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

- **Continuity:** the tree agrees with Evoni's account (5 commits, 28 files,
  the two migrations, no package change), with no gap after CP. Production
  is at `3ba0e38a`, level with `origin/main`.
- **Deploy:** manual, per §7.1:
  - fast-forward and backup;
  - 2 pending of 229;
  - both migrations run, then 0 pending of 229;
  - build;
  - one restart (count 46);
  - `/health` healthy and connected.
- **CFO:** 89/100, 0 critical, 4 warnings.
- **App check:** not checked yet (Evoni).
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
