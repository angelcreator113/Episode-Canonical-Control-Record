| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AR, 2026-09-26, backend, one restart, no migration, performed personally by Evoni, outside any agent session. Public /health reports only its six fields; the full diagnostic body is served on the box only.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AQ.md` (the AQ record, #1997). This document
follows that one rather than editing it. Basis:
`a2c75992311a615f8c32ab4c1f1bc24654ae5503` (#2003), the tree Deploy AR moved
production to. `origin/main` at filing is `594714ed` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states, from her terminal output and screenshots.
  It cannot be reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`show` any clone can reproduce, and register documents
  already merged under `docs/audit/`.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
database host, user id, account number or ARN.

The deploy is lettered AR, continuing after Deploy AQ. It is one of six
records (AR to AW) filed together under Task #2026.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-26):**

- Fast-forward `d49fc743` → `a2c75992`. Backend: `src/app.js` only.
- Pending-migration check: 0 pending of 218, `exit=0`.
- `node -c src/app.js`: no error.
- A plain `pm2 restart`, without `--update-env`. The restart count went from
  1 to 2.
- **After 10 seconds, on the box:**
  - `curl localhost:3000/health` returned only `status`, `timestamp`,
    `uptime`, `version`, `environment` and `database` (`connected`).
  - `curl localhost:3000/_diag/health` returned the full body, including
    `config`, `currentDatabase` `episode_metadata` and `episodeCount` 7.
- **From the box, through the public name:**
  - `https://primepisodes.com/_diag/health` → 404, `application/json`.
  - `https://primepisodes.com/health` → 200, `application/json`.
- A browser check of `/health`'s fields: **not attested.**

## §1. Identity and continuity

**ATTESTED.** The tree moved from `d49fc743` to `a2c75992` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse d49fc743 a2c75992
d49fc74396b299fa264784f11c481a7a4c4ab036
a2c75992311a615f8c32ab4c1f1bc24654ae5503
$ git merge-base --is-ancestor d49fc743 a2c75992; echo "exit=$?"
exit=0
```

Deploy AQ ends at `d49fc743` (AQ record §1, §8); Deploy AR begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent d49fc743..a2c75992
a2c75992 docs(phone): read how Phone Hub icons are stored, placed and replaced [skip-automerge] (#2003)
2e955b5a fix(health): public /health no longer reports database details [skip-automerge] (#2002)
542ec961 docs(audit): open and scope the F-Stats-1 reads slice [skip-automerge] (#2000)
7a17a2e7 docs(audit): file the deploy record for Deploy AQ [skip-automerge] (#1997)

$ git diff --name-only d49fc743 a2c75992 -- src frontend/src src/migrations package.json frontend/package.json
src/app.js

$ git diff --name-only d49fc743 a2c75992 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
src/app.js
exit=0
```

Four commits. #1997 (the AQ record), #2000 (the F-Stats-1 scoping document)
and #2003 (`docs/PHONE_ICONS_READ.md`) are documents only. #2002 carries the
code: `src/app.js`, the only file changed under `src/`, `frontend/src` or a
package manifest. No migration file, no package manifest or lockfile.

**Beside her account.** "Backend: `src/app.js` only" agrees with the
measurement. AR is the only backend deploy of AR to AW.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AR.

**MEASURED.** The newest commit in the range is #2003, 19:54:24 UTC, so the deploy
followed it:

```
$ git log --first-parent --format="%h %cI %s" d49fc743..a2c75992
a2c75992 2026-09-26T15:54:24-04:00 docs(phone): read how Phone Hub icons are stored, placed and replaced [skip-automerge] (#2003)
2e955b5a 2026-09-26T15:40:30-04:00 fix(health): public /health no longer reports database details [skip-automerge] (#2002)
542ec961 2026-09-26T15:28:47-04:00 docs(audit): open and scope the F-Stats-1 reads slice [skip-automerge] (#2000)
7a17a2e7 2026-09-26T15:06:27-04:00 docs(audit): file the deploy record for Deploy AQ [skip-automerge] (#1997)
```

## §4. Pre-deploy checks

**ATTESTED.** Pending-migration check: 0 pending of 218, `exit=0`.
`node -c src/app.js`: no error.

**MEASURED.** The migration tree holds 218 files at the end of the range:

```
$ git ls-tree -r --name-only a2c75992 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

#2002 (`2e955b5a`), `fix(health)`:

- `GET /health` builds the full health object as before, then answers with
  only the fields in `PUBLIC_HEALTH_FIELDS`: `status`, `timestamp`,
  `uptime`, `version`, `environment` and `database`.
- The full body moves to `GET /_diag/health`. It is served only when
  `isLocalDiagnosticRequest` holds: the socket's remote address is loopback
  and the request carries no `X-Forwarded-For`. Otherwise it answers
  `404` with `{ error: 'Not found' }` as JSON.

```
$ git diff --name-only d49fc743 a2c75992 -- src/
src/app.js
$ git show a2c75992:src/app.js | grep -n "PUBLIC_HEALTH_FIELDS = \|function isLocalDiagnosticRequest\|status(404).json"
293:const PUBLIC_HEALTH_FIELDS = ['status', 'timestamp', 'uptime', 'version', 'environment', 'database'];
297:function isLocalDiagnosticRequest(req) {
372:    return res.status(404).json({ error: 'Not found' });
```

### §5.2 The live check, beside the code

**ATTESTED (§0).** On the box, `/health` returned the six public fields
only, and `/_diag/health` from loopback returned the full body. Through the
public name, `/_diag/health` answered 404 with JSON and `/health` answered
200 with JSON.

**MEASURED.** Each reading matches #2002:

- The six fields are exactly `PUBLIC_HEALTH_FIELDS`.
- `curl localhost:3000/_diag/health` is a loopback request with no
  `X-Forwarded-For`, so `isLocalDiagnosticRequest` holds and the full body
  is served.
- The public `/_diag/health` answer, 404 with JSON, is the answer #2002
  gives a request that fails `isLocalDiagnosticRequest`.

**Not attested:** a browser check of `/health`'s fields.

### §5.3 Production's path and the backup

**Production's request path.** For the path a request takes to production,
this record cites `F-Deploy-1_Fix_Plan_v1.56.md` (production's path,
confirmed). At this record's filing that revision is **owed and not yet
filed**: no issue for it exists and nothing under `docs/audit/` carries it.
Until it is filed, the path below stands only as Evoni's account.

**ATTESTED (Evoni, as given for Task #2026):** requests reach production
through the load balancer to the box's app on port 3000, which serves
`frontend/dist`. The rsync of the build to `/var/www/html` reaches
`dev.primepisodes.com` and plain HTTP only.

**No frontend build at AR, MEASURED.** No file under `frontend/src` changed
(§2), and her account names no build or backup for AR.

## §6. Restarts

**ATTESTED.** One restart: a plain `pm2 restart`, without `--update-env`;
the restart count went from 1 to 2.

**MEASURED.** A backend file changed (§2), so a restart was needed for it to
take effect. No `.env` or credential change is in the range.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy AR, production's tree is this record's basis,
`a2c75992`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
594714eda6e86747f77226efafbf13977c2d1627 2026-09-26 feat(phone): "+ Add" asks what you're adding [skip-automerge] (#2025)
```

The commits after `a2c75992` up to `594714ed` are deployed by the later records of
this filing (AS to AW), not by Deploy AR.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and reproduces no value from the screenshots beyond what §0 and §5.2
  state in words;
- does not edit the AQ record or any other filed document;
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
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

Unchanged from the AQ record §10. Nothing minted here.

## §Standing

- §1, §2, §4 and §6 each carry ATTESTED and MEASURED clauses, marked
  separately and never merged into one standing.
- The tree agrees with her account: four commits, `src/app.js` the only
  code, no migration, no package change (§2). AR is the only backend deploy
  of AR to AW.
- **The live check (§5.2):** the six public fields on `/health`, the full
  body on loopback `/_diag/health`, and the app's JSON 404 for the public
  `/_diag/health`. A browser check of `/health` is not attested.
- Production's path (§5.3) is Evoni's account only until
  `F-Deploy-1_Fix_Plan_v1.56.md` is filed; this record does not stand in
  for it.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2026.*
