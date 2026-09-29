| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CG, 2026-09-29, backend only, a lockfile change, no migration, one plain restart. Evoni ran it herself, outside any agent session, as a manual deploy under `DEVELOPMENT_WORKFLOW.md` §7.1, because the range changed `package-lock.json`. The in-range dependency fixes (#2327) go live, and the CFO's `dependency_audit` count falls from 15 to 2. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_CF.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `1ffe8b5ae2c571835e7ae11f95b2e4f28bcad263` (#2327),
read 2026-09-29. This is the tree Deploy CG moved production to (§8).

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
account number or ARN.

**The letter.** This deploy is lettered **CG**. It follows CF
(`F-Deploy-1_Deploy_2026-09-29_CF.md`, #2328), the register's last deploy
record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-29, about
23:20–23:27 UTC, in her order:

1. **Fetch and fast-forward.**
   - `git fetch` found the range `1eaa0888..1ffe8b5a`: 1 commit (#2327).
   - The diff is `package-lock.json` only (165+/140−). No migration, no
     `package.json` change.
   - `frontend/dist` and `package-lock.json` were backed up.
   - `git merge --ff-only` moved the tree to `1ffe8b5a`.
2. **Install.**
   - Disk before: `/` 7.6G, 5.3G used, 2.3G free (71%).
   - `npm ci` installed all dependencies, not `--omit=dev`, to keep
     `sequelize-cli`: added 945 packages, audited 946, exit 0.
   - Its full audit summary, dev dependencies included: 14 vulnerabilities
     (1 low, 5 moderate, 8 high).
   - `node` `require('sharp')` and `require('sequelize')`: ok.
   - `sequelize-cli` 6.6.5.
   - `npm audit --omit=dev`, critical plus high: **2**.
3. **Restart.**
   - No frontend change, so no `vite build`.
   - `.env` unchanged.
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 35,
     online.
   - `/health` at 2026-09-29T23:26:59Z: healthy, database connected, uptime
     20.1 s.
   - Ready at 23:26:42.
   - CFO 23:26:51–23:26:54: **86/100** (was 84), 1 critical, 4 warnings;
     `[dependency_audit] 2 critical/high` (was 15).

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 1eaa0888 1ffe8b5a && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CF ends at `1eaa0888` (CF record §1 and §8), and that is where
this deploy starts.

**The restart count is continuous (ATTESTED):** CF left it at 34 (CF
record §6), and CG's single restart brings it to 35.

## §2. The range — MEASURED

```
$ git rev-list --count 1eaa0888..1ffe8b5a
1
$ git log --oneline 1eaa0888..1ffe8b5a
1ffe8b5ae chore(deps): apply the in-range backend audit fixes, lockfile only [skip-automerge] (#2327)
$ git diff --shortstat 1eaa0888 1ffe8b5a
 1 file changed, 165 insertions(+), 140 deletions(-)
$ git diff --numstat 1eaa0888 1ffe8b5a
165	140	package-lock.json
$ git diff --name-only 1eaa0888 1ffe8b5a -- src/migrations/ package.json frontend/; echo "EXIT: $?"
EXIT: 0
```

This agrees with Evoni's account: 1 commit, `package-lock.json` only
(165+/140−), and no migration, `package.json` or frontend change.

## §3. The time

**ATTESTED.** The deploy ran about 23:20–23:27 UTC. The app was ready at
23:26:42, and `/health` answered at 23:26:59Z with an uptime of 20.1 s.

**MEASURED.** The range's one commit, #2327, is at 23:17:49 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 1eaa0888..1ffe8b5a | head -1
1ffe8b5ae 2026-09-29T19:17:49-04:00 chore(deps): apply the in-range backend audit fixes, lockfile only [skip-automerge] (#2327)
```

## §4. The install, and the §7.1 path

**ATTESTED (§0).**
- Evoni took the §7.1 manual path because the lockfile changed:
  1. backup and fast-forward;
  2. `npm ci`;
  3. restart.
- There was no build, since nothing under `frontend/` changed (§2).
- There was no migration step. The tree holds 226 migration files, the
  same as CF:

  ```
  $ git ls-tree -r --name-only 1ffe8b5a src/migrations | grep -c '\.js$'
  226
  ```

  (MEASURED)
- `npm ci` installed dev dependencies too, so that `sequelize-cli` stays
  available for later migrations.

**MEASURED: the audit counts agree with this repository.** PR #2327
(Task #2326) measured the same lockfile before merge. Its root audits give
the same numbers Evoni's box gave:
- the full audit, which `npm ci` summarises, gave 14 (1 low, 5 moderate,
  8 high);
- `--omit=dev` critical plus high gave 2.

```
root --omit=dev {"info":0,"low":0,"moderate":4,"high":2,"critical":0,"total":6} critical+high = 2
root all        {"info":0,"low":1,"moderate":5,"high":8,"critical":0,"total":14}
```

The two left are `nodemailer` and `sharp`, per
`docs/DEPENDENCY_AUDIT_2026-09-29.md`. Both need major upgrades, which are
separate tasks.

**ATTESTED (§0), and consistent with the above:**
- The CFO's `dependency_audit` now reports 2 critical/high, down from 15.
- Its score is 86/100, up from 84.
- It still reports 1 critical, because 2 critical/high is still above the
  CFO's zero threshold (`src/services/cfoAgent.js`, `dependencyAudit`).

**INFERRED:** production's CFO count equals the local `--omit=dev` count.
The two agree at 2 here, as they did at 15 (CE record §9). The production
command was still not observed.

## §5. What went live — MEASURED

- **#2327 (`1ffe8b5a`), Task #2326: the in-range backend audit fixes.**
  `npm audit fix --omit=dev`, lockfile only. It resolves 13 of the 15
  critical/high findings: axios, form-data, joi, multer, @xmldom/xmldom,
  brace-expansion, engine.io, ip-address, path-to-regexp, lodash, nanoid,
  socket.io-parser and ws.
  - nodemailer takes its in-range patch, 8.0.2 → 8.0.11.
  - No code change and no `package.json` change.

**Not in this tree:** deploy record CF (PR #2328). It merged at
`04313379`, after this deploy's tree. It is a register document with no
runtime effect.

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 35,
  online.
- `.env` unchanged.
- The account does not mention `ANTHROPIC_API_KEY` or `episode-worker`.
  CF left the worker stopped, a standing state.

## §7. Schema changes

**MEASURED.** None (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy CG, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
1ffe8b5ae2c571835e7ae11f95b2e4f28bcad263 2026-09-29 chore(deps): apply the in-range backend audit fixes, lockfile only [skip-automerge] (#2327)
$ git rev-parse --is-shallow-repository
false
```

## §9. Noted, not investigated

- **Disk: 2.3G free of 7.6G (71% used)** before `npm ci` (ATTESTED). The
  account gives no figure for after. This record draws no conclusion.

## §10. What this document does not do

- It records no credential or host.
- It edits no filed document.
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

- **Continuity:** the tree agrees with Evoni's account (1 commit, lockfile
  only, no migration), with no gap after CF. Production is at `origin/main`,
  `1ffe8b5a`.
- **Deploy:** a manual deploy under §7.1: `npm ci` with all dependencies,
  no build, restart. `/health` healthy and connected; restart count 35.
- **CFO:** 86/100, 1 critical, 4 warnings. `dependency_audit` is at 2
  (nodemailer, sharp), down from 15.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
