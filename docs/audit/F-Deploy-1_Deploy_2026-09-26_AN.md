| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AN, 2026-09-26, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AM.md` (the AM record, #1972). This document
follows that one rather than editing it. Basis:
`88a41b85c13e3415cdbcf6f5bbd8b41d91d158ae` (#1977), the tree Deploy AN moved
production to. `origin/main` at filing is
`fa7aa036d38bb1546af0e21fff0719c6f747c336`; the one commit between is a
document (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host or
  running app states, from her terminal output and screenshots. It cannot be
  reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`grep` any clone can reproduce, and register documents
  already merged under `docs/audit/`.
- **INFERRED** marks one reading that is not observed (§5.3).

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
database host or user id.

The deploy is lettered AN, continuing after Deploy AM of the AM record.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-26):**

- Fast-forward `baa69a2d` → `88a41b85`.
  `git diff --name-only HEAD@{1} HEAD -- src/ src/migrations/` printed
  nothing. Frontend only: no backend restart, no migration.
- `npx vite build` succeeded, with the known `@keyframes` warning and a
  browserslist notice. Entry `index-EiwjfLIh.js` (previously
  `index-Cd2ISEKu.js`).
- Backup `/var/www/html.bak-20260926-pre1977`.
- The rsync dry run listed `index.nginx-debian.html` for deletion again,
  after AM had removed it. The real sync removed it. The served `index.html`
  references `index-EiwjfLIh.js`.
- **Live check, from her screenshots:**
  - A failed sign-in logs three lines, `[authService]`, `[AuthContext]` and
    `[Login]`, each only "Request failed with status code 401 401", plus the
    browser's own network line (`POST …/auth/login 401`), which shows only
    the URL. No email and no password appear.
  - A successful sign-in logs only
    "[AppContent] User authenticated on login page, redirecting to home...".
  - Before this deploy, the console showed the tokens and the user object on
    sign-in (her earlier screenshot).

## §1. Identity and continuity

**ATTESTED.** The tree moved from `baa69a2d` to `88a41b85` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse baa69a2d 88a41b85 origin/main HEAD
baa69a2d945d88c41b745320509aca97e82e52ba
88a41b85c13e3415cdbcf6f5bbd8b41d91d158ae
fa7aa036d38bb1546af0e21fff0719c6f747c336
fa7aa036d38bb1546af0e21fff0719c6f747c336
$ git merge-base --is-ancestor baa69a2d 88a41b85; echo "exit=$?"
exit=0
```

(`HEAD` is this filing session's branch point before this record's commit.)
Deploy AM ends at `baa69a2d` (AM record §1, §8); Deploy AN begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent baa69a2d..88a41b85
88a41b85 fix(auth): stop logging tokens and user details at login [skip-automerge] (#1977)
59743d80 docs(audit): file the deploy record for Deploy AL [skip-automerge] (#1973)
901b78c7 docs(audit): file the deploy record for Deploy AM [skip-automerge] (#1972)
70b42b9f docs(phone): read the two phone renderers [skip-automerge] (#1971)
f240f3af docs(audit): F-Deploy-1 Fix Plan v1.54, retire three box directories [skip-automerge] (#1970)

$ git diff --name-only baa69a2d 88a41b85 -- src frontend/src package.json frontend/package.json
frontend/src/contexts/AuthContext.jsx
frontend/src/contexts/AuthContext.loginLogging.test.jsx
frontend/src/pages/Login.jsx
frontend/src/services/authService.js

$ git diff --name-only baa69a2d 88a41b85 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0

$ git diff --name-status baa69a2d 88a41b85
A	docs/PHONE_RENDERER_READ.md
A	docs/audit/F-Deploy-1_Deploy_2026-09-26_AL.md
A	docs/audit/F-Deploy-1_Deploy_2026-09-26_AM.md
A	docs/audit/F-Deploy-1_Fix_Plan_v1.54.md
M	frontend/src/contexts/AuthContext.jsx
A	frontend/src/contexts/AuthContext.loginLogging.test.jsx
M	frontend/src/pages/Login.jsx
M	frontend/src/services/authService.js
```

Exactly five commits. #1970, #1971, #1972 and #1973 are documents only; #1977
carries the code. The only code files are #1977's four frontend files, one of
them a test. Nothing under `src/`, no migration file, no package manifest or
lockfile.

**Beside her account.** Her `git diff … -- src/ src/migrations/` printing
nothing agrees with the measurement, and so does "frontend only, no backend
restart": no backend file changed.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AN.

**MEASURED.** The newest commit in the range, #1977, is 14:45:04 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" baa69a2d..88a41b85
88a41b85 2026-09-26T10:45:04-04:00 fix(auth): stop logging tokens and user details at login [skip-automerge] (
59743d80 2026-09-26T10:18:48-04:00 docs(audit): file the deploy record for Deploy AL [skip-automerge] (#1973)
901b78c7 2026-09-26T10:14:00-04:00 docs(audit): file the deploy record for Deploy AM [skip-automerge] (#1972)
70b42b9f 2026-09-26T09:55:56-04:00 docs(phone): read the two phone renderers [skip-automerge] (#1971)
f240f3af 2026-09-26T09:40:48-04:00 docs(audit): F-Deploy-1 Fix Plan v1.54, retire three box directories [skip-
```

## §4. Pre-deploy checks

**ATTESTED.** `git diff --name-only HEAD@{1} HEAD -- src/ src/migrations/`
printed nothing. She reports no `check-pending-migrations` run and no
`node -c`. Neither applied: no backend or migration file changed (§2).

**MEASURED.** The migration tree is unchanged from AM's 218 files, since no
file under `src/migrations/` changes in the range (§2).

## §5. What went live

### §5.1 The change, MEASURED

#1977 (`88a41b85`) removes the sign-in path's `console.log` calls. It reduces
every remaining failure log in `authService.js`, `AuthContext.jsx` and
`Login.jsx` to the error message and, where there is one, the HTTP status.
At the basis, every `console.*` call left in the three files is:

```
$ for f in frontend/src/services/authService.js frontend/src/contexts/AuthContext.jsx frontend/src/pages/Login.jsx; do git show 88a41b85:$f | grep -n "console\." | sed "s#^#$f:#"; done
frontend/src/services/authService.js:41:      console.error('[authService] Login failed:', error.message, error.response?.status);
frontend/src/services/authService.js:97:          console.warn('Backend logout failed (continuing with local logout):', err.message);
frontend/src/services/authService.js:130:      console.error('Token refresh failed:', error.message, error.response?.status);
frontend/src/contexts/AuthContext.jsx:41:        console.error('[AuthContext] Check auth error:', err.message);
frontend/src/contexts/AuthContext.jsx:86:      console.error('[AuthContext] Login error:', err.message, err.response?.status);
frontend/src/contexts/AuthContext.jsx:105:      console.error('[AuthContext] Logout error:', err.message);
frontend/src/pages/Login.jsx:33:      console.error('[Login] Login error:', err.message, err.response?.status);
```

The change also adds a test, `AuthContext.loginLogging.test.jsx`, run in CI.
It asserts no console argument contains the tokens, password, email or user
id, on a successful sign-in and on a failed one.

### §5.2 The live check, beside the code

**ATTESTED (§0).** Three lines on a failed sign-in, each "Request failed with
status code 401 401", and one line on a successful sign-in.

**MEASURED.** A failed sign-in passes through exactly three of the calls
above:
- `authService.js:41` (`[authService] Login failed:`)
- `AuthContext.jsx:86` (`[AuthContext] Login error:`)
- `Login.jsx:33` (`[Login] Login error:`)

Each prints the error message followed by the status, which for a 401 reads
"Request failed with status code 401 401". Her three lines are those three
calls.

The one line left on a successful sign-in is `frontend/src/App.jsx:251`:

```
$ git show 88a41b85:frontend/src/App.jsx | sed -n 251p
      console.log('[AppContent] User authenticated on login page, redirecting to home...');
```

It is outside #1977's files and prints no data.

**Standing of the live check.** Her screenshots are the attestation. This
record states what they show, in words, and reproduces no value from them.

### §5.3 Frontend

**ATTESTED.** Build succeeded. Entry `index-EiwjfLIh.js`, previously
`index-Cd2ISEKu.js` (AM record §0, §5.3). Backup `html.bak-20260926-pre1977`
taken before the swap. The served `index.html` references
`index-EiwjfLIh.js`.

**The nginx page, again.** AM's `--delete` sync removed
`index.nginx-debian.html` (AM record §5.3). AN's dry run listed it for
deletion again, and the real sync removed it again.

**INFERRED, not observed.** The page came back because the 2026-09-26
security updates upgraded the nginx package, which reinstalls its stock
page. Expect it to reappear after any nginx upgrade. Those updates are
described in v1.55 (#1975), which is not merged at this basis (its PR is
#1980), so this cites #1975's issue text, as the AM record cited #1960's.
Whether the updates included nginx is not in Evoni's account.

## §6. Restarts

**ATTESTED.** No backend restart. Frontend only.

**MEASURED.** No backend file changed (§2), so no restart was needed.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes (§2).

## §8. Basis statement

**MEASURED.** After Deploy AN, production's tree is this record's basis,
`88a41b85`. Merged after AN, undeployed (at filing, after
`git fetch origin main`):

```
$ git log --first-parent --format="%h %cI %s" 88a41b85..origin/main
fa7aa036 2026-09-26T10:58:01-04:00 docs(doctrine): record the phone device ruling [skip-automerge] (#1979)
$ git diff --name-status 88a41b85 origin/main
M	docs/DESIGN_DOCTRINE.md
```

A document only; it changes nothing production runs.

## §9. What this document does not do

This document:

- records no token, email, password, database host or user id, and
  reproduces no value from the screenshots;
- does not rule on the nginx page's return (§5.3), or on `App.jsx:251`'s
  remaining log line;
- does not describe the box maintenance or reboot of 2026-09-26, which v1.55
  (#1975, PR #1980) records;
- does not edit the AM record or any other filed document;
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS, database
  or Cognito contact. Every ATTESTED claim is Evoni's own account, taken
  outside any agent session. Every MEASURED claim is a repository read this
  filing session performed itself; issue text is a GitHub read, with nothing
  written.

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

Unchanged from the AM record §10. Nothing minted here.

## §Standing

- §1, §2, §4, §6 and §7 each carry ATTESTED and MEASURED clauses, marked
  separately and never merged into one standing.
- Every attested fact about the tree agrees with the measurement: five
  commits, #1977's four frontend files the only code, nothing under `src/`,
  no migration, no package change (§2).
- **The live check (§5.2):** her three failure lines are exactly the three
  message-and-status calls on the sign-in path. Her one success line is
  `App.jsx:251`, outside #1977, which prints no data.
- One reading is INFERRED and marked: the nginx stock page returning with an
  nginx package upgrade (§5.3). v1.55 is cited by its issue, since it is not
  merged at this basis.
- Nothing in this document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #1978.*
