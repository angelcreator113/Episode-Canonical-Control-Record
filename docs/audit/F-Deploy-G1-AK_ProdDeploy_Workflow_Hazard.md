# F-Deploy-G1-AK -- "Deploy to Production" workflow re-arms the split-brain and disrupts the live topology (DRAFT v0.1)

> **PREP / FINDING DOCUMENT. AUTHORIZES NO PROD-BOX ACTION.**
> Reading/drafting this changes nothing on `episode-backend` (`54.163.229.144`).
> The finding documents hazards in the `Deploy to Production` workflow. The
> remediation is [3]-scope (the combined-restart window) and is its own gated
> session. This doc blocks and records; it does not repair.

| | |
|---|---|
| **Finding** | F-Deploy-G1-AK (P1, **provisional letter** -- confirm at the v12 Sec 8.1 registry reconcile) |
| **Class** | Five-part cluster, one root cause: the prod-deploy path drifted from live reality while it sat un-run; manual invocation now performs unsafe writes/restarts. |
| **Origin** | 2026-06-01 session, surfaced while gating the Track B Minimal-B push (#746). `gh workflow list` showed "Deploy to Production" `active`; investigation of `deploy-production.yml` + `.github/scripts/deploy-production.sh` revealed the cluster. |
| **Related** | FD-36 (canon-only `.env`, data-swap defused -- AK-1 can reverse it); FD-31 (split-brain -- AK-2 re-encodes it); F-Deploy-G1-H (hardcoded port/name drift -- AK-3 is its sibling); Track B (AK-3/AK-4 contradict the #746 topology + nginx-out-of-scope decision); FD-35 (2026-05-30 auto-deploy `pm2 save` poisoning -- AK's `pm2 save --force` is the same mechanism). |
| **Status** | DRAFT v0.1 -- finding recorded, evidence cited, disposition = hard blocker on [3] with a satisfiable gate (Sec 4). Remediation deferred to [3]. |
| **Trigger** | `workflow_dispatch` only (confirmed `deploy-production.yml:2-12`): inputs `confirm` (must equal `DEPLOY TO PRODUCTION`) + `reason`. No `push`/`pull_request`/`workflow_run`/`schedule`/`repository_dispatch`. **`active` = manually-runnable, NOT auto-firing.** A push to main does not trigger it -- the #746 file-merge premise was sound. |

---

## Sec 0 -- One-line

The manually-triggered `Deploy to Production` workflow, if run today, would: overwrite
the FD-36 canon-only `.env` `DB_HOST` from a stale-dated secret, run migrations against
a *different* secret than it points the app at, stop/delete PM2 processes by names that
now map to the wrong roles, and redeploy nginx (with a prod-vhost-delete failure path) --
then `pm2 save --force` the result. The phrase-gate prevents accidents, not any of these.

## Sec 1 -- Why this is a finding now (not before)

The workflow has presumably been `active` and unchanged for some time. It became a
finding when two things converged on 2026-06-01:
1. **The live topology changed** (06-01 hotfix: prod = `episode-api-prod-hotfix`@3000,
   dev = `episode-api`@3002) and the config-of-record changed (#746 folded the apps to
   3 and corrected the prod default-env). The deploy script was written against the OLD
   4-app names and never updated -- so it now disagrees with both live state and main.
2. **FD-36 established that the on-disk `.env` is the canon-safety mechanism.** Any
   process that rewrites `.env` `DB_HOST` is now a safety-relevant actor. This workflow
   does exactly that, deterministically, on every run.

Pre-FD-36, "a deploy rewrites `.env`" was unremarkable. Post-FD-36 it can reverse the
single most important data-safety fix on the board.

## Sec 2 -- The five sub-findings (each cited)

### AK-1 -- `.env` `DB_HOST` overwrite re-arms FD-36

`deploy-production.yml` (the `Deploy to EC2` step, ~`:291`) builds a creds file:
```
printf '%s\n' \
  'DB_HOST=${{ secrets.PROD_DB_HOST }}' \
  'DB_NAME=${{ secrets.PROD_DB_NAME }}' \
  'DB_USER=${{ secrets.PROD_DB_USER }}' \
  'DB_PASSWORD=${{ secrets.PROD_DB_PASSWORD }}' \
  > "$CREDS_FILE"
```
SCPs it to the box, then merges into `/home/ubuntu/episode-metadata/.env` via a
key-by-key upsert (`deploy-production.yml` ~`:319-334`): for each line, if `^${KEY}=`
exists it is replaced, else appended. The upsert logic is correct engineering -- but it
means **`DB_HOST` is unconditionally overwritten** with `secrets.PROD_DB_HOST`. The
"only if set" guard (`if [ -n ... ]`) exists ONLY for the optional API keys (FAL_KEY,
REMOVEBG_API_KEY), NOT for the DB block.

**Hazard:** FD-36 defused the data-swap landmine by making `.env` canon-only
(`DB_HOST=episode-control-dev`). If `secrets.PROD_DB_HOST` points at the empty
`episode-control-prod` (the split-brain default, plausible given history), one manual
deploy silently re-points the box at the empty DB and restarts it -- reversing FD-36.
**Value unverifiable via API** (secrets are write-only); `gh secret list` shows
`PROD_DB_HOST` last updated ~2 months ago, i.e. PRE-dating the ~22-day-old FD-36-era
credential work. Treat as pointing at `-prod` until proven otherwise.

### AK-2 -- Migrations target a different secret than runtime

The script is invoked with `DATABASE_URL='${{ secrets.PRODUCTION_DATABASE_URL }}'`
(`deploy-production.yml`, the retry loop, ~`:347`), and inside
`.github/scripts/deploy-production.sh` (~`:204-208`):
```
export DATABASE_URL="${DATABASE_URL}"
export NODE_ENV=production
npm run migrate:up || echo "...Migrations completed with warnings"
```
So **migrations run against `PRODUCTION_DATABASE_URL`** while **the app's `.env`
`DB_HOST` is set from `PROD_DB_HOST`** (AK-1). These are two distinct secrets, set at
different times (`PRODUCTION_DATABASE_URL` ~22 days ago; `PROD_DB_HOST` ~2 months ago).

**Hazard:** if the two point at different databases, a deploy migrates one and points
the running app at the other -- the split-brain mechanism encoded directly in the
deploy path. Also note `migrate:up` failure is swallowed (`|| echo "...warnings"`) --
a failed migration does not stop the deploy (echoes of the original F-Deploy-1
non-fatal-migration finding).

### AK-3 -- PM2 stop/delete/start uses names that drifted from roles (and from #746)

`.github/scripts/deploy-production.sh` (~`:217-219`):
```
pm2 stop episode-api episode-worker 2>/dev/null || true
pm2 delete episode-api episode-worker 2>/dev/null || true
```
then (~`:226-238`):
```
if [ -f ecosystem.config.js ]; then
  pm2 start ecosystem.config.js --only episode-api --env production --update-env
  pm2 start ecosystem.config.js --only episode-worker --env production --update-env
  if ! pm2 list | grep -q "episode-api-dev.*online"; then
    pm2 start ecosystem.config.js --only episode-api-dev --update-env
    pm2 start ecosystem.config.js --only episode-worker-dev --update-env
  fi
fi
pm2 save --force
```

**Hazard, post-06-01 + post-#746:**
- It `stop`/`delete`s `episode-api` -- which is now the **DEV** process (3002) -- and
  `episode-worker`. A prod deploy disrupts DEV.
- It does NOT touch `episode-api-prod-hotfix` -- the actual **PROD** process. The deploy
  misses prod entirely on the stop/delete side.
- The start references `--only episode-api` (now dev in the file), `episode-api-dev`,
  and `episode-worker-dev` -- but **#746 REMOVED `episode-api-dev` and
  `episode-worker-dev`** and renamed prod to `episode-api-prod-hotfix`. So the script's
  `--only` targets no longer exist or map wrong. Script and corrected ecosystem file
  actively disagree.
- `pm2 save --force` then persists whatever wrong topology results -- the same
  dump-poisoning mechanism that caused the original 06-01 multi-day outage (FD-35).

This is F-Deploy-G1-H's sibling: hardcoded names drifted from reality. #746 fixed the
*file*; this *script* names processes directly and was not touched by #746. **The script
must be rewritten to the #746 topology before it is ever run.**

### AK-4 -- nginx redeploy reintroduces the risk class Track B excluded

`.github/scripts/deploy-production.sh` (~`:165-200`) deploys/updates nginx on every run.
Nuance (better than worst-case): when an existing SSL config is detected it preserves
certs and edits proxy settings in-place via `sed` (`:170-184`) rather than overwriting.
BUT the failure path on a config test still does:
```
sudo rm -f /etc/nginx/sites-enabled/episode-prod
```
(the earlier slice, ~`:198`) -- i.e. **deletes the prod vhost if the new config fails
`nginx -t`**, then reloads. Track B v0.2 Sec 1 explicitly scoped nginx OUT ("verified
correct + unchanged ... removes the webserver-reload risk class entirely"). This script
reintroduces it, with a prod-down failure mode.

### AK-5 (sub) -- Multiple parallel deploy scripts, one wired

`git ls-tree -r origin/main` shows FIVE deploy artifacts:
```
.github/scripts/deploy-production.sh        <- the one the workflow runs
.github/workflows/deploy-production.yml
scripts/deploy/deploy-prod.sh
scripts/deploy/deploy-production.ps1
scripts/deploy/deploy-production.sh
```
The workflow invokes only `.github/scripts/deploy-production.sh`. The three under
`scripts/deploy/` are not wired to it -- parallel/orphaned deploy tooling (a deploy-layer
instance of the audit's "multiple parallel strategies, none authoritative" pattern).
**Not audited here** (rabbit hole); recorded so the [3] scoping or a cleanup pass knows
they exist and must establish which is canonical and whether the others are stale traps.

## Sec 3 -- Severity

P1. Not P0 only because it is `workflow_dispatch`-gated -- it cannot fire autonomously;
a human must run it and type the phrase. But every consequence above lands the moment
someone does, and several (AK-1 FD-36 reversal, AK-2 split-brain, AK-4 vhost delete)
are prod-down or canon-endangering. The phrase-gate is accident-prevention, not an
authorization or safety boundary (it validates intent to deploy, nothing about whether
the deploy is safe).

## Sec 4 -- Disposition: HARD BLOCKER on [3], with a satisfiable gate

[3] (the combined-restart window) MUST NOT begin until EITHER:

- **(a)** `Deploy to Production` is disabled for the duration of the [3] window
  (`gh workflow disable "Deploy to Production"`), OR
- **(b)** the prod-deploy path is audited-and-corrected on all five sub-points:
  - AK-1: `secrets.PROD_DB_HOST` confirmed = canon (`episode-control-dev...`), OR the
    `.env` `DB_HOST` write removed/guarded.
  - AK-2: `secrets.PRODUCTION_DATABASE_URL` confirmed = the SAME canon DB as PROD_DB_HOST.
  - AK-3: `deploy-production.sh` PM2 names reconciled to the #746 topology.
  - AK-4: the nginx `rm -f .../episode-prod` failure path neutralized (or nginx deploy
    removed, per Track B's out-of-scope decision).
  - AK-5: which deploy script is canonical established (the orphans need not be fixed,
    only classified).

**If [3] intends to USE this workflow as its restart mechanism, (b) is mandatory** --
an audited, corrected deploy landing the now-correct `ecosystem.config.js` is a
legitimate restart vehicle, but only after (b).

The gate is satisfiable and itemized -- it blocks the danger without forbidding the
workflow's use once cleared.

## Sec 5 -- What this does NOT do

- Does NOT touch, run, disable, or edit the workflow or any script.
- Does NOT inspect or change any secret value (values are write-only; this records the
  REQUIREMENT to verify PROD_DB_HOST / PRODUCTION_DATABASE_URL, performed at [3]).
- Does NOT touch the box, PM2, nginx, `.env`, or any DB.
- Does NOT remediate any sub-finding -- remediation is [3]-scope.
- Does NOT audit the three orphaned `scripts/deploy/` scripts (AK-5 records existence only).

---
*F-Deploy-G1-AK (provisional). The `Deploy to Production` workflow drifted from live
reality (06-01 hotfix topology, #746 ecosystem correction) while sitting un-run; a manual
invocation now re-arms FD-36 (AK-1), re-encodes the split-brain (AK-2), disrupts dev /
misses prod / poisons the dump (AK-3), and re-introduces nginx risk (AK-4), with three
orphaned deploy scripts alongside (AK-5). Disposition: hard blocker on [3] with a
satisfiable five-point audit gate. Evidence cited to deploy-production.yml and
.github/scripts/deploy-production.sh. Provisional letter -- confirm at the v12 Sec 8.1
registry reconcile (which owes AB-AJ + AK).*
