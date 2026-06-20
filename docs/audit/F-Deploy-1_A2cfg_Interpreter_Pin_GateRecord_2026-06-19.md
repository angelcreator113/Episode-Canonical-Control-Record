# F-Deploy-1 — [3] A2-cfg: ecosystem.config.js Interpreter Pin — GATE RECORD (2026-06-19)

> **PRE-RESTART DISCIPLINE, DONE IN THE COLD WINDOW. AUTHORIZES NO RESTART.**
> This records the A2-cfg mechanism change executed against `ecosystem.config.js` on
> `episode-backend` (`54.163.229.144`, `i-02ae7608c531db485`) during the [3] cold-entry
> prep session. The edit pins the PM2 `interpreter` for all four app entries to an explicit
> absolute Node path. **No PM2 lifecycle action was taken; no process was restarted.** The
> edited config takes effect only at the deliberate Phase 2 restart-to-align (Session B),
> which remains its own gated session. Per Master Runbook Sec 7 step 5 (A2-cfg correction,
> 2026-06-17) and Sec 5 A5 cold-entry fold.

| | |
|---|---|
| **Scope** | A2-cfg = option (c), mechanism-level fix to `ecosystem.config.js`. NOT restart-vehicle A2 (Sec 2). |
| **File** | `/home/ubuntu/episode-metadata/ecosystem.config.js` (sole copy on box; `find /home/ubuntu -maxdepth 3` confirmed no second copy). |
| **Change** | `interpreter: 'node'` → `interpreter: '/usr/bin/node'`, all four app entries. |
| **Decision (owner)** | Pin target = `/usr/bin/node` (v20.20.1). Codifies the proven-stable running runtime; no Node-version change rides the cutover. |
| **Restart performed** | **NONE.** Live processes untouched. |
| **Rollback** | `ecosystem.config.js.bak-20260619-a2cfg` retained on box (SHA `165b5b51…f9588` = pre-edit original, byte-exact). |

---

## 1 — Why this change (the binding ambiguity, proven live)

The A2-cfg correction exists because engines-range parity (G2A-1) is necessary but NOT
sufficient: it does not prove which on-box Node binary a restart will actually bind. This
session proved the config could not be trusted to bind what it names, via live reads:

- **Config intent:** `sharedEnv` prepends `/home/ubuntu/.nvm/versions/node/v20.20.0/bin`
  to PATH with the comment "to ensure it's used", sets `NODE_VERSION: '20.20.0'`, and every
  app uses the bare string `interpreter: 'node'` (PATH-resolved, not pinned).
- **Running reality (`pm2 describe`, then `readlink -f /proc/<pid>/exe`):** both live
  processes — id 3 `episode-api-prod-hotfix` (pid 1384830) and id 0 `episode-api`
  (pid 1380150) — execute **`/usr/bin/node`**, reporting **node.js version 20.20.1**, not
  20.20.0.
- **Demonstration the PATH mechanism does not bind what it names:** id 0's live env had
  `/home/ubuntu/.nvm/versions/node/v20.20.0/bin` FIRST on PATH (v20.20.1 second) yet still
  ran v20.20.1 from `/usr/bin/node`. The bare-string `'node'` + PATH-prepend mechanism did
  not select v20.20.0 even with v20.20.0 first on PATH. Consistent with manual (non-`pm2
  start ecosystem.config.js --env production`) launches.

Both 20.20.0 and 20.20.1 are Node major 20, ABI-stable, inside the A1 engines-range
contract (`engines.node >=20.0.0`). So this is NOT a G2A-1 gate failure — it is a
which-binary-does-the-restart-bind ambiguity, exactly what A2-cfg makes explicit.

## 2 — Decision: pin target = /usr/bin/node (v20.20.1)

Three candidate targets, all engines-range PASS:

1. `/usr/bin/node` (v20.20.1) — exact proven status quo; what id 3 has run canon-serving
   18 days, 0 restarts. **SELECTED.**
2. `/home/ubuntu/.nvm/versions/node/v20.20.1/bin/node` (v20.20.1) — same version,
   app-owned, byte-identical to /usr/bin/node today (size 98927992, mtime Mar 4 17:56).
3. `/home/ubuntu/.nvm/versions/node/v20.20.0/bin/node` (v20.20.0) — config's stated intent,
   but a downgrade vs running state; rejected (would make the restart a silent node change).

Owner decision (Evoni, 2026-06-19): **option 1, `/usr/bin/node`** — most conservative;
pins the restart to the same binary the stable process already executes, so the
restart-to-align introduces zero Node-version behavior change. `/usr/bin/node` confirmed a
real file (`readlink -f` returns itself, not a symlink), root-owned, v20.20.1.

## 3 — Scope: all four app entries pinned

Gate-critical subset (what restart-to-align relaunches under `--env production`): the prod
pair **`episode-api`** and **`episode-worker`**. All four entries pinned for
mechanism-hardening — removes the latent bare-`'node'` resolution risk file-wide and
prevents future operator drift via a dev entry. The two `-dev` entries
(`episode-api-dev`, `episode-worker-dev`) are not part of the [3] prod cutover but are
pinned to the same explicit binary by the same pass.

## 4 — Execution + verification evidence (live, this session)

Target proof in-band on every box command: `i-02ae7608c531db485` (IMDS instance-id),
matched throughout.

**Backup (Step A):** `cp -p ecosystem.config.js ecosystem.config.js.bak-20260619-a2cfg`.
Pre-edit SHA-256 (both files identical): `165b5b51d4230e0b6ba8c69ea729eff6c6cc15042dd63af31c4f9d1ceb7f9588`.

**Edit (Step B):** in-place replacement, `interpreter: 'node'` → `interpreter: '/usr/bin/node'`.

**Verification gate (Step C) — all four criteria PASS:**

1. **diff vs backup — exactly four changed lines, nothing else:**
   - line 72 (`episode-api`, prod), line 103 (`episode-worker`, prod), line 130
     (`episode-api-dev`), line 152 (`episode-worker-dev`), each
     `interpreter: 'node',` → `interpreter: '/usr/bin/node',`.
2. **grep `interpreter` — all four absolute, zero bare `'node'` remaining:** lines
   72/103/130/152 all `interpreter: '/usr/bin/node',`; adjacent `interpreter_args: ''`
   untouched.
3. **`node --check ecosystem.config.js` → `SYNTAX_OK`** — file parses as valid JS; no
   broken quote / dropped char that could crash a restart.
4. **SHA-256 post-edit:**
   - working file `ecosystem.config.js` = `2348071c4c84ef0e3a49892fde75f9dc785d52cfbb0da037f1154f90222d42da` (≠ original → change landed).
   - backup `…bak-20260619-a2cfg` = `165b5b51d4230e0b6ba8c69ea729eff6c6cc15042dd63af31c4f9d1ceb7f9588` (= original → rollback intact).

## 5 — State after this change

- `ecosystem.config.js` binds `interpreter: '/usr/bin/node'` explicitly for all four apps.
- **No restart performed; no PM2 lifecycle action.** id 3 / id 0 / id 1 remain on their
  pre-existing uptime (18–19D), running the old in-memory launch on `/usr/bin/node`.
- The edited config takes effect ONLY at the Phase 2 restart-to-align (Session B), opened
  only after a FRESH Phase 1 live abort re-verify at that session's own start — never
  inherited from this session.

## 6 — Findings recorded for separate follow-up (NOT actioned here)

1. **Misleading PATH / NODE_VERSION in `sharedEnv`.** Still prepends `v20.20.0/bin` and
   sets `NODE_VERSION: '20.20.0'`. Now inert for interpreter selection (absolute path wins)
   but misleading documentation. Left untouched to keep this a single-mechanism diff.
   Separate cleanup item.
2. **`episode-api` env vs env_production port split (F-Deploy-G1-H, confirmed in-file).**
   The prod `episode-api` entry defaults to `PORT: 3002` + dev CORS unless relaunched with
   `--env production` (→ 3000 + prod origins). The restart-to-align MUST carry
   `--env production` or prod comes up on the dev port. Belongs in the Phase 2
   restart-assembly checklist.
3. **Running topology names ≠ config names.** Live processes are hand-named
   (`episode-api-prod-hotfix`, etc.) from manual launches; config names them
   `episode-api` / `episode-worker` / `-dev`. The `--env production` ecosystem restart is a
   re-launch into the config topology, not a continuation of current process identities —
   handled by DB-1/DB-2 topology reconcile (Runbook Sec 7 step 6).

## 7 — What this record does NOT do

- Does NOT authorize, schedule, or perform any restart.
- Does NOT modify PATH, NODE_VERSION, env blocks, ports, or any line other than the four
  `interpreter` lines.
- Does NOT close Phase 2 or any cutover gate; G2A-1 / G2A-2 remain window-time LIVE gates.
- Does NOT delete the backup (`…bak-20260619-a2cfg` retained as rollback).

---
*Gate record for the [3] cold-window A2-cfg mechanism change. Pins `interpreter` to
`/usr/bin/node` (v20.20.1, proven running) for all four `ecosystem.config.js` app entries.
Built from this session's live evidence (IMDS identity, pm2 describe, /proc/<pid>/exe,
diff, node --check, sha256sum). No restart; takes effect only at the deliberate Phase 2
restart-to-align. Authority: Master Runbook Sec 7 step 5 (A2-cfg, 2026-06-17) + Sec 5 A5
fold; decision A2-cfg = option (c).*
