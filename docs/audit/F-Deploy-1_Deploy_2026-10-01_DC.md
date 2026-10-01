| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DC, 2026-10-01, by `scripts/deploy-prod.sh` end to end. A fast-forward of 5 commits and 6 files from `72ba7bbd` to `31fff055`, all docs (#2447–#2451: the CZ, DA and DB records, the PROJECT_CONTEXT refresh, the Episode Money Phase B rulings and note). No source, frontend, migration or package file; 0 pending of 244; one plain restart. CFO 89/100 with 4 warnings, unchanged from DB. App check: not applicable (no app change). The restart count is continuous from DB (58 → 59). Production is one commit behind `origin/main` (#2452, Episode Money Phase B PR 1, merged after DC's fetch).* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-01_DB.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `f1c2ad855c95263380e90fe824d7a0dfd577383c` (#2452),
read 2026-10-01. Deploy DC moved production to `31fff055` (#2451), one
commit behind it (§6).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, as she gave it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.
- **RULED**: Evoni's decision, quoted.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email address, password, hostname, IP address, key
path, account number, database user or ARN. The script's output names the
database user its pending-migrations check read as; it is left out here,
as in the CW–DB records.

**The letter.** This deploy is lettered **DC**, the letter after DB. It
follows DB (`F-Deploy-1_Deploy_2026-10-01_DB.md`, filed in #2449).

**The account's source.** Evoni's request to file DC gave its summary in
words ("docs only (#2447–#2451); PR 1 was not yet merged, so no app
change. App check: not applicable.") and carried a "[paste the DC
summary]" placeholder; the script's output followed in her next message,
headed "Deploy (Evoni, 2026-10-01, via scripts/deploy-prod.sh)". This
record is filed from both.

## §0. Evoni's account, as given

**ATTESTED.** The script's output as Evoni pasted it, 2026-10-01, about
21:28–21:31 UTC (the hidden host, the database and its user, and the log
prefixes left out):

1. **Tree.** `72ba7bbd` → `31fff055`, fast-forward. Range: 5 commits, 6
   files; PRs #2447, #2448, #2449, #2450, #2451. "No migration or
   package/lock file in the range."
2. **Backup.** `frontend/dist` backed up, stamped 20261001T212855Z.
3. **Build.** `vite build`, 36.55 s.
4. **Pending check.** The pending-migrations check read `SequelizeMeta`
   with `NODE_ENV=production` against the production database: "OK: 0
   pending of 244 migration files checked. (exit 0)"; the database
   confirmed by Evoni.
5. **The AI key.** `ANTHROPIC_API_KEY` in `.env`: count 1, value not read.
6. **Restart.** One plain `pm2 restart` of the API process: restart count
   59.
   - Ready at 21:30:36: "Ready to accept requests".
   - `/health` at 2026-10-01T21:30:36Z: healthy, production, database
     connected, uptime 6.1 s.
7. **CFO.** 21:30:44–21:30:48: **89/100**, 0 critical, **4 warnings**,
   3651 ms.

**App check: not applicable** (Evoni, RULED, verbatim): "docs only
(#2447–#2451); PR 1 was not yet merged, so no app change. App check: not
applicable." §2 measures that the range changes no source, frontend or
package file.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse origin/main 72ba7bbd 31fff055
f1c2ad855c95263380e90fe824d7a0dfd577383c
72ba7bbdb92b8297a48e0e50157b4e19d979383b
31fff0553bd1588ab565a3ca1073bb05401cdc13
$ git merge-base --is-ancestor 72ba7bbd 31fff055 && echo "ancestor: yes"
ancestor: yes
```

DB left production at `72ba7bbd` with restart count 58 (DB record §0,
§7). DC starts at `72ba7bbd`, and its one restart brings the count to 59
(ATTESTED, §0). **No gap:** no deploy ran between DB and DC that this
account does not show.

## §2. The range — MEASURED

```
$ git rev-list --count 72ba7bbd..31fff055
5
$ git log --oneline 72ba7bbd..31fff055
31fff0553 docs: Episode Money Phase B rulings (§8(gg)), answers and design note [skip-automerge] (#2451)
cbc4b1ddf docs(context): refresh to production at 72ba7bbd (Deploy DB) [skip-automerge] (#2450)
1836c8946 docs(audit): deploy record DB [skip-automerge] (#2449)
8a23d8e16 docs(audit): deploy record DA [skip-automerge] (#2448)
de1c8b4e4 docs(audit): deploy record CZ [skip-automerge] (#2447)
$ git diff --shortstat 72ba7bbd 31fff055
 6 files changed, 1089 insertions(+), 3 deletions(-)
$ git diff --name-only 72ba7bbd 31fff055
PROJECT_CONTEXT.md
docs/EPISODE_MONEY_PHASE_B_NOTE.md
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-10-01_CZ.md
docs/audit/F-Deploy-1_Deploy_2026-10-01_DA.md
docs/audit/F-Deploy-1_Deploy_2026-10-01_DB.md
$ git diff --name-only 72ba7bbd 31fff055 -- src/ frontend/ package.json package-lock.json | wc -l
0
```

This agrees with the script's own count (5 commits, 6 files, the five PRs
it named, no migration or package file) and with Evoni's "docs only".

**INFERRED.** With no frontend or source file in the range, the build and
the restart changed nothing that runs: the script builds and restarts on
every run. The restart still counts (59).

## §3. The time

**ATTESTED.** Backup stamped 21:28:55Z; ready at 21:30:36, `/health` at
21:30:36Z, CFO done 21:30:48.

**MEASURED.** The range's last commit, #2451, is at 21:18:10 UTC; #2452
(Phase B PR 1) merged at 21:30:05 UTC:

```
$ git log --first-parent --format="%h %cI" 72ba7bbd..origin/main
f1c2ad855 2026-10-01T17:30:05-04:00
31fff0553 2026-10-01T17:18:10-04:00
cbc4b1ddf 2026-10-01T17:02:57-04:00
1836c8946 2026-10-01T16:49:40-04:00
8a23d8e16 2026-10-01T16:41:49-04:00
de1c8b4e4 2026-10-01T16:31:16-04:00
```

**INFERRED.** The script's fetch came at or before the 21:28:55 backup,
after #2451 and before #2452 merged, so it reached `31fff055`. This agrees
with Evoni's "PR 1 was not yet merged".

## §4. Migrations

**MEASURED.** The tree holds 244 migration files, the same as at DB:

```
$ git ls-tree -r --name-only 31fff055 src/migrations | grep -c '\.js$'
244
```

**ATTESTED (§0):** 0 pending of 244, exit 0, as after DB.

## §5. Restart and the CFO

**ATTESTED.**
- One plain `pm2 restart`: restart count 59.
- `.env` was read only for the key's presence; no change to it is
  reported.
- CFO: 89/100, 0 critical, 4 warnings, the same as at CY to DB.

The account does not mention `FONT` lines or `episode-worker`; this
record says nothing about either.

## §6. Basis statement

**MEASURED.** Production's tree after Deploy DC is `31fff055` (#2451).
`origin/main` at filing is one commit ahead: Episode Money Phase B PR 1.

```
$ git log --oneline 31fff055..origin/main
f1c2ad855 feat(money): the Money tab lists every money line with its state, and projects the net and balance (Episode Money Phase B PR 1) [skip-automerge] (#2452)
$ git diff --name-only 31fff055 origin/main -- src/migrations/ | wc -l
0
$ git rev-parse --is-shallow-repository
false
```

**Next.** Evoni will deploy Phase B PRs 1, 2 and 3 together by script once
all three are merged (her message of 2026-10-01). #2452 adds no migration.

## §7. What this document does not do

- It records no credential, database user or host.
- It edits no filed document.
- It reads no production schema, calls no production endpoint (including
  the CFO history), and queries nothing in production.
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

## §8. Tails — re-derived, not carried

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

- **Continuity:** continuous from DB (`72ba7bbd`, restart 58). The tree
  agrees with the script's account: 5 commits, 6 files, all docs. Production
  is at `31fff055`, one commit behind `origin/main` (#2452).
- **Deploy:** by the script end to end: backup, build, 0 pending of 244,
  the AI key present, one restart (count 59), ready, `/health` healthy and
  connected.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from DB.
- **App check:** not applicable, docs only (Evoni).
- The only RULED item is Evoni's "App check: not applicable". The filing
  session made no host, AWS, database or Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
