# F-Deploy-1 - Canon Credential Exposure Finding

**Date:** 2026-06-14  
**Status:** DRAFT - handoff record, this session is documentation-only  
**Author context:** Filed during the put-parameter verification session  
**Supersedes:** Nothing. Additive finding-and-decision record.

---

## HARD CONSTRAINTS (keep verbatim)

1. The exposed credential value MUST NOT appear in any committed artifact. This document records THAT a cleartext value rendered; it never records WHAT it was.
2. This session is handoff-only. No rotation, no gate-close performed here.
3. Rotation plus gate-close occurs ONLY in a fresh dedicated session.

---

## 1. Finding

During the put-parameter verification session (2026-06-14), the canon database credential rendered in cleartext in this session's terminal output. The exposure occurred during a wholesale `source` of the box `.env` file (`set -a; source /home/ubuntu/episode-metadata/.env; set +a`), where a parse error on the file caused a credential line to surface in error output.

Classification: CONFIRMED EXPOSED (direct scrollback observation; a cleartext value appeared in the parse-error line, not merely possibly exposed).

Decision: the canon DB credential is treated as COMPROMISED and must be rotated.

## 2. Causal chain

- The drafted verification method was in-memory-only field extraction (grep specific keys, never source the whole file). That method was sound.
- The exposure came from a deviation to wholesale `source` of `.env` while debugging psql shell-quoting failures across several probe attempts.
- Root cause: method drift under debugging pressure, not a flaw in the drafted procedure. The discipline worked at the reporting stage (deviation was caught and self-reported); it failed at execution stage under iteration pressure.

## 3. put-parameter gate state - two orthogonal states

**Mechanism state: VERIFIED PASS.**

- SSM SecureString version 1 is byte-equal to box `.env` DB_PASSWORD (`BYTE_EQUAL=True`, both length 38, ordinal comparison).
- Box-side endpoint probe (run in-VPC, via configured DB_HOST endpoint) returned `episode_metadata|143|10.0.20.224`, confirming the credential authenticates to canon and returns the canon discriminator (correct DB, full 143-table population, distinguishing canon from the empty fork RDS).
- Actor of the v1 write confirmed via CloudTrail: PutParameter, 2026-06-14 14:19:58 -04:00, principal `evoni-admin`, user agent `AWSPowerShell.Common/5.0.233.0`, source IP `108.216.160.136`, version 1.

**Security state: CREDENTIAL COMPROMISED - OPERATIONAL GATE REMAINS OPEN.**

- The credential the parameter backs is now compromised (Sec 1).
- Closing the gate against a compromised credential would file a stale backup-of-record.
- The operational gate remains OPEN pending rotation.
- The gate closes in the rotation session against the rotated (v2) value.

## 3A. Canon network exposure (separate from AF)

- Canon identity was re-confirmed by private endpoint discriminator (`episode_metadata|143|10.0.20.224`).
- The canon private IP (`10.0.20.224`) maps to SG `sg-002578912805d1930` in `vpc-0754967be21268e7e`.
- `sg-002578912805d1930` currently allows `tcp/5432` from `0.0.0.0/0` (alongside narrower CIDRs), and the canon RDS instance is `PubliclyAccessible=true`.
- This is a distinct live exposure path and is not the same finding as F-Deploy-G1-AF (`sg-0164d0b20fbebacbb` on the fork-side instance at `10.2.1.207`).
- Combined with the credential compromise in Sec 1, this raises acute risk posture. Rotation remains mandatory; interim SG containment is a separate decision and must be sequenced with verified box dependency checks.
- Dependency note from read-only box check: box `.env` points at the canon public endpoint host and in-box DNS currently resolves that host to public IP `100.50.2.212`; containment sequencing must account for this before removing `0.0.0.0/0`.

## 4. Decision

Rotate the canon credential in a fresh dedicated session.

Rationale (per 2026-06-12 precedent): a session carrying an emergency or complex event is not a clean starting state for the next sensitive or irreversible operation. This session contained the exposure event; it is therefore handoff-only.

## 4A. Register impact

This file is a finding-and-decision record, not a register entry. Before or with merge, carry the event into the next authoritative FD/handoff update so it cannot disappear between doc PRs and the rotation session. Until a numbered register entry exists, treat this document plus the [3] blocker pointer as the controlling record for the exposure.

## 5. Rotation-session task list (DO NOT execute here)

1. Open fresh session with full wake-up sequence (`git fetch origin`, `git log --oneline -1 origin/main`, `gh pr list --state open`).
2. Live-assemble the rotation against the actual ecosystem at execution time. Never template the rotation commands.
3. Rotate: new password on canon RDS -> write to box `.env` -> overwrite the existing SSM parameter with the rotated value (this is the legitimate overwrite creating version 2 and retiring v1 as the backup-of-record).
4. Evidence capture: record CloudTrail version increment from v1 to v2 after overwrite as explicit attestation that the write landed.
5. Re-verify against v2: rerun the same byte-equality plus box-side endpoint probe chain proven to work this session, now against the rotated value.
6. Close the put-parameter gate against v2 (mechanism + security both green).
7. Post-rotation hygiene:
   - clear exposed value from local terminal scrollback and buffer;
   - confirm no raw terminal capture from the exposure session persists on disk.

## 6. Hard constraint (restated)

The exposed credential value appears in NO committed artifact. This document records that exposure occurred and how; it never records the value.

## 7. [3] impact

[3] moves further out, not closer. The [3] production-restart window cannot open until rotation completes AND the put-parameter gate closes against the rotated credential. A fresh Phase 1 abort re-verify still applies at [3]-window open, independent of this finding.

## 8. Promotion note

This file currently carries `_DRAFT` in its filename. If and when it is promoted/renamed, update all inbound references in the same PR, including the blocker pointer in `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md`, so the [3] entrypoint cannot drift into a dead link.