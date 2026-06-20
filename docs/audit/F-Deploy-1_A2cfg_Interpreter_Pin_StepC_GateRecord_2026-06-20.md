# F-Deploy-1 / A2-cfg Interpreter Pin -- Step C Verification Gate Record

**Date:** 2026-06-20 10:27 UTC
**Box:** i-02ae7608c531db485 (prod, private IP 172.31.26.1)
**Identity proof:** IMDS instance-id confirmed i-02ae7608c531db485 at session start
**Capture:** single-run, on-box, verbatim
**Additive on:** F-Deploy-1_A2cfg_Interpreter_Pin_GateRecord_2026-06-19.md (Step A/B backup + edit record)

## Disposition

**PASS (5/5).** The A2-cfg ecosystem.config.js interpreter pin is correct on disk and verified.

## Checks

| Check | Result | Evidence |
|---|---|---|
| C1 diff vs backup | PASS | 4 hunks, each interpreter: 'node' -> '/usr/bin/node'; entries episode-api, episode-worker, episode-api-dev, episode-worker-dev; no other lines changed |
| C2 ABS_COUNT (/usr/bin/node) | PASS | 4 (lines 72, 103, 130, 152) |
| C2 BARE_COUNT ('node') | PASS | 0 |
| C3 node --check | PASS | SYNTAX_OK |
| C4 working SHA != backup SHA | PASS | differ (see below) |

## SHA-256

- working ecosystem.config.js = 2348071c4c84ef0e3a49892fde75f9dc785d52cfbb0da037f1154f90222d42da
- backup ecosystem.config.js.bak-20260619-a2cfg = 165b5b51d4230e0b6ba8c69ea729eff6c6cc15042dd63af31c4f9d1ceb7f9588

Backup SHA prefix 165b5b51 matches the value recorded at backup creation in the 2026-06-19 session record. Backup untampered between sessions.

## Corroboration

- Byte-delta cross-check: backup 6205 B -> working 6241 B = +36 B = 4 x len("/usr/bin/"). Independently consistent with exactly four /usr/bin/-prefix insertions and no other change.
- Echo-gap caveat: interactive input-echo dropped two header lines in capture; output confirms both executed (SYNTAX_OK is &&-guarded behind node --check, so prints only on exit 0).

## Scope and effect

- This session: read-only verification only (diff / grep / node --check / sha256sum). No mutation. Rule 7: no shared-state change on box.
- The edit itself was made and saved in the 2026-06-19 session; Step C was the outstanding verification.
- The pin is correct ON DISK but NOT YET APPLIED to running processes. Application is the PM2 restart, which occurs in step [3].
- Record working SHA 2348071c... as the [3]-entry verified-config SHA.

## Does NOT prime [3]

[3] (combined prod-restart window) remains its own deliberate cold session. This record closes the on-disk A2-cfg edit thread only. It does not resolve the runtime three-way node-path discrepancy; confirming the running processes pick up /usr/bin/node post-restart is [3]'s job.