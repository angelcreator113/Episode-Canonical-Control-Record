# INCIDENT 2026-05-30 -- Automated deploy reloaded the FROZEN prod box

| | |
|---|---|
| **Date** | 2026-05-30 (~20:12 UTC) |
| **Severity** | P0 near-miss. No data loss. Frozen prod process was reloaded by automation. |
| **Outcome** | Data intact (72 episodes / 10 shows, raw-count verified post-incident). Prod app degraded but serving correct DB. |
| **Root trigger** | A `claude/**` PR (#728) committed without the `[skip-automerge]` tag. |
| **Containment** | `Deploy to Development` and `Auto-merge to Dev` workflows DISABLED (`gh workflow disable`). |
| **Status** | CONTAINED. Prod box deliberately left as-is (degraded but serving). Cleanup deferred to gated reconciliation. |

> **The freeze had a hole.** The `F-Deploy-1_PROD_SplitBrain_HAZARD.md` freeze warned against MANUAL restart/reboot/deploy/.env-edit. It did not account for the AUTOMATED deploy path, which reached the prod box via the shared-compute wiring (F-Deploy-G1-G) and reloaded the frozen process. The data survived by luck, not by the freeze holding.

## Sec 1 What happened (timeline)

1. PR #728 (a `.gitignore` chore) was committed WITHOUT `[skip-automerge]`. Every prior PR this session (#723-#727) carried the tag; #728 omitted it. (Authoring error -- see Sec 5.)
2. With no opt-out tag, the **Auto-merge to Dev** workflow merged `claude/gitignore-frontend-dist` into the `dev` branch (using the `-X ours` conflict path, FD-4).
3. The push to `dev` triggered the **Deploy to Development** workflow.
4. "Deploy to Development" SSHed to `EC2_HOST` -- which resolves to the **prod box** `episode-backend` (`54.163.229.144`), NOT a separate dev box. This is the shared-compute wiring: the "dev" deploy targets prod compute. (F-Deploy-G1-G, live.)
5. On the prod box, the deploy ran: `pm2 stop all` -> upload artifact -> `npx sequelize-cli db:migrate --env development` -> `pm2 delete all` -> `pm2 start ecosystem.config.js --env development` -> `pm2 save`.
6. The reloaded process picked up `DB_HOST` from the deploy's `DEV_DB_HOST` secret = `episode-control-dev` -- the LIVE, POPULATED data instance.
7. The migration step found nothing to run ("No migrations were executed, database schema was already up to date"). NO schema mutation occurred.
8. App came up healthy on **port 3002** (dev port) with a route-loading bug ("Failed to load Template Studio routes: url argument must be of type string"). `/episodes` and `/shows` routes did not load.

## Sec 2 Why it was NOT catastrophic (luck, not design)

The split-brain freeze predicted that ANY reload would read the on-disk `.env` (which points at the EMPTY `episode-control-prod`) and silently swap prod onto empty data. That is NOT what happened, because:

- The deploy OVERRODE `DB_HOST` from its own `DEV_DB_HOST` secret rather than relying on the on-disk `.env`.
- That secret happens to point at `episode-control-dev` -- the live data.

So the reload landed on the CORRECT, POPULATED database. **This was luck.** Had `DEV_DB_HOST` pointed at `episode-control-prod` (the empty instance), the reload would have produced the exact silent-empty-DB catastrophe the freeze exists to prevent. The good outcome came from the deploy's configuration happening to be correct, not from the freeze functioning.

## Sec 3 Verified post-incident state (read-only)

- `pm2 list` on prod: `episode-api` (PID 1371603) + `episode-worker` (PID 1371604), both online, ~5 min uptime (confirming the reload). Previous process had ~2-day uptime.
- `pm2 env 0` DB_HOST: `episode-control-dev...` (correct live instance).
- `/health` (port 3002): `database: connected`, `currentDatabase: episode_metadata`, `DB_HOST: episode-control-dev`. (`episodeCount: 18 / showCount: 1` in /health is a SCOPED metric, not a table count -- see raw count below.)
- **Raw count against the live DB (process env creds): 72 episodes, 10 shows.** Matches the 2026-05-29 pre-incident inspection exactly. NO DATA LOSS.
- Port 3000 (expected prod port): nothing listening. App moved to 3002 (dev port) -- F-Deploy-G1-H, live.

## Sec 4 What changed on prod (real, recorded)

- `episode-api`/`episode-worker` are now a fresh reload (new PIDs, ~5min uptime), not the prior multi-day process.
- `pm2 save` OVERWROTE `/home/ubuntu/.pm2/dump.pm2` with this deploy's process state. The resurrect state is now this deploy's state, on port 3002.
- App serves on **port 3002** (dev port), not 3000.
- Route-loading bug present: Template Studio routes failed to load; `/episodes`, `/shows` routes not serving (return non-200). App is up and DB-connected but functionally degraded.
- On-disk `.env` DB_HOST: unchanged by the deploy (the deploy's `write_env_key` only persisted FAL/REMOVEBG/ANTHROPIC keys, not DB_HOST). So `.env` still points at `episode-control-prod` (empty) -- meaning the split-brain PERSISTS: a future plain `pm2 restart` (without the deploy's env override) would still read `.env` and swap onto empty. The freeze still applies.

## Sec 5 Root cause and accountability

- **Trigger:** `[skip-automerge]` omitted from PR #728's commit. Authored by Claude. Five prior PRs this session carried the tag specifically to prevent the dev round-trip; the sixth omitted it. This was the author error that pulled the trigger.
- **Underlying defect (the real problem):** the deploy infrastructure routes "dev" deploys to the prod box (shared compute, F-Deploy-G1-G), and the auto-merge-to-dev -> deploy-to-dev chain runs automatically on any untagged `claude/**` PR. The freeze documentation did not account for this automated path -- it guarded only against manual actions. So a routine docs/chore PR could (and did) reload frozen prod.
- **The lesson:** the tag discipline was load-bearing and treated as routine. A protective measure that depends on remembering to add a tag to every commit is fragile. The durable fix is structural (workflows disabled; see Sec 6), not "remember the tag."

## Sec 6 Containment (done)

- `gh workflow disable "Deploy to Development"` -- the link that touches the prod box.
- `gh workflow disable "Auto-merge to Dev"` -- the trigger that fired.
- Both confirmed disabled via `gh workflow list`.
- Effect: no PR (tagged or not) can now trigger a deploy to the prod box. The auto-deploy path is closed.
- NOTE: `Deploy to Production` workflow remains ACTIVE -- it is a THIRD potential path to the prod box (its own trigger, not in tonight's fire path). Freeze hardening should assess whether it also needs gating.

## Sec 7 What was deliberately NOT done

- Prod box NOT "fixed." The route bug and port-3002 drift are left as-is. Any fix means another process reload -- the exact action under freeze. The app serves correct data; it is not on fire. Cleanup waits for the gated reconciliation session.
- No `.env` edit, no restart, no migration re-run on the prod box.

## Sec 8 Follow-ups owed

- **Hazard doc correction:** `F-Deploy-1_PROD_SplitBrain_HAZARD.md` must add the automated-deploy-path trigger to its do-not list and note the workflows are disabled (re-enabling is gated behind reconciliation).
- **New finding:** candidate **F-Deploy-G1-AI** -- "Automated dev-deploy reaches the prod box via shared-compute wiring; an untagged `claude/**` PR triggers a full prod process reload + migration. Demonstrated live 2026-05-30." (AG is the split-brain, assigned in v11. AI is next free after AH-the-slip; confirm at filing.)
- **Fix Plan v1.6 / future revision:** register the incident and the AI finding.
- **Reconciliation session additions:** restore prod to port 3000; fix the route-loading bug; reconcile the on-disk `.env` (still points at empty `-prod`); decide whether to re-enable the deploy workflows and how to gate them; the `pm2 save` overwrite means the resurrect state needs correcting too.
- **PR #728 disposition:** still open against main. Main-merge does not deploy (only dev-branch push does, now disabled). Safe to merge or close; low stakes.

---
*Incident record. Authored 2026-05-30 by Claude with JustAWomanInHerPrime / Evoni. No data lost; frozen prod reloaded by automation, landed on correct DB by luck. Auto-deploy path contained. Prod left degraded-but-serving pending gated reconciliation.*