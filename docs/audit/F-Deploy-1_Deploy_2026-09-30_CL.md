| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CL, 2026-09-30, a script deploy (`scripts/deploy-prod.sh`), backend code, no migration, no dependency change, one plain restart. Evoni ran it herself, outside any agent session. The Finalize `coin_cost` fix (#2348) goes live. #2349 merged after her fetch and is not in this tree.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CK.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `f32fb543ee5b363b4a68c3b28f160fe9575da4fc` (#2349),
read 2026-09-30. Deploy CL moved production to `2faae32b` (#2348), one
commit behind it (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, as she gave it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email, password, hostname, IP address, key path,
account number, database user or ARN.

**The letter.** This deploy is lettered **CL**. It follows CK
(`F-Deploy-1_Deploy_2026-09-30_CK.md`, PR #2353), the register's last
deploy record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's paste of the `scripts/deploy-prod.sh` summary,
2026-09-30, about 11:51–11:53 UTC, in its order:

1. **Tree.** `80a4bd75 -> 2faae32b`, a fast-forward.
   - Range: 1 commit, 3 files; PR #2348.
   - "No migration or package/lock file in the range."
2. **Backup.** `frontend/dist` was backed up (sortable name, 11:51:28Z).
3. **Build.** `vite build` "built in 36.03s".
4. **Pending migrations.**
   - The script's check read `SequelizeMeta` on the production database
     (host hidden in the paste; the database was confirmed by Evoni).
   - Result: "OK: 0 pending of 226 migration files checked." (exit 0).
5. **Key presence.** `ANTHROPIC_API_KEY` in `.env`: count 1 (value not
   read).
6. **Restart.**
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 41.
   - `/health` at 2026-09-30T11:52:33Z: healthy, database connected, uptime
     6.1 s, environment production.
   - Ready line at 11:52:32.
7. **CFO.** Scheduled audit 11:52:40–11:52:44: **89/100**, 0 critical,
   4 warnings.

**App check: not supplied.** The paste carries none, so this record claims
none.

**Not recorded.** The paste's trailing shell prompt carried a hostname. It
is left out, as are the database's host and user.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 80a4bd75e0bad53a2da22a7f9451bda01e79ad0e 2faae32b6aba30c55a03aef95d6a5fa9e7604f80 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CK ends at `80a4bd75` (CK record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CK left it at 40 (CK
record §6), and CL's single restart brings it to 41.

## §2. The range — MEASURED

```
$ git rev-list --count 80a4bd75..2faae32b
1
$ git log --oneline 80a4bd75..2faae32b
2faae32b6 fix(finalize): store coin_cost in the event outfit snapshot so Finalize charges it [skip-automerge] (#2348)
$ git diff --shortstat 80a4bd75 2faae32b
 3 files changed, 130 insertions(+), 4 deletions(-)
$ git diff --name-only 80a4bd75 2faae32b
src/routes/worldEvents.js
src/services/financialTransactionService.js
tests/integration/outfitSnapshotCoinCost.integration.test.js
$ git diff --name-only 80a4bd75 2faae32b -- src/migrations/ package.json package-lock.json; echo "EXIT: $?"
EXIT: 0
$ git diff --name-only 80a4bd75 2faae32b -- frontend/ | wc -l
0
```

This agrees with Evoni's account: 1 commit, 3 files, #2348, no migration
and no package or lockfile change.

**Noted:** nothing under `frontend/` changed. The script builds the
frontend on every deploy, so its `vite build` rebuilt the same sources
(INFERRED from the script's step order, as in CJ §2; the build output was
not compared).

## §3. The time

**ATTESTED.** The deploy ran about 11:51–11:53 UTC: backup 11:51:28Z,
`/health` 11:52:33Z with an uptime of 6.1 s, CFO done 11:52:44.

**MEASURED.** The range's one commit, #2348, is at 11:41:36 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 80a4bd75..2faae32b
2faae32b6 2026-09-30T07:41:36-04:00 fix(finalize): store coin_cost in the event outfit snapshot so Finalize charges it [skip-automerge] (#2348)
```

## §4. Migrations

**MEASURED.** The tree holds 226 migration files, the same as CK, and the
range adds none:

```
$ git ls-tree -r --name-only 2faae32b src/migrations | grep -c '\.js$'
226
```

**ATTESTED (§0):** the script's pending check read 0 pending of 226. The
two agree.

## §5. What went live — MEASURED

- **#2348 (`2faae32b`), Task #2346: Finalize charges `coin_cost`.** The
  event outfit route (`PUT /world/:showId/events/:eventId/outfit`,
  `src/routes/worldEvents.js`) now stores `coin_cost` in the
  `outfit_pieces` snapshot, and `finalizeEpisodeFinancials`
  (`src/services/financialTransactionService.js`) charges it. A snapshot
  written before this deploy has no `coin_cost` and keeps the old fallback
  to price.
  - A piece whose `coin_cost` is 0 now writes no purchase row.
  - Not fixed by it: the snapshot still lacks `rental_price` (#2348's PR
    text).

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 41.
- `ANTHROPIC_API_KEY` present in `.env` (count 1, value not read).
- `episode-worker` is not reported.

## §7. Schema changes

**MEASURED.** None (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy CL, production's tree is `2faae32b` (#2348).
`origin/main` at filing is one commit ahead: #2349 (the wardrobe price
floor removal), which merged after Evoni's fetch. It changes backend and
frontend code, with no migration or package change, and is not yet
deployed:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
f32fb543ee5b363b4a68c3b28f160fe9575da4fc 2026-09-30 fix(wardrobe): remove the $150 price floor; price by item type and tier, fill only an empty price [skip-automerge] (#2349)
$ git rev-list --count 2faae32b..origin/main
1
$ git diff --name-only 2faae32b origin/main
frontend/src/pages/WorldAdmin.jsx
frontend/src/utils/wardrobeAutoFill.js
frontend/src/utils/wardrobeAutoFill.test.js
src/routes/wardrobeLibrary.js
src/utils/wardrobePriceGuide.js
tests/unit/utils/wardrobePriceGuide.test.js
$ git diff --name-only 2faae32b origin/main -- src/migrations/ package.json package-lock.json | wc -l
0
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It queries nothing in production.
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

- **Continuity:** the tree agrees with Evoni's account (1 commit, #2348,
  no migration, no package change), with no gap after CK. Production is at
  `2faae32b`; `origin/main` is one undeployed commit ahead (#2349, §8).
- **Deploy:** by `scripts/deploy-prod.sh`: backup, build, 0 pending
  migrations, one restart (count 41). `/health` healthy and connected.
- **CFO:** 89/100, 0 critical, 4 warnings.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
