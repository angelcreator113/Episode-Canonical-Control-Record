# Track B -- PM2 Topology Formalization (DRAFT v0.2)

> **PREP DOCUMENT. AUTHORIZES NO PROD-BOX ACTION.**
> Reading/drafting this changes nothing on `episode-backend` (`54.163.229.144`).
> Execution is gated and is its own deliberate session. The current production
> state (restored 2026-06-01) is healthy and reboot-durable; this plan makes that
> state *correct and maintainable*, it does not fix a live outage.

| | |
|---|---|
| **Parent** | Track B (PM2 4-app naming/port topology) -- parked since project open; activated by the 2026-06-01 prod outage |
| **Incident context** | `docs/audit/F-Deploy-1_INCIDENT_2026-06-01_prod-502-restore.md` |
| **Related findings** | F-Deploy-G1-H (ecosystem default-env = dev port), FD-35 (2026-05-30 auto-deploy reload), F-Deploy-G1-AJ (no prod monitoring) |
| **Target** | **Target B -- formalize the working topology** (make config + dump match the verified-working running state), chosen over Target A (tear down + rebuild to the original file's naming) |
| **Status** | DRAFT v0.2 -- on main. Prep only, no execution. v0.2 resolves DB-1 (keep hotfix name), DB-2 (one shared worker), DB-3 (ecosystem .env-load verified read-only 2026-06-01). |
| **Freeze state** | Prod box restored + reboot-durable (hotfix on 3000, id-0 on 3002, dump persists both + worker). nginx unchanged + correct. |

---

## Sec 1 -- The situation this resolves

The 2026-06-01 incident restored prod via an **additive hotfix** process. The result
works and survives reboot, but it is not a clean topology:

**Current running + persisted state (verified 2026-06-01):**
| PM2 id | name | port | role it actually serves | health |
|---|---|---|---|---|
| 0 | `episode-api` | 3002 | **dev** (dev.primepisodes.com) | online, ~15h |
| 3 | `episode-api-prod-hotfix` | 3000 | **prod** (primepisodes.com) | online, healthy, canon |
| 1 | `episode-worker` | n/a | worker (shared) | online, ~43h |

**The naming inversion:** the process *named* `episode-api` serves **dev**; the
process *named* `...-prod-hotfix` serves **prod**. Names are backwards relative to
roles. The ecosystem file's *intent* (prod app = `episode-api` on 3000 via
`env_production`; dev app = `episode-api-dev` on 3002) has never matched reality.

**nginx (verified, needs NO change):**
- prod domain (`/etc/nginx/sites-enabled/episode-prod`): `proxy_pass -> localhost:3000` (/api + /health)
- dev domain (`/etc/nginx/sites-enabled/episode`): `proxy_pass -> localhost:3002` (/api + /health)

So nginx is hard-pinned: prod = whatever is on 3000, dev = whatever is on 3002.
Both are currently satisfied. **No nginx edit is in scope** -- this removes the
webserver-reload risk class entirely.

---

## Sec 2 -- Target B (the decision) vs Target A (the alternative)

**Target B -- formalize the working topology (CHOSEN):**
Make the ecosystem file's app *definitions* and the PM2 dump encode the
currently-working split (the 3000 process is prod; the 3002 process is dev), so a
reboot/resurrect/deploy reproduces the verified-good state. Accept current reality
(prod on 3000, dev on 3002, both healthy) as the new normal; correct the config and
persistence to describe it honestly. Retire the "hotfix" framing by giving the prod
process a permanent ecosystem home.

**Target A -- rebuild to the original file's naming (NOT chosen):**
Move `episode-api` (id 0) from 3002 -> 3000 via `--env production`, bring up
`episode-api-dev` on 3002, retire the hotfix -- so running state matches the
ecosystem file's original names. Rejected: it tears down a working, verified
topology to rebuild it for a naming ideal, with multiple live prod transitions
(prod wobbles during the move). Higher risk, no functional gain over B.

**Why B is lower risk:** prod and dev are ALREADY on their correct ports right now,
both healthy. B's work is config-file correctness + persistence, not a live-process
scramble. Prod need not wobble at all (see Minimal-B, Sec 4).

---

## Sec 3 -- Target end-state

After Track B, the ecosystem file + dump encode:
- **Prod API** on **3000** (the process currently called `episode-api-prod-hotfix`),
  with a permanent ecosystem definition (DB creds from `.env`/env, prod
  ALLOWED_ORIGINS, prod APP_NAME). The "hotfix" name either kept-as-permanent or
  renamed to a clean prod name (decision DB-1 below).
- **Dev API** on **3002** (the process currently called `episode-api`), defined as
  the dev app.
- **Worker(s)** per current working state (one `episode-worker`; decide whether a
  separate dev worker is needed -- decision DB-2 below).
- **Dump persists this exact topology** so reboot/resurrect reproduces it.
- **No process named in a way that lies about its role.**

**Decisions (RESOLVED 2026-06-01):**
- **DB-1 (naming): RESOLVED -- keep `episode-api-prod-hotfix` as the permanent prod
   process name.** Rename deferred indefinitely. A name is cosmetic; renaming a running
   PM2 process is a delete+restart = prod wobble, not worth it. (If a rename is ever
   wanted, fold it into the deferred combined-restart window, Sec 7 -- never on its own.)
- **DB-2 (workers): RESOLVED -- one shared `episode-worker`.** No prod/dev worker
   split. Current single worker is working; no known reason to split. Revisit only if a
   concrete need appears.
- **DB-3 (ecosystem credential path): RESOLVED (read-only verify 2026-06-01).** The
   ecosystem file loads `.env` via `require('dotenv').config({ path: join(__dirname,
   '.env') })` -- an EXPLICIT, cwd-independent path -- before defining `sharedEnv`,
   which passes `DB_*` into each app's env. So `pm2 start ecosystem.config.js --env
   production` comes up DB-connected through `sharedEnv`; the app never depends on its
   own `server.js:7` bare `dotenv.config()` for DB creds. The incident's bare `pm2 start
   src/server.js` failed ONLY because `server.js:7` calls bare `dotenv.config()` (no
   path -> resolves `.env` from `process.cwd()`, which was not the app root). **The
   ecosystem prod definition is viable as-is** -- no need to bake explicit creds into
   `env_production`; the existing `sharedEnv` mechanism handles it correctly.

---

## Sec 4 -- Migration paths: Minimal-B (recommended) vs Full-B

### Minimal-B (RECOMMENDED) -- config + dump correctness now, no live restart

Do NOT touch the running processes. Instead:
1. Correct `ecosystem.config.js` so its app definitions match the working topology
   (prod app -> 3000 with prod settings; dev app -> 3002). This is a file edit; it
   does not affect running processes.
2. Ensure the PM2 dump reflects the corrected definitions (the running processes are
   already correct; this is about what resurrect/deploy will use going forward).
3. Result: **zero live-process disruption now.** Prod stays on the working hotfix
   process. A future planned restart (or the next deploy) lands on the corrected
   topology. The risky transitions are deferred to a deliberate window, not incurred
   during Track B.

Cost: running-process *names* still don't match the file until that future restart
(the dump still holds `episode-api-prod-hotfix` serving 3000). Acceptable -- it's
working and durable; the file is now correct for the next lifecycle event.

### Full-B -- restart-to-align now

Also re-launch the processes under the corrected ecosystem definitions immediately,
so running state and file agree today. This requires restarting prod (the wobble
Minimal-B defers). Only choose if "running state matches file today" is worth a
gated prod restart.

**Recommendation: Minimal-B.** Get durability + config correctness now; defer the
prod restart to a deliberate session (and fold it in with the FD-31 cutover restart
and credential rotation, so prod restarts ONCE for all of it, not repeatedly).

---

## Sec 5 -- Gated execution sequence (Minimal-B)

Each mutable step is a Rule 7 boundary. Pre-step: confirm rollback (the working
hotfix process + the current dump are the fallback -- if any edit breaks a future
restart, the running state is untouched and still serving).

1. **(Read-only, pre-flight) Test the ecosystem prod path.** `pm2 start
   ecosystem.config.js --only episode-api --env production` would collide with running
   id-0, so it was NOT run. Instead DB-3 was settled read-only (2026-06-01): the
   ecosystem file loads `.env` via an explicit `__dirname` path before `sharedEnv`
   passes `DB_*` to each app, so the `--env production` path comes up DB-connected.
   **DB-3 RESOLVED (Sec 3) -- this step is complete; the ecosystem prod definition is
   viable as-is, no creds workaround needed.**
2. **Edit `ecosystem.config.js`** to encode the working topology (DB-1/DB-2/DB-3
   decisions applied). File edit only -- running processes unaffected.
3. **Reconcile the dump** so resurrect uses the corrected definitions. (Mechanics
   TBD by how PM2 6.0.14 reconciles a hand-edited ecosystem vs a saved dump --
   needs a read-only check of whether `pm2 save` after an ecosystem edit, without
   restart, updates definitions or only running state. If `pm2 save` only snapshots
   running state, the dump keeps the hotfix name until a restart -- which is fine
   for Minimal-B.)
4. **Verify** prod 200 / dev 200 / both unchanged (no restart happened, so they
   must be). Confirm the edited ecosystem file is syntactically valid (`node -c` or
   a dry `pm2 ecosystem` parse).
5. **Document** the deferred restart: the one future prod restart that aligns
   running-state to file, to be done with FD-31 cutover + credential rotation in a
   single deliberate window.

---

## Sec 6 -- Rollback

Minimal-B's rollback is trivial because nothing live is touched: the running
processes (prod hotfix on 3000, dev on 3002) and current dump remain the fallback
throughout. If an ecosystem-file edit is wrong, it affects only the NEXT restart --
revert the file, no running impact. The deeper net (canon snapshot + verified dump)
remains in place but is not engaged by config edits.

For the deferred restart (future session): full rollback = the canon snapshot +
verified dump (per FD-31 Sec 6.4), plus the ability to re-launch the additive
hotfix exactly as the incident did (the incident doc records the exact command).

---

## Sec 7 -- FD-31 boundary reconciliation

The 2026-06-01 incident clarified the FD-31 vs Track B scope split:
- **FD-31 (data safety):** split-brain defused, canon clean, schema preserved (#737),
  pre-flight v1.3 complete. RESOLVED at the data layer.
- **Track B (topology):** the port/naming/4-app problem. This plan.
- **Overlap:** FD-31 Pre-Flight v1.3 Sec 6.3 steps 5 (prod restart to 3000) and 6
  (port flip, pm2 save fix) are **Track B work**, not FD-31 cutover work. With Track
  B owning them, the FD-31 cutover shrinks to: credential rotation + any non-topology
  degraded cleanup. **Action: when Track B is scheduled, revise FD-31 v1.3 to hand
  steps 5-6 to Track B** (so FD-31 isn't claiming to do the restart).
- **The single prod restart:** FD-31's credential rotation, Track B's restart-to-align,
  and any route-bug fix should happen in ONE deliberate restart window, not three.
  That combined session is the real "un-freeze prod properly" event.

---

## Sec 8 -- What this does NOT do

- Does NOT touch, restart, or reconfigure any running process (Minimal-B).
- Does NOT edit nginx (verified correct + unchanged).
- Does NOT rotate credentials (deferred to the combined restart window).
- Does NOT retire the hotfix process (it remains prod until the deferred restart).
- Does NOT schedule or authorize the deferred restart -- that is its own gated session.

---
*Track B topology formalization. Target B (make config + dump match the verified-working
running state), Minimal-B path (config correctness now, defer the prod restart to a
combined window with FD-31 credential rotation). v0.2 resolves all three open decisions:
DB-1 (keep hotfix name), DB-2 (one shared worker), DB-3 (ecosystem .env-load verified
read-only -- prod definition viable as-is). Prep only; no prod-box action. nginx confirmed
correct and out of scope. The 2026-06-01 incident moved this from "parked future project"
to "scoped and justified."*
