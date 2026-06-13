# Prime Studios Audit Handoff v20

**Authored 2026-06-13 (later same day than v19). Additive on v19, but SUPERSEDES v19 Sec 1 (Branch B premise broken — box `.env` is not a working credential copy) and v19 Sec 3 (the `$1` bug it flags is fixed; two new runbook corrections are now owed). v19/v18/v17/v16/v15/v14/v13/v12/v10 remain canonical for anything v20 does not supersede; v16 governs FD-39.**

## What changed v19 -> v20

- **Branch B was EXECUTED, not selected/parked.** It ran (after the `$1` fix) and ABORTED at the canon probe per the runbook abort table. Abort was the correct outcome.
- **v19 Sec 1's central claim is REFUTED.** The box `.env` `DB_PASSWORD` does NOT authenticate against canon as `postgres`. It is not a working copy at all, let alone "the sole live copy."
- **The working credential is process-memory-only.** Timing evidence (`.env` mtime 06-12; all three PM2 processes booted ~06-01) shows the working credential lives only in the memory of the June-1 boot. The sole *working* copy is volatile — lost on any restart.
- **`[3]` HAZARD UPGRADED.** A restart now reloads the broken on-disk `.env` and guarantees a canon-auth outage. `[3]` must NOT prime until the working credential is recovered/re-established AND the on-disk `.env` is corrected.
- **NEW unknown:** an undocumented third PM2 process `episode-api-prod-hotfix` (boot ~06-01 20:02). Identify before any `[3]` restart planning.
- Authority: `docs/audit/F-Deploy-1_Finding_BoxEnv_CredentialDrift_2026-06-13.md` (committed `56564d69`).

## Sec 0 - Session close state

- Finding FILED: `56564d69` (committed in this session line, after v19 `26b7efb7` and the Branch-B `$1`-fix `3a8a1b1d`). Source file is on main; v20 references it, does not re-commit it.
- The Branch B execution session was READ-ONLY against the box: diagnostics + SSH command exec only. No restart, no `.env` edit, no process change. SSM param `/episode/db-password-extracted-box` was created then DELETED (it held a non-working credential; removed to prevent a future session mistaking it for valid). Local plaintext cleared.
- The handoff-filing work itself (this session) is paper-only. One stray empty branch from a redundant re-file attempt was cleaned (local + remote deleted); no main or box impact.
- v19 Sec 0's branch-protection-bypass observation ("Bypassed rule violations for refs/heads/main" on the operator account, direct-to-main push) still stands as recorded; not actioned. The `56564d69` finding push followed the same direct-to-main pattern.

## Sec 1 - SUPERSEDES v19 Sec 1: Branch B executed, on-disk credential refuted

- v19 Sec 1 framed the box `.env` as the sole live copy and Branch B as the parked remedy. Execution overtakes that framing.
- Real `.env` path corrected live to **`/home/ubuntu/episode-metadata/.env`** (runbook's assumed `/home/ubuntu/app/.env` was wrong — `test -f` returned NOTFOUND). Confirmed as the canon process's env via PM2 `pm_cwd`/`pm_exec_path` (`/home/ubuntu/episode-metadata`, `src/server.js`).
- Extract OK (38 chars, non-empty). SSM put OK. Hash verify matched (`97AAC3B0...17041FAE`) — transfer integrity clean, no quoting corruption.
- **Canon probe FAILED:** `FATAL: password authentication failed for user "postgres"`. Connection to `100.50.2.212:5432` succeeded (TLS fine, no network/SG problem) — the password was rejected.
- Benign explanations RULED OUT: `DB_USER=postgres` (correct user), `DB_HOST`/`DB_NAME` match canon (correct target), exactly one `DB_PASSWORD` line and zero `DATABASE_URL` references (correct field, no connection-string path missed). What remains: the on-disk `DB_PASSWORD` itself does not authenticate.
- **Timing evidence:** `.env` mtime `2026-06-12 15:09:44`; `episode-api` boot ~06-01 05:12, `episode-worker` ~05-31 01:32, `episode-api-prod-hotfix` ~06-01 20:02. The `.env` was edited 11+ days AFTER every process started. The running app loaded its working credential into memory at the June-1 boot and never restarted; the June-12 on-disk edit (consistent with the 06-10 rotation + broken off-box sync writing something to disk) does not authenticate.
- **NET: the working canon credential is NOT on disk anywhere found — it is process-memory-only.** Materially worse than v19's "sole live copy": the sole *working* copy is lost on any process restart.
- Authority: finding `56564d69`.

## Sec 2 - Canon IP vantage / inet_server_addr: STILL UNRECONCILED (this run did not close it)

- v19 Sec 2 carries forward UNCHANGED. The Branch B run did NOT resolve it: the probe failed at auth before returning a row, so live `inet_server_addr()` was never observed. The same-instance-two-vantages hypothesis remains unconfirmed.
- Remains a `[3]` Step-0 prerequisite: read the actual `inet_server_addr()` return at `[3]` prime; same-instance-two-vantages = benign, proceed; genuine target mismatch = ABORT-class.
- The runbook's hardcoded `100.50.2.212` canon-probe assertion is now suspect regardless (see Sec 3).

## Sec 3 - SUPERSEDES/extends v19 Sec 3: pre-check 2 bug fixed; two NEW runbook corrections owed

- v19 Sec 3's pre-check 2 `awk '{print $1}'` PowerShell `$1`-expansion bug is **FIXED and pushed (`3a8a1b1d`)**.
- TWO new runbook corrections surfaced during execution, owed before any re-run:
  1. **`.env` path is wrong.** Runbook assumes `/home/ubuntu/app/.env`; real path is `/home/ubuntu/episode-metadata/.env`.
  2. **Hardcoded `100.50.2.212` canon-probe assertion would false-fail** (Sec 2 unreconciled). Soften to diagnostic capture; do not assert the IP.
- Runbook needs a correction pass before any Branch B re-run. NOT done this session (deferred; carried in finding Sec 8).

## Sec 4 - First steps for next session (REVISES v19 Sec 4)

- **The next step is no longer "Branch B to get a durable credential."** Branch B ran and proved the on-disk credential is broken. The next step is the **credential recovery vs fresh-rotate decision** (architecture/product call; finding Sec 8 Q1): either recover the in-memory working credential from a running process (`/proc/<pid>/environ` — delicate: permissions, do not echo plaintext), or treat it as unrecoverable and rotate fresh + update all consumers.
- **`[3]` is hazard-UPGRADED and must NOT prime** until (a) the working credential is recovered/re-established AND (b) the on-disk `.env` is corrected to a known-good value. Restarting first = guaranteed canon-auth outage (proven by the diagnostic probe, not hypothetical).
- **Identify `episode-api-prod-hotfix`** (undocumented third PM2 process, boot ~06-01 20:02) before any `[3]` restart planning. The "prod-hotfix" name suggests an out-of-band patch process; load-bearing status, what it serves, and its relation to `episode-api` are unknown. May intersect `#752` AK-3/AK-4 PM2-naming work.
- **Correct the Branch B runbook** (Sec 3) before any re-run.
- Carry-forward open (from v19 Sec 4, unchanged): `#752` parked-not-killed under path (a); G2 Sec 4.2 memory gate (dev PM2 empty-list — never-started vs interrupted still undistinguished); S4.2-B/C disposition; AJ canary / target-health alarm (post-`[3]`); `-prod` teardown (post-cutover); `world_events` migration `20260807000000` (do-not-run until cutover); Episode 1 replacement TBD. Plus the standing `[3]` Step-0 items: fresh FD-31/FD-38 abort re-verify (untrusted from all prior) + the Sec 2 `inet_server_addr()` reconcile.

---
*Prime Studios Audit Handoff v20. Authored 2026-06-13. Additive on v19; SUPERSEDES v19 Sec 1 and Sec 3. Headline: Branch B was executed and aborted at the canon probe - the box `.env` `DB_PASSWORD` FAILS `postgres` auth against canon, refuting v19's "sole live copy" framing. Timing evidence (`.env` edited 06-12; all processes booted ~06-01) shows the working credential is process-memory-only and lost on any restart. `[3]` hazard UPGRADED: a restart now reloads the broken on-disk value and guarantees a canon-auth outage; `[3]` must not prime until the working credential is recovered/re-established AND the on-disk `.env` is corrected. New unknown: undocumented third PM2 process `episode-api-prod-hotfix` - identify before `[3]`. Branch B runbook `$1` bug fixed (`3a8a1b1d`); two new corrections (wrong `.env` path, suspect `100.50.2.212` assertion) owed before re-run. Authority: finding `56564d69`. `[3]` still not primed. v16 governs FD-39.*
