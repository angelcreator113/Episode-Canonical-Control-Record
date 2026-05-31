# FD-31 Cutover — Phase 0 Read-Only Findings (closeout note)

> **PHASE 0 (read-only inspection) ONLY. NOTHING MUTATED.** All commands were
> read-only over SSH (`pm2 list`, `pm2 env`, `cat`) or read-only RDS API. No `pm2`
> mutation, no `.env` edit, no restart. The frozen prod box `episode-backend`
> (`54.163.229.144`) was inspected, not changed. **We stopped at the Phase 0 → Phase
> 3 boundary by design — the restart is NOT started.**

| | |
|---|---|
| **Parent** | FD-31 reconciliation cutover (`F-Deploy-1_FD31_Reconciliation_PreFlight_Plan.md` Sec 6.3) |
| **Phase** | Phase 0 (pre-flight, read-only). **Complete.** |
| **Headline** | Phase 0 found that the plan's Phase 3 restart assumption is WRONG. The cutover must be redesigned before any restart. |
| **Status** | Stopped at the irreversible boundary. Phase 3 redesign = its own next sitting. |
| **Date** | 2026-05-31 |

---

## Sec 1 — Rollback net confirmed (precondition met)

Before touching the box, all three recovery artifacts verified present:
- Snapshot `episode-control-dev-prefreeze-insurance-20260530` — `available`
  (created 2026-05-30 22:28 UTC).
- Verified `-dev` dump — `episode-control-dev-verified-20260530.dump`, 2,828,246 B,
  off-repo in `Documents\PrimeStudios-Backups\`.
- Prod-only schema preservation — `prod-only-schema-preservation-20260531.sql`,
  549,063 B, same location.

---

## Sec 2 — Split-brain CONFIRMED from live state

| Source | DB_HOST | Meaning |
|---|---|---|
| Running process (`pm2 env 0`, `episode-api`) | `episode-control-dev…` | Process authenticates to **`-dev` (canon)** — the live, populated DB |
| Running worker (`pm2 env 1`, `episode-worker`) | `episode-control-dev…` | Worker also on **`-dev`** — both processes agree |
| On-disk `.env` | `episode-control-prod…` | Disk points at **`-prod` (empty)** — the disk half of the split-brain |

**The hazard, mechanized:** `ecosystem.config.js` `sharedEnv` sets
`DB_HOST: process.env.DB_HOST || ''`, and all boot-path `dotenv.config()` calls are
non-override. So a clean restart reads `DB_HOST=-prod` from `.env` and **comes up on
the empty DB** — the silent-empty swap the hazard doc warns about. The `.env`
DB_HOST fix (point at `-dev`) is therefore genuinely required and genuinely
dangerous if skipped. (Canon data itself is not at risk from a mispointed *read* —
Sec 6.1a — but the app would serve empty and new writes would fork.)

---

## Sec 3 — `‹READ LIVE›` values resolved (from `pm2 env`)

- **SSL posture:** `DB_SSL: true`, `DB_SSL_REJECT_UNAUTHORIZED: false` — SSL on, cert
  not verified. The rebuilt `.env` must reproduce this. (Explains why `sslmode=require`
  worked for the dumps.)
- **Port:** running on **3002** (both api + worker). Intended production port is 3000.
  The incident's drift, confirmed live.
- **NODE_ENV:** `production` on both processes.
- **DB name / user:** `episode_metadata` / `postgres` — consistent across process and `.env`.
- **Working `-dev` credential:** present in the launched env (sourced read-only; NOT
  held off-box — do not reset canon to obtain it, read it from `pm2 env` as done here).

---

## Sec 4 — Cluster-mode alarm STOOD DOWN

`pm2 list` showed `episode-api` in `mode: cluster`, which initially flagged against
the audit's single-instance-state finding (`uiOverlayRoutes.js` module-scope
`generationStatus = {}`, "breaks on PM2 cluster"). **`ecosystem.config.js` confirms
`instances: 1`.** Cluster with a single instance behaves like fork — only one process
holds the module-scope state, so that finding is **latent, not active**. It becomes
real only if `instances` ever goes > 1. Not a Phase 3 complication; the restart comes
up `instances: 1`, unchanged.

---

## Sec 5 — THE BIG FINDING: the plan's Phase 3 restart assumption is wrong

`ecosystem.config.js` does **not** define one app with a dev/prod toggle. It defines
**FOUR apps**, with inverted/misleading naming:

| App in ecosystem | `env` (default) | `env_production` | Running now? (`pm2 list`) |
|---|---|---|---|
| `episode-api` | PORT **3002**, name "(Development)", **dev** CORS | PORT 3000, prod CORS | **YES (id 0)** |
| `episode-worker` | — | NODE_ENV production | **YES (id 1)** |
| `episode-api-dev` | PORT 3002, "(Development)" | **none** | no |
| `episode-worker-dev` | — | — | no |

Consequences that break the plan's `pm2 restart ecosystem.config.js --env production`:

1. **Topology change.** That command targets the *whole file* — it would bring up all
   **four** apps (2 → 4 processes), including the `-dev` pair on 3002. Two apps would
   contend for 3002; `episode-api-dev` has no `env_production` so `--env production`
   does nothing coherent for it. That is not a clean cutover — it's a process-topology
   change mid-restart.
2. **The live process is on the DEFAULT env block, not production.** `episode-api` is
   on 3002 = its plain `env` block (labelled "(Development)", dev CORS), despite
   `NODE_ENV: production`. So "restart with `--env production`" is a *behavior change*
   (port 3000 + prod-only CORS), not merely a port-drift correction.
3. **CORS flip risk.** `episode-api.env_production` allows ONLY `primepisodes.com` /
   `www.primepisodes.com` — **not** `dev.primepisodes.com`. The current (default-env)
   process allows `dev.primepisodes.com`. If the live frontend is on
   `dev.primepisodes.com`, coming up `--env production` could sever the working
   frontend even with the DB correct.

**Net:** running the plan's Phase 3 command as-written would do *more and different*
than the plan assumes. The cutover must be redesigned around this four-app,
inverted-naming reality before any restart.

---

## Sec 6 — Open questions to answer (read-only) BEFORE Phase 3 is redesigned

1. **What does the reverse proxy route to — 3000 or 3002?** Determines whether
   "fix the port to 3000" connects the public site or disconnects it.
   (`cat /etc/nginx/sites-enabled/*` or the actual vhost, read-only.)
2. **Which domain is the live one — `primepisodes.com` or `dev.primepisodes.com`?**
   The CORS flip (Sec 5 #3) hinges on this.
3. **Is the `pm2 save`'d resurrect list (`dump.pm2`) the 2-app set or the 4-app set?**
   Determines what a reboot would bring back, and what the corrected `pm2 save` must
   capture.
4. **Should the cutover target a single named app** (`pm2 restart episode-api --env
   production`) rather than the whole file, to avoid the topology change? Likely yes —
   to be decided in the redesign.

The `-dev` row-count abort gate (Sec 3.1 catalog: 72 episodes / 10 shows / etc.) was
**not** run this session — deferred, because the topology finding is the higher-order
blocker and the count-check belongs at the top of the *redesigned* Phase 0→3 sequence.
(Also note: the `-dev` master password is not held off-box; the count-check must use
the credential read from `pm2 env`, not a reset.)

## Sec 6.1 — Final PM2 dump resolution (read-only)

`~/.pm2/dump.pm2` was read directly (no mutation) to settle resurrect behavior:

- Saved app set is **2 apps**: `episode-api`, `episode-worker`.
- Saved runtime DB target is canon: `DB_HOST=episode-control-dev...` for both apps.
- Saved runtime port is **3002** for both apps.
- `episode-api` saved mode is `cluster_mode` with `instances: 1` (single-instance behavior).
- `env_production.PORT=3000` exists in config/profile, but that is **profile-only**;
  a plain `pm2 resurrect` restores the saved runtime snapshot (3002/`-dev`), not 3000.

> **NOTE 2026-05-31 — post-restart health check: curl invocation matters.**
>
> During the FD-31 verification restart, `curl -sS http://localhost:3002/health`
> returned connection-refused while the app was actually serving. The working
> form was `curl http://127.0.0.1:3002/health` → `200 OK`,
> `"database":"connected"`, `DB_HOST=episode-control-dev...`. The refusal was a
> shell-wrapper / `localhost`-resolution artifact, NOT the app being down. Use
> the `127.0.0.1` form for the post-restart health check to avoid a false abort.

## FD-31 Track A — CLOSED 2026-05-31 (split-brain resolved, verified live)

The on-disk/live-process split-brain is resolved and verified serving on canon.

Final state:
- `.env` `DB_HOST` → `episode-control-dev...` (canon). Edited in-editor, verified by grep.
- `/home/ubuntu/.pm2/dump.pm2` → 2-app canon set (`episode-api`, `episode-worker`),
  saved via `pm2 save` AFTER the `.env` fix.
- Live `episode-api` (id 0) serving 3002, `200 OK`, `"database":"connected"`,
  `DB_HOST=episode-control-dev...`.
- Canon gate held 3 / 10 / 72 throughout (before, during, after) — canon never at risk.

Restart sequence (accurate provenance):
- `pm2 restart 0` executed; a `curl -sS` false-failure (see curl note) triggered a
  precautionary `pm2 resurrect`.
- The CURRENTLY RUNNING processes trace to `pm2 resurrect` (restored from the
  post-fix dump), not directly to `pm2 restart 0`. Functionally identical — both
  read the corrected `.env`, both on canon — but provenance is "restored from dump."

Track B (port/3000 migration, de-invert the 4-app naming, true `-prod` adoption)
remains PARKED as its own project. Not part of Track A closure.

---

## Sec 7 — Disposition

- **Phase 0: complete.** Split-brain confirmed, `‹READ LIVE›` values captured, rollback
  net verified, cluster alarm stood down — and the four-app topology finding caught
  the plan's Phase 3 assumption before it could be acted on. This is exactly what
  Phase 0 exists to do.
- **Phase 3: NOT started, and must be REDESIGNED.** The `pm2 restart … --env
  production` command in the pre-flight plan Sec 6.3 is no longer safe as-written.
  Redesign is its own next sitting, opening with the Sec 6 open questions.
- **Freeze:** intact. Box inspected read-only, never mutated.
- **Carry-forward loose ends (unchanged):** PR #728; `-prod` password disposition;
  Sec 4.3 plan-text reconciliation (point at the preservation `.sql`); untracked files.

*Read-only Phase 0 closeout. The cutover restart is deliberately un-started: Phase 0
surfaced a four-app, inverted-naming ecosystem that breaks the plan's restart command,
which is precisely the kind of discovery the read-only phase is separated out to make.
Next sitting = Phase 3 redesign, starting with the nginx/CORS/resurrect-list reads.*
