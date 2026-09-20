| **PRIME STUDIOS** **F-DEPLOY-1 FIX-PLANNING DOCUMENT** *Freeze lifted (Evoni ruling) + deploy-content preflight.* |
| --- |

**Document version**

v1.53 — successor to v1.52. Basis: `origin/main` at
`16261969fea9ee7d38dc5241c3208ffda4960bf2`, measured 2026-09-20.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RULED (§1) + ATTESTED (§2) + MEASURED (§4). This revision records Evoni's
ruling lifting the production freeze, her six preflight answers, and a
repo-only list of what deploying `origin/main` over `91193483` would ship.
It performs no deploy and no code change. Mints no FD, XK, or PE.

---

# F-Deploy-1 Fix Plan v1.53 — freeze lifted, deploy-content preflight

## §Measured repository basis

The basis SHA above is **MEASURED** from `origin/main`.

```
$ ls docs/audit/F-Deploy-1_Fix_Plan_v1.*.md | grep -v '_v1\.53\.md$' | sed -E 's#.*v1\.([0-9]+)\.md#\1 &#' | sort -n | tail -3
50 docs/audit/F-Deploy-1_Fix_Plan_v1.50.md
51 docs/audit/F-Deploy-1_Fix_Plan_v1.51.md
52 docs/audit/F-Deploy-1_Fix_Plan_v1.52.md
```

(`grep -v '_v1\.53\.md$'` excludes this very file, `F-Deploy-1_Fix_Plan_v1.53.md`,
from the listing — this check was performed before this document existed;
the exclusion reconstructs that pre-filing state honestly rather than the
command seeing itself.) v1.52 is the newest existing fix plan; nothing
newer exists. This revision is v1.53, as expected.

Priors, cited and not re-derived:
- `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repository root; Sec 3 — the
  numbered freeze rules this ruling lifts).
- `F-Deploy-1_Fix_Plan_v1.50.md` (2026-09-17 ruling that `Deploy to
  Development` stays undispatched; hazard doc Sec 3 items 7 and 9 govern).
- `F-Deploy-1_Fix_Plan_v1.52.md` (2026-09-18 reconciliation record: snapshot
  `canon-pre-reconcile-20260918` taken and restore-verified to a scratch
  instance before the session; deployed basis `91193483`).

## §1. Ruling — Evoni

**Standing: RULED.** Evoni's words, verbatim, as given for this revision:

> **Question 6** (question wording drafted by the planning assistant, not by
> Evoni): "Freeze scope: lift it entirely, or a one-time exception for this
> deploy?"
>
> **Evoni's answer:** "lift it"

**Reading of the answer:** "lift it" answers the first branch of the
drafted question — the freeze is lifted entirely, not as a one-time
exception scoped to a single deploy. This revision records that reading;
it does not paraphrase or expand Evoni's own words beyond the two quoted
above.

**Effect:** `F-Deploy-1_PROD_SplitBrain_HAZARD.md` Sec 3's numbered freeze
rules (no `pm2 restart`/reload, no reboot or deploy against the prod box,
no `.env` edit, no `pm2 save`, no RDS modification, no inter-instance data
copy, no dev-box deploy pointed at either instance, no SG change, no
re-enabling the disabled workflows) are lifted by this ruling. **This
ruling does not itself amend the hazard document** — the hazard document is
immutable per the register's carriage rules (never edited in place); an
additive banner pointing at this revision is named as owed, not performed,
at §5 below.

**Not re-opened by this ruling:** F-Deploy-1 remains CLOSED (v1.50, v1.52).
Nothing here reopens the keystone, mints an FD/XK/PE, or re-enables `Deploy
to Development` or `Deploy to Production` — v1.50's ruling on those
workflows stands untouched; a lifted general freeze is not, by itself, a
ruling on any specific workflow's enablement.

## §2. Preflight — ATTESTED (Evoni's own knowledge, outside any agent session)

**Standing: ATTESTED.** Each question was asked and Evoni's answer is
recorded verbatim. No agent session made host, AWS, database, or Cognito
contact to obtain these answers.

| # | Question | Evoni's answer |
|---|---|---|
| Q1 | Does production's `DB_HOST`/`DB_NAME` point at canon `episode-control-dev` right now? | "yes" |
| Q2 | Is there a canon snapshot you know you can restore? | "yes" |
| Q3 | After the 09-18 restart, did you confirm prod was serving canon data? | "yes" |
| Q4 | If the deploy goes wrong, am I comfortable putting `91193483` back the same way I deployed? | "yes" |
| Q5 | Is `COGNITO_CLIENT_SECRET` set in production's `.env`? | "i do not have a COGNITO_CLIENT_SECRET in my .env file" |
| Q6 | Freeze scope: lift it entirely, or a one-time exception for this deploy? | "lift it" (§1 above) |

**Q1–Q4, cross-referenced against v1.52 (carried, not re-derived):** v1.52
§Backup records the snapshot `canon-pre-reconcile-20260918`, restored to a
scratch instance `canon-verify-20260918` and read (143 tables, 2,760
`information_schema.columns` rows, matching the 2026-08-29 and 2026-09-17
captures) before the scratch instance was deleted — the snapshot itself is
retained. v1.52 §Deploy records the deployed basis as `91193483`. Q1–Q3's
"yes" answers are consistent with what v1.52 already recorded as
Evoni-attested fact; this document does not re-verify them independently.

**Q5, read literally:** Evoni's answer states a `COGNITO_CLIENT_SECRET`
value is not present in production's `.env`. This document takes no
position on whether that is the intended configuration — `src/services/cognitoPasswordAuthService.js`'s
own code (read in a prior document, not re-derived here) treats an absent
client secret as a supported, not a broken, configuration for a
secret-less Cognito app client. Whether production's app client is in fact
configured secret-less is outside this document's scope; it records the
attested fact only.

## §3. Scope boundaries

Lifting the freeze (§1) does **not** change any of the following:

- **Agent sessions still never touch hosts, AWS, RDS, or Cognito.** This is
  a standing `CLAUDE.md` non-negotiable, independent of the hazard
  document's freeze rules, and is untouched by §1's ruling.
- **No disabled workflow is re-enabled.** `Deploy to Development` and
  `Deploy to Production` remain exactly as v1.50 left them; this revision
  rules nothing about either.
- **No deploy is performed by this revision, or by any agent session.** The
  deploy — if and when it happens — remains Evoni's own action, taken
  personally, outside any agent session, the same way the 2026-09-18
  deploy recorded in v1.52 was taken.

## §4. Deploy-content preflight — MEASURED, repo only

**Ancestry, confirmed:**

```
$ git merge-base --is-ancestor 91193483fce433b85ec591a3811d138c7b3228a0 origin/main; echo "EXIT: $?"
EXIT: 0
```

`91193483` (v1.52's deployed basis) is an ancestor of `origin/main` at this
document's basis. `origin/main..91193483` diverges by zero commits in the
wrong direction; every commit below is additive on top of what is
currently deployed.

### §4(a) Every commit, `91193483..origin/main`

```
$ git log --format='%H %s' 91193483fce433b85ec591a3811d138c7b3228a0..origin/main | cat -n
     1	16261969fea9ee7d38dc5241c3208ffda4960bf2 docs(audit): file logout-revocation read [skip-automerge] (#1570)
     2	a40b72250c6b53a49c5a303cf253053a09b2fe84 docs: resolve staging RDS literal redaction status [skip-automerge] (#1568)
     3	b1313a9c1eff8d75123f214b3a74eab2e07957aa docs(context): refresh PROJECT_CONTEXT for Cognito refresh and v2.77 [skip-automerge] (#1566)
     4	213edbab10de2b07759a2c9b6969e53305f3b6cd feat(auth): exchange Cognito refresh tokens on /refresh per v2.77 [skip-automerge] (#1564)
     5	bf60ab1f712a28c6f1ef8945bf2f4aaa0b7bc9de docs(audit): file F-AUTH-1 Fix Plan v2.77 — Cognito refresh rulings [skip-automerge] (#1562)
     6	2964fce5d661fd8fef013a1ce5cb3a4fc7fe8d9d docs(audit): file F-AUTH-1 session-refresh read [skip-automerge] (#1560)
     7	b791439bc2fbb89c683c4073f14f48a9584d1b7c docs(audit): record enforce_admins verified true 2026-09-20 [skip-automerge] (#1558)
     8	a7fe6206f838a25d4846f56b7d31d7ce8f2842a9 docs(audit): file the 2026-09-19 session-conduct record [skip-automerge] (#1556)
     9	23887d44a6dfc7aa90980fb6e6ddc2de93d73b71 docs(audit): correction banner on #1550 note tail claims [skip-automerge] (#1554)
    10	071a740ae8fb26882c5fa0388cdc2c7de352f9f5 docs(audit): file Character Studio feasibility read [skip-automerge] (#1548)
    11	97639979e801acc79cefa769ae32a0c4c944e1fb docs(audit): file EpisodeDetail overview-test read [skip-automerge] (#1550)
    12	c594928405d32bcc4b663574f242f02490f82317 test(frontend): stabilize useToast mock to fix EpisodeDetail test isolation [skip-automerge] (#1552)
    13	34b3da26fcab7ea740631e3109eb1ab702856435 feat(frontend): group Stories tools under a sidebar hub [skip-automerge] (#1546)
    14	ce54a1427d460f36603325eb712be504a1cbfb96 feat(frontend): apply IA redirect policy and six route dispositions [skip-automerge] (#1544)
    15	5667d9a87a4ad1f7dc8fd6cdf4e37365fffc96e7 feat(frontend): retire /universe/assets and /audit-log duplicates [skip-automerge] (#1542)
    16	8d4a961620e85625a2f57bc744b4e823500d1a05 feat(frontend): sidebar workspace renames and Relationships repoint [skip-automerge] (#1540)
    17	e92610563e1c9bb9abaa36f5224f4e3b1e713a95 docs(design): record navigation/IA ruling [skip-automerge] (#1538)
    18	3002cdb819d97749dde71004ba6dd41a99a09715 docs(audit): file navigation census [skip-automerge] (#1535)
    19	7001e31f5d8ff5879d4ff5545ee183d175abdf42 feat(frontend): four-state Production Checklist sections [skip-automerge] (#1533)
    20	13a6c54492121b56fd1d4e07291fee67d392a815 feat(frontend): land episode on Checklist by default [skip-automerge] (#1531)
    21	15abdbafb68368cf3d459c2ffd77f38ba41b33cc feat(frontend): mount Production Checklist; move to-do overlays to Assets [skip-automerge]
    22	7e9f91d1de5271e6ba77c6d5db41e23d30dd26d0 docs(design): add episode production architecture [skip-automerge]
    23	91940e48923091e53095fe329b8615087bb7ca16 docs(audit): file checklist endpoint census [skip-automerge] (#1526)
    24	ab1ac90b794b91b412e82b47be70cf74377cd7b8 docs(context): refresh PROJECT_CONTEXT.md for the 2026-09-18 reconciliation [skip-automerge] (#1523)
    25	33cabcb8a8dc9824ceae5e4b9b4441ef172e541a docs(audit): author F-Deploy-1 Fix Plan v1.52 — 2026-09-18 reconciliation session [skip-automerge] (#1521)
```

25 commits. Note: some entries are the squash commit's title without a
trailing `(#N)` suffix (rows 4, 21, 22, 25 above carry `(#N)`; a few like
`b791439b`/`a7fe6206`/etc. do too) — this is the same commit-message
variance a prior document (`F-AUTH-1_LogoutRevocation_Read_2026-09-20.md`)
observed elsewhere in this repo's history; not investigated further here.

### §4(b) `src/migrations/` — MEASURED

```
$ git diff --name-status 91193483fce433b85ec591a3811d138c7b3228a0..origin/main -- src/migrations/
EXIT: 0
```

No output. **None** — no file under `src/migrations/` was added or changed
in this range. Deploying `origin/main` over `91193483` requires no
migration run.

### §4(c) Dependency manifests — MEASURED

```
$ git diff --stat 91193483fce433b85ec591a3811d138c7b3228a0..origin/main -- package.json package-lock.json frontend/package.json frontend/package-lock.json
EXIT: 0
```

No output. **None** — neither root nor `frontend/` `package.json` or
`package-lock.json` changed in this range. `npm ci` (root and `frontend/`)
would install the identical dependency set already on the deployed box; no
new install is required by this range's content (whether to re-run it
anyway is a deploy-procedure question, not answered here).

### §4(d) `process.env` names — MEASURED

```
$ git grep -hoE "process\.env\.[A-Z_][A-Z0-9_]*" 91193483fce433b85ec591a3811d138c7b3228a0 -- src frontend/src | sed 's/^[^:]*://' | sort -u | wc -l
146
$ git grep -hoE "process\.env\.[A-Z_][A-Z0-9_]*" origin/main -- src frontend/src | sed 's/^[^:]*://' | sort -u | wc -l
146
$ diff <(git grep -hoE "process\.env\.[A-Z_][A-Z0-9_]*" 91193483fce433b85ec591a3811d138c7b3228a0 -- src frontend/src | sed 's/^[^:]*://' | sort -u) <(git grep -hoE "process\.env\.[A-Z_][A-Z0-9_]*" origin/main -- src frontend/src | sed 's/^[^:]*://' | sort -u); echo "EXIT: $?"
EXIT: 0
```

Both trees reference the same 146 distinct `process.env.NAME` identifiers
under `src/` and `frontend/src/`; the diff between the two sorted lists is
empty. **No new environment variable name is referenced at `origin/main`
that was not already referenced at `91193483`.** This is a name-level
check only — it does not confirm every named variable already has a set
value in production's `.env` (§2 Q5 above is the one instance this
document does check that way).

### §4(e) Auth-relevant changes — MEASURED, PR #1564

```
$ git diff --stat 91193483fce433b85ec591a3811d138c7b3228a0..origin/main -- src/routes/auth.js src/middleware/auth.js src/middleware/jwtAuth.js src/services/tokenService.js src/services/cognitoPasswordAuthService.js frontend/src/services/authService.js frontend/src/services/api.js
 src/routes/auth.js                         | 82 +++++++++++++++++++++++++++---
 src/services/cognitoPasswordAuthService.js | 41 ++++++++++++++-
 2 files changed, 115 insertions(+), 8 deletions(-)

$ git log --format='%H %s' 91193483fce433b85ec591a3811d138c7b3228a0..origin/main -- src/routes/auth.js src/middleware/auth.js src/middleware/jwtAuth.js src/services/tokenService.js src/services/cognitoPasswordAuthService.js frontend/src/services/authService.js frontend/src/services/api.js
213edbab10de2b07759a2c9b6969e53305f3b6cd feat(auth): exchange Cognito refresh tokens on /refresh per v2.77 [skip-automerge] (#1564)
```

**PR #1564 is the only auth-relevant change in this range.** It touches
exactly two production files, `src/routes/auth.js` and
`src/services/cognitoPasswordAuthService.js` — `src/middleware/auth.js`,
`src/middleware/jwtAuth.js`, `src/services/tokenService.js`, and the two
frontend auth files checked are untouched. Its full commit stat (`git show
213edbab10de2b07759a2c9b6969e53305f3b6cd --stat`, not reproduced in full
here) additionally shows three test files changed/added — `tests/integration/auth.integration.test.js`,
`tests/unit/routes/auth-refresh-cognito.test.js`, `tests/unit/services/cognitoPasswordAuthService.test.js`.

What it does, per its own subject and per `docs/audit/F-AUTH-1_LogoutRevocation_Read_2026-09-20.md`
§6 (carried, not re-derived): `POST /refresh` now calls
`cognitoPasswordAuthService.refreshWithCognito`, which sends the refresh
token to Cognito's own `InitiateAuth`, `AuthFlow: 'REFRESH_TOKEN_AUTH'` —
replacing the prior `TokenService.refreshAccessToken` (local HS256-only)
path. **Deploying this range changes production's refresh behavior**: a
Cognito refresh token that `/refresh` previously rejected outright (per
the HS256-only path `F-AUTH-1_SessionRefresh_Read_2026-09-19.md` measured)
would, after this deploy, be exchanged with Cognito for real. This is a
repo-content observation; whether it behaves correctly against the live
pool is F-AUTH-1 v2.77 §8(b)'s live verification, named as owed at §5
below, not performed here.

### §4(f) Frontend changes — MEASURED

```
$ git diff --stat 91193483fce433b85ec591a3811d138c7b3228a0..origin/main -- frontend/
 frontend/src/App.jsx                               | 29 +++----
 .../src/components/Episodes/EpisodeAssetsTab.jsx   | 11 +++
 .../Episodes/EpisodeProductionChecklist.jsx        | 58 +++++++++++--
 .../Episodes/EpisodeProductionChecklist.test.jsx   | 56 +++++++++++++
 frontend/src/components/layout/Sidebar.jsx         | 24 +++---
 frontend/src/pages/EpisodeDetail.jsx               | 17 ++--
 frontend/src/pages/EpisodeDetail.test.jsx          | 94 ++++++++++++++++++++++
 7 files changed, 246 insertions(+), 43 deletions(-)
```

Frontend source changed in this range, so the served frontend must be
rebuilt as part of the deploy — a procedure fact, not a ruling.

## §5. Owed items — named, not performed

- **An additive banner on `F-Deploy-1_PROD_SplitBrain_HAZARD.md`** pointing
  at this revision. The hazard document is immutable per the register's
  carriage rules; this revision does not edit it. A banner is separate,
  additive work.
- **A `PROJECT_CONTEXT.md` refresh** of §0 item 1 and §7, to reflect this
  ruling. Not performed by this revision — `PROJECT_CONTEXT.md` is
  untouched.
- **Evoni's deploy**, taken personally outside any agent session, the same
  way the 2026-09-18 deploy (v1.52) was taken — followed by **F-AUTH-1
  v2.77 §8(b)'s live verification** of the Cognito refresh path against the
  real pool. Neither is performed here; both remain outstanding after this
  revision files.

## §6. What this revision does not do

This revision:

- performs no deploy;
- makes no host, AWS, database, or Cognito contact;
- changes no file under `src/`, `frontend/`, or `tests/`;
- amends no filed document — the hazard document and every prior
  `F-Deploy-1_Fix_Plan_v1.*.md` are cited, not edited;
- re-enables no workflow;
- edits no other file — `PROJECT_CONTEXT.md` is untouched (§5);
- mints no FD, XK, or PE number;
- rules nothing about `F-AUTH-1`'s own open items — §4(e)'s observation
  about PR #1564's behavior change is descriptive, not a ruling.

## §Standing

§1 is RULED (Evoni's own words, quoted verbatim). §2 is ATTESTED (Evoni's
own knowledge, outside any agent session). §3, §5, §6 state scope and
consequence, standing on §1/§2, not independently labelled. §4 is MEASURED
— every command and its raw output is pasted above, derived from this
repository only, at the basis SHA on this document's face.

No host, AWS, database, or Cognito contact. F-Deploy-1 remains CLOSED (this
revision rules on freeze scope only, not on the keystone).

---

**Type:** Ruling (§1) + attestation (§2) + measured preflight (§4).
**Rules:** the freeze scope only (lifted entirely). **Mints:** nothing.
**Host/AWS/DB/Cognito contact (this session):** none. The deploy remains
Evoni's own action, not performed here.
