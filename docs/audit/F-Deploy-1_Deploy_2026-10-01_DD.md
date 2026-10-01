| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DD, 2026-10-01, backend and frontend, by `scripts/deploy-prod.sh` end to end. A fast-forward of 4 commits and 26 files from `31fff055` to `d8bcffbd`: Episode Money Phase B PRs 1, 2 and 3 (#2452, #2453, #2455) and the DC record (#2454). No migration and no package or lock file; 0 pending of 244; one plain restart. CFO 89/100 with 4 warnings, unchanged from DC. The app check has not been done yet. The restart count is continuous from DC (59 → 60). Production is at `origin/main`.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-01_DC.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `d8bcffbd417892f4d93309b5e3262e4d17c073bb` (#2455),
read 2026-10-01. Deploy DD moved production to this same commit (§7).

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
as in the CW–DC records.

**The letter.** This deploy is lettered **DD**, the letter after DC. It
follows DC (`F-Deploy-1_Deploy_2026-10-01_DC.md`, filed in #2454).

## §0. Evoni's account, as given

**ATTESTED.** The script's output as Evoni pasted it, 2026-10-01, about
22:07–22:09 UTC (the hidden host, the database and its user, and the log
prefixes left out):

1. **Tree.** `31fff055` → `d8bcffbd`, fast-forward. Range: 4 commits, 26
   files; PRs #2452, #2453, #2454, #2455. "No migration or package/lock
   file in the range."
2. **Backup.** `frontend/dist` backed up, stamped 20261001T220714Z.
3. **Build.** `vite build`, 37.17 s.
4. **Pending check.** The pending-migrations check read `SequelizeMeta`
   with `NODE_ENV=production` against the production database: "OK: 0
   pending of 244 migration files checked. (exit 0)"; the database
   confirmed by Evoni.
5. **The AI key.** `ANTHROPIC_API_KEY` in `.env`: count 1, value not read.
6. **Restart.** One plain `pm2 restart` of the API process: restart count
   60.
   - Ready at 22:08:16: "Ready to accept requests".
   - `/health` at 2026-10-01T22:08:19Z: healthy, production, database
     connected, uptime 9.2 s.
7. **CFO.** 22:08:24–22:08:28: **89/100**, 0 critical, **4 warnings**,
   3700 ms.

**App check: not checked yet** (Evoni). Nothing in this record says the
deployed features work or fail in production.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse origin/main 31fff055 d8bcffbd
d8bcffbd417892f4d93309b5e3262e4d17c073bb
31fff0553bd1588ab565a3ca1073bb05401cdc13
d8bcffbd417892f4d93309b5e3262e4d17c073bb
$ git merge-base --is-ancestor 31fff055 d8bcffbd && echo "ancestor: yes"
ancestor: yes
```

DC left production at `31fff055` with restart count 59 (DC record §0,
§6). DD starts at `31fff055`, and its one restart brings the count to 60
(ATTESTED, §0). **No gap:** no deploy ran between DC and DD that this
account does not show.

## §2. The range — MEASURED

```
$ git rev-list --count 31fff055..d8bcffbd
4
$ git log --oneline 31fff055..d8bcffbd
d8bcffbd4 feat(money): the Overview's Money card replaces its ledger list (Episode Money Phase B PR 3) [skip-automerge] (#2455)
e8d238d86 docs(audit): deploy record DC [skip-automerge] (#2454)
4362e8b22 feat(money): early money warnings on the Money tab, at Start Episode and before Complete (Episode Money Phase B PR 2) [skip-automerge] (#2453)
f1c2ad855 feat(money): the Money tab lists every money line with its state, and projects the net and balance (Episode Money Phase B PR 1) [skip-automerge] (#2452)
$ git diff --shortstat 31fff055 d8bcffbd
 26 files changed, 1935 insertions(+), 166 deletions(-)
$ git diff --name-only 31fff055 d8bcffbd -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only 31fff055 d8bcffbd -- frontend/ | wc -l
15
$ git diff --name-only 31fff055 d8bcffbd -- src/
src/routes/worldEvents.js
src/services/episodeGeneratorService.js
src/services/episodeMoneyLines.js
src/services/episodeMoneyService.js
src/services/termsReopenService.js
$ git diff --name-only 31fff055 d8bcffbd -- . ':!frontend' ':!src'
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-10-01_DC.md
tests/integration/episodeMoneyLines.integration.test.js
tests/integration/episodeMoneyWarnings.integration.test.js
tests/unit/routes/world-cluster-tier-promotion.test.js
tests/unit/services/episodeMoneyLines.test.js
```

This agrees with the script's own count:
- 4 commits, the four PRs it named;
- 26 files (15 frontend, 5 backend, 2 docs, 4 tests);
- no migration;
- no package or lock file, so no `npm ci` was needed.

The frontend files needed the `vite build`; the backend files needed the
restart.

**Which PR is which** (Evoni asked; MEASURED):

```
$ git show --stat --format="%h %s" e8d238d86 | tail -2
 docs/audit/F-Deploy-1_Deploy_2026-10-01_DC.md | 221 ++++++++++++++++++++++++++
 1 file changed, 221 insertions(+)
$ git show --stat --format="%h %s" d8bcffbd4 | tail -6

 .../src/components/Episodes/EpisodeMoneyCard.jsx   | 94 ++++++++++++++++++++++
 .../components/Episodes/EpisodeMoneyCard.test.jsx  | 31 +++++++
 .../src/components/Episodes/EpisodeOverviewTab.jsx | 72 ++---------------
 .../Episodes/EpisodeOverviewTab.moneyCard.test.jsx | 71 ++++++++++++++++
 4 files changed, 201 insertions(+), 67 deletions(-)
```

- **#2454** (`e8d238d8`) is the DC deploy record: one file under
  `docs/audit/`, no runtime effect.
- **#2455** (`d8bcffbd`) is Episode Money Phase B PR 3, the Overview's
  Money card.

## §3. The time

**ATTESTED.** Backup stamped 22:07:14Z; ready at 22:08:16, `/health` at
22:08:19Z, CFO done 22:08:28.

**MEASURED.** The range's last commit, #2455, is at 22:05:00 UTC:

```
$ git log --first-parent --format="%h %cI" 31fff055..origin/main
d8bcffbd4 2026-10-01T18:05:00-04:00
e8d238d86 2026-10-01T17:55:06-04:00
4362e8b22 2026-10-01T17:46:15-04:00
f1c2ad855 2026-10-01T17:30:05-04:00
```

**INFERRED.** The script's fetch reached `d8bcffbd`, so it ran at or after
22:05:00; the backup stamp at 22:07:14 fits.

## §4. Migrations

**MEASURED.** The tree holds 244 migration files, the same as at DC; the
range adds none:

```
$ git ls-tree -r --name-only d8bcffbd src/migrations | grep -c '\.js$'
244
```

**ATTESTED (§0):** 0 pending of 244, exit 0.

## §5. What went live — MEASURED

Episode Money, Phase B (`docs/EVENT_EPISODE_FLOW.md` §8(gg) MB1–MB5 and
Evoni's answers; `docs/EPISODE_MONEY_PHASE_B_NOTE.md`):

- **#2452 (`f1c2ad85`), PR 1.** The Money tab lists every money line of
  the episode with its trigger, who pays or covers it, its amount and its
  state (Planned, Pending, Posted; Not earned and Covered, her accepted
  choices), and shows the projected net and Lala's projected balance after
  the episode beside her actual balance. Conditional bonuses show as "+ up
  to X if SLAY", never counted.
- **#2453 (`4362e8b2`), PR 2.** Early money warnings (projected balance
  below zero; costs and spending above her balance) on the Money tab, in
  the Event Package before Start Episode, and before Complete. Start
  Episode's stored affordability warning now reads the ledger balance and
  the event's whole plan. Nothing is blocked; Complete's refusals stay.
- **#2454 (`e8d238d8`).** The DC deploy record. No runtime effect.
- **#2455 (`d8bcffbd`), PR 3.** The Overview's Money card (actual net so
  far, projected net, open lines, "See all in Money →") in place of its
  ledger list.

New routes in the range, behind `requireAuth`:

```
$ git diff 31fff055 d8bcffbd -- src/routes | grep "^+router\.\(get\|post\|put\|delete\)"
+router.get('/world/:showId/events/:eventId/money-preview', requireAuth, async (req, res) => {
```

The new route only reads; it makes no AI call and writes nothing.

## §6. Restart and the CFO

**ATTESTED.**
- One plain `pm2 restart`: restart count 60.
- `.env` was read only for the key's presence; no change to it is
  reported.
- CFO: 89/100, 0 critical, 4 warnings, the same as at CY to DC.

The account does not mention `FONT` lines or `episode-worker`; this
record says nothing about either.

## §7. Basis statement

**MEASURED.** Production's tree after Deploy DD is `d8bcffbd` (#2455), the
same commit as `origin/main` at filing:

```
$ git log --oneline d8bcffbd..origin/main
$ git rev-parse --is-shallow-repository
false
```

(The first command prints nothing: `origin/main` has no commit beyond
production.) Episode Money Phase B PRs 1–3 are live; PR 4 (the Start
Episode plan snapshot and the reconciliation view) is not built yet.

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

- **Continuity:** continuous from DC (`31fff055`, restart 59). The tree
  agrees with the script's account: 4 commits, 26 files, no migration, no
  package or lock file. Production is at `d8bcffbd`, `origin/main` at
  filing.
- **Deploy:** by the script end to end: backup, build, 0 pending of 244,
  the AI key present, one restart (count 60), ready, `/health` healthy and
  connected.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from DC.
- **App check:** not done yet (Evoni).
- **Episode Money Phase B:** PRs 1–3 live.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
