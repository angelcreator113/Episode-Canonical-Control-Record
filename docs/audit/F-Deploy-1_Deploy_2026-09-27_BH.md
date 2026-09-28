| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BH, 2026-09-27, backend only, one migration (a no-op on production), one plain restart, performed personally by Evoni, outside any agent session. `registry_characters.world` gets its creating migration; the Story Engine write-back touches only its own registry's character.* |
| --- |

> **BANNER** (added 2026-09-28, additive; `F-Reg-2_Fix_Plan_v1.2.md` §3, Task #2174). See `F-Reg-2_OwedScoping_2026-09-28.md` §2.2 (PR #2173) for a repository finding bearing on §7.

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_BG.md` (the BG record) or of
`F-Deploy-1_Deploy_2026-09-28_BI.md` (the BI record, which names this deploy's
record as owed). This document follows them rather than editing either. Basis:
`0386bb97cda965ec33ee4cbbcc2a5bf64f406adf` (#2114), the tree Deploy BH moved
production to. `origin/main` at filing is `fc75e20d` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states, from her terminal output. It cannot be
  reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`show` any clone can reproduce, and register documents
  already merged under `docs/audit/`.
- **NOT ESTABLISHED** marks what neither her account nor the repository
  settles (§7).

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, password, database
host, IP address, key path, account number or ARN.

**The letter.** This deploy is lettered BH. It followed Deploy BG and came
before Deploy BI, whose record (§1 there) found it unrecorded and left BH for
it. The BI record is filed: `docs/audit/F-Deploy-1_Deploy_2026-09-28_BI.md`
(PR #2130, squash `fc75e20d931201323dd1a30e4646a3fd660f8f3e`); nothing here
edits it.

## §0. Evoni's account, as given

**ATTESTED (Evoni's terminal output, 2026-09-27, about 23:21 to 23:23 UTC):**

- Fast-forward `acdb6c7d` → `0386bb97`, 11 files.
- Pending-migration check, run with `NODE_ENV=production`, against the canon
  instance, database `episode_metadata` as `episode_app_dev`: **1 pending of
  220**, `20260927210000-add-registry-characters-world.js`, exit 1. No
  restart had been made at that point.
- She ran `npx sequelize-cli db:migrate` with `NODE_ENV=production` as
  `DB_USER=postgres`; the password was entered at a hidden prompt and unset
  afterwards. The migration printed that type `enum_registry_characters_world`
  "already exists with the expected labels; unchanged" and that
  `registry_characters.world` "already exists; unchanged"; it migrated in
  0.062s, exit 0.
- Re-check: **0 pending of 220**, exit 0.
- `node -c src/routes/storyEvaluationRoutes.js`: ok.
- One plain `pm2 restart episode-api-prod-hotfix`: restart count 9, online.
  `/health` reported healthy, database connected, at
  `2026-09-27T23:22:57Z`.
- No frontend build: the range has no frontend files.

No hostname, address, key path or credential from her output is recorded
here.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `acdb6c7d` to `0386bb97` by fast-forward.

**MEASURED.** The start is an ancestor of the end:

```
$ git merge-base --is-ancestor acdb6c7dc520ec548cd6ad8f6aa02c2a2f0bbdaf 0386bb97cda965ec33ee4cbbcc2a5bf64f406adf && echo ancestor
ancestor
```

Deploy BG ends at `acdb6c7d` (BG record §1, §8); Deploy BH begins there.
Deploy BI begins at `0386bb97`, where BH ends (BI record §1).

## §2. The range — MEASURED

```
$ git rev-list --count acdb6c7d..0386bb97
5

$ git log --oneline acdb6c7d..0386bb97
0386bb97c feat(db): a migration that adds registry_characters.world as production has it [skip-automerge] (#2114)
f8c8509a6 fix(stories): write-back updates only its own registry's character [skip-automerge] (#2113)
b00b8fc83 docs(audit): F-Reg-2 Fix Plan v1.1, world column homed [skip-automerge] (#2115)
7db3a9ac9 docs(audit): file deploy record BG [skip-automerge] (#2112)
dcd60857a docs(events): record event-generation rulings, amend rule 14 [skip-automerge] (#2103)

$ git diff --name-only acdb6c7d 0386bb97
docs/DESIGN_DOCTRINE.md
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-09-27_BG.md
docs/audit/F-Reg-2_Fix_Plan_v1.1.md
scripts/schema-agreement-step2.baseline
src/migrations/20260927210000-add-registry-characters-world.js
src/routes/storyEvaluationRoutes.js
tests/integration/registryJsonWrites.integration.test.js
tests/integration/registryJsonWrites2.integration.test.js
tests/integration/registryWorldMigration.integration.test.js
tests/integration/writeBackRegistryScope.integration.test.js

$ git diff --name-only acdb6c7d 0386bb97 -- package.json package-lock.json frontend/package.json frontend/package-lock.json frontend/src; echo "exit=$?"
exit=0
```

Five commits, eleven files, matching her count. Code: #2113
(`src/routes/storyEvaluationRoutes.js`) and #2114 (one new migration).
The rest is docs, a script baseline and four integration tests. No frontend
file, no package manifest or lockfile.

## §3. The time

**ATTESTED.** About 23:21 to 23:23 UTC on 2026-09-27; `/health` answered at
23:22:57 UTC (§0).

**MEASURED.** The newest commit in the range is #2114, 23:17:39 UTC, so the
deploy followed it within minutes:

```
$ git log --first-parent --format="%h %cI %s" acdb6c7d..0386bb97 | head -1
0386bb97c 2026-09-27T19:17:39-04:00 feat(db): a migration that adds registry_characters.world as production has it [skip-automerge] (#2114)
```

## §4. Pre-deploy checks

**ATTESTED.** Pending-migration check: 1 pending of 220
(`20260927210000-add-registry-characters-world.js`), exit 1, before any
restart. After the migration: 0 pending of 220, exit 0.
`node -c src/routes/storyEvaluationRoutes.js`: ok.

**MEASURED.** The migration tree holds 219 files at the start of the range and
220 at the end; the one added is this migration:

```
$ git ls-tree -r --name-only acdb6c7d src/migrations | wc -l
219
$ git ls-tree -r --name-only 0386bb97 src/migrations | wc -l
220
$ git diff --name-only acdb6c7d 0386bb97 -- src/migrations
src/migrations/20260927210000-add-registry-characters-world.js
```

## §5. What went live

### §5.1 The change, MEASURED

- #2113 (`f8c8509a`): the Story Engine write-back in
  `src/routes/storyEvaluationRoutes.js` updates only the character in its own
  registry.
- #2114 (`0386bb97`): `src/migrations/20260927210000-add-registry-characters-world.js`,
  the creating migration for `registry_characters.world` (F-Reg-2 Fix Plan
  v1.1; Task #2111). In one transaction it creates the type
  `enum_registry_characters_world` (labels `book-1`, `lalaverse`, `series-2`)
  only if absent, stops with an error if the type exists with other labels or
  order, and adds the column only if absent. Its `down` does nothing.
- #2103, #2112, #2115: docs only (the §8(u) rulings and rule 14, the BG
  record, F-Reg-2 Fix Plan v1.1).

### §5.2 The migration on production, beside the code

**ATTESTED (§0).** The migration printed that the type "already exists with
the expected labels; unchanged" and the column "already exists; unchanged",
and finished in 0.062s, exit 0.

**MEASURED.** Those are the migration's own messages for the case where both
exist with the expected labels:

```
$ grep -n "already exists" src/migrations/20260927210000-add-registry-characters-world.js
63:        console.log(`[migration 20260927210000] type ${TYPE} already exists with the expected labels; unchanged.`);
75:        console.log('[migration 20260927210000] registry_characters.world already exists; unchanged.');
```

So on production the migration
changed no schema and wrote no data; it recorded itself as applied. This
matches `F-Reg-2_Fix_Plan_v1.1.md` §2, Evoni's production read of
2026-09-27 (ATTESTED there): `world` present, `USER-DEFINED`, `enum_registry_characters_world`,
nullable, no default, labels `book-1`, `lalaverse`, `series-2` in order.

### §5.3 The migration identity

**ATTESTED.** The migration ran as `postgres`, with the password entered at a
hidden prompt and unset afterwards, not as the app user.

**MEASURED.** This is the path `PROJECT_CONTEXT.md` §0 item 11 records:
migrations reach production as `postgres`, run by Evoni, because the app user
owns no table (the owed "migration identity" row in §6.5). This record changes
nothing about that item.

## §6. Restarts

**ATTESTED.** One plain restart of `episode-api-prod-hotfix`, after the
migration; the restart count is 9, online. `/health` healthy, database
connected, at 23:22:57 UTC.

**MEASURED.** A backend file changed (§2), so a restart was needed for it to
take effect. No `.env` or credential change is in the range.

**The restart chain across the records:**
- BG took the count from 7 to 8 (BG record §6).
- BH took it from 8 to 9.
- BI took it to 10 (BI record §6).

## §7. Schema changes

**ATTESTED.** One migration ran, `20260927210000-add-registry-characters-world.js`,
and reported both the type and the column already present and unchanged (§0,
§5.2). 0 pending of 220 afterwards.

**MEASURED.** No other file under `src/migrations/` changes in the range (§4).
Before #2114, no migration created `enum_registry_characters_world` or
`registry_characters.world` (`F-Reg-2_Fix_Plan_v1.1.md` §3, which records the
`git grep` of the migration tree at `acdb6c7d`).

**NOT ESTABLISHED: who applied the type and the column on production, and
when.** They existed before this migration ran (§5.2), and no migration in the
tree created them before #2114. Neither Evoni's account nor the repository
says who added them or when. This record does not infer it.

**A precedent, cited without ruling.** `PROJECT_CONTEXT.md` §7, the row "Prod
box — deploy history to 2026-09-22 (carried)", records that on 2026-09-22
Evoni added `category`/`format` columns to `world_events` "by direct
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on the production database, not
through the migration tool", citing `F-Deploy-1_Deploy_2026-09-22.md` §3. That
is a precedent for a schema change made directly on production; it is not
evidence of how or when `registry_characters.world` was made, and this record
draws no conclusion from it.

## §8. Basis statement

**MEASURED.** After Deploy BH, production's tree was this record's basis,
`0386bb97`; Deploy BI later moved it to `28d14ff9` (BI record). At filing,
after `git fetch origin`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
fc75e20d931201323dd1a30e4646a3fd660f8f3e 2026-09-27 docs(audit): file deploy record BI [skip-automerge] (#2130)
```

## §9. What this document does not do

This document:

- records no token, password, database host, IP address, key path, account
  number or ARN;
- does not edit the BG or BI records or any other filed document;
- does not establish who made `registry_characters.world` on production, or
  when (§7);
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 (including the
  migration identity) or any Fix Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, restart, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS, database
  or Cognito contact. Every ATTESTED claim is Evoni's own account, taken
  outside any agent session. Every MEASURED claim is a repository read this
  filing session performed itself.

## §10. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Nothing minted here.

## §Standing

- §1 and §2 each carry ATTESTED and MEASURED clauses, marked separately.
- The tree agrees with her account: five commits, eleven files, one migration,
  one backend route file, no frontend or package change (§2).
- **The migration (§5.2):** a no-op on production; type and column already
  present with the expected shape; recorded as applied; 0 pending of 220.
- **The live check (§6):** after one plain restart (8 → 9, online), `/health`
  reported healthy and connected.
- **NOT ESTABLISHED (§7):** who applied `registry_characters.world` and its
  type on production, and when. The 2026-09-22 direct-ALTER precedent is cited,
  not relied on.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
