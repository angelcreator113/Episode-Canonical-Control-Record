| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CF, 2026-09-29, backend and frontend, five migrations, one plain restart. Evoni ran it herself, outside any agent session, as a manual deploy under `DEVELOPMENT_WORKFLOW.md` §7.1, because the range carried migrations. Deal build PR 1 (the deal schema, with the version 1 rate anchors seeded), the career-tier fix and the deal answers go live. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_CE.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `1eaa088844324bbdd35b64a1f04bdc4efb5303ad` (#2325),
read 2026-09-29. This is the tree Deploy CF moved production to (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, and the terminal excerpt
  she pasted.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.
- **CANNOT-TELL**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email, password, hostname, IP address, key path,
account number or ARN. Evoni's paste included the shell prompt and the
database endpoint; neither is reproduced here, and the endpoint is shown as
`[host hidden]`. The database password was typed at a hidden prompt and is
not in her account.

**The letter.** This deploy is lettered **CF**. It follows CE
(`F-Deploy-1_Deploy_2026-09-29_CE.md`), the register's last deploy record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account, 2026-09-29, about 22:55–23:03 UTC, in her
order:

1. **Fetch and fast-forward.**
   - `git fetch` found the range `8e210132..1eaa0888`: 5 commits (#2320,
     #2322, #2323, #2324, #2325). The package and lockfile diff was empty.
   - `frontend/dist` was backed up to `~/dist-backup-<timestamp>`.
   - `git merge --ff-only` moved the tree to `1eaa0888` (21 files).
2. **The pending check.** `check-pending-migrations` ran against the canon
   instance, `episode_metadata` as `episode_app_dev`: **5 pending of 226**,
   exit 1.
3. **The migrations.** `npx sequelize-cli db:migrate` ran as
   `DB_USER=postgres` with `NODE_ENV=production`. The password was typed at
   a hidden prompt and unset afterwards. Exit 0. The re-check found
   **0 pending of 226**, exit 0.
4. **Build and restart.**
   - `vite build` ✓ in 33.00 s.
   - `ANTHROPIC_API_KEY` count 1 (value not read); `.env` unchanged.
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 34,
     online.
   - `/health` at 2026-09-29T23:03:18Z: healthy, database connected, uptime
     20.1 s.
   - Ready at 23:03:06.
   - CFO 23:03:14–23:03:18: 84/100, 1 critical (`dependency_audit`, 15
     critical/high), 4 warnings.
   - `episode-worker` is stopped (a standing state).

**The terminal excerpt Evoni pasted** covers step 3 and the re-check. It
is shortened here. Removed:
- the shell prompt and the commands;
- the two dotenv notices and the blank lines;
- each migration's `migrating` line, keeping its `migrated` line;
- the database endpoint, shown as `[host hidden]`.

The lines kept are unchanged:

```
Sequelize CLI [Node: 20.20.1, CLI: 6.6.5, ORM: 6.37.8]
Loaded configuration file "src/config/sequelize.js".
Using environment "production".
== 20260929200000-add-world-events-deal-terms: migrated (0.052s)
== 20260929200001-add-event-deliverables-fee: migrated (0.029s)
== 20260929200002-create-deal-rate-anchors: migrated (0.071s)
== 20260929200003-create-event-costs: migrated (0.024s)
== 20260929200004-add-ledger-deal-payout-unique: migrated (0.012s)
exit=0
[pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
[pending-migrations] OK: 0 pending of 226 migration files checked.
exit=0
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 8e210132 1eaa0888 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CE ends at `8e210132` (CE record §1 and §8), and that is where
this deploy starts.

**The restart count is continuous (ATTESTED):** CE left it at 33 (CE
record §6), and CF's single restart brings it to 34.

## §2. The range — MEASURED

```
$ git rev-list --count 8e210132..1eaa0888
5
$ git log --oneline 8e210132..1eaa0888
1eaa08884 docs(deps): list the 15 critical/high dependency findings [skip-automerge] (#2325)
b2b4cf579 docs(audit): deploy record CE [skip-automerge] (#2324)
be24b7b65 feat(deals): deal build PR 1, the schema [skip-automerge] (#2323)
0994ed9e5 docs(deals): record the deal answers as §8(cc) and in DEAL_DESIGN §10 [skip-automerge] (#2322)
e60d6890a fix(career): align every career-tier map to the canonical five [skip-automerge] (#2320)
$ git diff --shortstat 8e210132 1eaa0888
 21 files changed, 1335 insertions(+), 10 deletions(-)
$ git diff --name-only 8e210132 1eaa0888
docs/DEAL_DESIGN.md
docs/DEPENDENCY_AUDIT_2026-09-29.md
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-09-29_CE.md
src/migrations/20260929200000-add-world-events-deal-terms.js
src/migrations/20260929200001-add-event-deliverables-fee.js
src/migrations/20260929200002-create-deal-rate-anchors.js
src/migrations/20260929200003-create-event-costs.js
src/migrations/20260929200004-add-ledger-deal-payout-unique.js
src/models/DealRateAnchor.js
src/models/DealRatePremium.js
src/models/EventCost.js
src/models/EventDeliverable.js
src/models/WorldEvent.js
src/models/index.js
src/routes/worldEvents.js
src/services/careerPipelineService.js
src/utils/careerTiers.js
tests/integration/careerTiersCanonical.integration.test.js
tests/integration/dealSchemaPr1.integration.test.js
tests/unit/models/eventTerms.models.test.js
$ git diff --name-only 8e210132 1eaa0888 -- package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with Evoni's account: 5 commits, 21 files, the same five PRs,
and no package or lockfile change.

The runtime files are backend only:
- five migrations;
- the models `WorldEvent`, `EventDeliverable`, and three new ones,
  `DealRateAnchor`, `DealRatePremium` and `EventCost`, registered in
  `src/models/index.js`;
- `worldEvents.js`, `careerPipelineService.js` and the new
  `src/utils/careerTiers.js`.

No frontend source changed, so the rebuilt bundle carries no code change
(INFERRED from the file list).

## §3. The time

**ATTESTED.** The deploy ran about 22:55–23:03 UTC. The app was ready at
23:03:06, and `/health` answered at 23:03:18Z with an uptime of 20.1 s.

**MEASURED.** The newest commit in the range is #2325, at 22:46:46 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 8e210132..1eaa0888 | head -1
1eaa08884 2026-09-29T18:46:46-04:00 docs(deps): list the 15 critical/high dependency findings [skip-automerge] (#2325)
```

## §4. The migrations, and the §7.1 path

**ATTESTED (§0).** Evoni took the §7.1 manual path, in this order:
1. backup and fast-forward;
2. pending check (5 of 226);
3. `db:migrate` as `postgres`;
4. re-check (0 of 226);
5. build and restart.

The migrations ran **before** the restart. That was required: the
`WorldEvent` and `EventDeliverable` models now declare the new columns, so
model reads fail on a database without them (PR #2323's deploy note).

**MEASURED.** The tree holds 226 migration files, five more than CE's 221,
and the five added are this range's:

```
$ git ls-tree -r --name-only 1eaa0888 src/migrations | grep -c '\.js$'
226
$ git diff --name-only 8e210132 1eaa0888 -- src/migrations/
src/migrations/20260929200000-add-world-events-deal-terms.js
src/migrations/20260929200001-add-event-deliverables-fee.js
src/migrations/20260929200002-create-deal-rate-anchors.js
src/migrations/20260929200003-create-event-costs.js
src/migrations/20260929200004-add-ledger-deal-payout-unique.js
```

What each migration does (MEASURED, from the files at this tree). Each
checks before it adds, and each has a `down` that removes only what it
added.

| Migration | Adds |
|---|---|
| `200000` | `world_events`: `deal_type` varchar(30), `appearance_fee` integer, `bonus_terms` jsonb, `gifted_value` integer, `pricing_version` integer, all nullable |
| `200001` | `event_deliverables.fee`, integer, nullable |
| `200002` | Two tables, `deal_rate_anchors` and `deal_rate_premiums`, each with a partial unique index. It seeds version 1 from Evoni's Q4 answer (§8(cc)) only while version 1 is empty: 25 anchor rows and 8 premium rows. |
| `200003` | The table `event_costs`, with a foreign key to `world_events` and an index on `event_id` |
| `200004` | The partial unique index `financial_transactions_deal_payout_once` on `(category, source_id)`, for `appearance_fee`, `content_fee` and `deal_bonus` rows that are executed and not deleted |

**CANNOT-TELL** from here:
- the seed's row counts in production;
- that no existing ledger row conflicted with the new index.

Evoni's account gives neither, and this record does not query production.
The migration exited 0, and a conflicting row would have failed the index
creation. No code wrote those three ledger categories before this tree
(PR #2323).

## §5. What went live — MEASURED

- **#2323 (`be24b7b6`), Task #2319: deal build PR 1, the schema
  (`docs/DEAL_DESIGN.md` §8, §11.4).**
  - The five migrations of §4.
  - The model fields, with `deal_type` limited to the eight deal types.
  - The three new models.
  - No behaviour change: no code reads the new fields, and `deal_type` is
    null on every event.
- **#2320 (`e60d6890`), Task #2317: the career-tier maps are aligned to the
  canonical five** (Emerging, Rising, Established, Influential, Elite = 1–5;
  `src/utils/careerTiers.js`).
  - The event PUT's label map now takes Elite to 5, and "icon" is refused
    with a 400.
  - The accessible tier (`getAccessibleCareerTier`) and the next-suggestions
    gate use `ceil(rep/2)`, clamped to 1–5. At reputation 2, 4, 6 and 8 the
    tier is one lower than before; at reputation 8, Influential rather than
    Elite. Evoni accepted the canonical bands on 2026-09-29.
- **Docs and register only:**
  - #2322: the deal answers, §8(cc), and `DEAL_DESIGN.md` §10–§11;
  - #2324: deploy record CE;
  - #2325: `docs/DEPENDENCY_AUDIT_2026-09-29.md`.

**Not in this tree:** the in-range lockfile fixes (Task #2326, PR #2327).
They are open, not merged, at filing.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 15
critical/high), 4 warnings, the same as at CE. No package changed (§2).

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 34,
  online.
- `ANTHROPIC_API_KEY` count 1 (value not read); `.env` unchanged.
- `episode-worker` is stopped, a standing state that this deploy did not
  change.

## §7. Schema changes

**MEASURED (§2, §4):** five migrations.
- New columns: five on `world_events` and one on `event_deliverables`.
- New tables: `deal_rate_anchors`, `deal_rate_premiums` and `event_costs`.
- New indexes: the two rate-table unique indexes, `event_costs_event_id`,
  and `financial_transactions_deal_payout_once`.

**ATTESTED (§0):** applied in production before the restart; 0 pending
after.

## §8. Basis statement

**MEASURED.** After Deploy CF, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
1eaa088844324bbdd35b64a1f04bdc4efb5303ad 2026-09-29 docs(deps): list the 15 critical/high dependency findings [skip-automerge] (#2325)
$ git rev-parse --is-shallow-repository
false
```

## §9. Noted, not investigated

- **Who owns the three new tables.** The migrations ran as `postgres`, and
  the app connects as `episode_app_dev` (§0).
  - **INFERRED:** `deal_rate_anchors`, `deal_rate_premiums` and
    `event_costs` were created owned by `postgres`.
  - **CANNOT-TELL:** whether `episode_app_dev` can read and write them.
    That depends on production's default privileges, which this record
    does not query.
  - **Why it does not matter yet:** no code reads or writes the new tables
    at this tree (§5), so nothing fails today.
  - **When it will matter:** the first PR that uses them (DEAL_DESIGN §8
    PR 3, pricing, and PR 4, itemised costs). Evoni may want to check the
    grants before that deploy.
- The new columns on existing tables (`world_events`, `event_deliverables`)
  and the ledger index belong to tables the app already uses. This record
  does not assess them further.

## §10. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It queries nothing in production.
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

- **Continuity:** the tree agrees with Evoni's account (5 commits, 21 files,
  five migrations, no package change), with no gap after CE. Production is
  at `origin/main`, `1eaa0888`.
- **Deploy:** a manual deploy under §7.1. The migrations ran before the
  restart; 0 pending of 226 after. `/health` healthy and connected; restart
  count 34.
- **CFO:** 84/100, 1 critical (15 critical/high), 4 warnings.
- **Live here:** the deal schema (no behaviour change) and the canonical
  career tiers.
- **Noted:** the new tables' grants for the app user, before the first PR
  that uses them (§9).
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
