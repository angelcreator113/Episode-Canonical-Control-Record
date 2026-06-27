# Prime Studios Audit Handoff v19

**Authored 2026-06-13. Additive on v18. v18/v17/v16/v15/v14/v13/v12/v10 remain canonical for anything v19 does not supersede; v16 governs FD-39.**

## Sec 0 - Session close state

- v18 pushed to origin: observed push result `a0350c83..419a019e  main -> main`. Local and origin/main now at `419a019e`.
- Paper-trail-only session. No box mutation, no `[3]` progress, no credential write.
- Two 06-12 findings absent from v18 are folded into the tracked chain here (Sec 1, Sec 2), and their two source files committed alongside this handoff.
- Observed at push: remote reported "Bypassed rule violations for refs/heads/main" (PR-required + 3 status checks), i.e. the direct-to-main push completed past nominal branch protection on the operator account. Recorded as observed; not actioned.

## Sec 1 - Credential durability gap (folds Session Outcome 2026-06-12 into the chain)

- Canon DB credential rotated 2026-06-10 10:57; new value written to box `.env`.
- Off-box sync broke: Bitwarden holds the stale PRE-rotation value (probed, rejected). No off-box recovery path (generator history / staging / scrollback all unreachable).
- **Box `.env` is the SOLE live copy of the current post-rotation canon credential.** Single point of failure.
- Remedy = Branch B (read box `.env`, durable-store to SSM Parameter Store SecureString, verify by canon probe). SELECTED, PARKED for a dedicated fresh session (extract->put->verify wants uncoupled context; not run from a churned session by design).
- Authority: `docs/audit/F-Deploy-1_Session_Outcome_2026-06-12.md` and `docs/audit/F-Deploy-1_Branch-B_Extraction_Runbook_2026-06-12.md` (both committed with this handoff; previously untracked).

## Sec 2 - Canon IP vantage finding (NEW this session) - [3] Step-0 prerequisite

- `episode-control-dev` confirmed CANON: `vpc-0754967be21268e7e`, AZ us-east-1b, `PubliclyAccessible=True`.
- Box DNS read resolved the canon FQDN to `100.50.2.212`. Runbook pre-check 2 expectation matches this resolve.
- The `[3]` Step-0 comparator carries `inet_server_addr()` = `10.0.20.224` (v17 Sec 2, carried from v15).
- **UNRECONCILED.** Working hypothesis is the same instance from two vantages, but actual live `inet_server_addr()` was NOT read this session.
- **Logged as a `[3]` Step-0 prerequisite:** at `[3]` prime, read the actual `inet_server_addr()` return. Same-instance-two-vantages = benign, proceed. Genuine target mismatch = ABORT-class. Do NOT hand-wave this from a doc; the Step-0 gate guards a prod restart with snapshot-restore as net.

## Sec 3 - Branch B runbook bug (fix before next-session execution)

- Pre-check 2 has a PowerShell escaping bug: `awk '{print $1}'` inside a double-quoted SSH string -> PowerShell consumes `$1`, the remote command stops extracting field 1, and `$resolved_ip` captures the whole `getent hosts` line. The equality check then falsely fails on a correct resolve, triggering a false abort.
- Fix: escape as `` `$1 `` or single-quote the awk block. The IP expectation (`100.50.2.212`) is itself confirmed correct (Sec 2).
- The Step-4 canon probe escaping (`` `$PW ``) is correct; only pre-check 2 is affected.

## Sec 4 - First steps for next session

- **Branch B, fresh dedicated session:** fix Sec 3 bug FIRST, then runbook pre-checks as Step 0 (abort on any fail), uninterrupted extract->put->hash->canon-probe, canon probe as SOLE correctness gate. Record hash + probe timestamp for audit trail.
- `[3]` remains PARKED behind a durable canon credential. On prime: fresh FD-31/FD-38 abort re-verify (untrusted from all prior) PLUS the Sec 2 `inet_server_addr()` reconcile as an added Step-0 item.
- Carry-forward open: `#752` parked-not-killed under path (a); G2 Sec 4.2 memory gate (dev PM2 empty-list per v18 Sec 2 - never-started vs interrupted still undistinguished); S4.2-B/C disposition; AJ canary / target-health alarm (post-`[3]`); `-prod` teardown (post-cutover); `world_events` migration `20260807000000` (do-not-run until cutover); Episode 1 replacement TBD.

---
*Prime Studios Audit Handoff v19. Authored 2026-06-13. Additive on v18. Headline: paper-trail-only session - v18 pushed (`a0350c83->419a019e`), and two 06-12 findings v18 was silent on are folded into the tracked chain: (1) canon credential durability gap - box `.env` is sole live copy after Bitwarden sync broke, Branch B selected/parked for fresh session; (2) canon IP vantage finding - box resolves canon to public `100.50.2.212`, `[3]` Step-0 carries private `10.0.20.224`, UNRECONCILED and logged as a `[3]` Step-0 prerequisite. Branch B runbook pre-check 2 has a PowerShell `$1` escaping bug to fix before execution. Both source docs committed with this handoff (were untracked). `[3]` still not primed. v16 governs FD-39.*