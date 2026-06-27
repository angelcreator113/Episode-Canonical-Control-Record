# F-Deploy-G1-AK — Five-Point Gate Status Addendum (2026-06-02)

> **STATUS / ADDENDUM DOCUMENT.** Records the disposition of the AK five-point
> gate after the 2026-06-02 session. Two points (AK-3, AK-4) corrected via PR #752;
> the remaining points are updated per the notes below. This addendum does
> NOT change the AK finding's severity or its hard-blocker disposition on [3] — it
> records progress against the satisfiable five-point gate (v13 Sec 4 path (b)).

| | |
|---|---|
| **Parent** | `F-Deploy-G1-AK_ProdDeploy_Workflow_Hazard.md` (#747); v13 Sec 4 (satisfiable gate) + Sec 8. |
| **Session** | 2026-06-02. Corrected the two safely-correctable-outside-cutover points. |
| **PR** | #752 — `f-deploy-g1-ak/ak3-pm2-names` (AK-3 commit `64c62092`, AK-4 commit `cdd52009`). |
| **Gate status** | NOT yet satisfied. 3 of 5 corrected; 2 deferred to [3] cutover; no remaining parallel-safe open points. |
| **Main HEAD at session** | `285a913a` (#750) at session start; #751 + #752 opened this session. |

---

## Sec 1 — Per-point disposition

**AK-3 — PM2 names drifted from #746 topology. CORRECTED (#752).**
`.github/scripts/deploy-production.sh` rewritten to the #746 ecosystem topology
(prod = `episode-api-prod-hotfix`@3000, dev = `episode-api`@3002, worker =
`episode-worker` shared). Four regions fixed: stop/delete now targets prod only
(was stopping dev + shared worker, missing prod); start uses
`--only episode-api-prod-hotfix` + shared-worker reload, removed the nonexistent
`episode-api-dev`/`episode-worker-dev` block; the `else` fallback no longer
hardcodes `--name episode-api` for a prod start (now `exit 1`); the post-deploy
health gate and both failure-path `pm2 logs` now reference `episode-api-prod-hotfix`.
Topology decision: a prod deploy restarts prod app + shared worker, leaves dev
untouched (worker runs the same `src/` tree; leaving it on old code = a quiet
version split).

> **Citation correction (important):** the AK finding cited AK-3 at
> `deploy-production.sh:~217-238`. That range under-counted the contamination —
> the post-deploy health gate (`grep "episode-api.*online"`) and the two
> failure-path `pm2 logs episode-api` lines were OUTSIDE the cited range but are
> the same drifted-names defect. PR #752 fixed all of them. The finding's line
> citation should be read as the stop/start block only; the full corrected set is
> wider. Fold this into the AK finding doc when next edited.

**AK-4 — nginx failure path deletes the prod vhost. CORRECTED (#752).**
The `nginx -t` failure `else` echoed "keeping existing config" then ran
`sudo rm -f /etc/nginx/sites-enabled/episode-prod` without reloading — a
delayed-action prod-down (nginx serves old in-memory config until the next reload,
at which point the vhost is gone from disk). Reintroduced the webserver-reload risk
class Track B scoped out. Fixed: on failure, do NOT delete the vhost, do NOT reload
(running config stays live), `exit 1` with a truthful message. Confined to the
failure `else` (lines 194-200); the in-place `sed` SSL-detection branch and the
outer structure are untouched.

**AK-1 — `.env` `DB_HOST` overwrite from stale `PROD_DB_HOST`. DEFERRED to [3] cutover.**
Not correctable safely outside a cutover: `PROD_DB_HOST` is a write-only GitHub
secret — its value is unverifiable via API (`gh secret list` shows only the
timestamp). "Correcting" it would mean a blind overwrite of a production DB secret
on the assumption it is wrong. Deferred to the [3] combined window, where the secret
is set deliberately as part of establishing canon and a wrong value is caught by the
post-restart `/health` abort-check. (The finding itself notes AK-1's remediation is
FD-36-related and [3]-scope.)

**AK-2 — migrations target `PRODUCTION_DATABASE_URL`, runtime points at `PROD_DB_HOST`. DEFERRED to [3] cutover.**
Same write-only-secret constraint as AK-1; same deferral. The two secrets must be
confirmed to point at the SAME canon DB, which is a deliberate cutover step, not a
blind pre-write. Also note the swallowed migration failure (`migrate:up || echo
"...warnings"`) is a related defect to address in the same pass.

**AK-5 — parallel deploy scripts. CORRECTED (PR #TBD), scope wider than filed.**
The parent finding recorded "five deploy artifacts, three orphaned under
`scripts/deploy/`." Actual audit: **one wired canonical script**
(`.github/scripts/deploy-production.sh`, PM2 / #746 topology, invoked by
`deploy-production.yml:350`) and **seven unwired runnable deploy/rollback
entrypoints** across four incompatible models — Docker-compose operator CLIs
(`scripts/deploy/deploy-production.{sh,ps1}`, container postgres/redis @3003,
infra prod does not run), a `sudo rm -rf`+clone nuke-deploy
(`scripts/deploy/deploy-prod.sh`), and generic multi-env CLIs
(`scripts/deploy/deploy.{sh,ps1}`, `scripts/deploy.sh`,
`.github/scripts/deploy-to-ec2.sh`). None are referenced by any executable call
site (verified via repo-wide grep); the only references were stale docs
miscite-ing `deploy-to-ec2.sh`/`scripts/deploy.sh` as canonical (5 doc hits,
repointed). Severity reclassified from "orphaned duplicates" to
**incident-time mis-fire hazard**: two are destructive (host `sudo rm -rf`; DB
restore against nonexistent compose stack), all are runnable by a human reaching
for "the prod script" or "the rollback command." Disposition: all seven
removed; docs repointed. Confirmed parallel-safe — deleting unreferenced scripts
changes no deploy behavior and does not touch [3].

## Sec 2 — Gate status and what [3] still needs

The AK five-point gate (v13 Sec 4) is satisfiable two ways: **(a)** disable
`Deploy to Production` for the [3] window, OR **(b)** audit-and-correct all five
points. After this update, path (b) is partially complete (AK-3, AK-4, AK-5)
but NOT finished — AK-1/AK-2 remain (resolvable only at cutover).

**Therefore the AK gate is NOT yet satisfied.** At the [3] entry gate, AK is cleared by EITHER:
- finishing AK-1/AK-2 at cutover (set both secrets to canon deliberately; post-restart
  `/health` abort-check is the safety net), OR
- path (a): `gh workflow disable "Deploy to Production"` for the window.

Do NOT arrive at [3] assuming AK is closed because parallel-safe points are done.
Three of five are corrected; the remaining two are cutover-bound unless path (a)
remains in force.

## Sec 3 — What this session did NOT do
- Did NOT run `Deploy to Production` or any deploy script (file edits only).
- Did NOT overwrite `PROD_DB_HOST` or `PRODUCTION_DATABASE_URL` (write-only secrets;
  no blind correction).
- Did NOT touch the nginx `sed` SSL-detection logic (only the destructive failure path).
- Did NOT execute any removed parallel deploy/rollback script; AK-5 cleanup is a
  source-control disposition only.
- Did NOT execute [3] or the restart-to-align.

## Sec 4 — [3] entry gate (updated)
1. Live abort-check re-verify (#749) — still owed.
2. Credential gate 2.5 — GREEN (#751, 2026-06-02 reconcile). [done]
3. AK five-point — AK-3/AK-4 corrected (#752); AK-5 corrected (PR #TBD);
  AK-1/AK-2 deferred to cutover. Gate satisfied at [3] via cutover-completion OR
  workflow-disable.
4. Then the combined window: FD-31 rotation + Track B restart-to-align + route fix +
   security sweep, ONE restart, post-restart `/health` = canon host + matching counts
   or ABORT+restore.

---
*AK five-point gate status update. AK-3 (PM2 names -> #746 topology, including
verification-grep scope beyond the finding's :217-238 citation) and AK-4
(destructive nginx failure path removed) corrected in PR #752. AK-5 corrected
as parallel-safe cleanup (seven unwired runnable deploy/rollback entrypoints
removed; docs repointed). AK-1/AK-2 deferred to [3] cutover (write-only secrets,
no blind overwrite). Gate NOT yet satisfied outside the window: path (b) is now
3/5, with the remaining two cutover-bound unless path (a) remains in force.
No deploy run, no secret overwrite, no [3] execution.*
