# F-Deploy-1 Phase 2A Step 1 Parity Abort (DRAFT)

> **SESSION NOTE ONLY. AUTHORIZES NO PROD-BOX ACTION.**
> This records a clean pre-write abort at the Phase 2A parity gate.

| | |
|---|---|
| Session date | 2026-06-17 |
| Scope | [3] Session B execution entry, Phase 2A step 1 parity confirm |
| Outcome | **CLEAN PRE-WRITE ABORT** |
| Box touched | Yes, read-only SSH probe only |
| Box mutation | **No** |
| Canon mutation | **No** |

---

## What Ran (Read-Only)

Phase 2A step 1 parity probe was run on the live prod box (`54.163.229.144`) to compare runtime tuple against pinned build tuple:

```
uname -m
ldd --version | head -1
node --version
npm --version
```

Host identity confirmation from same probe:

- Hostname: `ip-172-31-26-1`
- OS: Ubuntu 22.04.5 LTS

First probe attempt executed in workstation PowerShell (no SSH wrapper) and returned Windows command-not-found for `uname`/`ldd` plus workstation Node `v22.22.0` / npm `10.9.4` - a null read from the wrong host. Re-run wrapped in a single SSH invocation with hostname/OS self-identification; values below are from the box.

This confirmed probe execution on the target box, not workstation.

---

## Comparator Result

| Dimension | Pinned target | Live box | Tier | Result |
|---|---|---|---|---|
| arch | x86_64 | x86_64 | HIGH | PASS |
| libc | glibc 2.35 | glibc 2.35 (2.35-0ubuntu3.13) | HIGH | PASS |
| Node | v20.20.2 | **v20.20.1** | MEDIUM | **FAIL** |
| npm | 10.8.2 | 10.8.2 | MEDIUM | PASS |

Gate rule for Phase 2A step 1 is match-all-four. This session observed a real mismatch on the MEDIUM Node dimension.

---

## Decision Applied

Per runbook Step 1 mismatch path: **CLEAN PRE-WRITE ABORT**.

- Do not proceed to step 2 disk precheck.
- Do not proceed to any additive mutation (step 3+).
- Keep box frozen.

Abort is treated as valid success condition for this gate: mismatch was caught before any write path.

---

## Safety/State Assertions at Abort

- Box bytes written: none.
- Canon DB writes: none.
- Repo mutation from execution path: none.
- Only box contact this session: read-only probe commands.

---

## Open Decision (Required Before Next Attempt)

Re-pin direction for off-box rebuild:

1. Re-pin build Node **down to v20.20.1** to match live target box (preferred by rebuild-at-priming policy).
2. Upgrade box Node to v20.20.2 (not preferred; introduces new box-mutation risk class and is outside this session scope).

This draft records no unilateral choice. Next attempt opens after explicit re-pin decision and off-box rebuild.

---

## Next Attempt Entry Conditions

Before re-opening Phase 2A:

1. Off-box artifact rebuilt against confirmed Node pin.
2. Fresh session-open parity check re-run (step 1) from top.
3. Surface unresolved prerequisites G2A-1 and G2A-2 before first mutation step.

Until then, no Phase 2A mutation has occurred. The next attempt is a fresh window-open (Phase 1 re-verify + Phase 2A step 1 from top), not a resumption of this session.

