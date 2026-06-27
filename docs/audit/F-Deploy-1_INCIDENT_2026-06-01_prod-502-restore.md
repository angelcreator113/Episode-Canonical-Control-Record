# INCIDENT 2026-06-01 -- Production (primepisodes.com) was down (502); restored via additive hotfix

| | |
|---|---|
| **Date discovered** | 2026-06-01 (~14:15 UTC) |
| **Severity** | P0 -- production hard-down (502). No data loss. Restored same session. |
| **Outcome** | primepisodes.com / www restored to 200 via an additive PM2 hotfix process on port 3000. Dev (dev.primepisodes.com, 3002) never dropped. Restore persisted to the PM2 dump (reboot-durable). |
| **Root cause** | The prod-named PM2 app (`episode-api`, id 0) was running under its default `env` block = port **3002**, not `env_production` = port **3000**. nginx proxies primepisodes.com -> localhost:3000; nothing listened there -> ELB 502. Traces to the 2026-05-30 auto-deploy incident (FD-35), which reloaded the box via `pm2 start --env development` and `pm2 save`d that state. The saved dump perpetuated the wrong-port topology across every reboot/resurrect since. |
| **Restore method** | Additive hotfix: started a new PM2 process `episode-api-prod-hotfix` on 3000 with DB creds passed explicitly in env; left the live 3002 process untouched. Reversible (`pm2 delete episode-api-prod-hotfix`). |
| **Status** | RESTORED + reboot-durable (`pm2 save` done). Prod is up via an EMERGENCY hotfix, NOT the clean ecosystem topology -- see Sec 5 (bridge-not-end-state) and Track B. |

> **This restore is a bridge, not the final state.** Prod is served by a manually-launched hotfix process with DB credentials in its environment, running alongside a still-misnamed `episode-api` on the dev port. The correct fix is the Track B 4-app ecosystem topology. Do not mistake the hotfix for a properly configured prod.

## Sec 1 -- How it was found

Discovered during an FD-31 reconciliation cutover-scoping discussion, not by any alert. While deciding whether the "port 3002 -> 3000 flip" was FD-31 scope or Track B scope, a live check of primepisodes.com was run and returned 502. There was no monitoring or alerting that had flagged the outage -- see Sec 4 (the duration/monitoring finding), which is arguably the most important takeaway.

External checks at discovery:
- `https://primepisodes.com` -> 502 Bad Gateway (awselb/2.0)
- `https://www.primepisodes.com` -> 502 Bad Gateway
- `https://dev.primepisodes.com` -> 200 OK

On-host:
- `localhost:3000` -> connection refused (nothing listening)
- `localhost:3002` -> 200 OK
- `ss -ltnp` confirmed only `0.0.0.0:3002` was bound.
- nginx: prod domains proxy /api + /health to localhost:3000; dev proxies to localhost:3002.

## Sec 2 -- Root cause (detail)

The `ecosystem.config.js` defines `episode-api` with `PORT: 3002` in its default `env` block and `PORT: 3000` only in `env_production`. The running process (PID 1380150, ~14h uptime at discovery) was started WITHOUT `--env production`, so it bound 3002. nginx for the prod domain is hard-pinned to `localhost:3000`. With no process on 3000, the ELB health check failed and every prod request returned 502.

This is the live, user-facing consequence of F-Deploy-G1-H (the ecosystem default-env-is-dev-port finding) combined with FD-35 (the 2026-05-30 auto-deploy reload, which started the box with `--env development` and `pm2 save`d it). The saved PM2 dump held `episode-api:3002` + `episode-worker:3002` -- so a resurrect/reboot recreated the outage every time. The 4-app topology the ecosystem file describes (prod apps on 3000, dev apps on 3002) had never been the running/saved reality.

## Sec 3 -- Restore sequence (what was done)

All actions developer-initiated, gated, verified at each step. The live 3002 process (id 0) was never touched -- dev stayed up throughout.

1. Confirmed rollback net (carried from the FD-31 cutover entry checks the same session): canon snapshot `available`, verified dump on disk, canon row counts matched catalog (143/72/10/64/53/40/444/605/764).
2. First hotfix attempt: `pm2 start src/server.js --name episode-api-prod-hotfix` with PORT/NODE_ENV/APP_NAME/ALLOWED_ORIGINS in env, relying on dotenv for DB creds. Result: process bound 3000 but `/health` returned 503 / `database: disconnected` -- `password authentication failed (28P01)`. dotenv did not populate DB creds correctly in that launch context.
3. Confirmed the on-disk `.env` DB password DOES authenticate against canon (read-only psql, returned auth-ok) -- so the failure was launch/dotenv, not a credential problem.
4. Deleted the degraded hotfix (`pm2 delete episode-api-prod-hotfix`) -- clean, dev unaffected.
5. Re-launched the hotfix passing ALL DB vars explicitly in env (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD/DB_SSL), so the pg client got the confirmed-working credential. Result: `/health` = `status: healthy`, `database: connected`, canon (`episode-control-dev`), port 3000.
6. Verified end-to-end: primepisodes.com 200, www.primepisodes.com 200, dev.primepisodes.com still 200.
7. `pm2 save` -- persisted the 3-process state to the dump (reboot-durable).

**Persisted dump now holds (verified):** `episode-api` (id 0, 3002), `episode-api-prod-hotfix` (3000), `episode-worker`. Three app names.

## Sec 4 -- The duration / monitoring finding (most important takeaway)

Prod was down for an unknown but multi-day window (the wrong-port topology dates to the 2026-05-30 FD-35 reload; discovered 2026-06-01). It was caught only because a person manually checked the domain during an unrelated scoping discussion. **No alerting fired on a multi-day production 502.**

This is a monitoring gap that should be treated as its own finding: there is no external uptime check / ELB-target-health alarm wired to notify on prod 502. Had this not been stumbled upon, prod would have stayed down indefinitely. Recommend an uptime monitor on primepisodes.com/health and/or a CloudWatch alarm on the ELB target group's healthy-host count.

## Sec 5 -- Bridge, not end-state (what is owed)

The restore is an emergency bridge. Owed, deliberately deferred to their own sessions:

- **Track B 4-app topology** -- the correct fix: `episode-api` runs on 3000 via `env_production`, `episode-api-dev` holds 3002, and the dump persists the designed topology. The hotfix retires when this lands. (The "port flip" question that the FD-31 cutover-scoping raised is answered: prod genuinely needs 3000; that work is Track B, now justified by a real outage, not optional cleanup.)
- **Credential exposure** -- the canon DB password transited a shell command line and now lives in the hotfix process environment. Add to / reinforce the FD-31 Pre-Flight Sec 6.5 rotation list: rotate the `-dev` password at the Track B cleanup.
- **Monitoring** -- Sec 4. Wire prod uptime alerting.
- **FD-31 relationship** -- FD-31's data-safety core remains resolved (split-brain defused, canon clean, preservation captured #737, pre-flight v1.3 complete). This outage is the *topology* axis surfacing as a live incident; topology is Track B's domain.

## Sec 6 -- What was deliberately NOT done

- The live 3002 process (id 0) was NOT restarted, deleted, or reconfigured -- dev stayed up.
- No delete-flip of the running process (the irreversible path was avoided in favor of the additive hotfix).
- The ecosystem.config.js was NOT edited -- the topology fix is Track B, planned separately.
- `.env` was NOT edited.
- The canon DB password was NOT rotated (deferred to Track B per Sec 5).

---
*Incident record. Production primepisodes.com was hard-down (502) due to a wrong-port PM2 topology perpetuated by the 2026-05-30 FD-35 reload's saved dump; found by manual check (no alert), restored 2026-06-01 via a reversible additive hotfix process on port 3000 with explicit DB creds; dev never dropped; restore persisted (reboot-durable). The hotfix is a bridge -- the clean ecosystem topology is Track B. Most important takeaway: a multi-day prod outage went undetected (no monitoring). No data lost; canon untouched.*
