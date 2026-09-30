| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CP, 2026-09-30, backend and frontend, no migration, no dependency change, one plain restart. Evoni ran it herself with `scripts/deploy-prod.sh`, outside any agent session. Deal build PR 4 (itemised event costs, #2367) and the Season Arc Auto-Reorder removal (#2369) go live. Production stops short of origin/main: #2370 and #2371 ship with CQ.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CO.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `b31b0a61029ae3435ab939a51b2720c01f301444` (#2371),
read 2026-09-30. Deploy CP moved production to `8dd85f76` (#2369), two
commits before it (§8).

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
path, account number, database user or ARN. Two things in Evoni's paste
are left out: the database user named in the pending-check line, and the
shell prompt after the end marker, which names the host.

**The letter.** This deploy is lettered **CP**. It follows CO
(`F-Deploy-1_Deploy_2026-09-30_CO.md`, #2366), the register's last deploy
record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-30, about
16:17–16:18 UTC, from `scripts/deploy-prod.sh` in its order:

1. **Fast-forward.** Tree `0c20714a` → `8dd85f76` (fast-forward): 3
   commits, 28 files; PRs #2366, #2367, #2369. The script reported no
   migration and no package or lock file in the range.
2. **Backup.** `frontend/dist` was backed up (sortable name, stamped
   2026-09-30T16:17:00Z).
3. **Build.** `vite build`, built in 36.44 s.
4. **Pending migrations.** The check read `SequelizeMeta` with
   `NODE_ENV=production` against the canon instance's `episode_metadata`
   database (the user is left out): **0 pending of 227** migration files,
   exit 0. Evoni confirmed the database.
5. **Environment.** `ANTHROPIC_API_KEY` appears in `.env` once (count 1;
   the value was not read).
6. **Restart.**
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 45.
   - Ready line at 16:17:51: "Ready to accept requests".
   - `/health` at 2026-09-30T16:17:51Z: healthy, database connected,
     environment production, uptime 6.3 s.
7. **CFO.** Scheduled audit 16:17:59–16:18:06: **89/100**, 0 critical, 4
   warnings (7424 ms).

**#2370 is not in CP (Evoni):** "#2370 not included, it will ship with
CQ." It merged after the deploy's tree was taken (§8).

**App check (Evoni):** "the Terms area shows Deal type, Deal price, Costs
and the lock note on a used event." This is her look at a used event's
Event Package; it covers the Terms area, not every change in the range.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 0c20714a3d647d421238dd6d1dca6dc612c87ed9 8dd85f76eff01d608be60809d2cb92dc115bb68c && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CO ends at `0c20714a` (CO record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CO left it at 44 (CO
record §6), and CP's single restart brings it to 45.

## §2. The range — MEASURED

```
$ git rev-list --count 0c20714a..8dd85f76
3
$ git log --oneline 0c20714a..8dd85f76
8dd85f76e refactor(season): remove Season Arc's Auto-Reorder [skip-automerge] (#2369)
b3f1163f9 docs(audit): deploy record CO [skip-automerge] (#2366)
d744d7b9a feat(deals): deal build PR 4, itemised event costs [skip-automerge] (#2367)
$ git diff --shortstat 0c20714a 8dd85f76
 28 files changed, 1827 insertions(+), 195 deletions(-)
$ git diff --name-only 0c20714a 8dd85f76 -- src/migrations/
$ git diff --name-only 0c20714a 8dd85f76 -- package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
$ git diff --name-only 0c20714a 8dd85f76 -- frontend/ | wc -l
13
$ git diff --name-only 0c20714a 8dd85f76 -- src/ | wc -l
10
```

This agrees with Evoni's account:
- 3 commits, the three PRs named;
- 28 files;
- no migration;
- no package or lock file.

13 frontend files changed, so the build used new sources. 10 backend files
changed, including the new route `src/routes/eventCosts.js`, mounted in
`src/app.js`; the restart was needed to load them.

## §3. The time

**ATTESTED.** The deploy ran about 16:17–16:18 UTC: backup stamped
16:17:00Z, ready and `/health` at 16:17:51, CFO done 16:18:06.

**MEASURED.** The range's last commit, #2369, is at 16:14:33 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 0c20714a..8dd85f76
8dd85f76e 2026-09-30T12:14:33-04:00 refactor(season): remove Season Arc's Auto-Reorder [skip-automerge] (#2369)
b3f1163f9 2026-09-30T11:16:09-04:00 docs(audit): deploy record CO [skip-automerge] (#2366)
d744d7b9a 2026-09-30T11:04:44-04:00 feat(deals): deal build PR 4, itemised event costs [skip-automerge] (#2367)
```

## §4. Migrations

**MEASURED.** The tree still holds 227 migration files, as at CO:

```
$ git ls-tree -r --name-only 8dd85f76 src/migrations | grep -c '\.js$'
227
```

**ATTESTED (§0):** 0 pending of 227. This agrees with the tree and with CO.
PR 4 needs no migration: `event_costs` has existed since deal build PR 1
(`20260929200003`).

## §5. What went live — MEASURED

- **#2367 (`d744d7b9`), Task #2365: deal build PR 4, itemised event
  costs** (`docs/DEAL_DESIGN.md` §5; Evoni's answer 2 of 2026-09-30,
  §10.3).
  - A deal event's costs are `event_costs` rows, each paid by Lala or
    comped by the host or brand. They are edited under Terms and locked at
    Start Episode.
  - For a deal event, Finalize charges one `event_cost` expense per row
    Lala pays. It no longer charges `cost_coins` as entry or the hidden
    `styling_extras` row. Legacy events are charged as before.
  - "Draft extras" (and a deal's first Propose terms) drafts the event's
    extras and, for a self-funded or comped deal, an "Entry / ticket" line
    at `cost_coins`.
  - `cost_coins` reads "Difficulty" for deal events.
- **#2369 (`8dd85f76`), Task #2363:** Season Arc's Auto-Reorder is
  removed. It moved started events through `/inject`, which the terms lock
  refuses.
- **#2366:** the CO deploy record. A document with no runtime effect.

**INFERRED consequence (from #2367):** every event created since deal
build PR 2 has a deal type. Such an event is now charged only its listed
costs, which are none until they are drafted or added. This was stated in
#2367 before merge.

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 45.
- `ANTHROPIC_API_KEY` is present in `.env` (count 1; value not read).
- The account does not mention `episode-worker`.

## §7. Schema changes

None. The range carries no migration (§2, §4).

## §8. Basis statement

**MEASURED.** Production's tree after Deploy CP is `8dd85f76` (#2369).
`origin/main` at filing is two commits ahead of it: #2370 and #2371 (deal
build PR 5, with a migration) merged after the deploy and ship with CQ.

```
$ git log --oneline 8dd85f76..origin/main
b31b0a610 feat(deals): deal build PR 5, payouts at Complete and on approval [skip-automerge] (#2371)
7d98260a9 fix(wardrobe): apply texture-enhance's clarity sharpen pass [skip-automerge] (#2370)
$ git log -1 --format='%H %ad %s' --date=short origin/main
b31b0a61029ae3435ab939a51b2720c01f301444 2026-09-30 feat(deals): deal build PR 5, payouts at Complete and on approval [skip-automerge] (#2371)
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

- **Continuity:** the tree agrees with Evoni's account (3 commits, 28 files,
  no migration, no package change), with no gap after CO. Production is at
  `8dd85f76`, two commits behind `origin/main` (#2370 and #2371, for CQ).
- **Deploy:** `scripts/deploy-prod.sh`: fast-forward, backup, build, 0
  pending of 227, one restart (count 45). `/health` healthy and connected.
- **CFO:** 89/100, 0 critical, 4 warnings.
- **App check:** the Terms area shows Deal type, Deal price, Costs and the
  lock note on a used event (Evoni).
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
