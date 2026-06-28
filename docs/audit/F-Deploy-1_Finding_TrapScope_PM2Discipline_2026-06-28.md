> ⚠️ COLD-SESSION CONTAMINATION WARNING
> This note states facts about `episode-api-prod-hotfix` (identity, port, config
> disposition) that the NAVIGATION-ONLY `[3]` closing document requires a cold
> session to derive independently from live reads. Reading this note — or being
> shown its contents — disqualifies a session from priming or closing the `[3]`
> combined-restart window. The forward-pointer in Section 4 is safe to read in
> isolation; the full note is not. If you are preparing to prime or close `[3]`,
> stop reading here.

---

## F-Deploy-1 Finding: Deploy Trap Scope + PM2 Restart Discipline — 2026-06-28

**Not an FD number.** Evidence note + forward-pointers only. FD numbers mint via
Fix Plan revision.

### 1. Correct Reading of `ecosystem.config.js` at `origin/main` HEAD `ea6dca03`

`episode-api-prod-hotfix` is the **production web process**, not an orphaned patch
process:
- `PORT: 3000`, `NODE_ENV: production`,
  `ALLOWED_ORIGINS: https://primepisodes.com`
- Verbatim comment in file: *"Name kept permanently per Track B DB-1 (renaming a
  running process = delete+restart = prod wobble)."*

Three processes defined:

| name | port | nature |
|---|---|---|
| `episode-api-prod-hotfix` | 3000 | production — serves primepisodes.com |
| `episode-worker` | — | shared worker, no prod/dev split (Track B DB-2) |
| `episode-api` | 3002 | dev — serves dev.primepisodes.com |

### 2. Bug Found and Fixed

**Initial wrong premise (2026-06-28 session):** `episode-api-prod-hotfix` misread as
a duplicate-prod-on-same-port orphan. Wrong — different ports (3000 vs 3002); the
name is a locked artifact, the block is intentional.

**Actual bug — scope-loss in the deploy trap:**
- The original explicit-restart block used `--only episode-api,episode-worker`,
  deliberately excluding prod.
- The F-Deploy-1 trap as initially written used
  `pm2 startOrRestart ecosystem.config.js` with no `--only` — would have restarted
  all three processes including prod on any dev-deploy failure.
- Additionally, the cleanup block used `pm2 stop all` (session 1), stopping prod
  before the trap (session 2) was registered — leaving no recovery path for prod if
  anything failed between sessions.

**Fix committed at `94d5eac4` on `claude/f-deploy-1-fix-deploy-trap-2026-06-27`.**
Branch status: not yet merged to `origin/main`. This note is also on that branch.
Both land only after the Section 5 VALIDATION PENDING checks clear and the PR
unblocks. The fix is correctly staged, not yet canonical.

Changes at `94d5eac4`:
- Cleanup block: `pm2 stop all` → `pm2 stop episode-api episode-worker` (prod never
  stopped)
- Trap: added `--only episode-api,episode-worker` to `startOrRestart` (prod never
  restarted)
- Prod is protected by **exclusion** — neither stop nor restart in this workflow
  touches `episode-api-prod-hotfix`.

### 3. PM2 Restart Discipline

After any credential rotation, manual restarts must use
`pm2 startOrRestart ecosystem.config.js`, **never bare `pm2 restart <name>`**.

Mechanism: `ecosystem.config.js` calls `dotenv.config()` at the top before building
`sharedEnv`. `pm2 startOrRestart ecosystem.config.js` re-evaluates the file, dotenv
runs, current `.env` values load into `process.env`, `sharedEnv` picks them up. Bare
`pm2 restart` uses PM2's **cached** env snapshot — `.env` is not re-read, a rotated
credential is not picked up.

### 4. `[3]` Cutover Forward-Pointer

`episode-api-prod-hotfix` is the production process, config-defined at PORT 3000.
Consistent with Handoff v20 Sec 1/Sec 4 open item: the cold `[3]` closing session
must confirm its port, restart count, uptime, and config-block disposition from its
own live reads — independently of this note.

### 5. VALIDATION PENDING (gated on-box, cold session)

> **SUPERSEDED 2026-06-28 — VALIDATED (sandbox, pm2 6.0.14 parity-matched to box).**
> Both checks below resolved YES; not asserted from memory — reproduced on the box's
> exact PM2 version (6.0.14) in an isolated sandbox, zero infra touch.
> - Check 1 (env refresh): CONFIRMED. `startOrRestart --only … --update-env` flipped
>   a live process's `/proc/<pid>/environ` v1→v2.
> - Check 2 (start-stopped): CONFIRMED. A stopped process (status=stopped, pid 0)
>   came back online with a fresh pid; `--only` left the excluded process untouched
>   (pid/uptime unchanged), so the prod-by-exclusion guarantee holds.
> Discovery risk retired. REMAINING (not discovery): confirm-in-passing on the first
> gated dev deploy on the real box. The original two questions are preserved verbatim
> below as the at-filing record.

Before re-enabling `deploy-dev.yml`, confirm on the box:

1. Does `pm2 startOrRestart --only episode-api,episode-worker --update-env` refresh
   env on already-running dev processes? (`--update-env` behavior)
2. Does `startOrRestart --only` **start** a stopped process, not just restart a
   running one? The trap fires when cleanup has stopped both dev processes — start-
   stopped is the primary case. If `--only` skips stopped processes, the trap is
   broken in its core path and needs `pm2 start` semantics instead of `startOrRestart`.

**Severity note:** the trap never touches prod. If either check fails, the failure
mode is "dev doesn't auto-restore on a failed dev deploy" — not prod outage. (The §3
manual-restart discipline still guards a genuine prod-outage path; this severity note
applies only to the trap's automated dev-path behavior.)
