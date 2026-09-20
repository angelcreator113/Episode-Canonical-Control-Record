| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *The 2026-09-20 production deploy, an intermediate restart, and F-AUTH-1 v2.77 §8(b)'s live verification.* |
| --- |

**Document version**

New record, not a Fix Plan revision. Basis: `origin/main` at
`f08440fcb5a361896cc91d1f3d79705f235bc51e`, measured 2026-09-20.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Two standings appear below, each marked on its own claim, never
upgraded: **MEASURED** for what this repository itself shows — a `git
diff`/`show` any clone can reproduce — and **ATTESTED** for what only
Evoni's own account of the production host can state, not reproducible from
a clone (the same basis distinction `Prime_Studios_Audit_Handoff_v26.md`
Sec 3.2 draws for host-only facts). This document closes no keystone,
discharges no owed item, and mints no FD, XK, or PE number.

## §1. Deploy

**ATTESTED.** Evoni attests that she moved the production working tree from
`34b3da26fcab7ea740631e3109eb1ab702856435` to `origin/main` at
`f08440fcb5a361896cc91d1f3d79705f235bc51e` by `git merge --ff-only`, then
restarted `episode-api-prod-hotfix`. Taken personally, outside any agent
session, the same way the 2026-09-18 deploy (`F-Deploy-1_Fix_Plan_v1.52.md`)
was taken. No workflow was dispatched or re-enabled.

**MEASURED**, from the repository, `git diff --stat
34b3da26fcab7ea740631e3109eb1ab702856435..f08440fcb5a361896cc91d1f3d79705f235bc51e`:
17 files changed, 4,411 insertions, 55 deletions. Exactly two `src/` files
are in that diff — `src/routes/auth.js` and
`src/services/cognitoPasswordAuthService.js` — both already recorded as
F-AUTH-1 v2.77 §8(a)'s `/refresh` rewrite (Task #1563/PR #1564), so this
deploy is the first time that rewrite reached production. The only
`frontend/` path in the same diff is
`frontend/src/pages/EpisodeDetail.test.jsx`, a test file, not a component
or asset the served build depends on — no frontend rebuild was needed.
`package.json` and `package-lock.json` are both unchanged in the diff — no
dependency install was needed. `Deploy to Production`'s last measured state
is `disabled_manually` (`F-Deploy-1_Fix_Plan_v1.50.md` §5); this document
does not re-measure it.

## §2. Prior-state discrepancy — not ruled

**MEASURED.** `PROJECT_CONTEXT.md` §7 ("Prod box" row) states that the
working tree was moved to `origin/main` at `91193483` on 2026-09-18; that
figure originates in `F-Deploy-1_Fix_Plan_v1.52.md`'s own §Deploy ("The
working tree moved from `13002465` to `origin/main` at `91193483`") and is
cited forward, as `91193483fce433b85ec591a3811d138c7b3228a0`, at
`docs/audit/F-Deploy-1_Fix_Plan_v1.53.md` §4's ancestry check — **not** at
its §5, which references the 2026-09-18 deploy without repeating the SHA.
Both `91193483fce433b85ec591a3811d138c7b3228a0` and
`34b3da26fcab7ea740631e3109eb1ab702856435` (§1 above) are real commits in
this repository (`git cat-file -t` on each returns `commit`), and
`git merge-base --is-ancestor 91193483fce433b85ec591a3811d138c7b3228a0
34b3da26fcab7ea740631e3109eb1ab702856435` succeeds: `34b3da26` is thirteen
commits ahead of `91193483` on `origin/main`'s own history, dated
2026-09-19, one day after v1.52's 2026-09-18 date — not an unrelated or
earlier commit.

**ATTESTED.** Evoni attests that the production working tree was read at
`34b3da26fcab7ea740631e3109eb1ab702856435` immediately before this
deploy — a different commit than `91193483`, the one `PROJECT_CONTEXT.md`
§7 and `F-Deploy-1_Fix_Plan_v1.52.md`/`v1.53.md` §4 state prod was at after
the 2026-09-18 deploy.

This document records the discrepancy and takes no position on which prior
statement is correct, how the tree came to be at `34b3da26` instead of
`91193483` (the two are related by ordinary ancestry, not by branch
divergence, but ancestry alone does not establish how or when production's
own tree moved between them), or whether anything deployed, restarted, or
otherwise changed production between 2026-09-18 and this session.
`PROJECT_CONTEXT.md` §7 and `docs/audit/F-Deploy-1_Fix_Plan_v1.53.md` are
both cited above, not edited or implied incorrect — v1.53 is filed and
immutable, and v1.53 §4 correctly cites `91193483` as v1.52's own deployed
basis, a fact this document does not dispute. Resolving this discrepancy,
if it is resolved, is a future Fix Plan revision's work.

## §3. Intermediate restart

**ATTESTED.** Evoni attests that at approximately 16:51 UTC, before the
deploy in §1, `episode-api-prod-hotfix` was restarted while the working
tree was still at `34b3da26fcab7ea740631e3109eb1ab702856435` (PM2 restart
counter 7 at that point). This restart deployed nothing — the tree did not
move. The deploy restart described in §1 followed at 16:56:55 UTC, moving
the counter to 8. Both restarts are recorded; only the second one changed
what was running.

## §4. Post-state

**ATTESTED.** Evoni attests that after the §1 restart,
`episode-api-prod-hotfix` reported online, in cluster mode, at restart
counter 8, with zero unstable restarts, and that a request to the local
root route returned HTTP 200. `episode-worker` remains stopped, unchanged
by this deploy. The new process's startup log carried only two warnings,
both pre-existing and unrelated to this deploy: an OpenSearch fallback
notice and an AWS SDK node-version notice (see §6).

## §5. F-AUTH-1 v2.77 §8(b) live verification

**ATTESTED.** Evoni attests that she performed the verification
`F-AUTH-1_Fix_Plan_v2.77.md` §8(b) names as owed, against the real Cognito
pool, after the deploy in §1:

- `POST /api/v1/auth/login` returned `200`, with response `data` carrying
  the keys `accessToken`, `expiresIn`, `refreshToken`, `tokenType`, `user`.
- `POST /api/v1/auth/refresh`, called with the `refreshToken` from the
  response above, returned `200`, with response `data` carrying exactly the
  keys `accessToken`, `expiresIn`, `tokenType` — and **no** `refreshToken`
  in that response (non-rotation, as designed).

**MEASURED.** `F-AUTH-1_Fix_Plan_v2.77.md` §7 pins exactly the three keys
`/refresh` returned above (`accessToken`, `expiresIn`, `tokenType`,
exposing neither `idToken` nor a replacement `refreshToken`) as the success
contract — this document confirms the citation, not the live response
against it, which is Evoni's own account above.

Only key names and HTTP statuses are recorded here. No token, credential,
or other field value was captured in this document.

## §6. Observations carried, not ruled

**MEASURED.** `src/services/cognitoPasswordAuthService.js:29` reads
`process.env.COGNITO_CLIENT_SECRET?.trim() || null` — an absent value is
read by the application as optional, not as a misconfiguration.

**ATTESTED**, all from the production host, recorded as observations only —
none is characterized as a defect, and none is acted on by this document:

- No `COGNITO_CLIENT_SECRET` is present in the production `.env`.
- The root filesystem was at 88% used, with approximately 933M available.
- Four untracked `.bak` files exist in the production tree, including
  `src/routes/auth.js.bak-2026-08-22`.
- The box runs node v20.20.1. The AWS SDK v3 packages this codebase depends
  on will require node >=22 starting January 2027 — not yet a live
  constraint, but a dated one.

## §7. What this document does not do

This document:

- does not discharge `F-Deploy-1_Fix_Plan_v1.53.md` §5's third owed item
  (Evoni's deploy, then F-AUTH-1 v2.77 §8(b) verification) as a register
  ruling — it records that both steps were taken; whether that counts as
  discharging the owed item is for `PROJECT_CONTEXT.md`'s own §6.5 (or a
  future Fix Plan revision) to state, not this document;
- does not close F-AUTH-1 v2.77 §8(b), or any other open item;
- mints no FD, XK, or PE number;
- amends no filed document — `F-Deploy-1_Fix_Plan_v1.53.md`,
  `F-Deploy-1_Fix_Plan_v1.52.md`, and `PROJECT_CONTEXT.md` are cited above,
  not edited;
- does not rule on the §2 discrepancy, or on any other open question it
  names;
- performs no deploy of its own and makes no host, AWS, database, or
  Cognito contact — every ATTESTED claim above is Evoni's own account,
  taken outside any agent session; every MEASURED claim is a repository
  read this filing session performed itself, against `origin/main`, not
  against any host.

## §Standing

§1, §3, §4, §5, and §6 each carry both an ATTESTED clause (Evoni's own
account of actions and reads made personally, on the production host, not
reproducible from a clone) and a MEASURED clause (a `git diff`/`show`/
`cat-file`/`merge-base` read against this repository, reproducible by
anyone with a clone), marked separately where they mix — never merged into
one standing. §2 is the same mix, marked the same way, and additionally
states plainly what it does not rule. Nothing in this document is labelled
RULED. No host, AWS, database, or Cognito contact was made by the agent
session that filed it — every MEASURED claim above reads this repository
only. Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1);
agent sessions still never touch hosts, AWS, RDS, or Cognito (`CLAUDE.md`),
unchanged by that lift or by this record.
