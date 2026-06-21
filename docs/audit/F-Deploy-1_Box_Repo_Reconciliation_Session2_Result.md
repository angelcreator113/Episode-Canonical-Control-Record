> **SUPERSESSION NOTE (re: Session 1).** This Session-2 result supersedes Session 1 on exactly one point: the disposition framing of the box working tree. Session 1 proceeded on the expectation that the box held substantial uncommitted work to preserve before aligning to origin/main. Session 2's per-stream diffs (§4) establish the opposite: of the entire working tree, only `ecosystem.config.js` genuinely diverges from origin/main, and it is a hazard to suppress, not work to save — everything else is already upstream, handled via PR #830, or parked capture/secret scratch. All other Session-1 content stands unchanged and is NOT superseded by this note. Session 1 is preserved verbatim per the additive-over-destructive convention.

---

# F-Deploy-1 — Box↔Repo Reconciliation, Session 2 Result

**Authored:** 2026-06-21
**Status:** Investigation COMPLETE. No box mutations. [3] NOT primed. This session is WARM.
**Relationship to prior:** Additive to `F-Deploy-1_Box_Repo_Reconciliation_Session1_Result.md`. Does not rewrite Session 1; supersedes only where explicitly noted (the "three streams, preserve local work" framing — see §4).
**Convention:** All facts below are verbatim-terminal-backed from the 2026-06-21 read-only pass. Live SHAs/PR state are point-in-time and go stale by design; re-verify via wake-up trio before acting on any of this.

---

## §1 — Scope and method

A fully read-only characterization of the production box working tree relative to `origin/main`, run to answer two open sub-questions carried into the session:

1. Are the box's uncommitted streams (ecosystem.config.js pin / mass script deletions / CharacterState + modified `src` files) already upstream on `origin/main`?
2. What actually fronts production traffic?

Method: live wake-up trio → insurance re-verification → box-internal topology → ALB/DNS external path → per-stream diffs against `origin/main`. Every command run by the operator (Evoni); Claude drafted and held. Nothing was pushed, committed, restarted, or reloaded.

---

## §2 — Live ground truth (verified 2026-06-21)

| Fact | Value | Evidence |
|---|---|---|
| `origin/main` HEAD | `a1124ed7` (Merge PR #752) | `git log --oneline -1 origin/main` (workstation) |
| Box HEAD | `8425c13e3042fc33556a72bcba58f837335cb32b` | `box-HEAD.txt` + `git rev-parse HEAD` (box) |
| Box behind count | **203** commits | `git rev-list --count HEAD..origin/main` (box) |
| Repo dir on box | `/home/ubuntu/episode-metadata` | `pm2 describe 0` → exec cwd |
| Live prod server | `src/server.js`, PM2 id 0 `episode-api` (cluster, online) | `pm2 describe 0`, `pm2 list` |

"203 behind" and `8425c13e` are now confirmed live, not inherited from memory.

---

## §3 — Production topology (CORRECTS prior reads in this thread)

The live production path is:

```
primepisodes.com  →  ALB :443 (HTTPS)  →  TG primepisodes-backend  →  i-02ae7608c531db485 : 3000  →  PM2 episode-api
```

Supporting evidence:

- `nslookup primepisodes.com` → `52.201.79.137`, `3.232.250.132` (two A-records = the ALB, **not** the box EIP `54.163.229.144`).
- `aws elbv2 describe-listeners` → :443 HTTPS default action = `primepisodes-backend` TG.
- `aws elbv2 describe-target-health` (`primepisodes-backend`) → single target `i-02ae7608c531db485:3000`, **healthy**.
- `nslookup dev.primepisodes.com` → `54.163.229.144` (box EIP) → box nginx vhost split: `primepisodes.com/www` → `localhost:3000`, `dev.primepisodes.com` → `localhost:3002`.

### §3.1 — TG naming inversion (NEW finding, documentation hazard)

The target group named **`primepisodes-backend`** fronts **production** (port 3000). The TG named `primepisodes-frontend` (port 80) fronts the frontend leg. The "backend" name does not indicate a non-prod or API-only role — it is the prod path. This is the **same inversion-hazard class** as the "dev"-named RDS instance holding live canon: never reason about role from the resource name. Reason from listener → TG → target → port, verified live.

### §3.2 — `primepisodes-frontend` TG all-unhealthy (NEW finding, parallel-safe, carry-forward)

`aws elbv2 describe-target-health` (`primepisodes-frontend`, port 80) returns **both** targets unhealthy:

- `i-0005b67a477eb904f:80` — `unhealthy`, `Target.ResponseCodeMismatch`, HC codes `[404]`
- `i-02ae7608c531db485:80` — `unhealthy`, `Target.ResponseCodeMismatch`, HC codes `[404]`

Two open questions, both read-only / parallel-safe (NOT [3]-blocked):
1. What is instance `i-0005b67a477eb904f`? It is a second instance in the ALB topology not previously accounted for in this thread.
2. Is the 404 a benign health-check-path mismatch (HC target path not present at `:80`) or a real frontend-serving gap?

Deferred to a parallel-safe investigation; does not gate reconciliation or [3].

### §3.3 — Box-internal listeners / processes (reference)

`sudo ss -tlnp` + `pm2 list`:

| Port | Process | PM2 entry |
|---|---|---|
| 3000 | node (pid 1384830) | id 0 `episode-api` (cluster, ↺1, online) — **live prod** |
| 3002 | PM2 god (pid 90911) | id 3 `episode-api-prod-…` (fork, ↺0, online) — dev leg |
| 6379 | redis-server | (localhost only) |
| 80/443 | nginx | — |
| 22 | sshd | — |

Note the running-process naming is itself inverted: `episode-api` runs prod-on-3000; `episode-api-prod-hotfix` runs dev-on-3002. This matters for §4 (ecosystem.config.js) and for any future `pm2` operation.

---

## §4 — Working-tree disposition (SUPERSEDES Session 1's "preserve local work" framing)

`git status --short` shows 5 streams. Measured against `origin/main` (not the stale local HEAD), the divergence collapses to **one** item that matters. The session-start assumption that there was substantial box-only work to rescue was wrong **in the safe direction** — there is essentially nothing to preserve.

| Stream | git status | vs origin/main | Disposition |
|---|---|---|---|
| `ecosystem.config.js` | `M` | **DIVERGENT** (see §4.1) | **PARK.** Prod-demotion landmine. Input to [3] config reconciliation. Never push, never `pm2 reload`. |
| `package.json` + `src/app.js` + `src/config/sequelize.js` + `src/middleware/aiRateLimiter.js` + `src/models/index.js` + `src/migrations/20260718000000-*.js` | `M` | **CONVERGENT** — `git diff --stat origin/main` empty for all six | No action. The `M` is a HEAD-vs-origin artifact (box edited toward where origin landed; `git status` compares to stale HEAD `8425c13e`). Aligns cleanly at [3] checkout; no preservation needed. |
| ~90 deletions under `scripts/deploy/`, `scripts/migrations/`, `scripts/tests/` | `D` | Parked working-tree noise | **PARK.** Canonical AK-5 path is **PR #830** (human-authored, 7 disciplined removals). Box's mass deletion is NOT #830 and is not pushed. |
| `src/models/CharacterState.js` | `??` | **IDENTICAL** to `origin/main:src/models/CharacterState.js` (#684) — `diff … && echo IDENTICAL` → `IDENTICAL` | Redundant. Discard at checkout. (The earlier `git diff origin/main` "deleted file" output was a tracked-vs-untracked artifact, not a real delta.) |
| 7 × `.env.*` | `??` | Untracked, secret-bearing, **NOT gitignored** (see §4.3) | **PARK + remediate.** Captured offsite + on-box, owner-locked. `.gitignore` does NOT cover these suffixes — they are committable. Remediation (additive glob) owed; gated write, not done this session. |
| `ecosystem.config.js.bak-20260619-a2cfg` + 2 × `.ps1` helpers | `??` | Untracked scratch/backup | **PARK.** Part of capture. Note the `.bak` is a *third* ecosystem.config variant (see §4.1). |

### §4.1 — `ecosystem.config.js` — the only real divergence, and it is a hazard

`git diff origin/main -- ecosystem.config.js` shows the box's uncommitted edit rewrites the **first app block** (which on `origin/main` is the production app) as follows:

- `name: episode-api-prod-hotfix` → `episode-api`
- `PORT: 3000` → **`PORT: 3002`**
- **`NODE_ENV: 'production'` removed**
- `APP_NAME` "Production" → "Development"; ALLOWED_ORIGINS prod → dev list
- `interpreter: 'node'` → `/usr/bin/node` (all blocks)
- Renames the dev app `episode-api` → `episode-api-dev`; adds `episode-worker-dev`

**Effect if this file ever drives a `pm2 reload`/`restart`/`start`:** the process meant to be prod-on-3000 comes up as **dev-on-3002 with no `NODE_ENV=production`** — a live prod demotion. This is the concrete reason a casual reload was correctly rejected at session start, and the reason no reload from **any** of the three config variants (origin/main's, the box edit's, or the `.bak`) is safe without the [3] cold-window mechanism work: each carries a different name/port arrangement and remapping a running PM2 process = delete+restart = prod wobble.

Disposition: **PARK as deferred [3] input.** Do not push. Do not apply to PM2.

### §4.2 — Convergence spot-check (supports the "no preservation needed" disposition)

`git diff origin/main -- src/app.js` → **empty** (zero lines). Direct confirmation, beyond the `--stat` pass, that at least one of the six `M` files is byte-equal to `origin/main`. `git ls-files -- '.env*'` confirms only `.env.example` and `.env.production.template` are tracked — the `M` files hold no secret content. The "convergent; the `M` is a stale-HEAD artifact" disposition is evidence-backed, not assumed.

### §4.3 — `.gitignore` does NOT cover the 7 secret backups (NEW finding, remediation owed)

The 7 `.env.*` backups are **committable** as of 2026-06-21. Four corroborating probes:

- `git check-ignore -v <7 files>` → **empty output** for all 7 (an ignored path prints its matching rule; un-ignored prints nothing).
- `git status --ignored --short -- '.env*'` → all 7 under `??` (trackable); only `.env` and `.env.bak` under `!!` (ignored).
- `.gitignore` (lines 8–22, 102) is an **explicit-enumeration** list — `.env`, `.env.local`, `.env.production`, `.env.backup`, etc. — with only narrow globs (`.env.*.local`, `.env.*.secret(s)`). The dated/ad-hoc suffixes (`-pe39-20260511`, `-20260612-144450`, `.pre_reconcile_…`, `.pre-dbport-…`) match none of them. Note `.env.backup` IS ignored but `.env.backup-pe39-20260511` is NOT — the trailing token defeats the literal match.
- `git ls-files -- '.env*'` → only `.env.example`, `.env.production.template` (both templates). **Nothing secret is in history yet.**

Severity: not-yet-leaked, but one `git add .` on this working tree stages 7 live-credential files. Given the documented `git add .` / agent-driven-staging hazards on this repo, this is a real exposure surface, not a theoretical one.

**Proposed remediation (GATED — not executed this session):** append a catch-all glob to `.gitignore`, e.g. `.env.*` with template re-includes preserved (`!.env.example`, `!.env.production.template`), verified by re-running the three checks above until all 7 land under `!!` and `git ls-files` still shows both templates. This is a doc/config write on its own gated PR, sequenced at operator discretion — it does not block reconciliation or [3], but should land before any broad `git add` is ever run on the box tree.

---

## §5 — Insurance status: VERIFIED (complete, both homes)

The hold's safety net is real and current as of 2026-06-21.

- **Offsite:** `…\Documents\PrimeStudios-Backups\capture-20260621-prereconcile\` (recursive listing) contains: `untracked/` (with `scripts/`, `src/models/CharacterState.js`), `box-HEAD.txt`, `git-status.txt`, `tracked-changes-HEAD.patch` (365,812 bytes), `untracked-list.txt`, all **7 `.env.*`** files, `ecosystem.config.js.bak-20260619-a2cfg`, and 2 `.ps1` helpers.
- **On-box:** `~/capture-20260621-prereconcile/` mirrors that structure (`box-HEAD.txt`, `git-status.txt`, `tracked-changes-HEAD.patch` 365,812 b, `untracked/`, `untracked-list.txt`), permissions `drwx------` (owner-only).

Correction to a prior agent claim: an autonomous Copilot session reported "only a patch file present" — that was an artifact of it inspecting a **stray** `C:\Users\12483\capture-…` folder, not either documented home. Agent prose; zero evidentiary weight. Both real homes hold the full set.

---

## §6 — Carry-forward (parallel-safe / read-only; NOT [3]-blocked)

1. **`primepisodes-frontend` TG all-unhealthy 404** (§3.2) — identify `i-0005b67a477eb904f`; classify 404 as HC-path mismatch vs real gap.
2. **7 secret `.env.*` files in prod working dir, NOT gitignored** (§4.3) — ACTIVE finding, remediation owed (additive glob, gated). Files are committable; nothing leaked to history yet. Land the `.gitignore` fix before any broad `git add` on the box tree.
3. **TG naming inversion** (§3.1) — record alongside the RDS dev/prod inversion as a standing "name ≠ role" hazard.
4. **Locus 7** — fork SG `sg-0164d0b20fbebacbb` still open `0.0.0.0/0:5432` (carry-forward, deferred post-[3]).
5. **FD-39 internal prose/table inconsistency** — read-only, parallel-safe.

---

## §7 — Explicitly NOT done this session (gate integrity)

- **[3] not primed.** This session is WARM (reconciliation investigation + topology reads). Warming is irreversible within a session. [3] requires its own COLD session: wake-up trio → Sec 5 read only → fresh FD-31/FD-38 live abort re-verify → proceed.
- **P-4/P-5 status unresolved here.** An offsite `P4P5-build-transcript-20260619.txt` + `p4p5-evidence-20260618-140902/` exist and PR #820 (`fix/p4p5-*`) merged ~2 days prior; the "P-4/P-5 NOT PASSED" memory may be stale. Do NOT assume resolved from filenames. Verify at [3] readiness, in its own cold session.
- **ecosystem.config.js mechanism fix** stays deferred to the cold [3] window (box read of the Node v20.20.0 bin path + the config rewrite, under A2-cfg pre-restart runtime-bind gate).
- **No writes.** Any push/commit/reload/checkout is a Rule-7 gated action; none belong to this read-only pass.

---

## §8 — Net result

Of the entire box working tree, exactly **one** item is genuine divergence from `origin/main` (`ecosystem.config.js`), and it is a hazard to suppress, not work to save. Everything else is either already upstream (the 6 `M` files, CharacterState), canonically handled elsewhere (#830 for AK-5), or parked capture/secret scratch. Consequently, [3]'s eventual checkout-to-origin step loses **no legitimate local work**; its only hard constraint is that it must not carry the `ecosystem.config.js` edit into a live reload, and must rebuild the prod/dev PM2 topology deliberately under the cold-window gate.

*— End Session 2. Additive to Session 1. Re-verify all live SHAs/PR/topology state via wake-up trio before any action.*
