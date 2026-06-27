# Finding — Box `.env` Credential Drift: On-Disk Value Fails Canon Auth; Working Credential Is Process-Memory-Only

**Date:** 2026-06-13
**Session:** Branch B credential-durability extraction (executed; aborted at canon-probe per runbook abort table)
**Status:** FILED — finding only. No remediation this session. Abort was the correct outcome.
**Additive on:** Branch B Extraction Runbook (`F-Deploy-1_Branch-B_Extraction_Runbook_2026-06-12.md`, fix-pushed `3a8a1b1d`). Supersedes nothing; upgrades the `[3]` hazard model (see §5).

---

## 0. One-line

The `DB_PASSWORD` in the live canon process's on-disk `.env` (`/home/ubuntu/episode-metadata/.env`) **does not authenticate** against the canon DB as `postgres`. Timing evidence indicates the **working credential exists only in the memory of processes booted ~2026-06-01**, not on disk. A `[3]` restart now would reload the broken on-disk value and break canon auth.

---

## 1. What the session set out to do

Run Branch B: read box `.env` `DB_PASSWORD` → store to SSM SecureString → canon-probe verify, to establish a durable, verified copy of the rotated canon credential. The premise (per prior handoff): "credential rotated 06-10, off-box sync broke, box `.env` is the sole live copy."

That premise is now **broken** (see §3–4).

## 2. Execution path (live, this session)

Wake-up sequence run; v19 confirmed unpushed and pushed (`26b7efb7`); Branch B runbook pre-check 2 `awk '{print $1}'` PowerShell-expansion bug fixed and pushed (`3a8a1b1d`).

Pre-checks run live:
- Canon endpoint confirmed: `episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com`, VPC `vpc-0754967be21268e7e` (canon VPC — RDS-naming-inversion hazard cleared for this target), AZ `us-east-1b`.
- Box resolves canon hostname to `100.50.2.212` (public-style reverse name `ec2-100-50-2-212.compute-1.amazonaws.com`; not RFC1918).
- SSH key present.
- Runbook's assumed `.env` path `/home/ubuntu/app/.env` was **WRONG** — `test -f` returned NOTFOUND. Located real path by live search.

Real `.env` path (corrected): **`/home/ubuntu/episode-metadata/.env`**, confirmed as the canon process's env via PM2 `pm_cwd`/`pm_exec_path` (`/home/ubuntu/episode-metadata`, `src/server.js`).

Extraction sequence (Option 2 — canon probe softened to diagnostic capture, no hardcoded `100.50.2.212` assertion):
- Extract: `DB_PASSWORD` retrieved, 38 chars, non-empty.
- Put to SSM `/episode/db-password-extracted-box` (SecureString): OK.
- Hash verify: extract vs SSM hashes **matched** (`97AAC3B0…17041FAE`) — transfer integrity confirmed, no quoting corruption.
- **Canon probe (diagnostic): FAILED.** `FATAL: password authentication failed for user "postgres"`. Connection to `100.50.2.212:5432` succeeded (TLS fine, no network/SG problem) — the **password was rejected**.

Aborted per runbook abort table (canon-probe-fail row). SSM parameter **deleted** (`aws ssm delete-parameter`); local plaintext cleared.

## 3. Benign explanations ruled out

Read-only diagnosis of the `.env` connection vars (password redacted):
- `DB_USER=postgres` — probe used the correct user. **Not** a username mismatch.
- `DB_HOST` / `DB_NAME` match canon exactly — probe targeted the right DB.
- Exactly **one** `DB_PASSWORD` line; **zero** `DATABASE_URL` references — `DB_PASSWORD` is unambiguously the app's credential var; no connection-string path missed; correct field extracted.

All three benign hypotheses (wrong user, wrong var / connection-string path, extraction grabbed a dead var) eliminated. What remains: the on-disk `DB_PASSWORD` itself does not authenticate.

## 4. Timing evidence — working credential is process-memory-only

| Item | Value | Decoded (UTC) |
|------|-------|---------------|
| `.env` mtime | `2026-06-12 15:09:44` | 2026-06-12 |
| `episode-api` `pm_uptime` | `1780271564698` ms | ~2026-06-01 05:12 |
| `episode-worker` `pm_uptime` | `1780171967463` ms | ~2026-05-31 01:32 |
| `episode-api-prod-hotfix` `pm_uptime` | `1780324951435` ms | ~2026-06-01 20:02 |

**All running processes booted ~June 1. The `.env` was modified June 12 — 11+ days AFTER every process started.**

Conclusion: the running processes loaded their DB credential into memory at the June-1 boot and have **never restarted**. The on-disk `.env` was edited June 12 (consistent with the 06-10 rotation + broken off-box sync writing *something* to disk afterward), but that on-disk value **does not authenticate**. The credential the live app is actually using — the working one — is the in-memory copy from the June-1 boot.

**The working canon credential is therefore NOT on disk anywhere found. It exists only in volatile process memory.** This is materially worse than "box `.env` is the sole live copy": the sole *working* copy is lost on any process restart.

## 5. `[3]` HAZARD UPGRADE (the urgent consequence)

`[3]` (combined prod-restart window) was parked behind "a durable credential." This finding upgrades the hazard:

**A restart of the canon processes RIGHT NOW would reload the broken on-disk `.env` (`DB_PASSWORD` that fails `postgres` auth) and the app would fail to authenticate to canon.** This is not hypothetical — the diagnostic probe proved the on-disk value is rejected.

`[3]` must NOT be primed until the working credential is recovered/re-established AND the on-disk `.env` is corrected to a known-good value. Restarting first = guaranteed canon-auth outage.

## 6. NEW unknown — undocumented third process

PM2 shows **three** processes, not the two previously noted:
- `episode-api` (boot ~06-01 05:12)
- `episode-worker` (boot ~05-31 01:32)
- **`episode-api-prod-hotfix`** (boot ~06-01 20:02) — **undocumented; purpose unknown.**

The "prod-hotfix" name suggests an out-of-band patch process. Whether it is load-bearing, what it serves, and how it relates to `episode-api` is unknown. This must be identified before any `[3]` restart planning — restarting around an unidentified prod process is exactly the risk Path A guards against. (Cross-ref: #752 AK-3/AK-4 PM2-naming fix is parked for cutover; this third process may intersect that naming work.)

## 7. State at close

- SSM `/episode/db-password-extracted-box`: **deleted** (held a non-working credential; removed to prevent a future session mistaking it for valid).
- Local plaintext: cleared.
- Box: **untouched by writes** — entire session was read-only against the box except SSH command execution (all reads/diagnostics). No restart, no `.env` edit, no process change.
- `[3]`: remains parked, hazard upgraded per §5.
- Branch B runbook: pre-check 2 bug fixed (`3a8a1b1d`); but the runbook's `.env` path (`/home/ubuntu/app/.env`) is wrong — real path `/home/ubuntu/episode-metadata/.env`. Runbook also hardcodes a `100.50.2.212` canon-probe assertion that would false-fail (see open question below). **Runbook needs a correction pass before any re-run.**

## 8. Open questions for the remediation session (NOT this session)

1. **Recover the working credential.** It's in process memory (June-1 boot). Options: read `/proc/<pid>/environ` for the running process (delicate, needs care re: permissions and not echoing plaintext), or treat the working credential as unrecoverable and **rotate fresh** + update all consumers. This is an architecture/product decision, not a next command.
2. **Identify `episode-api-prod-hotfix`** before any restart planning.
3. **`inet_server_addr()` reconciliation still unresolved.** Probe failed before returning a row, so we never observed whether canon reports `100.50.2.212` or `10.0.20.224`. The "same instance, two vantages" hypothesis remains unconfirmed. Runbook's hardcoded `100.50.2.212` assertion is suspect regardless.
4. **Correct the Branch B runbook** path + assertion before re-run.

## 9. Why this is a good outcome

The broken on-disk credential would have caused a silent canon-auth outage the moment `[3]`'s restart fired — with no warning, mid-window, on the frozen prod box. Instead it surfaced in a read-only diagnostic probe with abort already correctly called. Path A working as intended: the failure mode is now mapped and parked, not discovered live during a restart.
