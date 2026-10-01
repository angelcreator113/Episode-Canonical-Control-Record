| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DB, 2026-10-01, backend and frontend, by `scripts/deploy-prod.sh` end to end. A fast-forward of 1 commit and 8 files from `20cb81db` to `72ba7bbd`: Season Arc PR 8 (#2446, Planning Insights), with no migration and no package or lock file; 0 pending of 244; one plain restart. CFO 89/100 with 4 warnings, unchanged from DA. The app check has not been done yet. The restart count is continuous from DA (57 → 58). Production is at `origin/main`: every Season Arc build PR (1–8) is live.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-01_DA.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `72ba7bbdb92b8297a48e0e50157b4e19d979383b` (#2446),
read 2026-10-01. Deploy DB moved production to this same commit (§7).

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
path, account number, database user or ARN. The script's output names the
database user its pending-migrations check read as; it is left out here,
as in the CW–DA records.

**The letter.** This deploy is lettered **DB**, the letter after DA. It
follows DA (`F-Deploy-1_Deploy_2026-10-01_DA.md`, filed in #2448, which
was still open when this record was written; CZ, #2447, was open too).

## §0. Evoni's account, as given

**ATTESTED.** The script's output as Evoni pasted it, 2026-10-01, about
20:21–20:23 UTC (the hidden host, the database and its user, and the log
prefixes left out):

1. **Tree.** `20cb81db` → `72ba7bbd`, fast-forward. Range: 1 commit, 8
   files; PR #2446. "No migration or package/lock file in the range."
2. **Backup.** `frontend/dist` backed up, stamped 20261001T202056Z.
3. **Build.** `vite build`, 38.46 s.
4. **Pending check.** The pending-migrations check read `SequelizeMeta`
   with `NODE_ENV=production` against the production database: "OK: 0
   pending of 244 migration files checked. (exit 0)"; the database
   confirmed by Evoni.
5. **The AI key.** `ANTHROPIC_API_KEY` in `.env`: count 1, value not read.
6. **Restart.** One plain `pm2 restart` of the API process: restart count
   58.
   - Ready at 20:22:32: "Ready to accept requests".
   - `/health` at 2026-10-01T20:22:33Z: healthy, production, database
     connected, uptime 6.1 s.
7. **CFO.** 20:22:41–20:22:45: **89/100**, 0 critical, **4 warnings**,
   4059 ms.

**App check: not checked yet** (Evoni). Nothing in this record says the
deployed features work or fail in production.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse origin/main 20cb81db 72ba7bbd
72ba7bbdb92b8297a48e0e50157b4e19d979383b
20cb81db69e23955de7dc0c136af6865185d9464
72ba7bbdb92b8297a48e0e50157b4e19d979383b
$ git merge-base --is-ancestor 20cb81db 72ba7bbd && echo "ancestor: yes"
ancestor: yes
```

DA left production at `20cb81db` with restart count 57 (DA record §0,
§7). DB starts at `20cb81db`, and its one restart brings the count to 58
(ATTESTED, §0). **No gap:** no deploy ran between DA and DB that this
account does not show.

## §2. The range — MEASURED

```
$ git rev-list --count 20cb81db..72ba7bbd
1
$ git log --oneline 20cb81db..72ba7bbd
72ba7bbdb feat(season): Planning Insights; the season-health line reads the slot ranges; no cost_coins tag in the Episode Ledger (Season Arc PR 8) [skip-automerge] (#2446)
$ git diff --shortstat 20cb81db 72ba7bbd
 8 files changed, 610 insertions(+), 9 deletions(-)
$ git diff --name-only 20cb81db 72ba7bbd
docs/EVENT_EPISODE_FLOW.md
frontend/src/pages/WorldAdmin.episodeLedgerMoney.test.jsx
frontend/src/pages/WorldAdmin.jsx
frontend/src/pages/WorldAdmin.seasonRoadmap.test.jsx
src/routes/arcRoutes.js
src/services/planningInsightsService.js
tests/integration/planningInsights.integration.test.js
tests/unit/routes/arc-routes-tier-promotion.test.js
$ git diff --name-only 20cb81db 72ba7bbd -- src/migrations/ | wc -l
0
$ git diff --name-only 20cb81db 72ba7bbd -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
```

This agrees with the script's own count:
- 1 commit, the PR it named;
- 8 files;
- no migration;
- no package or lock file, so no `npm ci` was needed.

`WorldAdmin.jsx` changed, so the `vite build` was needed. Two backend
files changed (a route file and a new service), so the restart was needed.

## §3. The time

**ATTESTED.** Backup stamped 20:20:56Z; ready at 20:22:32, `/health` at
20:22:33Z, CFO done 20:22:45.

**MEASURED.** The range's only commit, #2446, is at 20:12:14 UTC:

```
$ git log --first-parent --format="%h %cI" 20cb81db..72ba7bbd
72ba7bbdb 2026-10-01T16:12:14-04:00
```

**INFERRED.** The script's fetch reached `72ba7bbd`, so it ran at or after
20:12:14; the backup stamp at 20:20:56 fits.

## §4. Migrations

**MEASURED.** The tree holds 244 migration files, the same as at DA; the
range adds none:

```
$ git ls-tree -r --name-only 72ba7bbd src/migrations | grep -c '\.js$'
244
```

**ATTESTED (§0):** 0 pending of 244, exit 0. This agrees with DA's
after-check (0 pending of 244) and with the range. DA's record said the
next deploy, carrying #2446, could run by script end to end (DA §7); it
did.

## §5. What went live — MEASURED

- **#2446 (`72ba7bbd`): Season Arc PR 8, Planning Insights** (§8(ff) A8,
  Q13, Q14, Q15, and Evoni's five PR 8 choices):
  - a Planning Insights card on the Season tab: per slot, the planned
    pressure and outcome range beside the actual outcome and pressure,
    and the episode's money; phase and season totals; a balance trend
    over every counted ledger row; the season-health line, from the slot
    outcome ranges;
  - money comes from `financial_transactions` only, never `cost_coins`;
  - the Season tab no longer fetches the old 1/4/2/1 season-health grade
    (the backend route stays);
  - the Episode Ledger's event reference drops its 🪙 `cost_coins` tag.

New routes in the range, behind `requireAuth`:

```
$ git diff 20cb81db 72ba7bbd -- src/routes | grep "^+router\.\(get\|post\|put\|delete\)"
+router.get('/world/:showId/season/insights', requireAuth, async (req, res) => {
```

The new route only reads; it makes no AI call and writes nothing.

## §6. Restarts and the CFO

**ATTESTED.**
- One plain `pm2 restart`: restart count 58.
- `.env` was read only for the key's presence; no change to it is
  reported, so a plain restart fits.
- CFO: 89/100, 0 critical, 4 warnings, the same as at CY, CZ and DA.

The account does not mention `FONT` lines or `episode-worker`; this
record says nothing about either.

## §7. Basis statement

**MEASURED.** Production's tree after Deploy DB is `72ba7bbd` (#2446),
the same commit as `origin/main` at filing:

```
$ git log --oneline 72ba7bbd..origin/main
$ git rev-parse --is-shallow-repository
false
```

(The first command prints nothing: `origin/main` has no commit beyond
production.)

With DB, every Season Arc build PR in `docs/SEASON_ARC_DESIGN_NOTE.md`'s
order is in production: PRs 1–4 at CY, 5–6 at CZ, 7 at DA, 8 at DB.

**INFERRED.** The CZ and DA records (#2447, #2448) were still open at
filing. They change only `docs/audit/`, so merging them puts
`origin/main` ahead of production without a runtime change.

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

- **Continuity:** continuous from DA (`20cb81db`, restart 57). The tree
  agrees with the script's account: 1 commit, 8 files, no migration, no
  package or lock file. Production is at `72ba7bbd`, `origin/main` at
  filing.
- **Deploy:** by the script end to end: backup, build, 0 pending of 244,
  the AI key present, one restart (count 58), ready, `/health` healthy and
  connected.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from DA.
- **App check:** not done yet (Evoni).
- **Season Arc:** all eight build PRs are live.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
