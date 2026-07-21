# F-Deploy-1 Fix Plan v1.45

**s7.3 CLOSED CLEAN 2026-07-21: all seven burn-in close criteria
adjudicated SATISFIED with full-window kernel evidence for criterion 2.
The corrected OOM read reaches back to the Jul 14 13:05:25 boot line in
both dmesg and journal streams, shows zero-match counts with guarded
EXIT:1 semantics, and reports 593 kernel lines of depth for the window.
The first OOM read is now formally voided under FD-51 form (guard was
placed behind tail, so exit 0 certified tail-not-empty, not OOM-not-found).
Result: s4.4 CLOSED CLEAN and s7.3 CLOSED CLEAN together satisfy the
remaining gate to s4.5. Ruling: s4.5 UNBLOCKED as next executable step,
with s4.5.2 explicitly retained as a prod-box write requiring full Rule 7
ceremony in its own cold session. Mints no FD. Register tail: FD-61 at
open, FD-61 at close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.44 (bd976629, #941; s4.4 close, root PM2 daemon kill ratified). |
| **Author date** | 2026-07-21 |
| **Gate effect** | s7.3 CLOSED CLEAN. s4.5 unblocked. No s4.5 execution authorized by this revision. |

**Basis (live artifacts, this session):** burn-in log at
`docs/audit/F-Deploy-1_BurnIn_Log_2026-07-14_to_21.md` (main at cd2e2df7, #940); SSM
`e7b54321-2957-426e-b029-9a4d454b89e2` (`ssm_73_result.json`);
corrected full-window OOM read SSM
`31923f2d-974c-4942-b313-9a2e9696dc27` (`ssm_oom2_result.json`) using
payload `ssm_oom2.json`.

## s1 s7.3 scorecard -- seven of seven

| # | Criterion (§7.3) | Verdict | Basis |
|---|---|---|---|
| 1 | Memory peak <= synthetic +10% (~1233 MiB) | **SATISFIED** | SSM `e7b54321`: VmHWM 159896 kB / 171476 kB (= ~156 MiB / ~167 MiB), far below threshold; no post-heal growth signal. |
| 2 | No OOM events | **SATISFIED** | SSM `31923f2d`: dmesg and journal both start at Jul 14 13:05:25 boot line; grep counts both `0` with explicit guarded `EXIT:1`; kernel span depth `593` lines (`KLINES_EXIT:0`). Full-window zero OOM, kernel-attested. |
| 3 | No restarts beyond deploys | **SATISFIED** | Burn-in day-7 cumulative counters: restart_time frozen at 1/1 all week; uptime continuous since pre-deploy boot. |
| 4 | Prod unchanged vs pre-G2 variance | **SATISFIED** | Burn-in day-7 close: 72h backfill dead flat plateau (~0.53-0.56%), micro-drift watch retired benign. |
| 5 | Zero F-Deploy-G1-Y recurrences | **SATISFIED** | Burn-in log daily sweeps and day-7 aggregate: zero all seven days. |
| 6 | Zero targeting drift | **SATISFIED** | Burn-in day-7 close: deploy targeting frozen at run 29359414179 across the window. |
| 7 | Zero unplanned escalations or PE filings vs G2 execution | **SATISFIED (with notes)** | One day-1 jlist P1 classed tooling-side observation disclosure (not a box finding), contained and ledgered; ride-along disclosures carried explicitly, including the execution-disclosure comment filed on PR #941 (no hidden residue). |

**Ruling:** s7.3 CLOSED CLEAN.

## s2 Criterion 1 and 2 evidentiary correction

Criterion 1 and criterion 2 now rest on a two-read chain with explicit
defect accounting:

1. **First read (SSM `e7b54321`) remains valid for VmHWM (criterion 1)**
   and invalid for criterion 2 close because the OOM/journal grep exit
   was echoed after `tail -5`; the reported `0` can only certify
   non-empty tail output, not grep-match truth.
2. **Defect class:** guard placement error (tooling-side, not box-side).
   This is an FD-51 form violation: empty/non-empty textual output is not
   evidence unless the right command's exit code is captured.
3. **Corrected read (SSM `31923f2d`)** places the guard immediately after
   each grep, returns count+exit together, and adds a depth read
   (`journalctl -k ... | wc -l`) to prove window coverage.

The first read's apparent contradiction is therefore resolved without
changing the box facts: exit 0 belonged to tail, not grep. The corrected
read certifies criterion 2 with full-window depth.

## s3 Criterion 7 defensibility notes

Criterion 7 is closed with explicit notes, argued not assumed:

- The day-1 jlist disclosure is a measurement-path tooling miss, not a
  runtime instability or infrastructure escalation on either box.
- The one in-window ride-along (the v1.44-ratified root-PM2 kill,
  dispatched before the ratifying revision merged) was disclosed same-day
  in a comment on PR #941 with post-kill verification evidence; outcome verified clean, serving tree untouched.
- One duplicate-dispatch artifact is disclosed as procedural noise only;
  it changed no box state and opened no PE line.

These notes preserve strict accounting without diluting the criterion's
intent (no unplanned escalations against G2 execution).

## s4 Gate consequence and distance to G2 close

With s4.4 and s7.3 both closed clean:

- **s4.5 is now UNBLOCKED** (next executable step per G2 implementation
  close criterion chain, item 5).
- **No s4.5 action is taken in this revision.**

Distance statement against G2 close (§8 in
`F-Deploy-1_PhaseB_G2_Implementation_v1.4.md`):

- Items 1-4: satisfied.
- Remaining execution items: **§4.5.1** (repo ecosystem config),
  **§4.5.2** (shared-box PM2 retirement; prod-box write, full Rule 7,
  separate cold session), item 7 verification, and item 8 close note.

## s5 Register hygiene

- Mints no FD. Tail: FD-61 at open, FD-61 at close.
- Closes no new findings; this is gate adjudication and consequence
  routing.
- Carries no production write authority by itself.
- FD-21 check: no closing-keyword side effects.

---

*End of F-Deploy-1 Fix Plan v1.45.*
*Drafted by an IDE agent from this session's stated posture; certified*
*line-by-line and corrected (C1-C5) by the shipping session. Author of*
*record: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-21. Predecessor: v1.44.*
*Closed: s7.3 (clean). Minted: none. Tail: FD-61. [skip-automerge]*
