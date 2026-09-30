| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CS, 2026-09-30, backend and frontend, no migration, no dependency change, one plain restart. Evoni ran it herself with `scripts/deploy-prod.sh`, outside any agent session. Reopen terms (#2383) goes live, with the CQ and CR deploy records. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CR.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `f9810a6d4fddec59b7369061ca9bfe20242de127` (#2385),
read 2026-09-30. Deploy CS moved production to that same commit (§8).

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
are left out:
- the database user named in the pending-check line;
- the home-directory path of the `frontend/dist` backup. Only its sortable
  timestamp is kept.

**The letter.** This deploy is lettered **CS**. It follows CR
(`F-Deploy-1_Deploy_2026-09-30_CR.md`, #2385), the register's last deploy
record. Both CQ's and CR's records are in CS's range.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-30, about
18:48–18:50 UTC, from `scripts/deploy-prod.sh` in its order:

1. **Fast-forward.** Tree `b7d80aa5` → `f9810a6d` (fast-forward): 3
   commits, 23 files; PRs #2383, #2384, #2385. The script reported no
   migration and no package or lock file in the range.
2. **Backup.** `frontend/dist` was backed up (sortable name, stamped
   2026-09-30T18:48:51Z).
3. **Build.** `vite build`, built in 36.17 s.
4. **Pending migrations.** The check read `SequelizeMeta` with
   `NODE_ENV=production` against the `episode_metadata` database (the host
   was hidden by the script; the user is left out here): **0 pending of
   229** migration files, exit 0. Evoni confirmed the database.
5. **Environment.** `ANTHROPIC_API_KEY` appears in `.env` once (count 1;
   the value was not read).
6. **Restart.**
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 48.
   - Ready line at 18:49:42: "Ready to accept requests".
   - `/health` at 2026-09-30T18:49:45Z: healthy, database connected,
     environment production, uptime 9.2 s.
7. **CFO.** Scheduled audit 18:49:50–18:49:54: **89/100**, 0 critical, 4
   warnings (4696 ms).

**App check (Evoni):** not checked yet.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor b7d80aa587702283bf8189cad919e2befcfd3780 f9810a6d4fddec59b7369061ca9bfe20242de127 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CR ends at `b7d80aa5` (CR record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CR left it at 47 (CR
record §6), and CS's single restart brings it to 48.

## §2. The range — MEASURED

```
$ git rev-list --count b7d80aa5..f9810a6d
3
$ git log --oneline b7d80aa5..f9810a6d
f9810a6d4 docs(audit): deploy record CR [skip-automerge] (#2385)
85c18d7ff docs(audit): deploy record CQ [skip-automerge] (#2384)
9c0648504 feat(events): reopen locked terms per the Reopen ruling [skip-automerge] (#2383)
$ git diff --shortstat b7d80aa5 f9810a6d
 23 files changed, 2181 insertions(+), 65 deletions(-)
$ git diff --name-only b7d80aa5 f9810a6d -- src/migrations/
$ git diff --name-only b7d80aa5 f9810a6d -- package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
$ git diff --name-only b7d80aa5 f9810a6d -- frontend/ | wc -l
5
$ git diff --name-only b7d80aa5 f9810a6d -- src/ | wc -l
13
```

This agrees with Evoni's account:
- 3 commits, the three PRs named;
- 23 files;
- no migration;
- no package or lock file.

5 frontend files changed, so the build used new sources. 13 backend files
changed, including the new route `src/routes/eventTermsReopen.js`, mounted
in `src/app.js`; the restart was needed to load them.

## §3. The time

**ATTESTED.** The deploy ran about 18:48–18:50 UTC: backup stamped
18:48:51Z, ready 18:49:42, `/health` 18:49:45, CFO done 18:49:54.

**MEASURED.** The range's last commit, #2385, is at 18:34:52 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" b7d80aa5..f9810a6d
f9810a6d4 2026-09-30T14:34:52-04:00 docs(audit): deploy record CR [skip-automerge] (#2385)
85c18d7ff 2026-09-30T14:27:54-04:00 docs(audit): deploy record CQ [skip-automerge] (#2384)
9c0648504 2026-09-30T14:13:24-04:00 feat(events): reopen locked terms per the Reopen ruling [skip-automerge] (#2383)
```

## §4. Migrations

**MEASURED.** The tree holds 229 migration files, as at CR:

```
$ git ls-tree -r --name-only f9810a6d src/migrations | grep -c '\.js$'
229
```

**ATTESTED (§0):** 0 pending of 229. This agrees with the tree and with CR.
#2383 adds no migration: the reopen marker and history live in
`world_events.canon_consequences`.

## §5. What went live — MEASURED

- **#2383 (`9c064850`), Task #2378:** Reopen terms, per Evoni's Reopen
  terms ruling of 2026-09-30 (`docs/EVENT_EPISODE_FLOW.md` §8(cc)).
  - Evoni can reopen an event's locked terms while its episode is a draft,
    has no ledger rows except wardrobe purchases, and every deliverable is
    pending. Reopening is ADMIN-only and needs confirmation.
  - Save and relock records the reopen in the event's history. It rebuilds
    the brief's terms snapshot, deliverable stamping, deliverable tasks,
    estimated money and the affordability warning.
  - After saving, invitation and script regeneration are offered, with a
    money reminder.
  - While terms are reopened, Finalize and Complete refuse with 409
    `EVENT_TERMS_REOPENED`.
- **#2384 and #2385:** the CQ and CR deploy records. Documents with no
  runtime effect.

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 48.
- `ANTHROPIC_API_KEY` is present in `.env` (count 1; value not read).
- The account does not mention `episode-worker`.

## §7. Schema changes

None. The range carries no migration (§2, §4).

## §8. Basis statement

**MEASURED.** Production's tree after Deploy CS is `f9810a6d` (#2385),
which is `origin/main` at filing. Production is level with main.

```
$ git log --oneline f9810a6d..origin/main | wc -l
0
$ git log -1 --format='%H %ad %s' --date=short origin/main
f9810a6d4fddec59b7369061ca9bfe20242de127 2026-09-30 docs(audit): deploy record CR [skip-automerge] (#2385)
$ git rev-parse --is-shallow-repository
false
```

**INFERRED:** #2388 (image cost tracking) was open at filing. It carries
migration `20261001100000-add-image-cost-columns-to-ai-usage-logs`, so the
deploy that takes it is a manual one per `DEVELOPMENT_WORKFLOW.md` §7.1.

## §9. What this document does not do

- It records no credential, database user, host or home path.
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

- **Continuity:** the tree agrees with Evoni's account (3 commits, 23 files,
  no migration, no package change), with no gap after CR. Production is at
  `f9810a6d`, level with `origin/main` at filing.
- **Deploy:** `scripts/deploy-prod.sh`: fast-forward, backup, build, 0
  pending of 229, one restart (count 48). `/health` healthy and connected.
- **CFO:** 89/100, 0 critical, 4 warnings.
- **App check:** not checked yet (Evoni).
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
